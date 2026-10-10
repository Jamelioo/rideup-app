-- 019: cash payments, as an experiment (Admin › Settings › Accept cash). The rider pays the driver the fare shown
-- in the app; RideUp's share comes off the driver's balance. To keep cash trips safe for drivers, cash needs a real
-- account (not a guest) with a mobile number, and it's turned off for anyone who doesn't pay or keeps no-showing
-- (and for their other accounts on the same phone or card). Drivers choose whether they take cash trips. For every
-- rider, card or cash: after 3 cancellations in an hour, booking pauses for a while. Safe to re-run.
--   rides.payment_status for cash: 'cash_due' (driver on the way) → 'cash_collected' at drop-off, or 'cash_unpaid'
--   when the driver reports the rider didn't pay.

insert into public.app_settings (key, value) values ('accept_cash', 'true'::jsonb) on conflict (key) do nothing;

alter table public.rides add column if not exists payment_method text not null default 'card';
do $$ begin
  alter table public.rides add constraint rides_payment_method_check check (payment_method in ('card', 'cash'));
exception when duplicate_object then null;
end $$;

alter table public.riders add column if not exists cash_blocked boolean not null default false;
alter table public.riders add column if not exists cash_blocked_reason text;
alter table public.riders add column if not exists cash_blocked_at timestamptz;

-- Like Uber, each driver chooses whether they get cash trips (Profile › Cash trips).
alter table public.drivers add column if not exists accept_cash boolean not null default true;

-- A driver payout can now also be cash the driver hands over to RideUp (a negative amount).
alter table public.driver_payouts drop constraint if exists driver_payouts_amount_cents_check;
alter table public.driver_payouts add constraint driver_payouts_amount_cents_check check (amount_cents <> 0);

-- Riders can't turn cash back on for themselves. Same as 013 plus the cash fields.
create or replace function public.guard_riders()
returns trigger language plpgsql as $$
begin
  if public.is_trusted_caller() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.stripe_customer_id := null;
    new.payment_method_id := null;
    new.card_brand := null;
    new.card_last4 := null;
    new.card_fingerprint := null;
    new.rating := 5.0;
    new.total_rides := 0;
    new.suspended := false;
    new.referred_by := null;
    new.credit_cents := 0;
    new.referral_rewarded := false;
    new.acquisition := null;
    new.acquired_at := null;
    new.cash_blocked := false;
    new.cash_blocked_reason := null;
    new.cash_blocked_at := null;
    return new;
  end if;
  new.stripe_customer_id := old.stripe_customer_id;
  new.payment_method_id := old.payment_method_id;
  new.card_brand := old.card_brand;
  new.card_last4 := old.card_last4;
  new.card_fingerprint := old.card_fingerprint;
  new.rating := old.rating;
  new.total_rides := old.total_rides;
  new.suspended := old.suspended;
  new.referral_code := old.referral_code;
  new.referred_by := old.referred_by;
  new.credit_cents := old.credit_cents;
  new.referral_rewarded := old.referral_rewarded;
  new.acquisition := old.acquisition;
  new.acquired_at := old.acquired_at;
  new.cash_blocked := old.cash_blocked;
  new.cash_blocked_reason := old.cash_blocked_reason;
  new.cash_blocked_at := old.cash_blocked_at;
  return new;
end $$;

-- Booking guard: same as 014, plus who may pay cash, and a pause for riders who keep booking and cancelling.
create or replace function public.guard_rides_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a numeric;
  straight numeric;
  base int; per_mile int; per_min int; minimum int;
  requested_code text := nullif(upper(btrim(coalesce(new.promo_code, ''))), '');
  r public.riders;
  discount int := 0;
  credit int := 0;
  quoted_surge numeric := coalesce(new.surge_multiplier, 1.00);
  surge numeric;
  has_stop boolean := new.stop_lat is not null and new.stop_lng is not null;
  resume_at timestamptz;
  wait_min int;
