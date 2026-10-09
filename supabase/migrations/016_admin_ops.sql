-- 016: admin operations. A support-staff role, the team list (also who gets ride alerts), private notes on
-- riders, drivers and rides, and a log of admin actions. Safe to re-run.

-- ─────────────────────────────────────────
-- Staff: admins plus support agents (app_metadata.role = 'support', set from Admin › Team). Support staff can
-- see riders, drivers, rides, support tickets and safety reports, and work tickets and reports. Money, settings,
-- promos, payouts, approvals and refunds stay admin-only (is_admin()). Writes that need more go through the
-- server, which checks the role itself.
-- ─────────────────────────────────────────
create or replace function public.is_staff()
returns boolean language sql stable as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'support'), false)
$$;

create table if not exists public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  role text not null check (role in ('admin', 'support')),
  ride_alerts boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.staff enable row level security;
drop policy if exists "Staff read team" on public.staff;
create policy "Staff read team" on public.staff for select using (public.is_staff());

-- Everyone who already has an admin or support role.
insert into public.staff (user_id, email, role)
select u.id, u.email, u.raw_app_meta_data ->> 'role'
  from auth.users u
 where u.raw_app_meta_data ->> 'role' in ('admin', 'support')
on conflict (user_id) do nothing;

drop policy if exists "Staff can read all rides" on public.rides;
drop policy if exists "Staff can read all riders" on public.riders;
drop policy if exists "Staff can read all drivers" on public.drivers;
drop policy if exists "Staff can read all support tickets" on public.support_tickets;
drop policy if exists "Staff can update support tickets" on public.support_tickets;
drop policy if exists "Staff can read all safety reports" on public.safety_reports;
drop policy if exists "Staff can update safety reports" on public.safety_reports;
create policy "Staff can read all rides" on public.rides for select using (public.is_staff());
create policy "Staff can read all riders" on public.riders for select using (public.is_staff());
create policy "Staff can read all drivers" on public.drivers for select using (public.is_staff());
create policy "Staff can read all support tickets" on public.support_tickets for select using (public.is_staff());
create policy "Staff can update support tickets" on public.support_tickets for update using (public.is_staff());
create policy "Staff can read all safety reports" on public.safety_reports for select using (public.is_staff());
create policy "Staff can update safety reports" on public.safety_reports for update using (public.is_staff());

-- ─────────────────────────────────────────
-- Notes: private to staff, on a rider, driver or ride ("Called about the late pickup"). The author is stamped
-- from the session, so it can't be faked.
-- ─────────────────────────────────────────
create table if not exists public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('rider', 'driver', 'ride')),
  subject_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  author_id uuid,
  author_email text,
  created_at timestamptz not null default now()
);
create index if not exists admin_notes_subject_idx on public.admin_notes (subject_type, subject_id, created_at desc);
alter table public.admin_notes enable row level security;
drop policy if exists "Staff read notes" on public.admin_notes;
drop policy if exists "Staff add notes" on public.admin_notes;
drop policy if exists "Authors and admins delete notes" on public.admin_notes;
create policy "Staff read notes" on public.admin_notes for select using (public.is_staff());
create policy "Staff add notes" on public.admin_notes for insert with check (public.is_staff());
create policy "Authors and admins delete notes" on public.admin_notes for delete using (public.is_admin() or author_id = auth.uid());

create or replace function public.stamp_admin_note()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    new.author_id := auth.uid();
    new.author_email := auth.jwt() ->> 'email';
  end if;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists stamp_admin_note on public.admin_notes;
create trigger stamp_admin_note before insert on public.admin_notes
  for each row execute function public.stamp_admin_note();

-- ─────────────────────────────────────────
-- Action log: who did what, and when. The server writes its own actions (refunds, credit, cancel, assign,
-- broadcasts, team changes); the triggers below record edits made straight from the admin pages (suspending a
-- rider, approving or editing a driver, promos, settings, payouts, tickets, reports). Admins only.
-- ─────────────────────────────────────────
create table if not exists public.admin_actions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id uuid,
  actor_email text,
  action text not null,
  target_type text,
  target_id text,
  summary text,
  details jsonb
);
create index if not exists admin_actions_created_idx on public.admin_actions (created_at desc);
create index if not exists admin_actions_target_idx on public.admin_actions (target_type, target_id);
alter table public.admin_actions enable row level security;
drop policy if exists "Admins read action log" on public.admin_actions;
create policy "Admins read action log" on public.admin_actions for select using (public.is_admin());

-- Records which columns a staff member changed (old and new values). Does nothing for riders, drivers and the
-- server, so it costs nothing on the busy paths (driver locations, trip updates).
create or replace function public.log_staff_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  n jsonb;
  o jsonb;
  k text;
  changed jsonb := '{}'::jsonb;
  noise text[] := array['updated_at', 'last_seen_at', 'last_lat', 'last_lng', 'driver_lat', 'driver_lng', 'driver_location_at', 'last_moved_at'];
begin
  if not public.is_staff() then
    return null;
  end if;
  n := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  o := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  -- A team member who also rides or drives: their own profile, and trips they take or drive, aren't admin work.
  if coalesce(n ->> 'auth_user_id', o ->> 'auth_user_id') = auth.uid()::text then
    return null;
  end if;
  if tg_table_name = 'rides' and (
       exists (select 1 from drivers d where d.auth_user_id = auth.uid() and d.id in ((n ->> 'driver_id')::uuid, (o ->> 'driver_id')::uuid))
    or exists (select 1 from riders r where r.auth_user_id = auth.uid() and r.id in ((n ->> 'rider_id')::uuid, (o ->> 'rider_id')::uuid))) then
    return null;
  end if;
  for k in select jsonb_object_keys(n || o) loop
    if not (k = any (noise)) and (n -> k) is distinct from (o -> k) then
      changed := changed || jsonb_build_object(k, jsonb_build_array(o -> k, n -> k));
    end if;
  end loop;
  if changed = '{}'::jsonb then
    return null;
  end if;
  insert into admin_actions (actor_id, actor_email, action, target_type, target_id, details)
  values (auth.uid(), auth.jwt() ->> 'email', tg_table_name || '.' || lower(tg_op), tg_table_name,
          coalesce(n ->> 'id', o ->> 'id', n ->> 'key', o ->> 'key'), changed);
  return null;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['riders', 'drivers', 'rides', 'promo_codes', 'app_settings', 'driver_payouts', 'driver_quests', 'support_tickets', 'safety_reports'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists log_staff_change on public.%I', t);
      execute format('create trigger log_staff_change after insert or update or delete on public.%I for each row execute function public.log_staff_change()', t);
    end if;
  end loop;
end $$;
