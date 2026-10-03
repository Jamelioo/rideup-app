-- 013: ad measurement. Which ad or link first brought each rider (utm_* / gclid / fbclid), saved once at
-- sign-up, and a report of signups, first rides and revenue per campaign for Admin › Money. Safe to re-run.

alter table public.riders add column if not exists acquisition jsonb;
alter table public.riders add column if not exists acquired_at timestamptz;

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
  return new;
end $$;

-- First touch wins: set once, from the visitor's own browser, only known keys, short values.
create or replace function public.set_acquisition(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid;
  clean jsonb := '{}'::jsonb;
  k text;
begin
  select id into me from riders where auth_user_id = auth.uid();
  if me is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if jsonb_typeof(p) is distinct from 'object' then return; end if;
  foreach k in array array['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'landing'] loop
    if p ? k and jsonb_typeof(p -> k) = 'string' and length(p ->> k) > 0 then
      clean := clean || jsonb_build_object(k, left(p ->> k, case when k in ('gclid', 'fbclid') then 255 else 100 end));
    end if;
  end loop;
  if clean = '{}'::jsonb then return; end if;
  perform set_config('app.trusted', '1', true);
  update riders set acquisition = clean, acquired_at = now() where id = me and acquisition is null;
  perform set_config('app.trusted', '', true);
end $$;
revoke all on function public.set_acquisition(jsonb) from public, anon;
grant execute on function public.set_acquisition(jsonb) to authenticated;

-- Per source / campaign, for riders who signed up in the period: signups, riders who completed a trip,
-- completed trips and what those riders paid since. Riders with no ad link count as "direct".
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
     where x.status = 'completed' and x.payment_status in ('captured', 'paid', 'partially_refunded')
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
