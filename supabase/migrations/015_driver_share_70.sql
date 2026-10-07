-- 015: drivers keep 70% of the fare (excluding the booking fee); RideUp keeps the booking fee plus 30% of the rest.
-- Applies to rides created from now on; earlier rides keep the split stored on them. Must match DRIVER_SHARE in
-- src/lib/pricing.js. Safe to re-run.
create or replace function public.set_ride_fee()
returns trigger language plpgsql as $$
begin
  if new.fare_cents is not null then
    new.platform_fee_cents := coalesce(new.booking_fee_cents, 0)
      + round((new.fare_cents - coalesce(new.booking_fee_cents, 0)) * 0.30)::int;
    new.driver_payout_cents := new.fare_cents - new.platform_fee_cents;
  end if;
  return new;
end $$;
