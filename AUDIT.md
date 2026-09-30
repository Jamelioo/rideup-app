# RideUp Audit — 2026-09-30

Scope: code review of `api/`, `src/lib`, router, schema/RLS, and the rider, driver, payment, landing and legal flows. `npm run build` passes and `npm audit --omit=dev` reports 0 vulnerabilities.

**Not covered:** I did not render pages or take screenshots, so visuals are assessed from markup and classes only. I read the core flows in full and skimmed the remaining pages (Admin*, SavedPlaces, TrustedContacts, Support, Profile, EditProfile, most components) via grep. Treat those as unaudited.

## CRITICAL — fix before taking real money or real users

1. **Anyone can make themselves admin.** The admin check is `user_metadata.role === 'admin'` (router + every admin RLS policy in `supabase-schema.sql`). `user_metadata` is writable by the user (`supabase.auth.updateUser({data:{role:'admin'}})`). Use `app_metadata` (server-set only) or an `admins` table.
2. **Drivers can self-approve.** RLS "Users can insert/update own driver profile" has no column restriction. A user can insert or update `approved=true` on their own row and skip vetting. Same for `rating`, `total_trips`. Split approval into an admin-only path or use a column-guard trigger.
3. **Every `/api/*` endpoint is unauthenticated.** None verify a Supabase JWT or check the caller owns the ride/user.
   - `authorize-ride`, `capture-payment`, `cancel-payment`: anyone with a ride UUID can trigger a charge, capture, or release.
   - `create-setup-intent`: takes `userId` from the body, so you can attach cards to or read another user's Stripe customer.
   - `create-setup-session`: looks up a Stripe customer by email.
   - `notify-driver`: any caller can trigger approval/rejection emails to any driver.
   - Require `Authorization: Bearer <jwt>`, verify with `supabase.auth.getUser`, and check the ride belongs to the caller (rider, or assigned driver for capture).
4. **Clients can write money fields.** RLS lets ride participants `UPDATE` any column of `rides`. A rider or driver can change `fare_cents`, `payment_status`, `status`. The fare itself comes from the client on insert, so a rider can book a $0.01 ride. Compute and validate fare server-side and restrict updatable columns (RPC or trigger).
5. **Promos and referral credits live in `user_metadata`** (`Promotions.vue`, `Referrals.vue`), which the user can edit. Promo codes are hard-coded in the client bundle. `RiderBooking.applyPromo` gives 10% off for any non-empty text (`RiderBooking.vue:~258`), and that discounted fare is what gets inserted.
6. **Free rides are possible by design.** `acceptRide` (`useDriver.js:210-236`) continues when payment authorization fails ("proceeding without pre-auth"). It also then overwrites a ride that `authorize-ride` just set to `cancelled/payment_failed` back to `accepted`. `capture-payment` failure is swallowed in `DriverActiveRide.vue:66-76`. This contradicts the "enforce card before ride" commit.
7. **Ride accept is racy and probably blocked by RLS.** The update has no `.eq('status','requested')` guard, so two drivers can both accept and the last write wins. And the `rides` UPDATE policy in `supabase-schema.sql` only allows drivers on rows where `driver_id` is already theirs, so accepting an unassigned ride should fail. The same file has no SELECT policy letting drivers see `requested` rides. Use an atomic RPC: `update ... where id=$1 and status='requested' and driver_id is null returning *`.
8. **`ride_messages` SELECT policy is `auth.uid() = sender_id OR true`.** Every authenticated user, including anonymous guests, can read every ride chat.
9. **Stripe webhook** sets `status='paid'` on `checkout.session.completed`, a status the app doesn't otherwise use (would break the ride state machine). The current flow uses PaymentIntents, so the webhook does nothing for it: no handling of `payment_intent.payment_failed`, `amount_capturable_updated`, refunds or disputes. `webhook.js` falls back to the anon key if the service-role key is missing.

## HIGH — broken flows / data integrity

10. **Repo schema doesn't match the code.** Code reads or writes columns the SQL files don't define:
    - `riders.is_guest`, `riders.stripe_customer_id`, `riders.payment_method_id`
    - `rides.rider_name`, `rides.declined_by`, `rides.driver_lat`, `rides.driver_lng`, `rides.payment_intent_id`, `rides.payment_status`, `rides.paid_at`, `rides.payment_session_id`
    - `scheduled_rides.scheduled_at` and `.distance_miles` (schema has `scheduled_for`, no distance)
    - `ride_messages.content` (confirmed: `RideChat.vue:62` inserts `content`, schema column is `message NOT NULL`, so every chat insert fails; the error is returned not thrown, so the UI silently shows unsaved messages)
    - `drivers.total_trips` (schema has `total_rides`)
    - `driver_locations` table exists only in the older `supabase/schema.sql`
    - Two conflicting schema files (`supabase/schema.sql` vs `supabase-schema.sql`) with different columns and RLS. Pick one and add migrations.
