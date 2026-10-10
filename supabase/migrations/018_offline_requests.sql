-- 018: riders can request a ride when no driver is online. RideUp's team is alerted and the request looks for a
-- driver for 5 minutes (REQUEST_SEARCH_MINUTES in src/lib/dispatch.js) instead of ending at once, so a driver who
-- goes online in that time must still see it. Same as 006 except the age limit (was 3 minutes). Safe to re-run.

create or replace function public.open_ride_requests(
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_miles numeric default 10
)
returns table (
  id uuid, created_at timestamptz, vehicle_type text,
  pickup_address text, pickup_lat double precision, pickup_lng double precision,
  dropoff_address text, distance_miles numeric, duration_minutes numeric,
  fare_cents integer, driver_payout_cents integer,
  rider_first_name text, rider_rating numeric, pickup_distance_miles numeric
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  d public.drivers;
begin
  select * into d from drivers where auth_user_id = auth.uid() and approved = true;
  if not found then
    raise exception 'Not an approved driver' using errcode = '42501';
  end if;
  -- The sweeper takes drivers offline when their app stops checking in (closed or asleep).
  if d.status not in ('online', 'on_trip') then
    raise exception 'You are offline' using errcode = 'P0001', hint = 'offline';
  end if;
  -- Heartbeat: polling means the app is open. Written at most every 30 seconds, with an approximate
  -- position so new requests can be pushed to nearby drivers only.
  update drivers
     set last_seen_at = now(),
         last_lat = coalesce(round(p_lat::numeric, 3)::double precision, last_lat),
         last_lng = coalesce(round(p_lng::numeric, 3)::double precision, last_lng)
   where id = d.id and (last_seen_at is null or last_seen_at < now() - interval '30 seconds');

  return query
  select * from (
    select r.id as id, r.created_at as created_at, r.vehicle_type as vehicle_type,
           public.approx_address(r.pickup_address, 'street') as pickup_address,
           round(r.pickup_lat::numeric, 3)::double precision as pickup_lat,
           round(r.pickup_lng::numeric, 3)::double precision as pickup_lng,
           public.approx_address(r.dropoff_address, 'area') as dropoff_address, r.distance_miles as distance_miles, r.duration_minutes as duration_minutes,
           r.fare_cents as fare_cents, r.driver_payout_cents as driver_payout_cents,
           split_part(coalesce(nullif(r.rider_name, ''), 'Rider'), ' ', 1) as rider_first_name,
           ri.rating as rider_rating,
           case when p_lat is null or p_lng is null then null else
             round((2 * 3958.8 * asin(least(1, sqrt(
               power(sin(radians(r.pickup_lat - p_lat) / 2), 2)
               + cos(radians(p_lat)) * cos(radians(r.pickup_lat)) * power(sin(radians(r.pickup_lng - p_lng) / 2), 2)
             ))))::numeric, 1)
           end as pickup_distance_miles
      from rides r
      left join riders ri on ri.id = r.rider_id
     where r.status = 'requested'
       and r.driver_id is null
       and r.created_at > now() - interval '5 minutes'
       and not (d.id = any (coalesce(r.declined_by, '{}')))
       -- Premium only goes to vehicles approved as Premium; XL only to XL. Bigger/better cars can take Go trips.
       and r.vehicle_type = any (case d.vehicle_type
                                      when 'xl' then array['standard', 'xl']
                                      when 'premium' then array['standard', 'premium']
                                      else array['standard'] end)
  ) q
  where q.pickup_distance_miles is null or q.pickup_distance_miles <= p_radius_miles
  order by q.created_at desc
  limit 5;
end $$;
revoke all on function public.open_ride_requests(double precision, double precision, numeric) from public, anon;
grant execute on function public.open_ride_requests(double precision, double precision, numeric) to authenticated;
