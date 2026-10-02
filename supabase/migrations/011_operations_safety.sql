-- 011: operations and safety. Background-job heartbeat, admin refunds and credits, promo/referral abuse
-- checks, the drivers' busy-area map and trip check-ins. Safe to re-run.

-- ─────────────────────────────────────────
-- Heartbeat: the every-minute job records each run so /api/health and the admin can tell if it stopped.
-- ─────────────────────────────────────────
create table if not exists public.system_heartbeats (
  name text primary key,
  last_run_at timestamptz not null default now(),
  last_ok boolean not null default true,
  last_result jsonb
);
alter table public.system_heartbeats enable row level security;
drop policy if exists "Admins read heartbeats" on public.system_heartbeats;
create policy "Admins read heartbeats" on public.system_heartbeats for select using (public.is_admin());

-- ─────────────────────────────────────────
-- Refunds and credits issued by admins (/api/admin-refund). A refund can come out of RideUp's share or,
-- when the driver was at fault (e.g. a much longer route), partly out of the driver's earnings.
-- ─────────────────────────────────────────
create table if not exists public.ride_refunds (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  target text not null check (target in ('fare', 'tip')),
  method text not null check (method in ('card', 'credit')),
  amount_cents integer not null check (amount_cents > 0),
  driver_deduction_cents integer not null default 0 check (driver_deduction_cents >= 0),
  reason text not null check (length(btrim(reason)) between 3 and 300),
  stripe_refund_id text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists ride_refunds_ride_idx on public.ride_refunds (ride_id);
alter table public.ride_refunds enable row level security;
drop policy if exists "Admins read refunds" on public.ride_refunds;
drop policy if exists "Riders read own refunds" on public.ride_refunds;
create policy "Admins read refunds" on public.ride_refunds for select using (public.is_admin());
create policy "Riders read own refunds" on public.ride_refunds for select using (
  ride_id in (select r.id from public.rides r join public.riders me on me.id = r.rider_id where me.auth_user_id = auth.uid())
);

-- Earned = paid trips' driver share + tips + incentive rewards − refund deductions. Balance = earned − payouts.
-- Refunded trips still count: what a refund takes from the driver is recorded explicitly as a deduction.
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
      coalesce(sum(case when r.payment_status in ('captured', 'paid', 'partially_refunded', 'refunded')
                        then coalesce(r.driver_payout_cents, 0) else 0 end), 0)::bigint as earned,
      coalesce(sum(case when r.tip_payment_intent_id is not null and r.payment_status in ('captured', 'paid', 'partially_refunded', 'refunded')
                        then coalesce(r.tip_cents, 0) else 0 end), 0)::bigint as tips,
      count(*) filter (where r.status = 'completed' and r.payment_status in ('captured', 'paid', 'partially_refunded', 'refunded'))::bigint as trips
      from rides r where r.driver_id = who
  ), q as (
    select coalesce(sum(reward_cents), 0)::bigint as rewards from driver_quest_rewards where driver_quest_rewards.driver_id = who
  ), d as (
    select coalesce(sum(f.driver_deduction_cents), 0)::bigint as deducted
      from ride_refunds f join rides r on r.id = f.ride_id where r.driver_id = who
  ), p as (
    select coalesce(sum(amount_cents), 0)::bigint as paid from driver_payouts where driver_payouts.driver_id = who and status = 'paid'
  )
  select who, e.earned + e.tips + q.rewards - d.deducted, e.tips, p.paid,
         e.earned + e.tips + q.rewards - d.deducted - p.paid, e.trips
    from e, q, d, p;
end $$;
revoke all on function public.driver_earnings_summary(uuid) from public, anon;
grant execute on function public.driver_earnings_summary(uuid) to authenticated;

