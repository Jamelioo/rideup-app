-- 012: security hardening from the pre-launch review, "book for someone else", and driver document expiry
-- reminders. Safe to re-run.

-- ─────────────────────────────────────────
-- Security review fixes
-- ─────────────────────────────────────────
-- Internal helpers were callable by anyone through the API: promo_discount_for let a stranger test promo
-- codes (and see their value) and probe other riders' redemptions. Only our own functions call them now.
revoke all on function public.promo_discount_for(uuid, text) from public, anon, authenticated;
revoke all on function public.rider_has_completed_ride(uuid) from public, anon, authenticated;

-- Trigger functions are never called directly.
do $$
declare f text;
begin
  foreach f in array array['block_self_referral()', 'create_ride_pin()', 'expire_splits_on_cancel()', 'guard_rides_insert()',
                           'guard_rides_update()', 'handle_new_user()', 'on_ride_completed()', 'on_ride_rated()'] loop
    if to_regprocedure('public.' || f) is not null then
      execute format('revoke all on function public.%s from public, anon, authenticated', f);
    end if;
  end loop;
end $$;

-- A SECURITY DEFINER function must pin its search_path.
alter function public.handle_new_user() set search_path = public;

-- Promo codes: at most 10 wrong codes per rider per hour, so codes can't be guessed by trying many.
-- check_promo now returns the reason in `error` instead of raising, so failed tries can be counted.
create table if not exists public.promo_attempts (
  rider_id uuid not null references public.riders(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists promo_attempts_rider_idx on public.promo_attempts (rider_id, attempted_at desc);
alter table public.promo_attempts enable row level security;

drop function if exists public.check_promo(text);
create function public.check_promo(p_code text)
returns table (code text, amount_cents integer, description text, error text)
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid;
begin
  select id into me from riders where auth_user_id = auth.uid();
  if me is null then
    return query select null::text, null::integer, null::text, 'Sign in to use a promo code.'::text; return;
  end if;
  if (select count(*) from promo_attempts where rider_id = me and attempted_at > now() - interval '1 hour') >= 10 then
    return query select null::text, null::integer, null::text, 'Too many tries. Please wait an hour and try again.'::text; return;
  end if;
  begin
    perform public.promo_discount_for(me, p_code);
  exception when sqlstate '22023' then
    insert into promo_attempts (rider_id) values (me);
    return query select null::text, null::integer, null::text, sqlerrm::text; return;
  end;
  return query select p.code, p.amount_cents, p.description, null::text from promo_codes p where p.code = upper(btrim(p_code));
end $$;
revoke all on function public.check_promo(text) from public, anon;
grant execute on function public.check_promo(text) to authenticated;

-- ─────────────────────────────────────────
-- Book for someone else: the rider pays, the passenger is picked up. The driver sees the passenger's name
-- (rider_name) and phone; the passenger can get the driver's details by text.
-- ─────────────────────────────────────────
alter table public.rides add column if not exists passenger_name text;
alter table public.rides add column if not exists passenger_phone text;

create or replace function public.rides_passenger()
returns trigger language plpgsql as $$
begin
  new.passenger_name := nullif(btrim(coalesce(new.passenger_name, '')), '');
  new.passenger_phone := nullif(btrim(coalesce(new.passenger_phone, '')), '');
  if new.passenger_name is null and new.passenger_phone is null then return new; end if;
  if new.passenger_name is null or length(new.passenger_name) not between 2 and 60 then
    raise exception 'Enter the passenger''s name.' using errcode = '22023', hint = 'passenger';
  end if;
  if new.passenger_phone is null or length(regexp_replace(new.passenger_phone, '\D', '', 'g')) not between 7 and 15 then
    raise exception 'Enter the passenger''s phone number so the driver can reach them.' using errcode = '22023', hint = 'passenger';
  end if;
  new.rider_name := new.passenger_name; -- what drivers, the trip link and the request card show
  return new;
end $$;
drop trigger if exists rides_passenger on public.rides;
create trigger rides_passenger before insert on public.rides for each row execute function public.rides_passenger();

-- Driver's view of who to pick up: the passenger's phone when someone else booked.
create or replace function public.get_ride_rider(p_ride_id uuid)
returns table (first_name text, rating numeric, phone text)
language sql stable security definer set search_path = public as $$
  select split_part(coalesce(nullif(r.rider_name, ''), ri.name, 'Rider'), ' ', 1),
         ri.rating,
         case when public.ride_is_active(r.status) then nullif(coalesce(r.passenger_phone, ri.phone), '') else null end
    from rides r
    join riders ri on ri.id = r.rider_id
    join drivers d on d.id = r.driver_id
   where r.id = p_ride_id
     and d.auth_user_id = auth.uid()
$$;

-- ─────────────────────────────────────────
-- Driver document expiry reminders: 30 days, 7 days and on expiry (sent by the every-minute job, at most
-- once per stage per document). Drivers whose licence or insurance has expired are taken offline.
-- ─────────────────────────────────────────
create table if not exists public.driver_doc_reminders (
  driver_id uuid not null references public.drivers(id) on delete cascade,
  doc text not null check (doc in ('license', 'insurance')),
  stage text not null check (stage in ('30d', '7d', 'expired')),
  expires_on date not null,
  sent_at timestamptz not null default now(),
  primary key (driver_id, doc, stage, expires_on)
);
alter table public.driver_doc_reminders enable row level security;
drop policy if exists "Admins read doc reminders" on public.driver_doc_reminders;
create policy "Admins read doc reminders" on public.driver_doc_reminders for select using (public.is_admin());
