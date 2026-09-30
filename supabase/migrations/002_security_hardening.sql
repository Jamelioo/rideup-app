-- 002_security_hardening.sql
-- Run in Supabase SQL Editor AFTER supabase-schema.sql and 001_create_leads_table.sql.
-- Idempotent: safe to re-run.
--
-- What this fixes (see AUDIT.md):
--   #1  Admin role came from user_metadata (user-editable) -> now app_metadata (server-only).
--   #2  Drivers could self-approve / edit rating+trip counts.
--   #4  Clients could write fare/payment fields on rides and choose their own fare.
--   #7  Ride accept was racy and blocked by RLS -> atomic accept_ride()/decline_ride() RPCs.
--   #8  ride_messages were readable by every authenticated user.
--
-- !! AFTER RUNNING: re-grant admin to your admin account(s), because the old
-- user_metadata role no longer counts:
--
--   update auth.users
--      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
--    where email = 'you@example.com';
--
-- Then sign out / in again (the role is read from the JWT).
-- To review who had the old self-assigned flag:
--   select email, raw_user_meta_data->>'role' from auth.users where raw_user_meta_data ? 'role';

-- ─────────────────────────────────────────
-- Columns the app and API already use but the base schema lacks
-- ─────────────────────────────────────────
alter table public.riders  add column if not exists is_guest boolean default false;
alter table public.riders  add column if not exists stripe_customer_id text;
alter table public.riders  add column if not exists payment_method_id text;

alter table public.drivers add column if not exists total_trips integer default 0;

alter table public.rides add column if not exists rider_name text;
alter table public.rides add column if not exists declined_by uuid[] default '{}';
alter table public.rides add column if not exists accepted_at timestamptz;
alter table public.rides add column if not exists driver_lat double precision;
alter table public.rides add column if not exists driver_lng double precision;
alter table public.rides add column if not exists payment_intent_id text;
alter table public.rides add column if not exists payment_status text;
alter table public.rides add column if not exists paid_at timestamptz;
alter table public.rides add column if not exists payment_session_id text;

-- Chat code reads/writes `content`; base schema called it `message`.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'ride_messages' and column_name = 'message')
     and not exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'ride_messages' and column_name = 'content') then
    alter table public.ride_messages rename column message to content;
  end if;
end $$;

-- ─────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────
-- Admin = app_metadata.role (only settable server-side / via SQL, never by the user).
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

-- "Trusted" writers skip the column guards below: service role / SQL editor
-- (no JWT subject), admins, and our own SECURITY DEFINER RPCs (which set app.trusted).
create or replace function public.is_trusted_caller()
returns boolean language sql stable as $$
  select auth.uid() is null
      or coalesce(current_setting('app.trusted', true), '') = '1'
      or public.is_admin()
$$;

-- ─────────────────────────────────────────
-- DRIVERS: no self-approval, no self-edited stats
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
    new.rating := 5.0;
    new.total_rides := 0;
    new.total_trips := 0;
    new.total_earnings := 0;
    return new;
  end if;

  new.approved := old.approved;
  new.rating := old.rating;
  new.total_rides := old.total_rides;
  new.total_trips := old.total_trips;
  new.total_earnings := old.total_earnings;

  -- Drivers may only toggle online/offline/on_trip, and only once approved.
  if new.status is distinct from old.status
     and (not coalesce(old.approved, false) or new.status not in ('online', 'offline', 'on_trip')) then
    new.status := old.status;
  end if;

  return new;
end $$;

drop trigger if exists guard_drivers on public.drivers;
create trigger guard_drivers
  before insert or update on public.drivers
  for each row execute function public.guard_drivers();

-- ─────────────────────────────────────────
-- RIDES: server-computed fare, protected columns, valid status transitions
-- ─────────────────────────────────────────
-- Fare rates MUST match src/lib/pricing.js (RATES).
create or replace function public.guard_rides_insert()
returns trigger language plpgsql as $$
declare
  a numeric;
  straight numeric;
  base int; per_mile int; per_min int; minimum int;