-- Money dashboard: same as 010 plus refunds (card refunds, the drivers' part of them, credits issued).
drop function if exists public.admin_money_summary(date, date);
create or replace function public.admin_money_summary(p_from date, p_to date)
returns table (day date, trips bigint, gross_fare_cents bigint, platform_fee_cents bigint, driver_fare_cents bigint,
               booking_fee_cents bigint, airport_fee_cents bigint, busy_extra_cents bigint,
               promo_cents bigint, credit_cents bigint, tips_cents bigint,
               cancel_fee_cents bigint, cancel_platform_cents bigint, quest_reward_cents bigint,
               rider_paid_cents bigint, est_card_fee_cents bigint, cancelled_trips bigint,
               refund_cents bigint, refund_driver_cents bigint, credit_issued_cents bigint)
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
         coalesce(f.card, 0)::bigint, coalesce(f.driver, 0)::bigint, coalesce(f.credit, 0)::bigint
    from days
    left join d on d.day = days.day
    left join c on c.day = days.day
    left join q on q.day = days.day
    left join f on f.day = days.day
   order by days.day;
end $$;
revoke all on function public.admin_money_summary(date, date) from public, anon;
grant execute on function public.admin_money_summary(date, date) to authenticated;

-- ─────────────────────────────────────────
-- Promo and referral abuse: the same card (Stripe fingerprint) or phone number on another account counts as
-- the same person. Fingerprints stay after an account is deleted, so delete-and-sign-up-again doesn't work.
-- ─────────────────────────────────────────
alter table public.riders add column if not exists card_fingerprint text;
create index if not exists riders_card_fingerprint_idx on public.riders (card_fingerprint) where card_fingerprint is not null;

create or replace function public.phone_key(p text)
returns text language sql immutable as $$
  select nullif(right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 10), '')
$$;

