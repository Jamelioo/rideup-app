-- 009: $3 airport pickup fee (LPIA), promo codes, referrals ($5 off a friend's first ride, $5 credit to the
-- referrer after it) and ride credit. Discounts come out of RideUp's share; drivers are paid on the full fare.
-- Must match src/lib/pricing.js. Safe to re-run.

alter table public.rides add column if not exists promo_code text;
alter table public.rides add column if not exists promo_discount_cents integer not null default 0;
alter table public.rides add column if not exists airport_fee_cents integer not null default 0;
alter table public.rides add column if not exists credit_applied_cents integer not null default 0;

alter table public.riders add column if not exists referral_code text unique;
alter table public.riders add column if not exists referred_by uuid references public.riders(id);
alter table public.riders add column if not exists credit_cents integer not null default 0;
alter table public.riders add column if not exists referral_rewarded boolean not null default false;

create table if not exists public.promo_codes (
  code text primary key check (code ~ '^[A-Z0-9-]{3,20}$' and code <> 'REFERRAL'),
  description text,
  amount_cents integer not null check (amount_cents between 100 and 10000),
  first_ride_only boolean not null default false,
  max_uses integer check (max_uses is null or max_uses > 0),
  uses integer not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz default now()
);
alter table public.promo_codes enable row level security;
drop policy if exists "Admins manage promo codes" on public.promo_codes;
create policy "Admins manage promo codes" on public.promo_codes for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  rider_id uuid not null references public.riders(id) on delete cascade,
  ride_id uuid unique references public.rides(id) on delete set null,
  discount_cents integer not null,
  created_at timestamptz default now(),
  unique (code, rider_id)
);
alter table public.promo_redemptions enable row level security;
drop policy if exists "Admins read redemptions" on public.promo_redemptions;
drop policy if exists "Riders read own redemptions" on public.promo_redemptions;
create policy "Admins read redemptions" on public.promo_redemptions for select using (public.is_admin());
create policy "Riders read own redemptions" on public.promo_redemptions for select using (
  rider_id in (select id from public.riders where auth_user_id = auth.uid())
);

-- Referral codes: RIDE + 5 letters/digits, set for every rider (including ones created at sign-up).
create or replace function public.new_referral_code()
returns text language plpgsql as $$
declare c text;
begin
  loop
    c := 'RIDE' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
    exit when not exists (select 1 from riders where referral_code = c);
  end loop;
  return c;
end $$;

create or replace function public.set_referral_code()
returns trigger language plpgsql as $$
begin
  if new.referral_code is null then new.referral_code := public.new_referral_code(); end if;
  return new;
end $$;
drop trigger if exists riders_referral_code on public.riders;
create trigger riders_referral_code before insert on public.riders for each row execute function public.set_referral_code();
do $$ begin
  perform set_config('app.trusted', '1', true);
  update public.riders set referral_code = public.new_referral_code() where referral_code is null;
  perform set_config('app.trusted', '', true);
end $$;

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
    new.referred_by := null;
    new.credit_cents := 0;
    new.referral_rewarded := false;
    return new;
  end if;
  new.stripe_customer_id := old.stripe_customer_id;
  new.payment_method_id := old.payment_method_id;
  new.card_brand := old.card_brand;
  new.card_last4 := old.card_last4;
  new.rating := old.rating;
  new.total_rides := old.total_rides;
  new.suspended := old.suspended;
  new.referral_code := old.referral_code;
  new.referred_by := old.referred_by;
  new.credit_cents := old.credit_cents;
  new.referral_rewarded := old.referral_rewarded;
  return new;
end $$;

create or replace function public.rider_has_completed_ride(p_rider_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from rides where rider_id = p_rider_id and status = 'completed')
$$;

-- LPIA terminal area (about 1 mile around the terminals). Must match AIRPORT in src/lib/pricing.js.
create or replace function public.is_airport_pickup(p_lat double precision, p_lng double precision)
returns boolean language sql immutable as $$
  select p_lat is not null and p_lng is not null and
    2 * 3958.8 * asin(least(1, sqrt(
      power(sin(radians(p_lat - 25.0390) / 2), 2)
      + cos(radians(25.0390)) * cos(radians(p_lat)) * power(sin(radians(p_lng - (-77.4662)) / 2), 2)
    ))) <= 1.0
$$;

