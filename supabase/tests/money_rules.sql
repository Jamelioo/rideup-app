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
select pg_temp.check(fare_cents = 1560 and driver_payout_cents = 917 and booking_fee_cents = 250, 'Go 4.4 mi / 16 min = $15.60 (incl. $2.50 booking fee), driver $9.17 (70%)')
  from rides where id = '70000000-0000-0000-0000-000000000001';
update rides set status = 'cancelled' where id = '70000000-0000-0000-0000-000000000001';

set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into rides (id, rider_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, pickup_address, dropoff_address, distance_miles, duration_minutes, fare_cents)
values ('70000000-0000-0000-0000-000000000002', :'ra', 25.0392, -77.4655, 25.08, -77.33, 'LPIA', 'b', 10, 25, 1);
reset role; select pg_temp.as_server();
select pg_temp.check(fare_cents = 2875 and airport_fee_cents = 300, 'LPIA pickup adds $3; the app can''t set its own fare')
  from rides where id = '70000000-0000-0000-0000-000000000002';
update rides set status = 'cancelled' where id = '70000000-0000-0000-0000-000000000002';

\echo '== Promo codes and abuse checks'
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into rides (id, rider_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, pickup_address, dropoff_address, distance_miles, duration_minutes, promo_code)
values ('70000000-0000-0000-0000-000000000003', :'ra', 25.04, -77.35, 25.08, -77.33, 'a', 'b', 4.4, 16, 'big');
reset role; select pg_temp.as_server();
select pg_temp.check(fare_cents - promo_discount_cents - credit_applied_cents = 100 and driver_payout_cents = 917,
  'a promo bigger than the fare leaves the rider paying $1; driver still paid on the full fare')
  from rides where id = '70000000-0000-0000-0000-000000000003';
update rides set status = 'cancelled' where id = '70000000-0000-0000-0000-000000000003';

set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.check(error is not null and code is null, 'first-ride promo refused on another account with the same card')
  from public.check_promo('WELCOME5');
select count(*) from (select public.check_promo('NOPE' || g) from generate_series(1, 9) g) t;
select pg_temp.check(error like 'Too many tries%', 'promo codes can''t be guessed: 10 wrong tries an hour, then blocked')
  from public.check_promo('WELCOME5');
do $$ begin
  perform public.promo_discount_for((select id from riders where name = 'Tom T'), 'BIG');
  raise exception 'FAIL: the internal promo check can be called directly';
exception when insufficient_privilege then raise notice 'ok  internal promo check is not callable from the app';
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
select pg_temp.check(fare_cents = 1953 and surge_multiplier = 1.30 and driver_payout_cents = 1192,
  'busy fare $19.53 at the server''s 1.3× (not the 1.5× the app sent); driver keeps 70%')
  from rides where id = '70000000-0000-0000-0000-000000000005';
update rides set status = 'cancelled' where status = 'requested' or id = '70000000-0000-0000-0000-000000000005';

\echo '== Extra stop'
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into rides (id, rider_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, pickup_address, dropoff_address, distance_miles, duration_minutes, stop_address, stop_lat, stop_lng)
values ('70000000-0000-0000-0000-000000000006', :'ra', 25.04, -77.35, 25.04, -77.30, 'a', 'b', 1, 1, 'Stop', 25.08, -77.33);
reset role; select pg_temp.as_server();
select pg_temp.check(distance_miles = 6.38 and fare_cents = 1799, 'a stop is priced through the stop, plus 3 minutes')
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
select pg_temp.check(balance_cents = :before_balance + 1084 + 2000, 'trip ($10.84 driver share) and the $20 incentive added to the balance')
  from public.driver_earnings_summary('20000000-0000-0000-0000-0000000000d1');
insert into ride_refunds (ride_id, target, method, amount_cents, driver_deduction_cents, reason)
values ('70000000-0000-0000-0000-000000000006', 'fare', 'card', 500, 400, 'Longer route');
select pg_temp.check(balance_cents = :before_balance + 1084 + 2000 - 400, 'a driver-fault refund takes the driver''s share off the balance')
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

\echo '== Book for someone else'
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
do $$ begin
  insert into rides (rider_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, pickup_address, dropoff_address, passenger_name)
  values ((select id from riders where name = 'Ned N'), 25.04, -77.35, 25.08, -77.33, 'a', 'b', 'Mum');
  raise exception 'FAIL: a ride for someone else was booked without their phone number';
