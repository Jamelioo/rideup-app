# RideUp Nassau

An Uber-style ride app for New Providence: riders book and track trips, drivers accept and run them, and admins
approve drivers, handle safety reports and pay drivers out. Vue 3 + Vite + Tailwind on the front end, Supabase
(Postgres, auth, storage, realtime) for data, Stripe for payments, Vercel serverless functions in `api/`.

Without Supabase keys the app runs in **demo mode** (sample data, no backend) so you can click through every screen.

## What it does

**Riders**
- Book with Google Places search, see upfront prices for Go ($2.00 + $1.25/mile + $0.35/min, $10 minimum; XL and Premium appear once an admin turns them on), book as a
  guest or with an account, schedule rides.
- Live trip screen: driver photo, car and big plate, live ETA, wait timer at pickup, call and in-app chat (phone and
  chat only while the trip is active; chat stays open 30 minutes after drop-off for lost items).
- Safety: share a live trip link (`/track/<token>`, no login needed), optional pickup PIN, report a problem,
  emergency call (919).
- Cancel with a clear fee preview (free for 2 minutes after a driver accepts, then $5). If the driver cancels, the
  app finds another driver automatically at the same price.
- After the trip: rate the driver, add a tip (100% to the driver), receipt page and receipt email.
- Password reset, email confirmation, saving a guest account, optional SMS phone verification.

**Drivers**
- Apply (the application survives email confirmation), upload documents with review status and expiry warnings,
  profile photo (re-reviewed when changed).
- Go online, see nearby requests with distance and earnings but only an approximate pickup until accepting, accept
  or decline, navigate, arrive, start (with PIN if required), complete, rate the rider.
- No-show: after 5 minutes waiting at pickup the driver can cancel and the rider pays the no-show fee.
- Earnings: today and this week, balance, tips and payouts received.
- Drivers whose app has been closed for 3 minutes are set offline automatically.

**Admins** (`/admin`, needs the admin role)
- Dashboard, rides, riders (suspend), drivers (document review with checklist, expiry dates, background check,
  vehicle class, approve / reject with a note, low-rating flags), revenue, support, safety reports (with reporter,
  trip and phone numbers), payouts ledger, and trip settings (pickup PIN, Premium, required phone verification).

## Setup

### 1. Install

```bash
npm install
```

### 2. Supabase

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. In **SQL Editor**, run these files **in order**: `supabase-schema.sql`, then everything in
   `supabase/migrations/` (`001` … `007`). Each migration can be re-run safely.
3. Make yourself an admin (SQL Editor, use your account's email):
   ```sql
   update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
   where email = 'you@example.com';
   ```
   Log out and back in for it to take effect.
4. **Authentication → URL Configuration**: set **Site URL** to your domain and add these **Redirect URLs**
   (they're where emailed links land):
   `https://YOUR_DOMAIN/reset-password`, `https://YOUR_DOMAIN/set-password`, `https://YOUR_DOMAIN/driver/apply`,
   `https://YOUR_DOMAIN/book` (or simply `https://YOUR_DOMAIN/**`).
5. **Authentication → Sign In / Providers**: enable **Anonymous sign-ins** (guest booking). "Confirm email" can be
   on or off; the app handles both.
6. Optional, for SMS phone verification: **Authentication → Phone**, connect an SMS provider (e.g. Twilio). Only
   then turn on "Require verified phone numbers" in Admin → Settings.
7. **Project Settings → API**: copy the Project URL, the anon key and the service role key.

### 3. Google Maps

Create an API key in [Google Cloud](https://console.cloud.google.com) with **Maps JavaScript API**, **Places API**,
**Geocoding API** and **Directions API** enabled. Restrict it to your domain (it ships in the browser) and set a
budget alert.

### 4. Environment variables

```bash
cp .env.example .env
```

`.env.example` explains every value. For Vercel, add the same variables under **Settings → Environment Variables**:

| Variable | Needed for |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | the app (leave empty for demo mode) |
| `VITE_GOOGLE_MAPS_API_KEY` | maps, address search, routes |
| `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | payments (see `STRIPE_INTEGRATION_TODO.md`) |
| `SUPABASE_SERVICE_ROLE_KEY` | every protected `/api/*` route (they refuse to run without it) |
| `DOMAIN` | Stripe redirect URLs |
| `CRON_SECRET` | the every-minute job below |
| `CANCEL_FEE_CENTS`, `CANCEL_GRACE_SECONDS`, `FREE_WAIT_SECONDS` | cancellation / no-show policy (defaults $5, 2 min, 5 min); set `VITE_CANCEL_GRACE_SECONDS` / `VITE_FREE_WAIT_SECONDS` to match |
| `RESEND_API_KEY`, `EMAIL_FROM` | optional: receipts, fee and tip receipts, driver approval emails |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `VITE_VAPID_PUBLIC_KEY` | optional: push notifications (`npx web-push generate-vapid-keys`) |

Optional features stay switched off until their keys are set; nothing breaks without them.

### 5. The every-minute job

`/api/dispatch-scheduled` must be called every minute with `Authorization: Bearer $CRON_SECRET` (Vercel Cron on the
Pro plan sends it automatically; Supabase `pg_cron` + `pg_net` or any external pinger also works). Each run:

- turns due scheduled rides into live requests and alerts nearby drivers,
- cancels requests nobody accepted within 5 minutes,
- sets drivers offline whose app hasn't checked in for 3 minutes,
- charges completed trips whose payment capture didn't arrive from the driver's phone.

Without it, scheduled rides never dispatch and stale requests and online statuses linger.

### 6. Stripe webhook

Add `https://YOUR_DOMAIN/api/webhook` in Stripe → Developers → Webhooks. Events and testing are in
`STRIPE_INTEGRATION_TODO.md`.

## Develop and test

```bash
npm run dev          # http://localhost:5173 (demo mode without .env)
npm test             # unit tests: pricing, fees, auth helpers, API helpers
npx playwright test  # end-to-end tests in e2e/ (runs against the dev server)
npm run build        # production build into dist/
```

Fares are computed in two places that must agree: `src/lib/pricing.js` (shown to riders) and the
`guard_rides_insert` trigger (charged). `tests/pricing.test.js` pins the expected values.

## Project layout

- `src/pages/rider`, `src/pages/driver`, `src/pages/admin`: the three apps; `src/components`: shared pieces.
- `src/lib`: auth (`useAuth`), driver session (`useDriver`), pricing, policy, push, settings, helpers.
- `api/`: serverless functions. To stay within Vercel's 12-function Hobby limit, every endpoint the app calls runs
  in one function, `api/[action].js`, which hands `/api/<action>` to `api/_routes/<action>.js` (payments:
  `authorize-ride`, `capture-payment`, `cancel-ride`, `add-tip`, card setup; notifications: `trip-event`,
  `notify-driver`). Stripe's `webhook`, the cron (`dispatch-scheduled`) and `csp-report` are separate functions.
  Files and folders starting with `_` are shared code, not functions. Add new endpoints to `api/_routes/` and
  register them in `api/[action].js`; `tests/router.test.js` fails if the app calls an unregistered route or the
  function count goes over 12.
- `supabase/migrations/`: database rules (row-level security, guard triggers, RPCs). Clients can't change fares,
  payments, ratings they don't own, driver approval or protected ride fields.
- `AUDIT.md`, `AUDIT_V2.md`: audits and what was fixed.
