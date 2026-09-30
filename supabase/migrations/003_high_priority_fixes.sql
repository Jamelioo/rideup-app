-- 003_high_priority_fixes.sql
-- Run AFTER 002_security_hardening.sql. Idempotent.
--
--   #10 schema/code mismatches (scheduled_rides, card display columns)
--   #12 riders can read their driver's details for their own ride only (RPC)
--   #14 payment method fields can only be written by the server (Stripe-verified)
--   #17 platform fee / driver payout recorded per ride (20% / 80%)
--   #22 scheduled rides can be dispatched by the server
--   Storage: upload policies for avatars + driver documents

-- ─────────────────────────────────────────
-- Riders: card display info + server-only payment fields
-- ─────────────────────────────────────────
alter table public.riders add column if not exists card_brand text;
alter table public.riders add column if not exists card_last4 text;

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
    return new;
  end if;

  -- Only the server (after verifying with Stripe) may change these.
  new.stripe_customer_id := old.stripe_customer_id;
  new.payment_method_id := old.payment_method_id;
  new.card_brand := old.card_brand;
  new.card_last4 := old.card_last4;
  new.rating := old.rating;
  new.total_rides := old.total_rides;
  return new;
end $$;

drop trigger if exists guard_riders on public.riders;
create trigger guard_riders
  before insert or update on public.riders
  for each row execute function public.guard_riders();

-- ─────────────────────────────────────────
-- Rides: payout split + receipt card info
-- ─────────────────────────────────────────
alter table public.rides add column if not exists platform_fee_cents integer;
alter table public.rides add column if not exists driver_payout_cents integer;
alter table public.rides add column if not exists payment_brand text;
alter table public.rides add column if not exists payment_last4 text;

-- Runs after guard_rides_insert (triggers fire alphabetically) so the fare is already final.
create or replace function public.set_ride_fee()
returns trigger language plpgsql as $$
begin
  if new.fare_cents is not null then
    new.platform_fee_cents := round(new.fare_cents * 0.20)::int;
    new.driver_payout_cents := new.fare_cents - new.platform_fee_cents;
  end if;
  return new;
end $$;

drop trigger if exists guard_rides_insert_fee on public.rides;
create trigger guard_rides_insert_fee
  before insert on public.rides
  for each row execute function public.set_ride_fee();

-- Backfill existing rides
update public.rides
   set platform_fee_cents = round(fare_cents * 0.20)::int,
       driver_payout_cents = fare_cents - round(fare_cents * 0.20)::int
 where fare_cents is not null and driver_payout_cents is null;

-- ─────────────────────────────────────────
-- Riders see their driver's details for their own ride (drivers table is private)
-- ─────────────────────────────────────────
create or replace function public.get_ride_driver(p_ride_id uuid)
returns table (
  id uuid, name text, vehicle_make text, vehicle_model text, vehicle_color text,
  license_plate text, rating numeric, phone text
)
language sql stable security definer set search_path = public as $$
  select d.id, d.name, d.vehicle_make, d.vehicle_model, d.vehicle_color,
         d.license_plate, d.rating, d.phone
    from rides r
    join drivers d on d.id = r.driver_id
   where r.id = p_ride_id
     and public.is_ride_participant(p_ride_id)
$$;

revoke all on function public.get_ride_driver(uuid) from public, anon;
grant execute on function public.get_ride_driver(uuid) to authenticated;

-- ─────────────────────────────────────────
-- Scheduled rides: match the columns/ids the app really uses
-- ─────────────────────────────────────────
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'scheduled_rides' and column_name = 'scheduled_for')
     and not exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'scheduled_rides' and column_name = 'scheduled_at') then
    alter table public.scheduled_rides rename column scheduled_for to scheduled_at;
  end if;
end $$;

alter table public.scheduled_rides add column if not exists distance_miles numeric(6,2);
alter table public.scheduled_rides add column if not exists duration_minutes numeric(6,2);
alter table public.scheduled_rides add column if not exists dispatched_ride_id uuid;

-- The app stores riders.id (not auth.users.id) here.
alter table public.scheduled_rides drop constraint if exists scheduled_rides_rider_id_fkey;
alter table public.scheduled_rides
  add constraint scheduled_rides_rider_id_fkey
  foreign key (rider_id) references public.riders(id) on delete cascade not valid;

drop policy if exists "Users can manage own scheduled rides" on public.scheduled_rides;
drop policy if exists "Riders manage own scheduled rides" on public.scheduled_rides;
create policy "Riders manage own scheduled rides" on public.scheduled_rides
  for all
  using (rider_id in (select id from public.riders where auth_user_id = auth.uid()))
  with check (rider_id in (select id from public.riders where auth_user_id = auth.uid()));

create index if not exists idx_scheduled_rides_due on public.scheduled_rides (scheduled_at) where status = 'scheduled';

-- ─────────────────────────────────────────
-- Storage policies (skipped automatically where the storage schema doesn't exist)
-- ─────────────────────────────────────────
do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
  insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;

  -- Avatars: world-readable, but each user can only write their own file (avatars/<uid>.<ext>)
  drop policy if exists "Avatars are public" on storage.objects;
  drop policy if exists "Users upload own avatar" on storage.objects;
  drop policy if exists "Users update own avatar" on storage.objects;
  create policy "Avatars are public" on storage.objects for select using (bucket_id = 'avatars');
  create policy "Users upload own avatar" on storage.objects for insert to authenticated
    with check (bucket_id = 'avatars' and name like 'avatars/' || auth.uid()::text || '.%');
  create policy "Users update own avatar" on storage.objects for update to authenticated
    using (bucket_id = 'avatars' and name like 'avatars/' || auth.uid()::text || '.%');

  -- Driver documents: private; owner (driver-documents/<uid>/...) and admins only
  drop policy if exists "Users upload own documents" on storage.objects;
  drop policy if exists "Users update own documents" on storage.objects;
  drop policy if exists "Users and admins read documents" on storage.objects;
  create policy "Users upload own documents" on storage.objects for insert to authenticated
    with check (bucket_id = 'documents' and (storage.foldername(name))[1] = 'driver-documents'
                and (storage.foldername(name))[2] = auth.uid()::text);
  create policy "Users update own documents" on storage.objects for update to authenticated
    using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'driver-documents'
           and (storage.foldername(name))[2] = auth.uid()::text);
  create policy "Users and admins read documents" on storage.objects for select to authenticated
    using (bucket_id = 'documents'
           and ((storage.foldername(name))[2] = auth.uid()::text or public.is_admin()));
end $$;

-- ─────────────────────────────────────────
-- Realtime: the app subscribes to rides + chat (the base schema never enabled it)
-- ─────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rides') then
      alter publication supabase_realtime add table public.rides;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ride_messages') then
      alter publication supabase_realtime add table public.ride_messages;
    end if;
  end if;
end $$;
