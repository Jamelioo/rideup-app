-- 010: in-app account deletion, native app push tokens, busy-time pricing, admin money summary,
-- driver incentives, one extra stop, and split fare. Must match src/lib/pricing.js. Safe to re-run.

-- ─────────────────────────────────────────
-- Account deletion (App Store rule 5.1.1(v)): personal data is erased, trip and payment records stay
-- (anonymised) for tax, disputes and safety. Called by /api/delete-account with the service role.
-- ─────────────────────────────────────────
alter table public.riders add column if not exists deleted_at timestamptz;
alter table public.drivers add column if not exists deleted_at timestamptz;

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
  if d_id is not null then
    select balance_cents into owed from public.driver_earnings_summary(d_id);
    if coalesce(owed, 0) > 0 then return 'payout_owed'; end if;
  end if;
  return null;
end $$;
revoke all on function public.account_deletion_blocker(uuid) from public, anon, authenticated;

create or replace function public.erase_account_data(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r_id uuid;
  d_id uuid;
begin
  select id into r_id from riders where auth_user_id = p_user;
  select id into d_id from drivers where auth_user_id = p_user;
  perform set_config('app.trusted', '1', true);

  if r_id is not null then
    update rides set rider_name = 'Former rider' where rider_id = r_id;
    update riders set auth_user_id = null, name = 'Deleted rider', email = null, phone = null,
                      stripe_customer_id = null, payment_method_id = null, card_brand = null, card_last4 = null,
                      referral_code = null, credit_cents = 0, deleted_at = now()
     where id = r_id;
    delete from scheduled_rides where rider_id = r_id and status in ('scheduled', 'payment_required');
  end if;

  if d_id is not null then
    update drivers set auth_user_id = null, name = 'Deleted driver', email = null, phone = null,
                       license_plate = null, license_number = null, photo_url = null,
                       last_lat = null, last_lng = null, approved = false, status = 'offline', is_online = false,
                       deleted_at = now()
     where id = d_id;
  end if;

  delete from push_subscriptions where user_id = p_user;
  if to_regclass('public.native_push_tokens') is not null then
    execute 'delete from public.native_push_tokens where user_id = $1' using p_user;
  end if;
  -- Kept for safety investigations, but no longer linked to a login.
  update ride_messages set sender_id = null where sender_id = p_user;
  update safety_reports set reporter_id = null where reporter_id = p_user;
  delete from support_tickets where user_id = p_user;

  perform set_config('app.trusted', '', true);
end $$;
revoke all on function public.erase_account_data(uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────
-- Native app push (App Store / Google Play apps): APNs tokens on iPhone, FCM tokens on Android.
-- ─────────────────────────────────────────
create table if not exists public.native_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  token text not null unique check (length(token) between 20 and 4096),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.native_push_tokens enable row level security;
drop policy if exists "Users read own native push tokens" on public.native_push_tokens;
create policy "Users read own native push tokens" on public.native_push_tokens for select using (auth.uid() = user_id);

-- A phone can change hands (log out, someone else logs in), so a token always belongs to the latest user.
create or replace function public.register_native_push(p_platform text, p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if p_platform not in ('ios', 'android') then raise exception 'Unknown platform' using errcode = '22023'; end if;
  insert into native_push_tokens (user_id, platform, token) values (auth.uid(), p_platform, p_token)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;
revoke all on function public.register_native_push(text, text) from public, anon;
grant execute on function public.register_native_push(text, text) to authenticated;

create or replace function public.unregister_native_push(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from native_push_tokens where token = p_token and user_id = auth.uid()
$$;
revoke all on function public.unregister_native_push(text) from public, anon;
grant execute on function public.unregister_native_push(text) to authenticated;

-- ─────────────────────────────────────────
-- Busy-time pricing and one extra stop
-- ─────────────────────────────────────────
alter table public.rides add column if not exists surge_multiplier numeric(3,2) not null default 1.00;
alter table public.rides add column if not exists stop_address text;
alter table public.rides add column if not exists stop_lat double precision;
alter table public.rides add column if not exists stop_lng double precision;
alter table public.rides add column if not exists stop_reached_at timestamptz;

insert into public.app_settings (key, value) values ('surge_pricing', 'true'::jsonb) on conflict (key) do nothing;

create or replace function public.miles_between(a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision)
returns numeric language sql immutable as $$
  select (2 * 3958.8 * asin(least(1, sqrt(
    power(sin(radians(b_lat - a_lat) / 2), 2)
    + cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lng - a_lng) / 2), 2)
  ))))::numeric
$$;

-- Requests waiting for a driver vs free online drivers within 3 miles of the pickup.
-- 1.0 unless at least 2 riders are waiting; then 1.2× (as many riders as drivers) up to 1.5× (3+ per driver).
-- Must match MAX_SURGE in src/lib/pricing.js. Admins can switch it off (Settings → Busy-time pricing).
create or replace function public.surge_multiplier_at(p_lat double precision, p_lng double precision)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  demand int;
  supply int;
  ratio numeric;
begin
  if p_lat is null or p_lng is null or not public.setting_enabled('surge_pricing') then return 1.00; end if;
  select count(*) into demand from rides r
   where r.status in ('requested', 'pending_driver_response')
     and r.created_at > now() - interval '10 minutes'
     and public.miles_between(p_lat, p_lng, r.pickup_lat, r.pickup_lng) <= 3;
  if demand < 2 then return 1.00; end if;
  select count(*) into supply from drivers d
   where d.status = 'online' and d.approved
     and d.last_seen_at > now() - interval '3 minutes'
     and d.last_lat is not null
     and public.miles_between(p_lat, p_lng, d.last_lat, d.last_lng) <= 3
     and not exists (select 1 from rides x where x.driver_id = d.id
                      and x.status in ('pending_driver_response', 'accepted', 'driver_arrived', 'in_progress'));
  ratio := demand::numeric / greatest(supply, 1);
  return case when ratio >= 3 then 1.50 when ratio >= 2 then 1.40 when ratio >= 1.5 then 1.30 when ratio >= 1 then 1.20 else 1.00 end;
end $$;
revoke all on function public.surge_multiplier_at(double precision, double precision) from public;
grant execute on function public.surge_multiplier_at(double precision, double precision) to anon, authenticated;

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
  new.booking_fee_cents := 100;
  new.fare_cents := round(greatest(
    round(base + new.distance_miles * per_mile + new.duration_minutes * per_min)::int,
    minimum
  ) * surge)::int + new.booking_fee_cents;

  -- Airport pickup fee (LPIA), part of the fare so the driver keeps 80% of it.
  new.airport_fee_cents := case when public.is_airport_pickup(new.pickup_lat, new.pickup_lng) then 300 else 0 end;
  new.fare_cents := new.fare_cents + new.airport_fee_cents;

  -- Discounts are paid by RideUp: the driver is still paid on the full fare. The rider always pays at least $1.
  select * into r from riders where id = new.rider_id;
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

create or replace function public.guard_rides_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  mutable text[] := array[
    'status', 'started_at', 'completed_at', 'cancelled_at', 'cancel_reason',
    'driver_lat', 'driver_lng', 'driver_location_at', 'arrived_at',
    'rider_rating', 'rider_feedback', 'rider_compliments',
    'driver_rating', 'driver_feedback', 'stop_reached_at'
  ];
  is_driver boolean;
  is_rider boolean;
begin
  if public.is_trusted_caller() then
    if new.status is distinct from old.status then
      if new.status = 'driver_arrived' and new.arrived_at is null then new.arrived_at := now(); end if;
      if new.status = 'cancelled' and new.cancelled_at is null then new.cancelled_at := now(); end if;
      if new.status = 'in_progress' and new.started_at is null then new.started_at := now(); end if;
      if new.status = 'completed' and new.completed_at is null then new.completed_at := now(); end if;
    end if;
    return new;
  end if;

  if (to_jsonb(new) - mutable) is distinct from (to_jsonb(old) - mutable) then
    raise exception 'Not allowed to modify protected ride fields' using errcode = '42501';
  end if;

  select exists (select 1 from drivers d where d.id = old.driver_id and d.auth_user_id = auth.uid()) into is_driver;
  select exists (select 1 from riders r where r.id = old.rider_id and r.auth_user_id = auth.uid()) into is_rider;

  -- Driver location: driver only; server stamps the time.
  if (new.driver_lat, new.driver_lng) is distinct from (old.driver_lat, old.driver_lng) then
    if not is_driver then
      raise exception 'Only the driver can update the driver location' using errcode = '42501';
    end if;
    new.driver_location_at := now();
  else
    new.driver_location_at := old.driver_location_at;
  end if;

  -- Ratings: rider rates the driver (rider_*), driver rates the rider (driver_*). Once, after completion.
  if (new.rider_rating, new.rider_feedback, new.rider_compliments)
       is distinct from (old.rider_rating, old.rider_feedback, old.rider_compliments) then
    if not is_rider or old.status <> 'completed' or old.rider_rating is not null
       or new.rider_rating is null or new.rider_rating not between 1 and 5 then
      raise exception 'You can rate this ride once, after it is completed' using errcode = '42501';
    end if;
  end if;
  if (new.driver_rating, new.driver_feedback) is distinct from (old.driver_rating, old.driver_feedback) then
    if not is_driver or old.status <> 'completed' or old.driver_rating is not null
       or new.driver_rating is null or new.driver_rating not between 1 and 5 then
      raise exception 'You can rate this rider once, after the trip is completed' using errcode = '42501';
    end if;
  end if;

  -- Extra stop: the driver marks it reached (once, during the trip); the server stamps the time.
  if new.stop_reached_at is distinct from old.stop_reached_at then
    if not is_driver or old.status <> 'in_progress' or old.stop_lat is null or old.stop_reached_at is not null then
      raise exception 'Only the driver can mark the stop, once, during the trip' using errcode = '42501';
    end if;
    new.stop_reached_at := now();
  end if;

  if new.status is distinct from old.status then
    if old.status in ('completed', 'cancelled') then
      raise exception 'Ride is already finished' using errcode = '42501';
    end if;

    if is_driver and (
         (old.status = 'accepted' and new.status = 'driver_arrived')
      or (old.status = 'driver_arrived' and new.status = 'in_progress' and not public.setting_enabled('require_pickup_pin'))
      or (old.status = 'in_progress' and new.status = 'completed')
    ) then
      new.arrived_at := case when new.status = 'driver_arrived' then now() else old.arrived_at end;
      new.started_at := case when new.status = 'in_progress' then now() else old.started_at end;
      new.completed_at := case when new.status = 'completed' then now() else old.completed_at end;
      new.cancelled_at := old.cancelled_at;
      return new;
    end if;

    -- Before a driver is confirmed there is no hold to release, so riders may withdraw directly.
    if is_rider and new.status = 'cancelled' and old.status in ('requested', 'pending_driver_response') then
      new.cancelled_at := now();
      new.cancelled_by := 'rider';
      return new;
    end if;

    if is_driver and old.status = 'driver_arrived' and new.status = 'in_progress' then
      raise exception 'Enter the rider''s 4-digit PIN to start the trip' using errcode = '42501';
    end if;
    if new.status = 'cancelled' then
      raise exception 'Use the app''s cancel button to cancel this ride' using errcode = '42501';
    end if;
    raise exception 'Invalid ride status change % -> %', old.status, new.status using errcode = '42501';
  end if;

  -- No status change: server-controlled timestamps stay as they were.
  new.arrived_at := old.arrived_at;
  new.started_at := old.started_at;
  new.completed_at := old.completed_at;
  new.cancelled_at := old.cancelled_at;
  return new;
end $$;

-- ─────────────────────────────────────────
-- Split fare: the rider invites up to 3 RideUp riders during the trip; everyone who accepts pays an equal
-- share when the trip ends (charged by /api/capture). A friend's card that fails falls back to the rider.
-- ─────────────────────────────────────────
create table if not exists public.fare_splits (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  rider_id uuid not null references public.riders(id) on delete cascade,
  invited_by uuid not null references public.riders(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'accepted', 'declined', 'expired', 'paid', 'failed')),
  share_cents integer check (share_cents is null or share_cents > 0),
  payment_intent_id text,
  created_at timestamptz default now(),
  responded_at timestamptz,
  paid_at timestamptz,
  unique (ride_id, rider_id)
);
create index if not exists fare_splits_rider_idx on public.fare_splits (rider_id, created_at desc);
alter table public.fare_splits enable row level security;
drop policy if exists "Split participants read splits" on public.fare_splits;
create policy "Split participants read splits" on public.fare_splits for select using (
  public.is_admin()
  or rider_id in (select id from public.riders where auth_user_id = auth.uid())
  or invited_by in (select id from public.riders where auth_user_id = auth.uid())
);

