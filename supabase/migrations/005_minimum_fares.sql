-- 005_minimum_fares.sql — run after 002. Idempotent.
-- Minimum fares: standard $12, XL $15, premium $20. Must match RATES in src/lib/pricing.js.
-- Only affects rides created from now on (existing rides keep their fare).

create or replace function public.guard_rides_insert()
returns trigger language plpgsql as $$
declare
  a numeric;
  straight numeric;
  base int; per_mile int; per_min int; minimum int;
begin
  if public.is_trusted_caller() then
    return new;
  end if;

  if new.pickup_lat is null or new.pickup_lng is null
     or new.dropoff_lat is null or new.dropoff_lng is null then
    raise exception 'Pickup and dropoff coordinates are required' using errcode = '22023';
  end if;

  -- Lifecycle / payment fields are never client-controlled on insert.
  new.status := 'requested';
  new.driver_id := null;
  new.declined_by := '{}';
  new.accepted_at := null;
  new.started_at := null;
  new.completed_at := null;
  new.cancelled_at := null;
  new.cancel_reason := null;
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

  if new.vehicle_type is null or new.vehicle_type not in ('standard', 'xl', 'premium') then
    new.vehicle_type := 'standard';
  end if;

  -- Distance can't be shorter than the straight line between the two points;
  -- duration can't imply more than 60 mph.
  a := power(sin(radians(new.dropoff_lat - new.pickup_lat) / 2), 2)
     + cos(radians(new.pickup_lat)) * cos(radians(new.dropoff_lat))
       * power(sin(radians(new.dropoff_lng - new.pickup_lng) / 2), 2);
  straight := 2 * 3958.8 * asin(least(1, sqrt(a)));
  new.distance_miles := round(greatest(coalesce(new.distance_miles, 0), straight), 2);
  new.duration_minutes := round(greatest(coalesce(new.duration_minutes, 0), new.distance_miles), 2);

  if new.vehicle_type = 'xl' then
    base := 450; per_mile := 230; per_min := 30; minimum := 1500;
  elsif new.vehicle_type = 'premium' then
    base := 700; per_mile := 320; per_min := 40; minimum := 2000;
  else
    base := 250; per_mile := 165; per_min := 20; minimum := 1200;
  end if;

  new.fare_cents := greatest(
    round(base + new.distance_miles * per_mile + new.duration_minutes * per_min)::int,
    minimum
  );

  return new;
end $$;