begin
  -- These apply to everyone, including the scheduled-ride dispatcher.
  if exists (select 1 from riders where id = new.rider_id and coalesce(suspended, false)) then
    raise exception 'This account is suspended. Please contact support.' using errcode = '42501';
  end if;
  if exists (select 1 from rides
              where rider_id = new.rider_id
                and status in ('requested', 'pending_driver_response', 'accepted', 'driver_arrived', 'in_progress')) then
    raise exception 'You already have a ride in progress.' using errcode = '23505';
  end if;

  if public.is_trusted_caller() then
    return new;
  end if;

  if public.setting_enabled('require_verified_phone')
     and not exists (select 1 from auth.users where id = auth.uid() and phone_confirmed_at is not null) then
    raise exception 'Please verify your phone number before requesting a ride.' using errcode = '42501';
  end if;

  select * into r from riders where id = new.rider_id;

  -- Booking and cancelling over and over alerts drivers for nothing: after 3 cancellations in an hour, booking
  -- pauses until the oldest of them is an hour old. A search that ran out because nobody accepted doesn't count.
  select x.cancelled_at + interval '1 hour' into resume_at
    from rides x
   where x.rider_id = new.rider_id and x.status = 'cancelled' and x.cancelled_by = 'rider'
     and x.cancelled_at > now() - interval '1 hour'
     and not (x.cancel_reason = 'no_drivers' and x.cancelled_at >= x.created_at + interval '80 seconds')
   order by x.cancelled_at desc
   offset 2 limit 1;
  if resume_at is not null then
    wait_min := greatest(1, ceil(extract(epoch from resume_at - now()) / 60))::int;
    raise exception 'You''ve cancelled a few rides in the last hour. You can book again in % %.',
      wait_min, case when wait_min = 1 then 'minute' else 'minutes' end
      using errcode = '22023', hint = 'cooldown';
  end if;

  -- Cash: a real account (guests sign up first) with a mobile number, for the rider's own ride (the passenger
  -- didn't agree to pay), not turned off for this person or for their other accounts on the same phone or card.
  new.payment_method := case when new.payment_method = 'cash' then 'cash' else 'card' end;
  if new.payment_method = 'cash' then
    if not public.setting_enabled('accept_cash') then
      raise exception 'Cash isn''t available right now. Please pay by card.' using errcode = '22023', hint = 'cash';
    end if;
    if coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
      raise exception 'Sign up to pay with cash. It takes a minute and keeps cash trips safe for drivers.' using errcode = '22023', hint = 'cash';
    end if;
    if nullif(btrim(coalesce(new.passenger_name, '')), '') is not null or nullif(btrim(coalesce(new.passenger_phone, '')), '') is not null then
      raise exception 'Cash is for your own rides. When you book for someone else, pay by card.' using errcode = '22023', hint = 'cash';
    end if;
    if length(coalesce(public.phone_key(r.phone), '')) < 7 then
      raise exception 'Add your mobile number to pay with cash.' using errcode = '22023', hint = 'cash';
    end if;
    if r.cash_blocked or exists (select 1 from riders o where o.cash_blocked and o.id in (select public.rider_lookalikes(r.id))) then
      raise exception 'Cash isn''t available on your account. Please pay by card.' using errcode = '22023', hint = 'cash';
    end if;
  end if;

  if new.vehicle_type = 'xl' and not public.setting_enabled('offer_xl') then
    raise exception 'RideUp XL isn''t available yet. Please choose RideUp Go.' using errcode = '22023';
  end if;

  if new.vehicle_type = 'premium' and not public.setting_enabled('offer_premium') then
    raise exception 'RideUp Premium isn''t available yet. Please choose another ride type.' using errcode = '22023';
  end if;

  if new.pickup_lat is null or new.pickup_lng is null
     or new.dropoff_lat is null or new.dropoff_lng is null then
    raise exception 'Pickup and dropoff coordinates are required' using errcode = '22023';
  end if;

  new.status := 'requested';
  new.driver_id := null;
  new.declined_by := '{}';
  new.accepted_at := null;
  new.arrived_at := null;
  new.started_at := null;
  new.completed_at := null;
  new.cancelled_at := null;
  new.cancel_reason := null;
  new.cancelled_by := null;
  new.cancel_fee_cents := 0;
  new.promo_code := null;
  new.promo_discount_cents := 0;
  new.payment_intent_id := null;
  new.payment_status := null;
  new.paid_at := null;
  new.payment_session_id := null;
  new.rider_rating := null;
  new.rider_feedback := null;
  new.rider_compliments := null;
  new.driver_rating := null;
  new.driver_feedback := null;
  new.share_token := null;
  new.tip_cents := 0;
  new.tip_payment_intent_id := null;
  new.driver_lat := null;
  new.driver_lng := null;
  new.driver_location_at := null;
  new.replaced_by_ride_id := null;
  new.booking_fee_cents := 0;
  new.airport_fee_cents := 0;
  new.credit_applied_cents := 0;
  new.surge_multiplier := 1.00;
  new.stop_reached_at := null;
  if not has_stop then
    new.stop_address := null; new.stop_lat := null; new.stop_lng := null;
  elsif nullif(btrim(coalesce(new.stop_address, '')), '') is null then
    raise exception 'The stop needs an address' using errcode = '22023';
  end if;

  if new.vehicle_type is null or new.vehicle_type not in ('standard', 'xl', 'premium') then
    new.vehicle_type := 'standard';
  end if;

  -- Never shorter than the straight line (through the stop, if there is one).
  if has_stop then
    straight := public.miles_between(new.pickup_lat, new.pickup_lng, new.stop_lat, new.stop_lng)
              + public.miles_between(new.stop_lat, new.stop_lng, new.dropoff_lat, new.dropoff_lng);
  else
    straight := public.miles_between(new.pickup_lat, new.pickup_lng, new.dropoff_lat, new.dropoff_lng);
  end if;
  new.distance_miles := round(greatest(coalesce(new.distance_miles, 0), straight), 2);
  -- Never priced faster than 30 mph on average (2 minutes per mile), plus 3 minutes for a stop.
  new.duration_minutes := round(greatest(coalesce(new.duration_minutes, 0),
                                         new.distance_miles * 2 + case when has_stop then 3 else 0 end), 2);

  -- Busy-time pricing. The rider confirmed a price; if it got busier since, ask them to confirm the new one.
  surge := public.surge_multiplier_at(new.pickup_lat, new.pickup_lng);
  if surge > quoted_surge + 0.001 then
    raise exception 'It just got busier, so prices went up a little. Check the new price and confirm again.'
      using errcode = '22023', hint = 'surge';
  end if;
  new.surge_multiplier := surge;

  -- Must match RATES in src/lib/pricing.js
  if new.vehicle_type = 'xl' then
    base := 450; per_mile := 230; per_min := 30; minimum := 1500;
  elsif new.vehicle_type = 'premium' then
    base := 700; per_mile := 320; per_min := 40; minimum := 2000;
  else
    base := 200; per_mile := 125; per_min := 35; minimum := 1000;
  end if;

  -- Upfront price = max(trip, minimum) × busy-time multiplier + booking fee (kept by RideUp).
  -- Must match calculateFare in src/lib/pricing.js.
  new.booking_fee_cents := 250;
  new.fare_cents := round(greatest(
    round(base + new.distance_miles * per_mile + new.duration_minutes * per_min)::int,
    minimum
  ) * surge)::int + new.booking_fee_cents;

  -- Airport pickup fee (LPIA), part of the fare so the driver keeps their share of it.
  new.airport_fee_cents := case when public.is_airport_pickup(new.pickup_lat, new.pickup_lng) then 300 else 0 end;
  new.fare_cents := new.fare_cents + new.airport_fee_cents;

  -- Discounts are paid by RideUp: the driver is still paid on the full fare. The rider always pays at least $1.
  if requested_code is not null then
    discount := public.promo_discount_for(new.rider_id, requested_code);
    new.promo_code := requested_code;
  elsif r.referred_by is not null and not public.rider_has_completed_ride(new.rider_id) then
    discount := 500; -- referral: $5 off the first ride
    new.promo_code := 'REFERRAL';
  end if;
  discount := greatest(0, least(discount, new.fare_cents - 100));
  new.promo_discount_cents := discount;
  if discount = 0 then new.promo_code := null; end if;
  credit := greatest(0, least(coalesce(r.credit_cents, 0), new.fare_cents - discount - 100));
  new.credit_applied_cents := credit;
  return new;