-- A cancelled trip has nothing to split.
create or replace function public.expire_splits_on_cancel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update fare_splits set status = 'expired' where ride_id = new.id and status in ('invited', 'accepted');
  end if;
  return new;
end $$;
drop trigger if exists rides_expire_splits on public.rides;
create trigger rides_expire_splits after update of status on public.rides
  for each row execute function public.expire_splits_on_cancel();

-- ─────────────────────────────────────────
-- Driver incentives ("Complete 15 trips this weekend, get $20"). Earned automatically when the trip that
-- reaches the target is completed; the reward is added to the driver's balance for the next payout.
-- ─────────────────────────────────────────
create table if not exists public.driver_quests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 3 and 80),
  trips_required integer not null check (trips_required between 1 and 200),
  reward_cents integer not null check (reward_cents between 100 and 50000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz default now(),
  check (ends_at > starts_at)
);
alter table public.driver_quests enable row level security;
drop policy if exists "Admins manage quests" on public.driver_quests;
drop policy if exists "Drivers read active quests" on public.driver_quests;
create policy "Admins manage quests" on public.driver_quests for all using (public.is_admin()) with check (public.is_admin());
create policy "Drivers read active quests" on public.driver_quests for select using (
  active and exists (select 1 from public.drivers where auth_user_id = auth.uid() and approved)
);

