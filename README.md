# RideUp Nassau — On-Demand App (Vue + Supabase)

Rebuild of RideUp Nassau as an Uber-style on-demand ride app for locals in
New Providence. Vue 3 + Vite + Tailwind on the frontend, Supabase (Postgres)
on the backend.

## What's built so far

- **Rider booking flow** (`src/pages/rider/`)
  - `RiderBooking.vue` — pickup/dropoff with Google Places autocomplete
    (biased to New Providence), live route + fare calculation, vehicle
    picker (Standard / XL), submits a ride request to Supabase
  - `SearchingForDriver.vue` — shown after request, listens in real time
    for a driver to accept via Supabase Realtime
  - `RiderFlow.vue` — parent component wiring the two screens together

- **Database schema** (`supabase-schema.sql` + `supabase/migrations/`)
  - `riders`, `drivers`, `rides`, `scheduled_rides`, `ride_messages`, support/safety tables
  - Row Level Security + guard triggers so users can only touch their own data and can't edit fares, payments or driver approval
  - Realtime enabled on `rides` and `ride_messages`

- **Fare calculation** (`src/lib/pricing.js`)
  - Distance + time based pricing, separate rates for Standard vs XL
  - This is for on-demand point-to-point rides — your existing airport
    transfer flat rates stay on the current Stripe/WordPress setup unless
    you want those folded in here too

## What's NOT built yet (next steps, in order)

1. **Driver dashboard** (port the Firebase version we built earlier to
   Supabase — same online/offline toggle, same accept/decline flow, just
   swapping Firebase Realtime DB for Supabase's `driver_locations` table
   and Postgres changes instead of Firestore listeners)
2. **Matching logic** — a Supabase Edge Function that runs when a ride is
   requested: finds nearest online, approved driver, assigns them, and
   reassigns to the next-nearest if they decline or timeout
3. **Live tracking screen** — rider sees the matched driver's dot move in
   real time via `driver_locations` Realtime subscription
4. **Auth** — phone number sign-up/login for both riders and drivers
   (Supabase Auth supports phone OTP natively)
5. **Stripe payment on completion**
6. **Driver sign-up flow** — the form where new drivers apply (name, phone,
   vehicle info), which creates an `approved = false` row until you
   manually approve them

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Create a new project (e.g. "rideup-nassau")
3. Once it's ready, go to the **SQL Editor** and run these files **in order**:
   `supabase-schema.sql`, then `supabase/migrations/001_create_leads_table.sql`,
   `002_security_hardening.sql`, `003_high_priority_fixes.sql`.
   (`002` explains how to grant your admin account the `app_metadata` admin role.)
4. Go to **Project Settings → API** — copy the **Project URL** and
   **anon public key**

### 3. Get a Google Maps API key

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project (or use an existing one)
3. Enable these APIs: **Maps JavaScript API**, **Places API**,
   **Geocoding API**, **Directions API**
4. Go to **Credentials** → Create API key
5. (Recommended) Restrict the key to your domain once you deploy

### 4. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the three values from steps 2 and 3.

### 5. Run it

```bash
npm run dev
```

Note: since there's no auth/driver sign-up yet, requesting a ride will
currently fail at the "find rider profile" step unless you manually
insert a test rider row in Supabase's Table Editor with your test
`auth_user_id`. Auth is the next thing to build so this works end to end.

## Deploying

Push this to a GitHub repo, then connect it to **Netlify** or **Vercel**
for automatic deploys on push. Add the same three env vars in their
dashboard settings.


## Server configuration (Vercel environment variables)

| Variable | Used by |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | every protected `/api/*` route (they refuse to run without it) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | payments + webhook (listen for `checkout.session.completed` and `payment_intent.payment_failed`) |
| `CRON_SECRET` | `/api/dispatch-scheduled` |
| `RESEND_API_KEY`, `EMAIL_FROM` | driver approval emails |

### Scheduled rides and stale requests

`/api/dispatch-scheduled` turns due scheduled rides into live requests and cancels requests no driver answered
within 5 minutes. Call it every minute with `Authorization: Bearer $CRON_SECRET` — Vercel Cron (Pro plan),
Supabase `pg_cron` + `pg_net`, or any external pinger. Without it, scheduled rides are saved but never dispatched.
