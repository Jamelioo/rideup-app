-- 006_trip_experience.sql — run after 001–005. Idempotent.
-- Audit v2 (AUDIT_V2.md): trip communication, recovery, safety sharing, cancellations, ratings,
-- admin controls, privacy hardening, pickup PIN, payout ledger.

-- ─────────────────────────────────────────
-- Columns
-- ─────────────────────────────────────────
alter table public.drivers add column if not exists photo_url text;
alter table public.drivers add column if not exists license_expires_on date;
alter table public.drivers add column if not exists insurance_expires_on date;
alter table public.drivers add column if not exists background_check_status text default 'not_started';
alter table public.drivers add column if not exists review_note text;

alter table public.riders add column if not exists suspended boolean default false;

alter table public.rides add column if not exists arrived_at timestamptz;
alter table public.rides add column if not exists driver_location_at timestamptz;
alter table public.rides add column if not exists share_token uuid;
alter table public.drivers add column if not exists last_seen_at timestamptz;
alter table public.rides add column if not exists tip_cents integer default 0;
alter table public.rides add column if not exists tip_payment_intent_id text;
alter table public.rides add column if not exists cancelled_by text;
-- When a driver cancels, the server books the rider a fresh request (Uber re-matches automatically).
alter table public.rides add column if not exists replaced_by_ride_id uuid references public.rides(id) on delete set null;
create unique index if not exists idx_rides_share_token on public.rides (share_token) where share_token is not null;
create index if not exists idx_rides_rider_status on public.rides (rider_id, status);
create index if not exists idx_rides_driver_status on public.rides (driver_id, status);

alter table public.safety_reports add column if not exists admin_note text;

-- ─────────────────────────────────────────
-- Admin-controlled feature flags
-- ─────────────────────────────────────────
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);
alter table public.app_settings enable row level security;
drop policy if exists "Anyone can read settings" on public.app_settings;
drop policy if exists "Admins manage settings" on public.app_settings;
create policy "Anyone can read settings" on public.app_settings for select using (true);
create policy "Admins manage settings" on public.app_settings for all using (public.is_admin()) with check (public.is_admin());

insert into public.app_settings (key, value) values
  ('require_pickup_pin', 'false'::jsonb),
  ('require_verified_phone', 'false'::jsonb),
  ('offer_premium', 'false'::jsonb)
on conflict (key) do nothing;

create or replace function public.setting_enabled(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select value = 'true'::jsonb from app_settings where key = p_key), false)
$$;

