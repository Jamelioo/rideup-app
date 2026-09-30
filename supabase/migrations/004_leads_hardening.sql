-- 004_leads_hardening.sql — run after 001. Idempotent.
-- The landing-page lead form is open to anonymous visitors. This keeps it from being trivially abused:
--   * one row per phone number per source (same number submitted twice is a no-op for the visitor)
--   * the database itself rejects junk (too short/long, non-phone characters)
-- It cannot stop a script rotating random numbers; put Vercel WAF / Turnstile in front if that becomes a problem.

-- Remove existing duplicates, keeping the earliest submission.
delete from public.leads a
 using public.leads b
 where a.source = b.source
   and regexp_replace(a.phone, '\D', '', 'g') = regexp_replace(b.phone, '\D', '', 'g')
   and (a.created_at, a.id) > (b.created_at, b.id);

alter table public.leads add column if not exists phone_digits text
  generated always as (regexp_replace(phone, '\D', '', 'g')) stored;

create unique index if not exists idx_leads_unique_phone_source on public.leads (phone_digits, source);

alter table public.leads drop constraint if exists leads_phone_format;
alter table public.leads add constraint leads_phone_format
  check (length(phone) <= 32 and phone ~ '^[0-9 ()+.-]+$' and length(regexp_replace(phone, '\D', '', 'g')) between 7 and 15) not valid;

drop policy if exists "Anyone can insert leads" on public.leads;
create policy "Anyone can insert leads" on public.leads
  for insert to anon
  with check (source in ('rider', 'driver'));
