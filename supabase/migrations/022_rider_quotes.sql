-- 022: rider quotes for the website. Safe to re-run.
--  * After a 5-star trip, a rider can choose to let RideUp show their comment on the website, with their first
--    name and last initial (share_testimonial). Nothing is shared without that choice.
--  * Every quote waits for an admin to approve it (Admin › Promos) before the landing pages show it; admins can
--    hide one at any time. Only admins can read the table; the website gets approved quotes from the server
--    (api/_routes/stats.js), never rider ids.
--  * Deleting an account deletes that rider's quotes.

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null unique references public.rides(id) on delete cascade,
  rider_id uuid not null references public.riders(id) on delete cascade,
  quote text not null check (length(btrim(quote)) between 10 and 280),
  display_name text not null check (length(btrim(display_name)) between 1 and 40),
  status text not null default 'pending' check (status in ('pending', 'approved', 'hidden')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
create index if not exists testimonials_status_idx on public.testimonials (status, created_at desc);
alter table public.testimonials enable row level security;

drop policy if exists "Admins read testimonials" on public.testimonials;
create policy "Admins read testimonials" on public.testimonials for select using (public.is_admin());
drop policy if exists "Admins review testimonials" on public.testimonials;
create policy "Admins review testimonials" on public.testimonials for update using (public.is_admin()) with check (public.is_admin());
-- Riders add theirs only through share_testimonial(), so the checks below can't be skipped.

-- The rider's own finished trip, rated 5 stars, with a comment of 10 to 280 characters. Shown as "Ann R.".
-- Sharing again for the same trip changes nothing.
create or replace function public.share_testimonial(p_ride_id uuid, p_quote text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r riders;
  rd rides;
  q text := btrim(regexp_replace(coalesce(p_quote, ''), '\s+', ' ', 'g'));
  first_name text;
  last_initial text;
begin
  select * into r from riders where auth_user_id = auth.uid() and deleted_at is null;
  if not found then
    raise exception 'Only riders can share a comment.' using errcode = '42501';
  end if;
  select * into rd from rides where id = p_ride_id and rider_id = r.id;
  if not found or rd.status <> 'completed' then
    raise exception 'You can only share a comment about your own finished trip.' using errcode = '22023';
  end if;
  if coalesce(rd.rider_rating, 0) < 5 then
    raise exception 'Only comments on 5-star trips can be shared.' using errcode = '22023';
  end if;
  if length(q) < 10 or length(q) > 280 then
    raise exception 'Keep your comment between 10 and 280 characters.' using errcode = '22023';
  end if;
  first_name := left(split_part(btrim(coalesce(r.name, '')), ' ', 1), 30);
  last_initial := upper(left(nullif(split_part(btrim(coalesce(r.name, '')), ' ', 2), ''), 1));
  insert into testimonials (ride_id, rider_id, quote, display_name)
  values (p_ride_id, r.id, q, coalesce(nullif(first_name, ''), 'A rider') || coalesce(' ' || last_initial || '.', ''))
  on conflict (ride_id) do nothing;
end $$;
revoke all on function public.share_testimonial(uuid, text) from public, anon;
grant execute on function public.share_testimonial(uuid, text) to authenticated;

-- Account deletion (erase_account_data, migration 010) marks the rider deleted: their quotes go with it.
create or replace function public.forget_rider_quotes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from testimonials where rider_id = new.id;
  return new;
end $$;
revoke all on function public.forget_rider_quotes() from public, anon, authenticated;
drop trigger if exists riders_forget_quotes on public.riders;
create trigger riders_forget_quotes after update of deleted_at on public.riders
  for each row when (new.deleted_at is not null and old.deleted_at is null)
  execute function public.forget_rider_quotes();