-- Validates a promo code for a rider and returns the discount; raises a rider-friendly error otherwise.
create or replace function public.promo_discount_for(p_rider_id uuid, p_code text)
returns integer language plpgsql stable security definer set search_path = public as $$
declare p promo_codes;
begin
  select * into p from promo_codes where code = upper(btrim(p_code));
  if not found or not p.active then
    raise exception 'That promo code isn''t valid.' using errcode = '22023', hint = 'promo';
  end if;
  if p.expires_at is not null and p.expires_at < now() then
    raise exception 'That promo code has expired.' using errcode = '22023', hint = 'promo';
  end if;
  if p.max_uses is not null and p.uses >= p.max_uses then
    raise exception 'That promo code has been fully used.' using errcode = '22023', hint = 'promo';
  end if;
  if exists (select 1 from promo_redemptions where code = p.code and rider_id = p_rider_id) then
    raise exception 'You''ve already used that promo code.' using errcode = '22023', hint = 'promo';
  end if;
  if p.first_ride_only and public.rider_has_completed_ride(p_rider_id) then
    raise exception 'That promo code is for first rides only.' using errcode = '22023', hint = 'promo';
  end if;
  return p.amount_cents;
end $$;

-- Rider-facing: check a code before booking.
create or replace function public.check_promo(p_code text)
returns table (code text, amount_cents integer, description text)
language plpgsql stable security definer set search_path = public as $$
declare me uuid;
begin
  select id into me from riders where auth_user_id = auth.uid();
  if me is null then raise exception 'Sign in to use a promo code.' using errcode = '42501', hint = 'promo'; end if;
  perform public.promo_discount_for(me, p_code);
  return query select p.code, p.amount_cents, p.description from promo_codes p where p.code = upper(btrim(p_code));
end $$;
revoke all on function public.check_promo(text) from public, anon;
grant execute on function public.check_promo(text) to authenticated;

-- Rider-facing: attach a friend's referral code (before the first completed ride, once, not your own).
create or replace function public.redeem_referral(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare me riders; friend riders;
begin
  select * into me from riders where auth_user_id = auth.uid();
  if not found then raise exception 'Sign in first.' using errcode = '42501', hint = 'referral'; end if;
  select * into friend from riders where referral_code = upper(btrim(p_code));
  if not found then raise exception 'That referral code isn''t valid.' using errcode = '22023', hint = 'referral'; end if;
  if friend.id = me.id then raise exception 'You can''t use your own code.' using errcode = '22023', hint = 'referral'; end if;
  if me.referred_by is not null then raise exception 'You''ve already used a referral code.' using errcode = '22023', hint = 'referral'; end if;
  if public.rider_has_completed_ride(me.id) then
    raise exception 'Referral codes are for new riders before their first trip.' using errcode = '22023', hint = 'referral';
  end if;
  perform set_config('app.trusted', '1', true);
  update riders set referred_by = friend.id where id = me.id;
  perform set_config('app.trusted', '', true);
  return split_part(coalesce(nullif(friend.name, ''), 'your friend'), ' ', 1);
end $$;
revoke all on function public.redeem_referral(text) from public, anon;
grant execute on function public.redeem_referral(text) to authenticated;

-- Rider-facing: referral code, credit, and what the next ride gets.
create or replace function public.my_rewards()
returns table (referral_code text, credit_cents integer, referral_discount_pending boolean, friends_joined bigint, friends_rewarded bigint)
language sql stable security definer set search_path = public as $$
  select me.referral_code, me.credit_cents,
         me.referred_by is not null and not public.rider_has_completed_ride(me.id),
         (select count(*) from riders f where f.referred_by = me.id),
         (select count(*) from riders f where f.referred_by = me.id and f.referral_rewarded)
    from riders me where me.auth_user_id = auth.uid()
$$;
revoke all on function public.my_rewards() from public, anon;
grant execute on function public.my_rewards() to authenticated;

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

  if new.vehicle_type is null or new.vehicle_type not in ('standard', 'xl', 'premium') then
    new.vehicle_type := 'standard';
  end if;

  a := power(sin(radians(new.dropoff_lat - new.pickup_lat) / 2), 2)
     + cos(radians(new.pickup_lat)) * cos(radians(new.dropoff_lat))
       * power(sin(radians(new.dropoff_lng - new.pickup_lng) / 2), 2);
  straight := 2 * 3958.8 * asin(least(1, sqrt(a)));
  new.distance_miles := round(greatest(coalesce(new.distance_miles, 0), straight), 2);
  -- Never priced faster than 30 mph on average (2 minutes per mile), whatever the app sends.
  new.duration_minutes := round(greatest(coalesce(new.duration_minutes, 0), new.distance_miles * 2), 2);

  -- Must match RATES in src/lib/pricing.js
  if new.vehicle_type = 'xl' then
    base := 450; per_mile := 230; per_min := 30; minimum := 1500;
  elsif new.vehicle_type = 'premium' then
    base := 700; per_mile := 320; per_min := 40; minimum := 2000;
  else
    base := 200; per_mile := 125; per_min := 35; minimum := 1000;
  end if;

  -- Upfront price = max(trip, minimum) + booking fee (kept by RideUp). Must match src/lib/pricing.js.
  new.booking_fee_cents := 100;
  new.fare_cents := greatest(
    round(base + new.distance_miles * per_mile + new.duration_minutes * per_min)::int,
    minimum
  ) + new.booking_fee_cents;

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
