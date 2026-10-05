-- 014: booking fee $1.00 → $2.50. RideUp keeps the booking fee (it covers card processing, which costs more on
-- Bahamian cards); drivers still keep 80% of the rest of the fare, so their pay per trip doesn't change.
-- Same insert guard as 010 except the booking fee. Must match BOOKING_FEE_CENTS in src/lib/pricing.js. Safe to re-run.

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
  quoted_surge numeric := coalesce(new.surge_multiplier, 1.00);
  surge numeric;
  has_stop boolean := new.stop_lat is not null and new.stop_lng is not null;
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
  new.surge_multiplier := 1.00;
  new.stop_reached_at := null;
  if not has_stop then
    new.stop_address := null; new.stop_lat := null; new.stop_lng := null;
  elsif nullif(btrim(coalesce(new.stop_address, '')), '') is null then
    raise exception 'The stop needs an address' using errcode = '22023';
  end if;

  if new.vehicle_type is null or new.vehicle_type not in ('standard', 'xl', 'premium') then
    new.vehicle_type := 'standard';
  end if;

  -- Never shorter than the straight line (through the stop, if there is one).
  if has_stop then
    straight := public.miles_between(new.pickup_lat, new.pickup_lng, new.stop_lat, new.stop_lng)
              + public.miles_between(new.stop_lat, new.stop_lng, new.dropoff_lat, new.dropoff_lng);
  else
    straight := public.miles_between(new.pickup_lat, new.pickup_lng, new.dropoff_lat, new.dropoff_lng);
  end if;
  new.distance_miles := round(greatest(coalesce(new.distance_miles, 0), straight), 2);
  -- Never priced faster than 30 mph on average (2 minutes per mile), plus 3 minutes for a stop.
  new.duration_minutes := round(greatest(coalesce(new.duration_minutes, 0),
                                         new.distance_miles * 2 + case when has_stop then 3 else 0 end), 2);

  -- Busy-time pricing. The rider confirmed a price; if it got busier since, ask them to confirm the new one.
  surge := public.surge_multiplier_at(new.pickup_lat, new.pickup_lng);
  if surge > quoted_surge + 0.001 then
    raise exception 'It just got busier, so prices went up a little. Check the new price and confirm again.'
      using errcode = '22023', hint = 'surge';
  end if;
  new.surge_multiplier := surge;

  -- Must match RATES in src/lib/pricing.js
  if new.vehicle_type = 'xl' then
    base := 450; per_mile := 230; per_min := 30; minimum := 1500;
  elsif new.vehicle_type = 'premium' then
    base := 700; per_mile := 320; per_min := 40; minimum := 2000;
  else
    base := 200; per_mile := 125; per_min := 35; minimum := 1000;
  end if;

  -- Upfront price = max(trip, minimum) × busy-time multiplier + booking fee (kept by RideUp).
  -- Must match calculateFare in src/lib/pricing.js.
  new.booking_fee_cents := 250;
  new.fare_cents := round(greatest(
    round(base + new.distance_miles * per_mile + new.duration_minutes * per_min)::int,
    minimum
  ) * surge)::int + new.booking_fee_cents;

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