begin
  if public.is_trusted_caller() then
    return new;
  end if;

  if new.pickup_lat is null or new.pickup_lng is null
     or new.dropoff_lat is null or new.dropoff_lng is null then
    raise exception 'Pickup and dropoff coordinates are required' using errcode = '22023';
  end if;

  -- Lifecycle / payment fields are never client-controlled on insert.
  new.status := 'requested';
  new.driver_id := null;
  new.declined_by := '{}';
  new.accepted_at := null;
  new.started_at := null;
  new.completed_at := null;
  new.cancelled_at := null;
  new.cancel_reason := null;
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

  if new.vehicle_type is null or new.vehicle_type not in ('standard', 'xl', 'premium') then
    new.vehicle_type := 'standard';
  end if;

  -- Distance can't be shorter than the straight line between the two points;
  -- duration can't imply more than 60 mph.
  a := power(sin(radians(new.dropoff_lat - new.pickup_lat) / 2), 2)
     + cos(radians(new.pickup_lat)) * cos(radians(new.dropoff_lat))
       * power(sin(radians(new.dropoff_lng - new.pickup_lng) / 2), 2);
  straight := 2 * 3958.8 * asin(least(1, sqrt(a)));
  new.distance_miles := round(greatest(coalesce(new.distance_miles, 0), straight), 2);
  new.duration_minutes := round(greatest(coalesce(new.duration_minutes, 0), new.distance_miles), 2);

  if new.vehicle_type = 'xl' then
    base := 450; per_mile := 230; per_min := 30; minimum := 1000;
  elsif new.vehicle_type = 'premium' then
    base := 700; per_mile := 320; per_min := 40; minimum := 1500;
  else
    base := 250; per_mile := 165; per_min := 20; minimum := 600;
  end if;

  new.fare_cents := greatest(
    round(base + new.distance_miles * per_mile + new.duration_minutes * per_min)::int,
    minimum
  );

  return new;
end $$;

drop trigger if exists guard_rides_insert on public.rides;
create trigger guard_rides_insert
  before insert on public.rides
  for each row execute function public.guard_rides_insert();

create or replace function public.guard_rides_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  -- Columns riders/drivers may change directly. Everything else (fare, payment,
  -- driver assignment, route, declined_by, ...) is server-only.
  mutable text[] := array[
    'status', 'started_at', 'completed_at', 'cancelled_at', 'cancel_reason',
    'driver_lat', 'driver_lng',
    'rider_rating', 'rider_feedback', 'rider_compliments',
    'driver_rating', 'driver_feedback'
  ];
  is_driver boolean;
  is_rider boolean;
begin
  if public.is_trusted_caller() then
    return new;
  end if;

  if (to_jsonb(new) - mutable) is distinct from (to_jsonb(old) - mutable) then
    raise exception 'Not allowed to modify protected ride fields' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if old.status in ('completed', 'cancelled') then
      raise exception 'Ride is already finished' using errcode = '42501';
    end if;

    select exists (select 1 from drivers d where d.id = old.driver_id and d.auth_user_id = auth.uid()) into is_driver;
    select exists (select 1 from riders r where r.id = old.rider_id and r.auth_user_id = auth.uid()) into is_rider;

    if is_driver and (
         (old.status = 'accepted'       and new.status in ('driver_arrived', 'cancelled'))
      or (old.status = 'driver_arrived' and new.status in ('in_progress', 'cancelled'))
      or (old.status = 'in_progress'    and new.status = 'completed')
    ) then
      return new;
    end if;

    if is_rider and new.status = 'cancelled'
       and old.status in ('requested', 'pending_driver_response', 'accepted', 'driver_arrived') then
      return new;
    end if;

    raise exception 'Invalid ride status change % -> %', old.status, new.status using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists guard_rides_update on public.rides;
create trigger guard_rides_update
  before update on public.rides
  for each row execute function public.guard_rides_update();

