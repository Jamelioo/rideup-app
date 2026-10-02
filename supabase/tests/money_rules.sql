-- Money and safety rules, checked in CI on a fresh database after every migration has run
-- (see .github/workflows/ci.yml). Each check raises "FAIL: ..." if a rule is broken; psql stops on it.
-- Numbers must match src/lib/pricing.js and tests/pricing.test.js.
\set ON_ERROR_STOP 1
\set QUIET 1
\pset tuples_only on

create or replace function pg_temp.as_user(uid text, meta text default '{}') returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'app_metadata', meta::json)::text, false); end $$;
create or replace function pg_temp.as_server() returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', '', false); end $$;
create or replace function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FAIL: %', what; end if; raise notice 'ok  %', what; end $$;
set client_min_messages = notice;

-- People: riders A (has trips), N (new, referred by A), T (A's second account: same card), F (friend);
-- drivers D1, D2; admin.
insert into auth.users (id, email, phone) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test', '+12425550101'),
  ('00000000-0000-0000-0000-0000000000a2', 'n@test', '+12425550202'),
  ('00000000-0000-0000-0000-0000000000a3', 't@test', null),
  ('00000000-0000-0000-0000-0000000000a4', 'f@test', '+12425550404'),
  ('00000000-0000-0000-0000-0000000000d1', 'd1@test', null),
  ('00000000-0000-0000-0000-0000000000d2', 'd2@test', null),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@test', null);
update riders set name = 'Ann A', phone = '+12425550101', card_fingerprint = 'fpA', payment_method_id = 'pm_a', stripe_customer_id = 'cus_a'
 where auth_user_id = '00000000-0000-0000-0000-0000000000a1';
update riders set name = 'Ned N', phone = '242-555-0202', card_fingerprint = 'fpN' where auth_user_id = '00000000-0000-0000-0000-0000000000a2';
update riders set name = 'Tom T', card_fingerprint = 'fpA' where auth_user_id = '00000000-0000-0000-0000-0000000000a3';
update riders set name = 'Fay F', phone = '+12425550404', card_fingerprint = 'fpF' where auth_user_id = '00000000-0000-0000-0000-0000000000a4';
insert into drivers (id, auth_user_id, name, approved, status, last_seen_at, last_lat, last_lng) values
  ('20000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d1', 'Dee One', true, 'online', now(), 25.05, -77.34),
  ('20000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000d2', 'Dan Two', true, 'online', now(), 25.05, -77.34);
select id as ra from riders where auth_user_id = '00000000-0000-0000-0000-0000000000a1' \gset
select id as rn from riders where auth_user_id = '00000000-0000-0000-0000-0000000000a2' \gset
select id as rt from riders where auth_user_id = '00000000-0000-0000-0000-0000000000a3' \gset
select id as rf from riders where auth_user_id = '00000000-0000-0000-0000-0000000000a4' \gset
select referral_code as acode from riders where id = :'ra' \gset
insert into promo_codes (code, amount_cents, first_ride_only) values ('WELCOME5', 500, true), ('BIG', 5000, false);

-- A has one past trip, so A is not a first-time rider.
insert into rides (rider_id, driver_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, fare_cents, status, payment_status, completed_at)
values (:'ra', '20000000-0000-0000-0000-0000000000d1', 25.04, -77.35, 25.08, -77.33, 1410, 'completed', 'captured', now() - interval '2 days');

\echo '== Fares'
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into rides (id, rider_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, pickup_address, dropoff_address, distance_miles, duration_minutes)
values ('70000000-0000-0000-0000-000000000001', :'ra', 25.04, -77.35, 25.08, -77.33, 'a', 'b', 4.4, 16);
reset role; select pg_temp.as_server();
select pg_temp.check(fare_cents = 1410 and driver_payout_cents = 1048 and booking_fee_cents = 100, 'Go 4.4 mi / 16 min = $14.10, driver $10.48')
  from rides where id = '70000000-0000-0000-0000-000000000001';
update rides set status = 'cancelled' where id = '70000000-0000-0000-0000-000000000001';

set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into rides (id, rider_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, pickup_address, dropoff_address, distance_miles, duration_minutes, fare_cents)
values ('70000000-0000-0000-0000-000000000002', :'ra', 25.0392, -77.4655, 25.08, -77.33, 'LPIA', 'b', 10, 25, 1);
reset role; select pg_temp.as_server();
select pg_temp.check(fare_cents = 2725 and airport_fee_cents = 300, 'LPIA pickup adds $3; the app can''t set its own fare')
  from rides where id = '70000000-0000-0000-0000-000000000002';
update rides set status = 'cancelled' where id = '70000000-0000-0000-0000-000000000002';

\echo '== Promo codes and abuse checks'
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into rides (id, rider_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, pickup_address, dropoff_address, distance_miles, duration_minutes, promo_code)
values ('70000000-0000-0000-0000-000000000003', :'ra', 25.04, -77.35, 25.08, -77.33, 'a', 'b', 4.4, 16, 'big');
reset role; select pg_temp.as_server();
select pg_temp.check(fare_cents - promo_discount_cents - credit_applied_cents = 100 and driver_payout_cents = 1048,
  'a promo bigger than the fare leaves the rider paying $1; driver still paid on the full fare')
  from rides where id = '70000000-0000-0000-0000-000000000003';
update rides set status = 'cancelled' where id = '70000000-0000-0000-0000-000000000003';

set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
do $$ begin
  perform * from public.check_promo('WELCOME5');
  raise exception 'FAIL: a second account on a card that already rode got a first-ride promo';
exception when sqlstate '22023' then raise notice 'ok  first-ride promo refused on another account with the same card';
end $$;
do $$ begin
  perform public.redeem_referral((select referral_code from riders where name = 'Ann A'));
  raise exception 'FAIL: self-referral through a second account on the same card was accepted';
exception when sqlstate '22023' then raise notice 'ok  self-referral through a second account refused';
end $$;
reset role; select pg_temp.as_server();

\echo '== Referral: $5 off the first ride, $5 credit to the referrer'
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select public.redeem_referral(:'acode') is not null as referred \gset
insert into rides (id, rider_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, pickup_address, dropoff_address, distance_miles, duration_minutes)
values ('70000000-0000-0000-0000-000000000004', :'rn', 25.04, -77.35, 25.08, -77.33, 'a', 'b', 4.4, 16);
reset role; select pg_temp.as_server();
select pg_temp.check(promo_code = 'REFERRAL' and promo_discount_cents = 500, 'referred rider gets $5 off') from rides where id = '70000000-0000-0000-0000-000000000004';
update rides set status = 'completed', driver_id = '20000000-0000-0000-0000-0000000000d2', payment_status = 'captured'
 where id = '70000000-0000-0000-0000-000000000004';
select pg_temp.check(credit_cents = 500, 'referrer credited $5 when the friend''s first trip completes') from riders where id = :'ra';

\echo '== Busy-time pricing'
insert into rides (rider_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, status) values
  (:'rn', 25.041, -77.351, 25.08, -77.33, 'requested'),
  (:'rt', 25.042, -77.352, 25.08, -77.33, 'requested'),
  (:'rf', 25.043, -77.353, 25.08, -77.33, 'requested');
select pg_temp.check(public.surge_multiplier_at(25.04, -77.35) = 1.30, '3 waiting riders, 2 free drivers → 1.3×');
select pg_temp.check(public.surge_multiplier_at(25.00, -77.10) = 1.00, 'no busy pricing 15 miles away');
update riders set credit_cents = 0 where id = :'ra';
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  insert into rides (rider_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, pickup_address, dropoff_address, distance_miles, duration_minutes)
  values ((select id from riders where name = 'Ann A'), 25.04, -77.35, 25.08, -77.33, 'a', 'b', 4.4, 16);
  raise exception 'FAIL: a price quoted before it got busy was accepted';
exception when sqlstate '22023' then raise notice 'ok  rider asked to confirm when prices went up';
end $$;
insert into rides (id, rider_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, pickup_address, dropoff_address, distance_miles, duration_minutes, surge_multiplier)
values ('70000000-0000-0000-0000-000000000005', :'ra', 25.04, -77.35, 25.08, -77.33, 'a', 'b', 4.4, 16, 1.5);
reset role; select pg_temp.as_server();
select pg_temp.check(fare_cents = 1803 and surge_multiplier = 1.30 and driver_payout_cents = 1362,
  'busy fare $18.03 at the server''s 1.3× (not the 1.5× the app sent); driver keeps 80%')
  from rides where id = '70000000-0000-0000-0000-000000000005';
update rides set status = 'cancelled' where status = 'requested' or id = '70000000-0000-0000-0000-000000000005';

\echo '== Extra stop'
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into rides (id, rider_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, pickup_address, dropoff_address, distance_miles, duration_minutes, stop_address, stop_lat, stop_lng)
values ('70000000-0000-0000-0000-000000000006', :'ra', 25.04, -77.35, 25.04, -77.30, 'a', 'b', 1, 1, 'Stop', 25.08, -77.33);
reset role; select pg_temp.as_server();
select pg_temp.check(distance_miles = 6.38 and fare_cents = 1649, 'a stop is priced through the stop, plus 3 minutes')
  from rides where id = '70000000-0000-0000-0000-000000000006';

\echo '== Trip check-ins'
update rides set status = 'in_progress', driver_id = '20000000-0000-0000-0000-0000000000d1', started_at = now(),
       safety_checkin_at = now(), safety_checkin_reason = 'stopped'
 where id = '70000000-0000-0000-0000-000000000006';
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
do $$ begin
  perform public.ride_checkin_ok('70000000-0000-0000-0000-000000000006');
  raise exception 'FAIL: a stranger answered a trip check-in';
exception when insufficient_privilege then raise notice 'ok  only the rider or driver can answer a check-in';
end $$;
do $$ begin
  perform public.driver_ping('70000000-0000-0000-0000-000000000006', 25.05, -77.34);
  raise exception 'FAIL: a stranger sent the driver''s position';
exception when insufficient_privilege then raise notice 'ok  only the trip''s driver can send its position';
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select public.driver_ping('70000000-0000-0000-0000-000000000006', 25.05, -77.34);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.ride_checkin_ok('70000000-0000-0000-0000-000000000006');
reset role; select pg_temp.as_server();
select pg_temp.check(safety_checkin_ok_at is not null and last_moved_at is not null and driver_location_at is not null,
  'rider answered "I''m OK"; driver position recorded') from rides where id = '70000000-0000-0000-0000-000000000006';

\echo '== Incentives and refunds change the driver''s balance'
insert into driver_quests (title, trips_required, reward_cents, starts_at, ends_at) values ('Test boost', 1, 2000, now() - interval '1 hour', now() + interval '1 day');
select balance_cents as before_balance from public.driver_earnings_summary('20000000-0000-0000-0000-0000000000d1') \gset
update rides set status = 'completed', payment_status = 'captured' where id = '70000000-0000-0000-0000-000000000006';
select pg_temp.check(balance_cents = :before_balance + 1239 + 2000, 'trip ($12.39 driver share) and the $20 incentive added to the balance')
  from public.driver_earnings_summary('20000000-0000-0000-0000-0000000000d1');
insert into ride_refunds (ride_id, target, method, amount_cents, driver_deduction_cents, reason)
values ('70000000-0000-0000-0000-000000000006', 'fare', 'card', 500, 400, 'Longer route');
select pg_temp.check(balance_cents = :before_balance + 1239 + 2000 - 400, 'a driver-fault refund takes the driver''s share off the balance')
  from public.driver_earnings_summary('20000000-0000-0000-0000-0000000000d1');

\echo '== Who can see what'
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
do $$ begin
  perform * from public.demand_hotspots();
  raise exception 'FAIL: a rider read the drivers'' busy-area map';
exception when insufficient_privilege then raise notice 'ok  busy-area map is for drivers only';
end $$;
do $$ begin
  perform * from public.admin_money_summary(current_date - 1, current_date);
  raise exception 'FAIL: a rider read the money summary';
exception when insufficient_privilege then raise notice 'ok  money summary is for admins only';
end $$;
select pg_temp.check(count(*) = 0, 'riders can''t see other riders'' refunds') from ride_refunds;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select pg_temp.check(count(*) >= 0, 'drivers can open the busy-area map') from public.demand_hotspots();
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad', '{"role":"admin"}');
select pg_temp.check(sum(refund_cents) = 500 and sum(refund_driver_cents) = 400, 'money summary counts refunds')
  from public.admin_money_summary(current_date - 1, current_date + 1);
reset role; select pg_temp.as_server();

\echo '== Account deletion'
select pg_temp.check(public.account_deletion_blocker('00000000-0000-0000-0000-0000000000d1') = 'payout_owed', 'a driver who is owed money can''t delete yet');
select pg_temp.check(public.account_deletion_blocker('00000000-0000-0000-0000-0000000000a4') is null, 'a rider with nothing pending can delete');
select public.erase_account_data('00000000-0000-0000-0000-0000000000a4');
select pg_temp.check(name = 'Deleted rider' and email is null and phone is null and auth_user_id is null and card_fingerprint = 'fpF',
  'personal data erased; card fingerprint kept against promo abuse') from riders where id = :'rf';

\echo 'All money and safety rules passed.'