create table if not exists public.driver_quest_rewards (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.driver_quests(id) on delete restrict,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  reward_cents integer not null check (reward_cents > 0),
  earned_at timestamptz not null default now(),
  unique (quest_id, driver_id)
);
alter table public.driver_quest_rewards enable row level security;
drop policy if exists "Admins read quest rewards" on public.driver_quest_rewards;
drop policy if exists "Drivers read own quest rewards" on public.driver_quest_rewards;
create policy "Admins read quest rewards" on public.driver_quest_rewards for select using (public.is_admin());
create policy "Drivers read own quest rewards" on public.driver_quest_rewards for select using (
  driver_id in (select id from public.drivers where auth_user_id = auth.uid())
);

create or replace function public.my_quests()
returns table (id uuid, title text, trips_required integer, reward_cents integer, starts_at timestamptz, ends_at timestamptz,
               trips_done bigint, earned boolean)
language sql stable security definer set search_path = public as $$
  select q.id, q.title, q.trips_required, q.reward_cents, q.starts_at, q.ends_at,
         (select count(*) from rides r where r.driver_id = d.id and r.status = 'completed'
             and r.completed_at >= q.starts_at and r.completed_at < q.ends_at),
         exists (select 1 from driver_quest_rewards w where w.quest_id = q.id and w.driver_id = d.id)
    from drivers d
    join driver_quests q on q.active and q.ends_at > now() - interval '2 days'
   where d.auth_user_id = auth.uid() and d.approved
   order by q.ends_at