-- Trip counters are server-maintained (drivers can't write them).
create or replace function public.on_ride_completed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' and new.driver_id is not null then
    perform set_config('app.trusted', '1', true);
    update drivers
       set total_trips = coalesce(total_trips, 0) + 1,
           total_rides = coalesce(total_rides, 0) + 1
     where id = new.driver_id;
    perform set_config('app.trusted', '', true);
  end if;
  return new;
end $$;

drop trigger if exists on_ride_completed on public.rides;
create trigger on_ride_completed
  after update on public.rides
  for each row execute function public.on_ride_completed();

-- ─────────────────────────────────────────
-- Atomic accept / decline (drivers can't UPDATE unassigned rides directly)
-- ─────────────────────────────────────────
-- Claims the ride for the calling driver. Returns the ride, or no row if it was
-- already taken / cancelled / declined. The status moves to
-- 'pending_driver_response' until /api/authorize-ride holds the rider's card and
-- flips it to 'accepted' (or cancels it on payment failure).
create or replace function public.accept_ride(p_ride_id uuid)
returns setof public.rides
language plpgsql security definer set search_path = public as $$
declare
  d public.drivers;
begin
  select * into d from drivers where auth_user_id = auth.uid() and approved = true;
  if not found then
    raise exception 'Not an approved driver' using errcode = '42501';
  end if;

  if exists (select 1 from rides
              where driver_id = d.id
                and status in ('pending_driver_response', 'accepted', 'driver_arrived', 'in_progress')) then
    raise exception 'Driver already has an active ride' using errcode = '23505';
  end if;

  perform set_config('app.trusted', '1', true);
  return query
    update rides
       set driver_id = d.id,
           status = 'pending_driver_response',
           accepted_at = now()
     where id = p_ride_id
       and status = 'requested'
       and driver_id is null
       and not (d.id = any (coalesce(declined_by, '{}')))
    returning *;
  perform set_config('app.trusted', '', true);
end $$;

create or replace function public.decline_ride(p_ride_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  d public.drivers;
begin
  select * into d from drivers where auth_user_id = auth.uid() and approved = true;
  if not found then
    raise exception 'Not an approved driver' using errcode = '42501';
  end if;

  perform set_config('app.trusted', '1', true);
  update rides
     set declined_by = array_append(coalesce(declined_by, '{}'), d.id)
   where id = p_ride_id
     and status = 'requested'
     and not (d.id = any (coalesce(declined_by, '{}')));
  perform set_config('app.trusted', '', true);
end $$;

revoke all on function public.accept_ride(uuid)  from public, anon;
revoke all on function public.decline_ride(uuid) from public, anon;
grant execute on function public.accept_ride(uuid)  to authenticated;
grant execute on function public.decline_ride(uuid) to authenticated;

-- ─────────────────────────────────────────
-- RLS policies
-- ─────────────────────────────────────────
-- Admin policies: swap user_metadata for is_admin()
drop policy if exists "Admins can read all drivers" on public.drivers;
drop policy if exists "Admins can update all drivers" on public.drivers;
drop policy if exists "Admins can read all riders" on public.riders;
drop policy if exists "Admins can read all rides" on public.rides;
drop policy if exists "Admins can update all rides" on public.rides;
drop policy if exists "Admins can read all support tickets" on public.support_tickets;
drop policy if exists "Admins can update all support tickets" on public.support_tickets;
drop policy if exists "Admins can read all safety reports" on public.safety_reports;

create policy "Admins can read all drivers" on public.drivers for select using (public.is_admin());
create policy "Admins can update all drivers" on public.drivers for update using (public.is_admin());
create policy "Admins can read all riders" on public.riders for select using (public.is_admin());
create policy "Admins can read all rides" on public.rides for select using (public.is_admin());
create policy "Admins can update all rides" on public.rides for update using (public.is_admin());
create policy "Admins can read all support tickets" on public.support_tickets for select using (public.is_admin());
create policy "Admins can update all support tickets" on public.support_tickets for update using (public.is_admin());
create policy "Admins can read all safety reports" on public.safety_reports for select using (public.is_admin());

-- Approved drivers can see open requests (also what Realtime INSERT events need).
drop policy if exists "Drivers can view open requests" on public.rides;
create policy "Drivers can view open requests" on public.rides for select using (
  status = 'requested'
  and exists (select 1 from public.drivers d where d.auth_user_id = auth.uid() and d.approved = true)
);

-- Chat: participants only.
create or replace function public.is_ride_participant(p_ride_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1
      from rides r
      left join riders ri on ri.id = r.rider_id
      left join drivers d on d.id = r.driver_id
     where r.id = p_ride_id
       and (ri.auth_user_id = auth.uid() or d.auth_user_id = auth.uid())
  )
$$;

drop policy if exists "Ride participants can read messages" on public.ride_messages;
drop policy if exists "Users can send messages" on public.ride_messages;
drop policy if exists "Ride participants can send messages" on public.ride_messages;

create policy "Ride participants can read messages" on public.ride_messages
  for select using (public.is_ride_participant(ride_id));
create policy "Ride participants can send messages" on public.ride_messages
  for insert with check (auth.uid() = sender_id and public.is_ride_participant(ride_id));