11. **Ride status names don't match between DB and rider UI.** Driver writes `accepted / driver_arrived / in_progress / completed`. Rider `ActiveRide.vue` / `RideTracker.vue` expect `driver_enroute / driver_arrived / on_trip`. The rider never sees "Heading to your destination" / "On trip" in real mode.
12. **Driver details query is wrong.** `ActiveRide.vue:74` and `SearchingForDriver.vue` select `drivers.vehicle`, which doesn't exist, so the whole query errors. Also, RLS only lets a driver read their own row, so riders can't read driver name/plate/phone at all. Result in real mode: "Your Driver", no plate, no call button. Needs a driver-info RPC or view scoped to the ride.
13. **"Matched" screen in RiderFlow** (`RiderFlow.vue`) renders `matchInfo.driver_name`, `eta_minutes`, `vehicle`, `rating` from the raw ride row, which has none of those fields ("undefined is undefined minutes away") unless the redirect to `/ride/:id` happens first.
14. **Saved cards never register from the Payments page.** `create-setup-session` (Checkout setup mode) redirects to `/payments?card=added` and shows "Card added successfully", but nothing saves `payment_method_id` on the rider. The user will be asked for a card again at booking. The second Stripe integration path (Checkout) duplicates the SetupIntent one; remove one.
15. **Currency mismatch.** `create-checkout-session` charges in `bsd`; `authorize-ride` in `usd`. Pricing is shown as `$`. Pick one (BSD is 1:1 USD, but Stripe payout/fees differ).
16. **Anonymous sign-ins** (`signInAnonymously`) are unlimited and have no phone verification. The driver landing page claims "Every rider is phone-verified". Enable CAPTCHA/rate limits, or verify phone with OTP, or change the claim.
17. **Driver payout is never computed.** Landing pages promise "keep 80%". `DriverEarnings` and `AdminRevenue` sum gross `fare_cents`, and no 20% fee is recorded anywhere. Drivers will see inflated earnings. "Cash out instantly" text (`DriverEarnings.vue:195`) has no implementation.
18. **Driver location not shown to riders reliably.** Driver broadcasts over a channel and also writes `rides.driver_lat/lng` on every GPS tick (unthrottled DB write per position update, and columns are missing per #10).
19. **Cancel flows:** rider cancel on `ActiveRide.cancelRide()` only navigates away; it does not update the ride or release the payment hold. The driver can keep driving to a ride the rider thinks is cancelled. Cancellation fee (promised in Terms) is never charged.
20. **`RideReceipt` fallback shows fake data** (Visa ····4242, "Marcus Thompson", Sep 27 2026) if the query fails. `PaymentSuccess` marks the user's latest ride "verified" without checking it was paid.
21. **Driver request pickup** only looks at rides created in the last 90 s, newest one, no location/vehicle-type filtering — every online driver gets every request anywhere. `declined_by` update runs on the client and no server-side re-dispatch exists; there is no timeout/expiry for unanswered requests.
22. **Scheduled rides:** saved but nothing dispatches them (no cron/edge function).
23. **Stale committed artifacts:** `test-results/` (17 tracked files of failed stress-bot runs) is in git. All e2e failures recorded are `page.goto` timeouts against `localhost:5176`, not app bugs, but they shouldn't be committed. `playwright.config.js` is pointed at a dev server that must be running.

## MEDIUM — security hygiene

24. `notify-driver` HTML email interpolates `driver.name` unescaped (HTML injection in emails; name is user-supplied at apply time).
25. `AdminLayout.vue:37` uses `v-html` (static icons now, but a footgun).
26. In-memory rate limiter (`_rateLimit.js`) resets per serverless instance; only applied to 3 of 10 endpoints. The IP comes from a spoofable `x-forwarded-for` when not behind Vercel.
27. Error responses return `err.message` from Stripe/Supabase directly (`res.status(500).json({error: err.message})`).
28. `index.html` CSP is only `upgrade-insecure-requests`. No real CSP, frame-ancestors, or security headers in `vercel.json`. Add headers for CSP (Stripe, Google Maps, Supabase, Vercel Analytics), `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` (geolocation).
29. `leads` table: anonymous inserts with `with check (true)` and no dedup/rate limit (index is not unique) — spam-able.
30. `public/_redirects` is a Netlify file; `vercel.json` already rewrites, so it's dead weight. The `/api/(.*)` rewrite to itself is redundant.
31. Google Maps key is exposed client-side by design; make sure it's HTTP-referrer restricted in Google Cloud.
32. Committed docs `STRIPE_INTEGRATION_TODO.md` references `sk_live_REPLACE_ME` and says to edit `.env` — fine, but it's outdated relative to the PaymentIntent flow.

## Text / copy / legal

- **Unverifiable marketing claims:** "Join 200+ drivers", "200+" stat, three named testimonials with trip counts (Marcus T. "320+ trips", etc.), "run a background check", "Get anywhere in Nassau in 5 minutes", "Every driver verified", "24/7". If these are placeholders, they're fabricated testimonials on a public site; remove or replace with real ones before launch.
- **Terms/Privacy** last updated "September 1, 2025" (a year ago, before most of this app existed). Missing: guest/anonymous accounts, card pre-authorization and capture, cancellation fee amount, driver terms, location sharing (trusted contacts, share trip), third parties (Stripe, Google Maps, Supabase, Vercel Analytics, Resend), data retention, age verification, governing law/jurisdiction. Privacy "never stored on our servers" is true for card numbers, but you store Stripe IDs — say so.
- **About page:** "Rate the app" links to the generic `https://apps.apple.com`; there is no native app. `<title>`, OG and Twitter tags have no `og:image`/`twitter:image` (card is `summary` with no image).
- Referral share text says "Get $5 off your first ride… Download RideUp" but no referral redemption exists server-side, and there's no app to download.
- Promo list text claims e.g. "$10 off" codes that nothing enforces on the server.
- Placeholder/fake-looking data in demo mode is shown whenever `VITE_GOOGLE_MAPS_API_KEY` is missing (not only Supabase). A production deploy missing the Maps key silently runs the fake demo with a banner ("no backend connected") instead of failing loudly. Consider gating DEMO_MODE behind an explicit `VITE_DEMO=true`.
- Phone `(242) 452-9911` and `support@rideupnassau.com` are used consistently. Confirm they're real/monitored.

## Visual / UX / accessibility

- **Brand colour drift:** the UI uses `#2b8659` (and `--color-brand`), but 19 places still use the old lime green `rgba(88,204,2,…)` / `#58cc02` glow (HarborBackdrop, SearchingForDriver, RiderBooking focus ring, DriverLanding gradients, DriverApply, DriverPending, DriverRideRequest, DriverActiveRide). Focus rings and glows will look off-brand (lime vs forest green).
- Brand colour is hard-coded as `text-[#2b8659]` / `bg-[#2b8659]` throughout instead of the `--color-brand` token, so dark mode (`#34a065`) isn't applied to most of the UI; brand text on dark surfaces has lower contrast than intended.
- **Muted text contrast:** `--color-text-muted` is 35% opacity of the text colour (≈2.3:1 on white, below WCAG AA 4.5:1) and it's used for real content (helper text, timestamps, terms dates). `--color-text-secondary` (55%) is ≈3.9:1 and used for body copy on Terms/Privacy. Raise to ≥ 60% / 70%.
- **Tiny text:** 71 uses of `text-[9px]…[11px]`.
- **Accessibility:** only 15 `aria-label`s across 195 `<button>`s; many icon-only buttons (back arrows, close, menu toggle) have none. Map markers/HarborBackdrop decorative SVGs aren't `aria-hidden`. The bottom-sheet drag handle is touch/mouse only (no keyboard alternative). The slide-to-complete control on the driver screen has no keyboard/tap fallback — a driver with a motor impairment or a failing touchscreen can't end a trip.
- **Layout:** `h-screen` (100vh) on the booking/driver screens causes the bottom sheet to sit under the mobile browser toolbar; use `100dvh`. `html, body { overflow-x: hidden }` hides rather than fixes any horizontal overflow.
- `manifest.json` has one SVG icon only: no 192/512 PNG, so "Add to Home Screen" on Android/iOS will not show a proper icon; `apple-touch-icon` points to an SVG (iOS ignores it). `theme_color` static while dark mode exists.
- **Emoji as icons** (`🚗 🚙 🚘 💬 📞`) in vehicle cards and matched card render differently per OS and aren't labelled.
- Fonts: `--font-serif` is mapped to Inter, so `font-serif` classes are misleading; Google Fonts loaded render-blocking from `index.html` (no `font-display` fallback guarantee beyond `display=swap`, which is set — fine).
- `BottomNav` is rendered globally in `App.vue` — confirm it's hidden on booking/landing/driver/admin screens where it would overlap the bottom sheet and action buttons.
- Images: `public/images/*.jpg` (59 KB / 82 KB) and `src/assets/hero.png`, `vite.svg`, `vue.svg` are Vite template leftovers/unoptimised; check they're actually referenced.

## Code quality

- `ActiveRide.vue` in-app chat `sendMessage()` only pushes to a local array (never saved or sent to the driver); the real chat is `RideChat`/`RideMessages`. Same in `RiderFlow.vue`. Dead/fake chat UI paths should be removed.
- `CancelRide.vue` component isn't referenced anywhere in `src`, and `cancel_fee_cents` is never written.

- `RiderBooking.vue` is 821 lines mixing address autocomplete, pricing, auth, Stripe, scheduling; rider-creation logic is copy-pasted 3 times (`createRideForUser`, `handleGuestSubmit`, `scheduleRide`), each with slightly different fields.
- Auth/DB errors mostly swallowed or shown as generic text; no global error handler or boundary.
- `useDriver` singleton state is module-level and never reset on logout (a second user on the same tab inherits `driver`, `currentRide`, realtime subscriptions, and the 5 s polling interval).
- Realtime channels in `ActiveRide.vue` (`ride-status-…`) are never removed on unmount (only `locationChannel` is tracked); `statusTimers` aren't cleared on unmount.
- Polling every 5 s per online driver + every searching rider, in addition to realtime.
- No tests beyond Playwright smoke/stress; no unit tests for `calculateFare` or server routes; no CI config.
- Minimum fare check: `calculateFare` base+per-mile: 4.2 mi/12 min ⇒ $11.83 matches the receipt fixture, but `RideReceipt` recomputes line items with `data.base_fare || 250` defaults that won't match the stored fare if rates change. Store the breakdown on the ride.

## Suggested order of work

1. Lock down auth: fix admin role (#1), driver self-approval (#2), API authentication (#3), ride column-level writes (#4), chat policy (#8).
2. Move fare calculation, promo validation and ride acceptance server-side (#4, #5, #7); make payment authorization mandatory (#6).
3. Reconcile the schema with the code in one migration (#10) and fix status names/driver-info access (#11–#13).
4. Payments: one card-saving path, one currency, webhook handling for PaymentIntents, cancel/fee handling (#9, #14, #15, #19).
5. Remove/replace fabricated claims and testimonials; update Terms/Privacy.
6. Visual pass: replace lime remnants, use the brand token, fix contrast and aria-labels, `100dvh`, PWA icons.

## Remediation status (critical items)

| # | Item | Status |
|---|------|--------|
| 1 | Admin via `user_metadata` | **Fixed** — `app_metadata` in router, SideMenu, RLS (`is_admin()`), API. Existing admins must be re-granted (see migration header). |
| 2 | Driver self-approval | **Fixed** — `guard_drivers` trigger locks `approved`/`rating`/trip counts; only approved drivers can go online. |
| 3 | Unauthenticated `/api/*` | **Fixed** — JWT required on authorize/capture/cancel/setup-intent/setup-session/checkout/notify; ownership checked; notify-driver is admin-only. `verify-session` is still open (needs a Stripe session id). |
| 4 | Client-written fare/payment fields | **Fixed** — fare recomputed from coordinates in a DB trigger (rates must stay in sync with `pricing.js`); protected columns; status-transition rules. |
| 5 | Promo / credits | **Mitigated** — booking promo removed so nothing client-side changes price; server recomputes fare. The Promotions/Referrals pages still keep display-only data in `user_metadata` and grant nothing; a real promo system needs a server table. |
| 6 | Free rides | **Fixed** — accept only succeeds if the card hold succeeds; failure cancels the ride and tells the driver; capture requires a completed ride with an authorized payment. |
| 7 | Accept race / RLS | **Fixed** — atomic `accept_ride` / `decline_ride` RPCs; drivers can see open requests. |
| 8 | Chat readable by all | **Fixed** — participants/admin only; `message` column renamed to `content`. |
| 9 | Webhook | **Partly fixed** — no longer writes `rides.status`, requires service key, handles `payment_intent.payment_failed`, generic errors. Refund/dispute handling still TODO. |

Still open from the critical list's neighbours: riders can still write their own `stripe_customer_id`/`payment_method_id` directly (should move to a server endpoint that reads the SetupIntent), `verify-session` is unauthenticated, and everything in the High/Medium sections.

Deploy order: run `supabase/migrations/002_security_hardening.sql`, set `SUPABASE_SERVICE_ROLE_KEY` in Vercel, re-grant admin, then deploy the code (old client + new DB will fail ride accept; new client + old DB will fail the `accept_ride` RPC).


## Remediation status — High items and screenshot UI/UX audit

Screenshots were taken with Playwright/Chromium in demo mode at 390px (light + dark) and 1280px, across ~24 routes. Logged-in-only states (bottom nav over the booking sheet, real ride flow with live data, Stripe card entry) could not be rendered without real Supabase/Stripe keys and are **untested visually**.

**UI/UX findings from screenshots — fixed**
- **Driver landing page unreadable in dark mode** (hero used the text colour as its "dark" background, so white text sat on a pale panel; also footer, referral card, 404, toasts). Fixed with a fixed dark colour.
- Faint text everywhere (placeholders, helper text, "Continue as guest"): muted/secondary text colours raised to readable contrast in light and dark.
- 21 leftover lime-green glows/favicon → brand green; brand-coloured text now uses the theme token (lighter on dark).
- `100vh` → `100dvh` (34 places); text under 11px removed; 38 icon-only buttons + 2 switches + 2 social links + 1 image now labelled; slide-to-complete now keyboard/tap accessible.
- Bottom nav no longer hides the booking sheet (sheet sits above it via `--bottom-nav-h`) — logic only, not visually verified logged-in.
- PWA: real 192/512/maskable PNG icons, Apple touch icon, share image (`og-image.png`), `summary_large_image`; removed Vite template leftovers, Netlify `_redirects`, dead sitemap line.
- Landing hero mockup now shows real product names and realistic prices; Payments page copy/state matches the real flow (shows the actual card on file instead of a permanent fake checkmark).
- Not fixed (by choice): admin tables are not phone-friendly (horizontal scroll, actions off-screen); demo banner wraps to two lines and adds 48px to `h-dvh` screens in demo mode only; driver-landing "200+ drivers", testimonials and mock earnings remain unverifiable marketing copy.

| # | High item | Status |
|---|-----------|--------|
| 10 | Schema/code mismatches | **Fixed** — migration 003 (scheduled_rides columns/FK/policy, card + payout + receipt columns, realtime on rides/chat); conflicting `supabase/schema.sql` removed; README lists the run order. |
| 11 | Status name mismatch | **Fixed** — rider UI maps `accepted/in_progress` to tracker states. |
| 12 | Riders can't see driver details | **Fixed** — `get_ride_driver` RPC (participants only), used by search, live-ride and receipt screens. |
| 13 | "undefined minutes away" match screen | **Fixed** — match details built before the screen is shown. |
| 14 | Card saved from Payments page never stored | **Fixed** — webhook stores setup-mode cards; in-app path goes through new `/api/save-payment-method` (verifies the SetupIntent belongs to the user's Stripe customer; client can no longer write card fields). |
| 15 | Currency mismatch | **Fixed** — USD everywhere (checkout session and copy). |
| 16 | "Phone-verified" claim / anonymous sign-ins | **Claim fixed** (now "payment card on file"). Anonymous sign-in abuse limits and CAPTCHA must be configured in the Supabase dashboard. |
| 17 | Driver payout not computed | **Fixed** — 20% fee / 80% payout stored per ride; driver screens show payout; admin pages relabelled "Gross bookings"; fake "instant cash out" text removed. |
| 18 | Unthrottled GPS DB writes | **Fixed** — at most one every 10s (live position still streams over realtime). |
| 19 | Cancel flows | **Fixed** — rider cancel releases the hold and cancels the ride; driver screen reacts when the rider cancels; rider sees a cancelled screen. Cancellation **fee** is still never charged (needs a policy decision). |
| 20 | Fake receipt / unchecked "verified" | **Fixed** — no placeholder data; real line items, real card; unpaid rides aren't marked verified. |
| 21 | Driver request targeting/expiry | **Partly fixed** — vehicle-type filtering and request expiry (rider timeout cancels; server cleanup in the dispatcher). No distance-based matching (drivers don't share location yet). |
| 22 | Scheduled rides never dispatched | **Fixed in code** — `/api/dispatch-scheduled`; it must be called every minute (Vercel Pro cron, pg_cron, or external pinger) with `CRON_SECRET`. Not scheduled automatically. |
| 23 | Committed test-results | **Fixed** — removed and gitignored. |

Deploy order now: run migrations 002 then 003, set `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`, add the Stripe webhook events above, then deploy.