-- ─────────────────────────────────────────
-- Trust check, hardened: only a direct DB connection (no JWT), the service-role key,
-- our own SECURITY DEFINER RPCs (app.trusted) or an admin. Requests made with the public
-- anon key carry role=anon and are NOT trusted.
-- ─────────────────────────────────────────
create or replace function public.is_trusted_caller()
returns boolean language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '') is null
      or (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role') = 'service_role'
      or coalesce(current_setting('app.trusted', true), '') = '1'
      or public.is_admin()
$$;

-- ─────────────────────────────────────────
-- Riders: suspension is admin-only
-- ─────────────────────────────────────────
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
    new.rating := 5.0;
    new.total_rides := 0;
    new.suspended := false;
    return new;
  end if;
  new.stripe_customer_id := old.stripe_customer_id;
  new.payment_method_id := old.payment_method_id;
  new.card_brand := old.card_brand;
  new.card_last4 := old.card_last4;
  new.rating := old.rating;
  new.total_rides := old.total_rides;
  new.suspended := old.suspended;
  return new;
end $$;

drop policy if exists "Admins can update riders" on public.riders;
create policy "Admins can update riders" on public.riders for update using (public.is_admin());

-- ─────────────────────────────────────────
-- Drivers: identity changes go back to review; expired documents can't go online
-- ─────────────────────────────────────────
create or replace function public.guard_drivers()
returns trigger language plpgsql as $$
begin
  if public.is_trusted_caller() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.approved := false;
    new.status := 'pending';
    if coalesce(new.vehicle_type, '') not in ('standard', 'xl') then
      new.vehicle_type := 'standard'; -- the Premium class is granted by an admin after inspecting the car
    end if;
    new.rating := 5.0;
    new.total_rides := 0;
    new.total_trips := 0;
    new.total_earnings := 0;
    new.background_check_status := 'not_started';
    new.review_note := null;
    new.license_expires_on := null;
    new.insurance_expires_on := null;
    return new;
  end if;

  new.approved := old.approved;
  new.rating := old.rating;
  new.total_rides := old.total_rides;
  new.total_trips := old.total_trips;
  new.total_earnings := old.total_earnings;
  new.background_check_status := old.background_check_status;
  new.review_note := old.review_note;
  new.license_expires_on := old.license_expires_on;
  new.insurance_expires_on := old.insurance_expires_on;

  if new.vehicle_type = 'premium' and old.vehicle_type is distinct from 'premium' then
    new.vehicle_type := old.vehicle_type; -- only admins grant Premium
  end if;

  -- Changing who/what drives (name, photo, licence, vehicle) needs a fresh review, like Uber.
  if coalesce(old.approved, false) and (
       new.name, new.photo_url, new.license_number, new.license_plate,
       new.vehicle_make, new.vehicle_model, new.vehicle_year, new.vehicle_color, new.vehicle_type
     ) is distinct from (
       old.name, old.photo_url, old.license_number, old.license_plate,
       old.vehicle_make, old.vehicle_model, old.vehicle_year, old.vehicle_color, old.vehicle_type
     ) then
    new.approved := false;
    new.status := 'pending';
    return new;
  end if;

  if new.status is distinct from old.status then
    if not coalesce(old.approved, false) or new.status not in ('online', 'offline', 'on_trip') then
      new.status := old.status;
    elsif new.status = 'online' and (
         (old.license_expires_on is not null and old.license_expires_on < current_date)
      or (old.insurance_expires_on is not null and old.insurance_expires_on < current_date)
    ) then
      new.status := old.status; -- expired documents: stay offline until renewed
    end if;
    if new.status = 'online' and old.status is distinct from 'online' then
      new.last_seen_at := now(); -- heartbeat starts now, so the offline sweeper doesn't catch a driver who just went online
    end if;
  end if;

  return new;
end $$;

-- ─────────────────────────────────────────
-- Ride insert: one active ride per rider, suspended riders blocked, optional verified phone,
-- server-computed fare (minimums from 005).
-- ─────────────────────────────────────────
create or replace function public.guard_rides_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a numeric;
  straight numeric;
  base int; per_mile int; per_min int; minimum int;
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

  if new.vehicle_type is null or new.vehicle_type not in ('standard', 'xl', 'premium') then
    new.vehicle_type := 'standard';
  end if;

  a := power(sin(radians(new.dropoff_lat - new.pickup_lat) / 2), 2)
     + cos(radians(new.pickup_lat)) * cos(radians(new.dropoff_lat))
       * power(sin(radians(new.dropoff_lng - new.pickup_lng) / 2), 2);
  straight := 2 * 3958.8 * asin(least(1, sqrt(a)));
  new.distance_miles := round(greatest(coalesce(new.distance_miles, 0), straight), 2);
  new.duration_minutes := round(greatest(coalesce(new.duration_minutes, 0), new.distance_miles), 2);

  -- Must match RATES in src/lib/pricing.js
  if new.vehicle_type = 'xl' then
    base := 450; per_mile := 230; per_min := 30; minimum := 1500;
  elsif new.vehicle_type = 'premium' then
    base := 700; per_mile := 320; per_min := 40; minimum := 2000;
  else
    base := 250; per_mile := 165; per_min := 20; minimum := 1200;
  end if;

  new.fare_cents := greatest(
    round(base + new.distance_miles * per_mile + new.duration_minutes * per_min)::int,
    minimum
  );
  return new;
end $$;

-- ─────────────────────────────────────────
-- Ride updates by riders/drivers
--   * cancellations after a driver accepts go through /api/cancel-ride (fee + card hold together)
--   * each side writes only its own rating, once, after the trip is completed
--   * only the driver moves the driver location; timestamps are set by the server
--   * starting the trip goes through start_trip() when the pickup PIN is required
-- ─────────────────────────────────────────
create or replace function public.guard_rides_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  mutable text[] := array[
    'status', 'started_at', 'completed_at', 'cancelled_at', 'cancel_reason',
    'driver_lat', 'driver_lng', 'driver_location_at', 'arrived_at',
    'rider_rating', 'rider_feedback', 'rider_compliments',
    'driver_rating', 'driver_feedback'
  ];
  is_driver boolean;
  is_rider boolean;
begin
  if public.is_trusted_caller() then
    if new.status is distinct from old.status then
      if new.status = 'driver_arrived' and new.arrived_at is null then new.arrived_at := now(); end if;
      if new.status = 'cancelled' and new.cancelled_at is null then new.cancelled_at := now(); end if;
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

-- Ratings → rolling averages (last 500 rated trips), like Uber.
create or replace function public.on_ride_rated()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.rider_rating is distinct from old.rider_rating and new.driver_id is not null then
    perform set_config('app.trusted', '1', true);
    update drivers set rating = coalesce((
      select round(avg(t.rider_rating)::numeric, 2) from (
        select rider_rating from rides
         where driver_id = new.driver_id and rider_rating is not null
         order by completed_at desc nulls last limit 500) t), 5.0)
     where id = new.driver_id;
    perform set_config('app.trusted', '', true);
  end if;
  if new.driver_rating is distinct from old.driver_rating then
    perform set_config('app.trusted', '1', true);
    update riders set rating = coalesce((
      select round(avg(t.driver_rating)::numeric, 2) from (
        select driver_rating from rides
         where rider_id = new.rider_id and driver_rating is not null
         order by completed_at desc nulls last limit 500) t), 5.0)
     where id = new.rider_id;
    perform set_config('app.trusted', '', true);
  end if;
  return new;
end $$;

drop trigger if exists on_ride_rated on public.rides;
create trigger on_ride_rated
  after update on public.rides
  for each row execute function public.on_ride_rated();

-- ─────────────────────────────────────────
-- Pickup PIN (optional, off by default). Kept in its own table so the driver can't read it.
-- ─────────────────────────────────────────
create table if not exists public.ride_pins (
  ride_id uuid primary key references public.rides(id) on delete cascade,
  pin text not null
);
alter table public.ride_pins enable row level security;
drop policy if exists "Rider reads own ride PIN" on public.ride_pins;
create policy "Rider reads own ride PIN" on public.ride_pins for select using (
  exists (select 1 from public.rides r join public.riders ri on ri.id = r.rider_id
           where r.id = ride_id and ri.auth_user_id = auth.uid())
);

create or replace function public.create_ride_pin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into ride_pins (ride_id, pin)
  values (new.id, lpad((floor(random() * 10000))::int::text, 4, '0'))
  on conflict (ride_id) do nothing;
  return new;
end $$;

drop trigger if exists create_ride_pin on public.rides;
create trigger create_ride_pin
  after insert on public.rides
  for each row execute function public.create_ride_pin();

create or replace function public.start_trip(p_ride_id uuid, p_pin text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.rides;
begin
  select rd.* into r from rides rd join drivers d on d.id = rd.driver_id
   where rd.id = p_ride_id and d.auth_user_id = auth.uid();
  if not found then raise exception 'Not your ride' using errcode = '42501'; end if;
  if r.status <> 'driver_arrived' then raise exception 'The trip can only start after you arrive' using errcode = '42501'; end if;
  if public.setting_enabled('require_pickup_pin')
     and not exists (select 1 from ride_pins where ride_id = p_ride_id and pin = p_pin) then
    raise exception 'Wrong PIN. Ask the rider for the 4-digit PIN in their app.' using errcode = '22023';
  end if;
  perform set_config('app.trusted', '1', true);
  update rides set status = 'in_progress', started_at = now() where id = p_ride_id;
  perform set_config('app.trusted', '', true);
end $$;

-- ─────────────────────────────────────────
-- Contact details: only while the trip is active (Uber cuts contact after drop-off)
-- ─────────────────────────────────────────
create or replace function public.ride_is_active(p_status text)
returns boolean language sql immutable as $$
  select p_status in ('pending_driver_response', 'accepted', 'driver_arrived', 'in_progress')
$$;

drop function if exists public.get_ride_driver(uuid);
create function public.get_ride_driver(p_ride_id uuid)
returns table (
  id uuid, name text, photo_url text, vehicle_make text, vehicle_model text, vehicle_color text,
  license_plate text, rating numeric, phone text
)
language sql stable security definer set search_path = public as $$
  select d.id, split_part(coalesce(nullif(d.name, ''), 'Driver'), ' ', 1), d.photo_url, d.vehicle_make, d.vehicle_model, d.vehicle_color,
         d.license_plate, d.rating,
         case when public.ride_is_active(r.status) then d.phone else null end
    from rides r
    join drivers d on d.id = r.driver_id
   where r.id = p_ride_id
     and public.is_ride_participant(p_ride_id)
$$;
revoke all on function public.get_ride_driver(uuid) from public, anon;
grant execute on function public.get_ride_driver(uuid) to authenticated;

create or replace function public.get_ride_rider(p_ride_id uuid)
returns table (first_name text, rating numeric, phone text)
language sql stable security definer set search_path = public as $$
  select split_part(coalesce(nullif(r.rider_name, ''), ri.name, 'Rider'), ' ', 1),
         ri.rating,
         case when public.ride_is_active(r.status) then nullif(ri.phone, '') else null end
    from rides r
    join riders ri on ri.id = r.rider_id
    join drivers d on d.id = r.driver_id
   where r.id = p_ride_id
     and d.auth_user_id = auth.uid()
$$;
revoke all on function public.get_ride_rider(uuid) from public, anon;
grant execute on function public.get_ride_rider(uuid) to authenticated;

-- Chat: readable by participants; sendable while the trip is active and for 30 minutes after
-- drop-off (lost items), then it closes.
create or replace function public.ride_chat_open(p_ride_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_ride_participant(p_ride_id) and exists (
    select 1 from rides r where r.id = p_ride_id and (
      public.ride_is_active(r.status)
      or (r.status = 'completed' and r.completed_at > now() - interval '30 minutes')
    )
  )
$$;

drop policy if exists "Ride participants can send messages" on public.ride_messages;
create policy "Ride participants can send messages" on public.ride_messages
  for insert with check (auth.uid() = sender_id and public.ride_chat_open(ride_id));

-- ─────────────────────────────────────────
-- Open requests for drivers: approximate pickup, rider first name only, nearby only.
-- Replaces direct table access to every open request.
-- ─────────────────────────────────────────
drop policy if exists "Drivers can view open requests" on public.rides;

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
  rider_first_name text, rider_rating numeric, pickup_distance_miles numeric
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
  -- Heartbeat: polling means the app is open. Written at most every 30 seconds.
  update drivers set last_seen_at = now()
   where id = d.id and (last_seen_at is null or last_seen_at < now() - interval '30 seconds');

  return query
  select * from (
    select r.id as id, r.created_at as created_at, r.vehicle_type as vehicle_type,
           r.pickup_address as pickup_address,
           round(r.pickup_lat::numeric, 3)::double precision as pickup_lat,
           round(r.pickup_lng::numeric, 3)::double precision as pickup_lng,
           r.dropoff_address as dropoff_address, r.distance_miles as distance_miles, r.duration_minutes as duration_minutes,
           r.fare_cents as fare_cents, r.driver_payout_cents as driver_payout_cents,
           split_part(coalesce(nullif(r.rider_name, ''), 'Rider'), ' ', 1) as rider_first_name,
           ri.rating as rider_rating,
           case when p_lat is null or p_lng is null then null else
             round((2 * 3958.8 * asin(least(1, sqrt(
               power(sin(radians(r.pickup_lat - p_lat) / 2), 2)
               + cos(radians(p_lat)) * cos(radians(r.pickup_lat)) * power(sin(radians(r.pickup_lng - p_lng) / 2), 2)
             ))))::numeric, 1)
           end as pickup_distance_miles
      from rides r
      left join riders ri on ri.id = r.rider_id
     where r.status = 'requested'
       and r.driver_id is null
       and r.created_at > now() - interval '3 minutes'
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

-- ─────────────────────────────────────────
-- Live trip sharing (Uber "Share trip status")
-- ─────────────────────────────────────────
create or replace function public.create_share_link(p_ride_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  token uuid;
begin
  if not exists (select 1 from rides r join riders ri on ri.id = r.rider_id
                  where r.id = p_ride_id and ri.auth_user_id = auth.uid()) then
    raise exception 'Not your ride' using errcode = '42501';
  end if;
  select share_token into token from rides where id = p_ride_id;
  if token is null then
    token := gen_random_uuid();
    perform set_config('app.trusted', '1', true);
    update rides set share_token = token where id = p_ride_id;
    perform set_config('app.trusted', '', true);
  end if;
  return token;
end $$;
revoke all on function public.create_share_link(uuid) from public, anon;
grant execute on function public.create_share_link(uuid) to authenticated;

-- Public: anyone with the secret link sees the trip while it's live (and for an hour after it ends).
create or replace function public.get_shared_trip(p_token uuid)
returns table (
  status text, pickup_address text, dropoff_address text,
  pickup_lat double precision, pickup_lng double precision,
  dropoff_lat double precision, dropoff_lng double precision,
  driver_first_name text, driver_photo_url text, vehicle text, license_plate text,
  driver_lat double precision, driver_lng double precision, driver_location_at timestamptz,
  rider_first_name text, updated_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select r.status, r.pickup_address, r.dropoff_address,
         r.pickup_lat, r.pickup_lng, r.dropoff_lat, r.dropoff_lng,
         split_part(coalesce(d.name, 'Driver'), ' ', 1), d.photo_url,
         nullif(trim(concat_ws(' ', d.vehicle_color, d.vehicle_make, d.vehicle_model)), ''),
         d.license_plate,
         r.driver_lat, r.driver_lng, r.driver_location_at,
         split_part(coalesce(nullif(r.rider_name, ''), 'Rider'), ' ', 1),
         greatest(r.accepted_at, r.arrived_at, r.started_at, r.completed_at, r.cancelled_at, r.driver_location_at)
    from rides r
    left join drivers d on d.id = r.driver_id
   where r.share_token = p_token
     and (public.ride_is_active(r.status) or r.status = 'requested'
          or coalesce(r.completed_at, r.cancelled_at) > now() - interval '1 hour')
$$;
grant execute on function public.get_shared_trip(uuid) to anon, authenticated;

-- ─────────────────────────────────────────
-- Safety reports: admins can work them
-- ─────────────────────────────────────────
drop policy if exists "Admins can update safety reports" on public.safety_reports;
create policy "Admins can update safety reports" on public.safety_reports for update using (public.is_admin());

-- ─────────────────────────────────────────
-- Driver payouts ledger (manual bank transfer / cash / mobile money, or Stripe later)
-- ─────────────────────────────────────────
create table if not exists public.driver_payouts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  method text not null default 'bank_transfer' check (method in ('bank_transfer', 'cash', 'mobile_money', 'stripe', 'other')),
  reference text,
  note text,
  status text not null default 'paid' check (status in ('paid', 'void')),
  created_at timestamptz default now(),
  created_by uuid default auth.uid()
);
alter table public.driver_payouts enable row level security;
drop policy if exists "Admins manage payouts" on public.driver_payouts;
drop policy if exists "Drivers read own payouts" on public.driver_payouts;
create policy "Admins manage payouts" on public.driver_payouts for all using (public.is_admin()) with check (public.is_admin());
create policy "Drivers read own payouts" on public.driver_payouts for select using (
  driver_id in (select id from public.drivers where auth_user_id = auth.uid())
);

-- Earned = paid trips' driver share + driver share of cancellation/no-show fees + tips. Balance = earned − payouts.
create or replace function public.driver_earnings_summary(p_driver_id uuid default null)
returns table (driver_id uuid, earned_cents bigint, tips_cents bigint, paid_out_cents bigint, balance_cents bigint, paid_trips bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  target uuid := p_driver_id;
begin
  if target is null then
    select id into target from drivers where auth_user_id = auth.uid();
  elsif not public.is_admin() and not exists (select 1 from drivers where id = target and auth_user_id = auth.uid()) then
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
  ), p as (
    select coalesce(sum(amount_cents), 0)::bigint as paid from driver_payouts where driver_payouts.driver_id = target and status = 'paid'
  )
  select target, e.earned + e.tips, e.tips, p.paid, e.earned + e.tips - p.paid, e.trips from e, p;
end $$;
revoke all on function public.driver_earnings_summary(uuid) from public, anon;
grant execute on function public.driver_earnings_summary(uuid) to authenticated;

-- ─────────────────────────────────────────
-- Storage: avatars must be images
-- ─────────────────────────────────────────
do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;
  drop policy if exists "Users upload own avatar" on storage.objects;
  drop policy if exists "Users update own avatar" on storage.objects;
  create policy "Users upload own avatar" on storage.objects for insert to authenticated
    with check (bucket_id = 'avatars' and name ~ ('^avatars/' || auth.uid()::text || '\.(jpg|jpeg|png|webp|gif)$'));
  create policy "Users update own avatar" on storage.objects for update to authenticated
    using (bucket_id = 'avatars' and name ~ ('^avatars/' || auth.uid()::text || '\.(jpg|jpeg|png|webp|gif)$'));
end $$;

-- ─────────────────────────────────────────
-- Realtime: live-location channels are private to the ride's participants
-- (the app joins them with { private: true }; the ride row still carries the location as a fallback)
-- ─────────────────────────────────────────
do $$
begin
  if to_regclass('realtime.messages') is null then
    return;
  end if;
  execute 'drop policy if exists "Ride participants read ride channels" on realtime.messages';
  execute 'drop policy if exists "Ride participants write ride channels" on realtime.messages';
  execute $p$create policy "Ride participants read ride channels" on realtime.messages for select to authenticated using (
    case when realtime.topic() ~ '^ride-location-[0-9a-f-]{36}$'
         then public.is_ride_participant(substring(realtime.topic() from 15)::uuid) else false end)$p$;
  execute $p$create policy "Ride participants write ride channels" on realtime.messages for insert to authenticated with check (
    case when realtime.topic() ~ '^ride-location-[0-9a-f-]{36}$'
         then public.is_ride_participant(substring(realtime.topic() from 15)::uuid) else false end)$p$;
end $$;

-- Admin payouts page: every driver's balance in one call.
create or replace function public.admin_driver_balances()
returns table (driver_id uuid, name text, phone text, earned_cents bigint, paid_out_cents bigint, balance_cents bigint, paid_trips bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
  select d.id, d.name, d.phone, s.earned_cents, s.paid_out_cents, s.balance_cents, s.paid_trips
    from drivers d
    cross join lateral public.driver_earnings_summary(d.id) s
   order by s.balance_cents desc, d.name;
end $$;
revoke all on function public.admin_driver_balances() from public, anon;
grant execute on function public.admin_driver_balances() to authenticated;

-- ─────────────────────────────────────────
-- Web push subscriptions (trip alerts when the app is in the background)
-- ─────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Trip counters for both sides (riders' "rides" count was never maintained).
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
    end if;
    update riders set total_rides = coalesce(total_rides, 0) + 1 where id = new.rider_id;
    perform set_config('app.trusted', '', true);
  end if;
  return new;
end $$;
