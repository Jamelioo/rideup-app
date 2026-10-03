# RideUp launch checklist

Work through this top to bottom before opening to the public. Tick each box only after you've seen it work.

## 1. Switch from test to live

- [ ] **Stripe live keys** in Vercel (Production): `STRIPE_SECRET_KEY` (`sk_live_…`) and `VITE_STRIPE_PUBLISHABLE_KEY` (`pk_live_…`).
- [ ] **Stripe live webhook**: Stripe › Developers › Webhooks (live mode) › Add endpoint
      `https://www.rideupnassau.com/api/webhook` with events `checkout.session.completed`, `charge.refunded`,
      `charge.dispute.created`, `payment_intent.payment_failed`. Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
- [ ] **Redeploy** after changing keys (Vercel › Deployments › latest › Redeploy).
- [ ] **Google Maps key** restricted to `https://rideupnassau.com/*` and `https://www.rideupnassau.com/*`
      (plus `https://rideup-app.vercel.app/*`), with only Maps JavaScript, Places, Directions and Geocoding enabled,
      and a daily quota so a bug can't run up a bill.
- [ ] **Emails**: `RESEND_API_KEY` set and `rideupnassau.com` verified in Resend, so receipts don't land in spam.
      Send yourself a test receipt.
- [ ] Optional: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (texts to passengers booked by someone else),
      `VITE_SENTRY_DSN` and `SENTRY_DSN` (error reports), the push keys (`VAPID_*`, and `APNS_*` / `FCM_*` for the store apps).
- [ ] Remove any test riders, drivers and rides from the database (Supabase › Table editor), or keep them clearly named "TEST".

## 2. Database and settings

- [ ] Migrations `001` … `012` all run in the Supabase SQL Editor, in order.
- [ ] Your admin account has `{"role":"admin"}` in its app metadata, and Admin pages open without errors.
- [ ] Admin › Settings reviewed: busy-time pricing, pickup PIN, XL / Premium offered only when you have those drivers,
      verified phone numbers only if SMS is set up in Supabase.
- [ ] Supabase › Authentication › URL configuration: Site URL `https://www.rideupnassau.com`, and both domains in the
      redirect list (password reset and email confirmation links depend on it).
- [ ] Supabase backups: on a paid plan, daily backups are on. On the free plan, export the database weekly,
      and note that free projects pause after a week without use.

## 3. Running and monitored

- [ ] `https://rideupnassau.com/api/health` shows `"ok":true` (database ok, background job ok).
- [ ] UptimeRobot checks that address every minute and alerts your phone.
- [ ] The background job is scheduled in Supabase (`rideup-dispatch`, every minute), and the red warning on Admin is gone.
- [ ] GitHub checks are green on `main`.

## 4. Test rides (two phones, about 45 minutes)

Use a rider account on one phone and an approved driver account on another. Use a real card for a few small trips
after switching to live keys, and refund them afterwards.

| # | Do this | You should see |
|---|---|---|
| 1 | Rider: enter pickup and drop-off | Upfront price; "Busy" only if it really is busy |
| 2 | Rider: book | Driver phone gets the request (sound/alert) |
| 3 | Driver: accept | Rider sees the driver and car; Stripe shows an **uncaptured** payment for the fare |
| 4 | Driver: "I've arrived" | Rider gets "Your driver has arrived"; wait timer starts |
| 5 | Driver: start (enter PIN if on) | Trip in progress on both phones; driver's position moves on the rider's map |
| 6 | Driver: slide to complete | Stripe payment **captured**; receipt email arrives; rider is asked to rate |
| 7 | Rider: add a $1 tip | Tip receipt; driver's earnings go up by $1 |
| 8 | New trip: rider cancels more than 2 minutes after accept | Cancellation fee charged and on the receipt |
| 9 | New trip: driver waits 5 minutes, then "Rider didn't show up" | No-show fee charged |
| 10 | New trip with an extra stop | Price includes the stop; driver gets "Stop done" |
| 11 | New trip: "Someone else?", with a third phone number | Driver sees the passenger's name and phone; the passenger gets a text (if Twilio is set) |
| 12 | During a trip: Split fare with a third account | Friend accepts; both charged their share at the end |
| 13 | Admin › Rides › a trip › refund $1 as credit | Rider is notified; credit is used on the next trip |
| 14 | Admin › Money | The day's trips, payments and RideUp's share look right |
| 15 | Delete a test rider account from Profile | Logged out; the account can't sign in again |
| 16 | Driver: go online, allow notifications, then switch to another app; rider books | Driver gets a "New trip request" notification; tapping it opens the request. After 30 minutes away the driver is taken offline and told so |

## 5. Business and legal

- [ ] Terms of Service and Privacy Policy read by a Bahamian lawyer (both are in the app: `/terms`, `/privacy`).
- [ ] Business licence and any transport / taxi licensing required for app-based rides.
- [ ] Drivers' commercial insurance requirements decided and checked during approval (Admin › Drivers).
- [ ] Support phone and WhatsApp (242-452-9911) answered during operating hours; someone checks Admin › Safety daily.
- [ ] Driver payout schedule set (e.g. weekly) and recorded in Admin › Payouts.

## 6. Launch day

- [ ] Someone watches Admin › Rides, Admin › Safety and UptimeRobot for the first few hours.
- [ ] If something breaks after a deploy: Vercel › Deployments › the previous working one › **Promote to Production**
      (the rollback takes effect within seconds).
- [ ] Too few drivers at a busy time: create an incentive (Admin › Incentives). A storm or an outage:
      switch off busy-time pricing (Admin › Settings).