exception when sqlstate '22023' then raise notice 'ok  booking for someone else needs their phone number';
end $$;
insert into rides (id, rider_id, rider_name, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, pickup_address, dropoff_address, passenger_name, passenger_phone)
values ('70000000-0000-0000-0000-000000000009', :'rn', 'Ned N', 25.04, -77.35, 25.08, -77.33, 'a', 'b', 'Mary Mum', '242-555-7788');
reset role; select pg_temp.as_server();
update rides set status = 'accepted', driver_id = '20000000-0000-0000-0000-0000000000d2' where id = '70000000-0000-0000-0000-000000000009';
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
select pg_temp.check(first_name = 'Mary' and phone = '242-555-7788', 'the driver sees the passenger''s name and phone, not the booker''s')
  from public.get_ride_rider('70000000-0000-0000-0000-000000000009');
reset role; select pg_temp.as_server();
update rides set status = 'cancelled' where id = '70000000-0000-0000-0000-000000000009';

\echo '== Ad measurement'
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select public.set_acquisition('{"utm_source":"facebook","utm_campaign":"launch","evil":"x"}');
select public.set_acquisition('{"utm_source":"google","utm_campaign":"later"}');
update riders set acquisition = '{"utm_source":"fake"}' where auth_user_id = '00000000-0000-0000-0000-0000000000a2';
reset role; select pg_temp.as_server();
select pg_temp.check(acquisition = '{"utm_source":"facebook","utm_campaign":"launch"}'::jsonb,
  'the first ad gets the credit; unknown keys dropped; riders can''t rewrite it') from riders where id = :'rn';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad', '{"role":"admin"}');
select pg_temp.check(signups = 1 and riders_with_trip = 1 and trips >= 1, 'campaign report counts signups and riders who took a trip')
  from public.admin_acquisition_report(current_date - 1, current_date + 1) where source = 'facebook' and campaign = 'launch';
select pg_temp.as_server();

\echo '== Account deletion'
select pg_temp.check(public.account_deletion_blocker('00000000-0000-0000-0000-0000000000d1') = 'payout_owed', 'a driver who is owed money can''t delete yet');
select pg_temp.check(public.account_deletion_blocker('00000000-0000-0000-0000-0000000000a4') is null, 'a rider with nothing pending can delete');
select public.erase_account_data('00000000-0000-0000-0000-0000000000a4');
select pg_temp.check(name = 'Deleted rider' and email is null and phone is null and auth_user_id is null and card_fingerprint = 'fpF',
  'personal data erased; card fingerprint kept against promo abuse') from riders where id = :'rf';

\echo '== Admin operations: support staff, notes and the action log'
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'support@test');
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1', '{"role":"support"}');
select pg_temp.check((select count(*) from riders) > 0 and (select count(*) from rides) > 0, 'support staff can see riders and rides');
select pg_temp.check((select count(*) from admin_actions) = 0, 'support staff can''t read the action log');
update riders set suspended = true where id = :'ra';
insert into admin_notes (subject_type, subject_id, body, author_id) values ('rider', :'ra', 'Called about a late pickup', '00000000-0000-0000-0000-0000000000ad');
reset role; select pg_temp.as_server();
select pg_temp.check(suspended is not true, 'support staff can''t suspend riders') from riders where id = :'ra';
select pg_temp.check(author_id = '00000000-0000-0000-0000-0000000000e1', 'a note is signed by whoever wrote it') from admin_notes where subject_id = :'ra';
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select count(*) from admin_notes) = 0, 'riders can''t read staff notes');
do $$ begin
  insert into admin_notes (subject_type, subject_id, body) values ('rider', gen_random_uuid(), 'x');
  raise exception 'FAIL: a rider added a staff note';