-- Other accounts that look like the same person.
create or replace function public.rider_lookalikes(p_rider_id uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select o.id from riders me join riders o on o.id <> me.id
   where me.id = p_rider_id
     and ((me.card_fingerprint is not null and o.card_fingerprint = me.card_fingerprint)
       or (length(public.phone_key(me.phone)) >= 7 and public.phone_key(o.phone) = public.phone_key(me.phone)))
$$;
revoke all on function public.rider_lookalikes(uuid) from public, anon, authenticated;

-- "Has this person ridden before?" now includes their other accounts, so first-ride promos and the referral
-- discount can't be claimed again with a new account on the same card or phone.
create or replace function public.rider_has_completed_ride(p_rider_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from rides where status = 'completed'
                   and (rider_id = p_rider_id or rider_id in (select public.rider_lookalikes(p_rider_id))))
$$;

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
  return new;
end $$;

-- Referring yourself: drop the referral once the "friend" turns out to share the referrer's card or phone.
create or replace function public.block_self_referral()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.referred_by is not null and exists (
       select 1 from riders ref where ref.id = new.referred_by
          and ((new.card_fingerprint is not null and ref.card_fingerprint = new.card_fingerprint)
            or (length(public.phone_key(new.phone)) >= 7 and public.phone_key(ref.phone) = public.phone_key(new.phone)))) then
    new.referred_by := null;
  end if;
  return new;
end $$;
drop trigger if exists riders_block_self_referral on public.riders;
create trigger riders_block_self_referral before update of card_fingerprint, phone, referred_by on public.riders
  for each row execute function public.block_self_referral();

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
  if exists (select 1 from promo_redemptions where code = p.code and rider_id in (select public.rider_lookalikes(p_rider_id))) then
    raise exception 'That promo code was already used with this card or phone number.' using errcode = '22023', hint = 'promo';
  end if;
  if p.first_ride_only and public.rider_has_completed_ride(p_rider_id) then
    raise exception 'That promo code is for first rides only.' using errcode = '22023', hint = 'promo';
  end if;
  return p.amount_cents;
end $$;

create or replace function public.redeem_referral(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare me riders; friend riders;
begin
  select * into me from riders where auth_user_id = auth.uid();
  if not found then raise exception 'Sign in first.' using errcode = '42501', hint = 'referral'; end if;
  select * into friend from riders where referral_code = upper(btrim(p_code));
  if not found then raise exception 'That referral code isn''t valid.' using errcode = '22023', hint = 'referral'; end if;
  if friend.id = me.id or friend.id in (select public.rider_lookalikes(me.id)) then
    raise exception 'You can''t use your own code.' using errcode = '22023', hint = 'referral';
  end if;
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
    -- No reward if the "friend" is a returning rider on another account (same card or phone).
    update riders ref set credit_cents = ref.credit_cents + 500
      from riders me
     where me.id = new.rider_id and me.referred_by = ref.id and not me.referral_rewarded
       and ref.id not in (select public.rider_lookalikes(me.id))
       and not exists (select 1 from rides x where x.status = 'completed'
                         and x.rider_id in (select public.rider_lookalikes(me.id)));
    update riders set referral_rewarded = true where id = new.rider_id and referred_by is not null and not referral_rewarded;
    perform set_config('app.trusted', '', true);
  end if;
  return new;
end $$;

-- ─────────────────────────────────────────
-- Drivers' busy-area map: where riders are requesting (last 45 minutes, waiting riders count triple), in
-- cells of about 0.7 mile, with the busy-time multiplier there. Approved drivers and admins only.
-- ─────────────────────────────────────────
create or replace function public.demand_hotspots()
returns table (lat double precision, lng double precision, weight integer, surge numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() and not exists (select 1 from drivers where auth_user_id = auth.uid() and approved) then
    raise exception 'Approved drivers only' using errcode = '42501';
  end if;
  return query
  with cells as (
    select round(r.pickup_lat::numeric, 2) as glat, round(r.pickup_lng::numeric, 2) as glng,
           count(*) filter (where r.status in ('requested', 'pending_driver_response') and r.created_at > now() - interval '10 minutes') as waiting,
           count(*) as recent
      from rides r
     where r.created_at > now() - interval '45 minutes' and r.pickup_lat is not null and r.pickup_lng is not null
     group by 1, 2
  )
  select c.glat::double precision, c.glng::double precision, (c.waiting * 3 + c.recent)::int,
         public.surge_multiplier_at(c.glat::double precision, c.glng::double precision)
    from cells c
   where c.waiting * 3 + c.recent >= 2
   order by 3 desc
   limit 40;
end $$;
revoke all on function public.demand_hotspots() from public, anon;
grant execute on function public.demand_hotspots() to authenticated;

-- ─────────────────────────────────────────
-- Trip check-ins (like Uber's RideCheck). The every-minute job asks rider and driver "Everything OK?" when a
-- trip stops moving for a while or runs far longer than expected; no answer within 5 minutes opens a safety
-- report for the admin.
-- ─────────────────────────────────────────
alter table public.rides add column if not exists last_moved_at timestamptz;
alter table public.rides add column if not exists safety_checkin_at timestamptz;
alter table public.rides add column if not exists safety_checkin_reason text;
alter table public.rides add column if not exists safety_checkin_ok_at timestamptz;
alter table public.rides add column if not exists safety_escalated_at timestamptz;

-- The driver's app reports its position during a trip (also when standing still), so "stopped" can be told
-- apart from "app closed". Moves of more than ~100 m count as moving.
create or replace function public.driver_ping(p_ride_id uuid, p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path = public as $$
declare r rides;
begin
  select * into r from rides where id = p_ride_id;
  if not found or not exists (select 1 from drivers d where d.id = r.driver_id and d.auth_user_id = auth.uid()) then
    raise exception 'Not your ride' using errcode = '42501';
  end if;
  if r.status not in ('accepted', 'driver_arrived', 'in_progress') then return; end if;
  if p_lat is null or p_lng is null or abs(p_lat) > 90 or abs(p_lng) > 180 then
    raise exception 'Bad position' using errcode = '22023';
  end if;
  perform set_config('app.trusted', '1', true);
  update rides set driver_lat = p_lat, driver_lng = p_lng, driver_location_at = now(),
         last_moved_at = case when r.driver_lat is null or r.last_moved_at is null
                                or public.miles_between(r.driver_lat, r.driver_lng, p_lat, p_lng) > 0.06
                              then now() else r.last_moved_at end
   where id = p_ride_id;
  perform set_config('app.trusted', '', true);
end $$;
revoke all on function public.driver_ping(uuid, double precision, double precision) from public, anon;
grant execute on function public.driver_ping(uuid, double precision, double precision) to authenticated;

-- Rider or driver taps "I'm OK".
create or replace function public.ride_checkin_ok(p_ride_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_ride_participant(p_ride_id) then raise exception 'Not your ride' using errcode = '42501'; end if;
  perform set_config('app.trusted', '1', true);
  update rides set safety_checkin_ok_at = now() where id = p_ride_id and safety_checkin_at is not null and safety_checkin_ok_at is null;
  perform set_config('app.trusted', '', true);
end $$;
revoke all on function public.ride_checkin_ok(uuid) from public, anon;
grant execute on function public.ride_checkin_ok(uuid) to authenticated;