$$;
revoke all on function public.my_quests() from public, anon;
grant execute on function public.my_quests() to authenticated;

-- Earned = paid trips' driver share + tips + incentive rewards. Balance = earned − payouts.
-- Trusted callers (the server) may ask for any driver, e.g. before deleting an account.
create or replace function public.driver_earnings_summary(p_driver_id uuid default null)
returns table (driver_id uuid, earned_cents bigint, tips_cents bigint, paid_out_cents bigint, balance_cents bigint, paid_trips bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  target uuid := p_driver_id;
begin
  if target is null then
    select id into target from drivers where auth_user_id = auth.uid();
  elsif not public.is_trusted_caller() and not exists (select 1 from drivers where id = target and auth_user_id = auth.uid()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if target is null then return; end if;

  return query
  with e as (
    select
      coalesce(sum(case when r.payment_status in ('captured', 'paid', 'partially_refunded')
                        then coalesce(r.driver_payout_cents, 0) else 0 end), 0)::bigint as earned,
      coalesce(sum(case when r.payment_status in ('captured', 'paid', 'partially_refunded') and r.tip_payment_intent_id is not null
                        then coalesce(r.tip_cents, 0) else 0 end), 0)::bigint as tips,
      count(*) filter (where r.status = 'completed' and r.payment_status in ('captured', 'paid', 'partially_refunded'))::bigint as trips
      from rides r where r.driver_id = target
  ), q as (
    select coalesce(sum(reward_cents), 0)::bigint as rewards from driver_quest_rewards where driver_quest_rewards.driver_id = target
  ), p as (
    select coalesce(sum(amount_cents), 0)::bigint as paid from driver_payouts where driver_payouts.driver_id = target and status = 'paid'
  )
  select target, e.earned + e.tips + q.rewards, e.tips, p.paid, e.earned + e.tips + q.rewards - p.paid, e.trips from e, q, p;
end $$;
revoke all on function public.driver_earnings_summary(uuid) from public, anon;
grant execute on function public.driver_earnings_summary(uuid) to authenticated;

create or replace function public.on_ride_completed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform set_config('app.trusted', '1', true);
    if new.driver_id is not null then
      update drivers
         set total_trips = coalesce(total_trips, 0) + 1,
             total_rides = coalesce(total_rides, 0) + 1
       where id = new.driver_id;
      -- Incentives this trip completes.
      insert into driver_quest_rewards (quest_id, driver_id, reward_cents)
      select q.id, new.driver_id, q.reward_cents
        from driver_quests q
       where q.active and new.completed_at >= q.starts_at and new.completed_at < q.ends_at
         and (select count(*) from rides r where r.driver_id = new.driver_id and r.status = 'completed'
                and r.completed_at >= q.starts_at and r.completed_at < q.ends_at) >= q.trips_required
      on conflict (quest_id, driver_id) do nothing;
    end if;
    update riders set total_rides = coalesce(total_rides, 0) + 1 where id = new.rider_id;
    -- Promo used up, ride credit spent, and the referrer rewarded after a referred rider's first trip.
    if coalesce(new.promo_discount_cents, 0) > 0 and new.promo_code is not null then
      insert into promo_redemptions (code, rider_id, ride_id, discount_cents)
      values (new.promo_code, new.rider_id, new.id, new.promo_discount_cents)
      on conflict do nothing;
      update promo_codes set uses = uses + 1 where code = new.promo_code;
    end if;
    if coalesce(new.credit_applied_cents, 0) > 0 then
      update riders set credit_cents = greatest(0, credit_cents - new.credit_applied_cents) where id = new.rider_id;
    end if;
    update riders ref set credit_cents = ref.credit_cents + 500
      from riders me
     where me.id = new.rider_id and me.referred_by = ref.id and not me.referral_rewarded;
    update riders set referral_rewarded = true where id = new.rider_id and referred_by is not null and not referral_rewarded;
    perform set_config('app.trusted', '', true);
  end if;
  return new;
end $$;

-- ─────────────────────────────────────────
-- Admin money dashboard: one row per day (Nassau time). Card fees are an estimate (2.9% + 30¢ per charge).
-- ─────────────────────────────────────────
create or replace function public.admin_money_summary(p_from date, p_to date)
returns table (day date, trips bigint, gross_fare_cents bigint, platform_fee_cents bigint, driver_fare_cents bigint,
               booking_fee_cents bigint, airport_fee_cents bigint, busy_extra_cents bigint,
               promo_cents bigint, credit_cents bigint, tips_cents bigint,
               cancel_fee_cents bigint, cancel_platform_cents bigint, quest_reward_cents bigint,
               rider_paid_cents bigint, est_card_fee_cents bigint, cancelled_trips bigint)
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
     where r.status = 'completed' and r.payment_status in ('captured', 'paid', 'partially_refunded')
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
           sum(round(charge * 0.029) + 30) + sum(case when tip > 0 then round(tip * 0.029) + 30 else 0 end) as card
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
  )
  select days.day,
         coalesce(d.trips, 0)::bigint, coalesce(d.gross, 0)::bigint, coalesce(d.platform, 0)::bigint, coalesce(d.driver, 0)::bigint,
         coalesce(d.booking, 0)::bigint, coalesce(d.airport, 0)::bigint, coalesce(d.busy, 0)::bigint,
         coalesce(d.promo, 0)::bigint, coalesce(d.credit, 0)::bigint, coalesce(d.tips, 0)::bigint,
         coalesce(c.fees, 0)::bigint, coalesce(c.platform, 0)::bigint, coalesce(q.rewards, 0)::bigint,
         (coalesce(d.paid, 0) + coalesce(c.fees, 0))::bigint, (coalesce(d.card, 0) + coalesce(c.card, 0))::bigint,
         coalesce(c.n, 0)::bigint
    from days
    left join d on d.day = days.day
    left join c on c.day = days.day
    left join q on q.day = days.day
   order by days.day;
end $$;
revoke all on function public.admin_money_summary(date, date) from public, anon;
grant execute on function public.admin_money_summary(date, date) to authenticated;

-- What RideUp owes right now: unspent ride credit and driver balances waiting for a payout.
create or replace function public.admin_money_owed()
returns table (credit_outstanding_cents bigint, driver_balances_cents bigint, drivers_owed bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  return query
  select (select coalesce(sum(credit_cents), 0) from riders)::bigint,
         coalesce(sum(greatest(s.balance_cents, 0)), 0)::bigint,
         count(*) filter (where s.balance_cents > 0)::bigint
    from drivers d cross join lateral public.driver_earnings_summary(d.id) s;
end $$;
revoke all on function public.admin_money_owed() from public, anon;
grant execute on function public.admin_money_owed() to authenticated;

-- Server-only lookup for split-fare invites: matches the last 10 digits whatever the number's formatting.
create or replace function public.find_riders_by_phone(p_digits text)
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from riders
   where deleted_at is null and length(p_digits) >= 7
     and right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), length(right(p_digits, 10))) = right(p_digits, 10)
   limit 5
$$;
revoke all on function public.find_riders_by_phone(text) from public, anon, authenticated;
