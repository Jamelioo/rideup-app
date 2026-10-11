-- 020: the landing page's first-ride offer and a booking funnel. Safe to re-run.

-- ─────────────────────────────────────────
-- First-ride offer: every new visitor gets the code picked in Admin › Promos ("Show on landing page"), applied
-- automatically (src/lib/landingOffer.js, api/_routes/landing-offer.js). WELCOME5 to start with; an admin can
-- pick another code or none. Existing codes and settings are left as they are.
-- ─────────────────────────────────────────
insert into public.promo_codes (code, amount_cents, first_ride_only, description)
values ('WELCOME5', 500, true, '$5 off your first ride')
on conflict (code) do nothing;
insert into public.app_settings (key, value) values ('landing_promo', '"WELCOME5"'::jsonb) on conflict (key) do nothing;

-- ─────────────────────────────────────────
-- Booking funnel for Admin › Money. For each day: how many people opened a landing page, opened booking, saw a
-- price and requested a ride (the app sends each step once per browser per day). Counts only: no names, no ids,
-- nothing that identifies anyone. Only the server adds to it (api/_routes/track.js); admins can read it.
-- ─────────────────────────────────────────
create table if not exists public.funnel_daily (
  day date not null,
  step text not null check (step in ('landing', 'booking', 'price', 'request')),
  visitors integer not null default 0 check (visitors >= 0),
  primary key (day, step)
);
alter table public.funnel_daily enable row level security;
revoke insert, update, delete on public.funnel_daily from anon, authenticated;
drop policy if exists "Admins read the funnel" on public.funnel_daily;
create policy "Admins read the funnel" on public.funnel_daily for select using (public.is_admin());

-- One more person at this step today (Nassau time).
create or replace function public.funnel_bump(p_step text)
returns void language sql security definer set search_path = public as $$
  insert into funnel_daily (day, step, visitors)
  values ((now() at time zone 'America/Nassau')::date, p_step, 1)
  on conflict (day, step) do update set visitors = funnel_daily.visitors + 1
$$;
revoke all on function public.funnel_bump(text) from public, anon, authenticated;
grant execute on function public.funnel_bump(text) to service_role;