exception when insufficient_privilege then raise notice 'ok  riders can''t add staff notes';
end $$;
reset role; select pg_temp.as_server();
select count(*) as log0 from admin_actions \gset
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
update drivers set status = 'offline' where auth_user_id = '00000000-0000-0000-0000-0000000000d1';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad', '{"role":"admin"}');
update riders set suspended = true where id = :'ra';
reset role; select pg_temp.as_server();
select pg_temp.check((select count(*) from admin_actions) = :log0 + 1, 'an admin''s change is logged; a driver''s own change isn''t');
select pg_temp.check(action = 'riders.update' and target_id = :'ra' and details ? 'suspended' and not details ? 'name'
  and actor_id = '00000000-0000-0000-0000-0000000000ad', 'the log records who changed what on which rider')
  from admin_actions order by id desc limit 1;
update riders set suspended = false where id = :'ra';
select count(*) as log1 from admin_actions \gset
update drivers set status = 'online' where id = '20000000-0000-0000-0000-0000000000d1';
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1', '{"role":"admin"}');
update drivers set status = 'offline' where auth_user_id = '00000000-0000-0000-0000-0000000000d1';
reset role; select pg_temp.as_server();
select pg_temp.check((select count(*) from admin_actions) = :log1, 'an admin who also drives: going online/offline isn''t logged as admin work');

\echo '== Mobile number at sign-up'
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'p1@test', '{"name":"Pat P","phone":"+12425550111"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'p2@test', '{"name":"Dee Applicant","driver_application":{"phone":"242 555 0122"}}'),
  ('00000000-0000-0000-0000-0000000000b3', 'p3@test', '{"name":"Junk Number","phone":"12"}');
select pg_temp.check(phone = '+12425550111' and name = 'Pat P', 'the number given at sign-up is on the rider profile straight away')
  from riders where auth_user_id = '00000000-0000-0000-0000-0000000000b1';
select pg_temp.check(phone = '+12425550122', 'a driver applicant''s number is saved the same way')
  from riders where auth_user_id = '00000000-0000-0000-0000-0000000000b2';
select pg_temp.check(phone is null, 'something that isn''t a phone number isn''t saved')
  from riders where auth_user_id = '00000000-0000-0000-0000-0000000000b3';
select pg_temp.check(public.phone_e164('555-0100') = '+12425550100' and public.phone_e164('1 (242) 555-0100') = '+12425550100'
  and public.phone_e164('+44 20 7946 0958') = '+442079460958' and public.phone_e164('2-242-555-0100') is null
  and public.phone_e164('12345678') is null and public.phone_e164(null) is null, 'numbers are stored the way the app writes them (toE164)');
update auth.users set raw_user_meta_data = '{"name":"Junk Number","phone":"(242) 555-0133"}' where id = '00000000-0000-0000-0000-0000000000b3';
update auth.users set raw_user_meta_data = '{"phone":"+12425559999"}' where id = '00000000-0000-0000-0000-0000000000a1';
\ir ../migrations/017_rider_phone.sql
select pg_temp.check(phone = '+12425550133', 'a number saved only on the login is copied onto the rider profile')
  from riders where auth_user_id = '00000000-0000-0000-0000-0000000000b3';
select pg_temp.check(phone = '+12425550101', 'a number already on the rider profile is left alone') from riders where id = :'ra';

\echo '== A request nobody online could take stays open for 5 minutes'
update drivers set status = 'online' where id = '20000000-0000-0000-0000-0000000000d1';
insert into rides (id, rider_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, fare_cents, status, created_at)
select '70000000-0000-0000-0000-0000000000f1', id, 25.05, -77.34, 25.08, -77.33, 1500, 'requested', now() - interval '4 minutes'
  from riders where auth_user_id = '00000000-0000-0000-0000-0000000000b1';
insert into rides (id, rider_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, fare_cents, status, created_at)
select '70000000-0000-0000-0000-0000000000f2', id, 25.05, -77.34, 25.08, -77.33, 1500, 'requested', now() - interval '6 minutes'
  from riders where auth_user_id = '00000000-0000-0000-0000-0000000000b2';
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select pg_temp.check(exists (select 1 from public.open_ride_requests(25.05, -77.34, 25) where id = '70000000-0000-0000-0000-0000000000f1'),
  'a driver who goes online sees a request made 4 minutes ago, when nobody was online');
select pg_temp.check(not exists (select 1 from public.open_ride_requests(25.05, -77.34, 25) where id = '70000000-0000-0000-0000-0000000000f2'),
  'a request older than 5 minutes is gone (the sweeper ends it)');
reset role; select pg_temp.as_server();

\echo 'All money and safety rules passed.'
