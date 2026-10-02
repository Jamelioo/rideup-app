-- 007: RideUp Go priced for small cars (Honda Fit, Nissan March…): $2.00 base + $1.25/mile + $0.35/minute,
-- $10.00 minimum. XL joins Premium behind an admin switch (Admin → Settings), so launch offers Go only.
-- Must match RATES in src/lib/pricing.js. Safe to re-run.

insert into public.app_settings (key, value) values ('offer_xl', 'false'::jsonb)
on conflict (key) do nothing;

create or replace function public.guard_rides_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a numeric;
  straight numeric;
  base int; per_mile int; per_min int; minimum int;
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

  if new.vehicle_type is null or new.vehicle_type not in ('standard', 'xl', 'premium') then
    new.vehicle_type := 'standard';
  end if;

  a := power(sin(radians(new.dropoff_lat - new.pickup_lat) / 2), 2)
     + cos(radians(new.pickup_lat)) * cos(radians(new.dropoff_lat))
       * power(sin(radians(new.dropoff_lng - new.pickup_lng) / 2), 2);
  straight := 2 * 3958.8 * asin(least(1, sqrt(a)));
  new.distance_miles := round(greatest(coalesce(new.distance_miles, 0), straight), 2);
  new.duration_minutes := round(greatest(coalesce(new.duration_minutes, 0), new.distance_miles), 2);

  -- Must match RATES in src/lib/pricing.js
  if new.vehicle_type = 'xl' then
    base := 450; per_mile := 230; per_min := 30; minimum := 1500;
  elsif new.vehicle_type = 'premium' then
    base := 700; per_mile := 320; per_min := 40; minimum := 2000;
  else
    base := 200; per_mile := 125; per_min := 35; minimum := 1000;
  end if;

  new.fare_cents := greatest(
    round(base + new.distance_miles * per_mile + new.duration_minutes * per_min)::int,
    minimum
  );
  return new;
end $$;
