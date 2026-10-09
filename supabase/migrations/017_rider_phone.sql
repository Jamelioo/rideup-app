-- 017: the mobile number asked for at sign-up goes onto the rider profile as the account is created (before the
-- email is confirmed), so drivers and the team can reach every new rider. Safe to re-run.

-- "555-0100", "(242) 555-0100", "1 242 555 0100", "+44 20 7946 0958" → E.164. The same rules as toE164 in
-- src/lib/phone.js; anything else is not a phone number.
create or replace function public.phone_e164(p text)
returns text language sql immutable as $$
  select case
    when btrim(coalesce(p, '')) like '+%' then case when length(d) between 8 and 15 then '+' || d end
    when length(d) = 7 then '+1242' || d
    when length(d) = 10 then '+1' || d
    when length(d) = 11 and d like '1%' then '+' || d
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x
$$;

-- Sign-up sends the number in the user metadata: "phone" from the rider sign-up, or the phone on a driver application.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.riders (auth_user_id, name, email, phone)
  values (new.id, new.raw_user_meta_data ->> 'name', new.email,
          coalesce(public.phone_e164(new.raw_user_meta_data ->> 'phone'),
                   public.phone_e164(new.raw_user_meta_data -> 'driver_application' ->> 'phone')));
  return new;
end $$;

-- Numbers riders already gave that never reached their profile: Edit Profile only saved them on the login.
update public.riders r
   set phone = public.phone_e164(u.raw_user_meta_data ->> 'phone')
  from auth.users u
 where u.id = r.auth_user_id
   and public.phone_e164(r.phone) is null
   and public.phone_e164(u.raw_user_meta_data ->> 'phone') is not null;