end $$;

-- Cash trips the rider didn't show up for, or cancelled late (over 2 minutes after a driver accepted, when a card
-- rider would pay a fee): two in 30 days turns cash off for the account. They can still pay by card, and an admin
-- can turn cash back on (Admin › Users). A rider who doesn't pay is turned off at once by the driver's report.
create or replace function public.cash_strike()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.payment_method <> 'cash' or new.status <> 'cancelled' or old.status = 'cancelled' then
    return null;
  end if;
  if not (new.cancel_reason = 'rider_no_show'
          or (new.cancel_reason = 'rider_cancelled' and new.accepted_at is not null
              and new.cancelled_at > new.accepted_at + interval '2 minutes')) then
    return null;
  end if;
  if (select count(*) from rides x
       where x.rider_id = new.rider_id and x.payment_method = 'cash' and x.status = 'cancelled'
         and x.cancelled_at > now() - interval '30 days'
         and (x.cancel_reason = 'rider_no_show'
              or (x.cancel_reason = 'rider_cancelled' and x.accepted_at is not null
                  and x.cancelled_at > x.accepted_at + interval '2 minutes'))) >= 2 then
    perform set_config('app.trusted', '1', true);
    update riders set cash_blocked = true, cash_blocked_reason = 'no_shows', cash_blocked_at = now()
     where id = new.rider_id and not cash_blocked;
    perform set_config('app.trusted', '', true);
  end if;
  return null;
