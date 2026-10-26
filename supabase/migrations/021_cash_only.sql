-- 021: cash only. Card payments are off, so every ride is paid to the driver in cash at drop-off.
--  * Guests can book with their name and mobile number; booking for someone else is fine (the passenger pays
--    the driver). Every booking needs a mobile number the driver can call.
--  * Missed pickups and late cancellations (over 2 minutes after a driver accepts) still pause booking after two in
--    30 days, and a driver's unpaid-fare report pauses it at once (cash_strike and cash-unpaid, migration 019).
--  * Card history stays as it was: old rides keep 'card', saved card details stay on old profiles until deleted.
-- Safe to re-run.

alter table public.rides alter column payment_method set default 'cash';
insert into public.app_settings (key, value) values ('accept_cash', 'true'::jsonb)
  on conflict (key) do update set value = excluded.value;
update public.drivers set accept_cash = true where not accept_cash;

-- Trips under way that were booked by card can't be charged any more: they're paid in cash instead.
update public.rides
   set payment_method = 'cash',
       payment_status = case when status in ('accepted', 'driver_arrived', 'in_progress') then 'cash_due' end
 where payment_method = 'card'
   and status in ('requested', 'pending_driver_response', 'accepted', 'driver_arrived', 'in_progress');

-- Booking is paused for this rider, or for another of their accounts on the same phone or card: after missed
-- pickups or late cancellations (cash_strike) or an unpaid fare (cash-unpaid). Used by booking below and by the
-- scheduled-ride dispatcher.
create or replace function public.booking_paused(p_rider_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from riders o
                  where o.cash_blocked
                    and (o.id = p_rider_id or o.id in (select public.rider_lookalikes(p_rider_id))))
$$;
revoke all on function public.booking_paused(uuid) from public, anon, authenticated;

-- Ride requests: as in 019, but every ride is cash and guests can book.
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
  -- Every ride is paid to the driver in cash at drop-off (card payments are off). Old card rides keep 'card'.
  new.payment_method := 'cash';

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

  -- A mobile number for the driver to call or text at pickup, guests included. Missed pickups and late
  -- cancellations pause booking for this person and for their other accounts on the same phone or card
  -- (cash_strike), and a driver's unpaid-fare report pauses it at once; an admin can turn it back on.
  if length(coalesce(public.phone_key(r.phone), '')) < 7 then
    raise exception 'Add your mobile number so your driver can reach you.' using errcode = '22023', hint = 'phone';
  end if;
  if public.booking_paused(r.id) then
    raise exception 'Booking is paused on your account because of missed pickups or an unpaid fare. Contact RideUp support to sort it out.'
      using errcode = '22023', hint = 'blocked';
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

-- Drivers' request list: as in 019, without the "takes cash" filter. Every trip is cash, so every driver gets them.
create or replace function public.open_ride_requests(
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
