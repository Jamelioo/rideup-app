-- Leads table for landing page phone number capture
create table if not exists public.leads (
  id uuid default gen_random_uuid() primary key,
  phone text not null,
  source text not null check (source in ('rider', 'driver')),
  created_at timestamptz default now() not null
);

-- Index for dedup lookups
create index idx_leads_phone_source on public.leads (phone, source);

-- Enable RLS
alter table public.leads enable row level security;

-- Allow anonymous inserts (landing pages are public, no auth)
create policy "Anyone can insert leads"
  on public.leads
  for insert
  to anon
  with check (true);

-- Only authenticated service role can read leads
create policy "Service role can read leads"
  on public.leads
  for select
  to service_role
  using (true);