end $$;
drop trigger if exists rides_cash_strike on public.rides;
create trigger rides_cash_strike after update of status on public.rides
  for each row execute function public.cash_strike();

-- Drivers' request list: same as 018, plus whether it's a cash trip and how much cash to collect. Cash trips
-- only go to drivers who take cash.
drop function if exists public.open_ride_requests(double precision, double precision, numeric);
create function public.open_ride_requests(
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_miles numeric default 10
)
returns table (
  id uuid, created_at timestamptz, vehicle_type text,
  pickup_address text, pickup_lat double precision, pickup_lng double precision,
  dropoff_address text, distance_miles numeric, duration_minutes numeric,
  fare_cents integer, driver_payout_cents integer,
  rider_first_name text, rider_rating numeric, pickup_distance_miles numeric,
  payment_method text, cash_due_cents integer
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  d public.drivers;
begin
  select * into d from drivers where auth_user_id = auth.uid() and approved = true;
  if not found then
    raise exception 'Not an approved driver' using errcode = '42501';
  end if;
  -- The sweeper takes drivers offline when their app stops checking in (closed or asleep).
  if d.status not in ('online', 'on_trip') then
    raise exception 'You are offline' using errcode = 'P0001', hint = 'offline';
  end if;
  -- Heartbeat: polling means the app is open. Written at most every 30 seconds, with an approximate
  -- position so new requests can be pushed to nearby drivers only.
  update drivers
     set last_seen_at = now(),
         last_lat = coalesce(round(p_lat::numeric, 3)::double precision, last_lat),
         last_lng = coalesce(round(p_lng::numeric, 3)::double precision, last_lng)
   where id = d.id and (last_seen_at is null or last_seen_at < now() - interval '30 seconds');

  return query
  select * from (
    select r.id as id, r.created_at as created_at, r.vehicle_type as vehicle_type,
           public.approx_address(r.pickup_address, 'street') as pickup_address,
           round(r.pickup_lat::numeric, 3)::double precision as pickup_lat,
           round(r.pickup_lng::numeric, 3)::double precision as pickup_lng,
           public.approx_address(r.dropoff_address, 'area') as dropoff_address, r.distance_miles as distance_miles, r.duration_minutes as duration_minutes,
           r.fare_cents as fare_cents, r.driver_payout_cents as driver_payout_cents,
           split_part(coalesce(nullif(r.rider_name, ''), 'Rider'), ' ', 1) as rider_first_name,
           ri.rating as rider_rating,
           case when p_lat is null or p_lng is null then null else
             round((2 * 3958.8 * asin(least(1, sqrt(
               power(sin(radians(r.pickup_lat - p_lat) / 2), 2)
               + cos(radians(p_lat)) * cos(radians(r.pickup_lat)) * power(sin(radians(r.pickup_lng - p_lng) / 2), 2)
             ))))::numeric, 1)
           end as pickup_distance_miles,
           r.payment_method as payment_method,
           case when r.payment_method = 'cash'
                then greatest(r.fare_cents - coalesce(r.promo_discount_cents, 0) - coalesce(r.credit_applied_cents, 0), 0)
           end as cash_due_cents
      from rides r
      left join riders ri on ri.id = r.rider_id
     where r.status = 'requested'
       and r.driver_id is null
       and r.created_at > now() - interval '5 minutes'
       and not (d.id = any (coalesce(r.declined_by, '{}')))
       and (r.payment_method <> 'cash' or d.accept_cash)
       -- Premium only goes to vehicles approved as Premium; XL only to XL. Bigger/better cars can take Go trips.
       and r.vehicle_type = any (case d.vehicle_type
                                      when 'xl' then array['standard', 'xl']
                                      when 'premium' then array['standard', 'premium']
                                      else array['standard'] end)
  ) q
  where q.pickup_distance_miles is null or q.pickup_distance_miles <= p_radius_miles
  order by q.created_at desc
  limit 5;
end $$;
revoke all on function public.open_ride_requests(double precision, double precision, numeric) from public, anon;
grant execute on function public.open_ride_requests(double precision, double precision, numeric) to authenticated;

-- Driver balance: same as 011, plus cash trips. The driver keeps the cash a rider pays, so their share counts as
-- earned and the cash they hold comes off what RideUp owes them. A negative balance is RideUp's share of cash
-- fares the driver still has; cash they hand over is recorded as a negative payout.
create or replace function public.driver_earnings_summary(p_driver_id uuid default null)
returns table (driver_id uuid, earned_cents bigint, tips_cents bigint, paid_out_cents bigint, balance_cents bigint, paid_trips bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  who uuid := p_driver_id;
begin
  if who is null then
    select id into who from drivers where auth_user_id = auth.uid();
  elsif not public.is_trusted_caller() and not exists (select 1 from drivers where id = who and auth_user_id = auth.uid()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if who is null then return; end if;

  return query
  with e as (
    select
      coalesce(sum(case when r.payment_status in ('captured', 'paid', 'partially_refunded', 'refunded', 'cash_collected')
                        then coalesce(r.driver_payout_cents, 0) else 0 end), 0)::bigint as earned,
      coalesce(sum(case when r.tip_payment_intent_id is not null and r.payment_status in ('captured', 'paid', 'partially_refunded', 'refunded', 'cash_collected')
                        then coalesce(r.tip_cents, 0) else 0 end), 0)::bigint as tips,
      coalesce(sum(case when r.payment_status = 'cash_collected'
                        then greatest(r.fare_cents - coalesce(r.promo_discount_cents, 0) - coalesce(r.credit_applied_cents, 0), 0) else 0 end), 0)::bigint as cash,
      count(*) filter (where r.status = 'completed' and r.payment_status in ('captured', 'paid', 'partially_refunded', 'refunded', 'cash_collected'))::bigint as trips
      from rides r where r.driver_id = who
  ), q as (
    select coalesce(sum(reward_cents), 0)::bigint as rewards from driver_quest_rewards where driver_quest_rewards.driver_id = who
  ), d as (
    select coalesce(sum(f.driver_deduction_cents), 0)::bigint as deducted
      from ride_refunds f join rides r on r.id = f.ride_id where r.driver_id = who
  ), p as (
    select coalesce(sum(amount_cents) filter (where amount_cents > 0), 0)::bigint as paid,
           coalesce(-sum(amount_cents) filter (where amount_cents < 0), 0)::bigint as handed
      from driver_payouts where driver_payouts.driver_id = who and status = 'paid'
  )
  select who, e.earned + e.tips + q.rewards - d.deducted, e.tips, p.paid,
         e.earned + e.tips + q.rewards - d.deducted - p.paid - (e.cash - p.handed), e.trips
    from e, q, d, p;
end $$;
revoke all on function public.driver_earnings_summary(uuid) from public, anon;
grant execute on function public.driver_earnings_summary(uuid) to authenticated;

-- Account deletion: same as 010, plus an unpaid cash trip (rider) and cash owed to RideUp (driver).
create or replace function public.account_deletion_blocker(p_user uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  r_id uuid;
  d_id uuid;
  owed bigint;
begin
  select id into r_id from riders where auth_user_id = p_user;
  select id into d_id from drivers where auth_user_id = p_user;
  if exists (select 1 from rides
              where (rider_id = r_id or driver_id = d_id)
                and status in ('requested', 'pending_driver_response', 'accepted', 'driver_arrived', 'in_progress')) then
    return 'active_ride';
  end if;
  if r_id is not null and exists (select 1 from rides where rider_id = r_id and status = 'completed'
                                     and payment_status in ('authorized', 'failed')) then
    return 'unpaid_balance';
  end if;
  if r_id is not null and exists (select 1 from rides where rider_id = r_id and payment_status = 'cash_unpaid') then
    return 'cash_unpaid';
  end if;
  if d_id is not null then
    select balance_cents into owed from public.driver_earnings_summary(d_id);
    if coalesce(owed, 0) > 0 then return 'payout_owed'; end if;
    if coalesce(owed, 0) < 0 then return 'cash_owed'; end if;
  end if;
  return null;
end $$;
revoke all on function public.account_deletion_blocker(uuid) from public, anon, authenticated;

-- Money dashboard: same as 011, plus cash. Cash trips count like card trips (no card fee on them), and the cash
-- drivers collected is shown on its own.
drop function if exists public.admin_money_summary(date, date);
create function public.admin_money_summary(p_from date, p_to date)
returns table (day date, trips bigint, gross_fare_cents bigint, platform_fee_cents bigint, driver_fare_cents bigint,
               booking_fee_cents bigint, airport_fee_cents bigint, busy_extra_cents bigint,
               promo_cents bigint, credit_cents bigint, tips_cents bigint,
               cancel_fee_cents bigint, cancel_platform_cents bigint, quest_reward_cents bigint,
               rider_paid_cents bigint, est_card_fee_cents bigint, cancelled_trips bigint,
               refund_cents bigint, refund_driver_cents bigint, credit_issued_cents bigint,
               cash_trips bigint, cash_cents bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  if p_to < p_from or p_to - p_from > 400 then raise exception 'Pick a range of up to 400 days' using errcode = '22023'; end if;
  return query
  with days as (select generate_series(p_from, p_to, interval '1 day')::date as day),
  done as (
    select (r.completed_at at time zone 'America/Nassau')::date as day, r.*,
           greatest(r.fare_cents - coalesce(r.promo_discount_cents, 0) - coalesce(r.credit_applied_cents, 0), 0) as charge,
           case when r.tip_payment_intent_id is not null then coalesce(r.tip_cents, 0) else 0 end as tip
      from rides r
     where r.status = 'completed' and r.payment_status in ('captured', 'paid', 'partially_refunded', 'cash_collected')
       and r.completed_at >= (p_from::timestamp at time zone 'America/Nassau')
       and r.completed_at < ((p_to + 1)::timestamp at time zone 'America/Nassau')
  ),
  d as (
    select day, count(*) as trips, sum(fare_cents) as gross, sum(coalesce(platform_fee_cents, 0)) as platform,
           sum(coalesce(driver_payout_cents, 0)) as driver, sum(coalesce(booking_fee_cents, 0)) as booking,
           sum(coalesce(airport_fee_cents, 0)) as airport,
           sum(case when surge_multiplier > 1 then
                 (fare_cents - coalesce(booking_fee_cents, 0) - coalesce(airport_fee_cents, 0))
                 - round((fare_cents - coalesce(booking_fee_cents, 0) - coalesce(airport_fee_cents, 0)) / surge_multiplier)
               else 0 end) as busy,
           sum(coalesce(promo_discount_cents, 0)) as promo, sum(coalesce(credit_applied_cents, 0)) as credit,
           sum(tip) as tips, sum(charge) + sum(tip) as paid,
           sum(case when payment_method = 'cash' then 0 else round(charge * 0.029) + 30 end)
             + sum(case when tip > 0 then round(tip * 0.029) + 30 else 0 end) as card,
           count(*) filter (where payment_method = 'cash') as cash_trips,
           sum(case when payment_method = 'cash' then charge else 0 end) as cash
      from done group by day
  ),
  c as (
    select (r.cancelled_at at time zone 'America/Nassau')::date as day, count(*) as n,
           sum(r.cancel_fee_cents) as fees, sum(coalesce(r.platform_fee_cents, 0)) as platform,
           sum(round(r.cancel_fee_cents * 0.029) + 30) as card
      from rides r
     where r.status = 'cancelled' and coalesce(r.cancel_fee_cents, 0) > 0 and r.payment_status in ('captured', 'paid')
       and r.cancelled_at >= (p_from::timestamp at time zone 'America/Nassau')
       and r.cancelled_at < ((p_to + 1)::timestamp at time zone 'America/Nassau')
     group by 1
  ),
  q as (
    select (w.earned_at at time zone 'America/Nassau')::date as day, sum(w.reward_cents) as rewards
      from driver_quest_rewards w
     where w.earned_at >= (p_from::timestamp at time zone 'America/Nassau')
       and w.earned_at < ((p_to + 1)::timestamp at time zone 'America/Nassau')
     group by 1
  ),
  f as (
    select (x.created_at at time zone 'America/Nassau')::date as day,
           sum(case when x.method = 'card' then x.amount_cents else 0 end) as card,
           sum(x.driver_deduction_cents) as driver,
           sum(case when x.method = 'credit' then x.amount_cents else 0 end) as credit
      from ride_refunds x
     where x.created_at >= (p_from::timestamp at time zone 'America/Nassau')
       and x.created_at < ((p_to + 1)::timestamp at time zone 'America/Nassau')
     group by 1
  )
  select days.day,
         coalesce(d.trips, 0)::bigint, coalesce(d.gross, 0)::bigint, coalesce(d.platform, 0)::bigint, coalesce(d.driver, 0)::bigint,
         coalesce(d.booking, 0)::bigint, coalesce(d.airport, 0)::bigint, coalesce(d.busy, 0)::bigint,
         coalesce(d.promo, 0)::bigint, coalesce(d.credit, 0)::bigint, coalesce(d.tips, 0)::bigint,
         coalesce(c.fees, 0)::bigint, coalesce(c.platform, 0)::bigint, coalesce(q.rewards, 0)::bigint,
         (coalesce(d.paid, 0) + coalesce(c.fees, 0))::bigint, (coalesce(d.card, 0) + coalesce(c.card, 0))::bigint,
         coalesce(c.n, 0)::bigint,
         coalesce(f.card, 0)::bigint, coalesce(f.driver, 0)::bigint, coalesce(f.credit, 0)::bigint,
         coalesce(d.cash_trips, 0)::bigint, coalesce(d.cash, 0)::bigint
    from days
    left join d on d.day = days.day
    left join c on c.day = days.day
    left join q on q.day = days.day
    left join f on f.day = days.day
   order by days.day;
end $$;
revoke all on function public.admin_money_summary(date, date) from public, anon;
grant execute on function public.admin_money_summary(date, date) to authenticated;

-- Ad report: same as 013, with cash trips counted as trips.
create or replace function public.admin_acquisition_report(p_from date, p_to date)
returns table (source text, campaign text, signups bigint, riders_with_trip bigint, trips bigint, rider_paid_cents bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  return query
  with r as (
    select ri.id,
           coalesce(nullif(ri.acquisition ->> 'utm_source', ''),
                    case when ri.acquisition ? 'gclid' then 'google' when ri.acquisition ? 'fbclid' then 'facebook' end,
                    'direct') as src,
           coalesce(nullif(ri.acquisition ->> 'utm_campaign', ''), '—') as camp
      from riders ri
     where ri.deleted_at is null
       and ri.created_at >= (p_from::timestamp at time zone 'America/Nassau')
       and ri.created_at < ((p_to + 1)::timestamp at time zone 'America/Nassau')
  ), t as (
    select x.rider_id, count(*) as n,
           sum(greatest(x.fare_cents - coalesce(x.promo_discount_cents, 0) - coalesce(x.credit_applied_cents, 0), 0)) as paid
      from rides x
     where x.status = 'completed' and x.payment_status in ('captured', 'paid', 'partially_refunded', 'cash_collected')
       and x.rider_id in (select r.id from r)
     group by x.rider_id
  )
  select r.src, r.camp, count(*)::bigint, count(t.rider_id)::bigint,
         coalesce(sum(t.n), 0)::bigint, coalesce(sum(t.paid), 0)::bigint
    from r left join t on t.rider_id = r.id
   group by r.src, r.camp
   order by 3 desc;
end $$;
revoke all on function public.admin_acquisition_report(date, date) from public, anon;
grant execute on function public.admin_acquisition_report(date, date) to authenticated;
