# RideUp Audit v2: UX/UI, security and trip flow against Uber practices (2026-10-02)

**Benchmark:** how Uber handles the same moment: booking, matching, pickup, trip, payment, rating, safety, support and driver ops.

**Method:**
- Walked the full rider flow (quote → request → match → live ride → rating) and driver flow (online → request → accept → arrive → start → complete → rate rider) in Chromium at phone size, light and dark.
- Read every flow-critical page, component, API route and migration.
- Unit tests: 18/18 pass. Browser smoke tests: 25 pass, 3 skipped in demo mode.

**Limits:**
- No live Supabase or Stripe keys, so real-backend behaviour comes from reading the code, not from running it.
- Card entry, real maps and push could not be rendered.

**Overall:** the security and money foundations from the last rounds hold up: server-side fares, atomic accept, card holds, locked-down tables and authenticated APIs. What's missing is mostly the **trip experience around them**. Riders and drivers can't actually talk to each other, a refresh mid-trip strands both sides, the safety toolkit is built but never shown, and two account flows are broken. None of these is visible in demo mode, but every one would surface in the first week of real rides.

## Fix status (2026-10-02)

Everything below has been fixed in code. Items marked **config** work as soon as you add the key or flip the setting;
until then they stay off and nothing breaks. Verified with 28 unit tests, 31 browser tests (3 skipped in demo mode),
a 100-bot chaos run, and the migration's rules exercised on Postgres 16 (fares, one active ride, ratings, PIN,
share links, suspension, payouts, realtime policies, Premium gating, heartbeat, re-match).

| Item | Status |
|---|---|
| C1 Chat and calls | Fixed: real chat and call on both trip screens; phone and chat only while active (+30 min chat for lost items). |
| C2 Trip recovery | Fixed: rider and driver return to any active trip; the driver is never locked out. |
| C3 Safety | Fixed: shield on both trip screens (919, live share link, report), public `/track/<token>`, admin safety queue with reporter, trip and phone numbers. Reports were also being silently dropped (wrong column); fixed. |
| C4 Accounts | Fixed: set-new-password page, driver applications survive email confirmation (saved with the account, submitted automatically, any device). |
| H1 Cancellation | Fixed: one server cancel endpoint, wait timer, $5 no-show after 5 minutes, fee preview. |
| H2 Driver earnings | Fixed: earnings shown everywhere, balance, tips and payouts on the earnings page. |
| H3 ETA | Fixed: live ETA from the driver's real position, ETA to destination during the trip. |
| H4 Ratings | Fixed: written once by the right person after completion, rolling averages, honest errors, issue tags, low-rating review flag. |
| H5 Admin | Fixed: no fake data in live mode, correct statuses, rider suspension that blocks booking, document viewer and checklist, payouts ledger. |
| H6 Multiple rides | Fixed in the database for everyone, including the scheduler. |
| H7 Guest conversion | Fixed: confirm email first, then choose a password (Supabase's required order). |
| H8 Hidden main action | Fixed: sticky request bar showing the card on file. |
| M1 Phone exposure | Fixed for the short term (active trips only). Masked numbers need Twilio Proxy. |
| M2–M9 | Fixed. M3 now also hides the house number and destination street before accepting. |
| M10 Phone verification | **config**: verify-phone page built; needs an SMS provider in Supabase, then the admin setting. |
| U1–U6, U8 | Fixed (U2 pickup PIN is an admin setting). |
| U7, U10 Push alerts | **config**: needs VAPID keys. Wait timer done. |
| U9 Email receipts | **config**: needs `RESEND_API_KEY`. |
| Low items | Fixed (CSP buffers, request cards close on cancel, drivers go offline when the app is closed). Promotions/Referrals remain "coming soon". |

**Also fixed while doing this (found during the work):**
- A dropped connection at drop-off could leave a trip uncharged; capture is now retried and swept up by the cron.
- A double tap on a tip could charge twice; the tip is claimed before charging.
- "RideUp Premium" was sold at Premium prices but dispatched to any car. Premium is now hidden until an admin turns
  it on, and only goes to vehicles an admin has approved as Premium.
- When a driver cancels, the rider is re-matched automatically at the same price (Uber behaviour).
- New-request push alerts went to every online driver island-wide with the exact pickup address; they now go to
  the closest matching drivers and show only distance and earnings.
- Riders saw the driver's full name; both sides now see first names only.

**Still open (needs a service or a decision):** masked calling (Twilio Proxy), automatic driver payouts (Stripe
Connect), background-check vendor, promotions/referrals.

---

## CRITICAL: breaks a real trip or a safety promise

### C1. Riders and drivers can't communicate
- **Uber:** in-app chat and masked calls, both ways, from accept until shortly after drop-off.
- **Rider side:** on the live-ride screen, "Message" opens a chat that only stores messages in the page (`ActiveRide.vue` `sendMessage` pushes to a local array). Nothing is sent.
- **Unused code:** the real chat (`RideChat.vue`, `/ride/:id/messages`) is never opened from anywhere.
- **Driver side:** the driver screen has **no** call or message button at all, so a driver who can't find the rider has no way to reach them.

### C2. A refresh or dropped connection mid-trip strands both sides
- **Uber:** reopening the app always returns you to the trip in progress.
- **Driver side:**
  - The current ride lives only in memory (`useDriver`). After a reload the driver lands on the dashboard with no ride.
  - The database then refuses every new request ("Driver already has an active ride").
  - The trip can never be completed, so **the card hold is never captured** (lost revenue).
  - The driver is locked out until someone edits the database.
- **Rider side:** a reload or closed tab loses the trip screen, and nothing leads back to it.

### C3. The safety toolkit exists but is never shown
- **Uber:** a shield button on every trip screen with an emergency call, live trip sharing, and incident reporting that reaches a person.
- **Unused components:** `SafetyToolkit.vue`, `ShareTrip.vue` and `ReportSafety.vue` are not used on any page, so there is no emergency button during a trip.
- **Share trip:** it only sends static text ("I'm on a RideUp ride, From/To"). There's no live link, no driver name or plate, and "Copy link" copies that same text.
- **Trusted contacts:** they are saved but never used.
- **Safety reports:** there is **no admin view** for them, so if a rider reports a safety issue, nobody sees it.
- **Policy pages:** the Privacy Policy and Terms describe trip sharing as a working feature.

### C4. Two account flows are broken
- **Forgot password:**
  - The app sends the reset email, but there is no page or handler to set the new password (no `PASSWORD_RECOVERY` handling, no route).
  - Users who click the link land in the app and are never asked for a new password.
- **Driver sign-up with email confirmation on:**
  - `DriverApply` creates the account, then immediately needs a session. With confirmation required there isn't one, so the driver sees "Please log in first."
  - The application data they typed is lost.

---

## HIGH

### H1. Cancellation is two separate calls, so money can leak
- **Rider cancel during the trip:** the app releases the hold first, then changes the ride status in a second call. If the second call fails, the driver keeps going and completes a trip that can no longer be charged.
- **Rider cancel while searching:** it never releases a hold. If a driver accepted a second earlier, the rider's card stays on hold for days.
- **Uber:** cancellation is one server action that decides the fee and the hold together.
- **No-show rules missing:**
  - After the driver arrives, the rider has no cancel button.
  - The driver can't cancel with a no-show fee. Uber starts a wait timer and, after 5 minutes, lets the driver cancel as a no-show and charges the rider.

### H2. Drivers see the gross fare, not their earnings
- **Where:** the request card says "$12.00 est. fare" and "Trip complete" says "+$12.00", while the earnings page says "+$9.60" for the same trip.
- **Uber:** the driver sees *their* earnings for the trip upfront, and those numbers match everywhere.

### H3. The ETA is wrong from the first second
- **Display bug:** "Arriving now" shows immediately. `RideTracker` reads the ETA once at setup, before `ActiveRide` loads it, so it is always 0.
- **Estimate is a guess:** the ETA is 30% of the trip time, not based on the driver's actual distance.
- **Missing during the trip:** there's no ETA to the destination.
- **Uber:** a live pickup ETA and a live arrival time.

### H4. Ratings are cosmetic
- **Never calculated:** `drivers.rating` and `riders.rating` stay at 5.0 forever. Every rider sees every driver rated 5.0.
- **Not tied to the right person:** either participant can write either rating field, so a rider can set the rating "given by the driver".
- **No limits:** ratings can be changed at any time, even before the trip ends.
- **False success:** the rating screen shows "Thanks" even when saving failed.
- **Uber:** ratings are written once per trip by the right person, averaged over recent trips, and low ratings trigger review.

### H5. Admin pages show fake data and can't do their jobs
- **Dashboard:**
  - The "Rides — last 7 days" chart is hard-coded fake numbers in production.
  - "Recent rides" shows invented riders when there were no rides today.
  - The metric cards keep fake values if the query fails.
- **Driver management:**
  - With zero drivers, or on any error, it lists made-up drivers.
  - Rejected and suspended drivers reappear as **Pending** after a reload, because the page reads `rejected` and `suspended` fields that don't exist.
  - The "Earnings" column is always 0.
  - There is **no way to view a driver's uploaded documents**, so approvals are blind.
- **Users:** "Suspend user" writes a column that doesn't exist and has no permission to write, so it silently does nothing. A suspended rider could still book.
- **Driver documents page:** it forgets what the driver uploaded after a reload. Everything shows "pending" again.

### H6. A rider can request several rides at once
Nothing stops a second request while one is active. That means multiple card holds and multiple drivers dispatched for one person.

### H7. Turning a guest into a full account is unreliable
- **The problem:** it sets the email and password in one call. Supabase requires guest accounts to verify the email before setting a password.
- **The result:** it shows "Account created! You can log in anytime" before anything is verified.

### H8. The booking screen hides the main action
- **The problem:** on a phone, the "Request Ride" button is below the fold. The rider has to scroll past three vehicle cards to find it, and the payment method isn't shown before requesting.
- **Uber:** a sticky bottom bar that always shows "Choose RideUp Go · Visa •••• 4242".

---

## MEDIUM: security and privacy

| # | Issue | Uber standard |
|---|---|---|
| M1 | The driver's real phone number goes to the rider and stays available forever after the trip (`get_ride_driver`). | Masked numbers that stop working after the trip. Short term: limit to active trips. Long term: Twilio Proxy. |
| M2 | Chat messages can still be sent after a ride ends, which is a harassment vector. | Chat closes shortly after drop-off. |
| M3 | Every approved driver can see the exact pickup and drop-off address and the name of every open request, island-wide. | Before accepting: approximate pickup area, distance and trip length. Exact address after accept. |
| M4 | Approved drivers can change their name, plate, vehicle or XL class afterwards without re-review (directly through the API). | Vehicle or identity changes go back through document review. |
| M5 | The database trusts any request with no signed-in user, which includes requests made with the public anon key. Row-level security blocks these today; this is defense in depth. | Trust only the service-role key or a direct database connection. |
| M6 | Saving a card can create orphan Stripe customers if the rider profile row doesn't exist yet. The card sheet doesn't make sure the profile exists first. | — |
| M7 | The login `?redirect=` value isn't checked to be an in-app path. | — |
| M8 | Avatar uploads accept any file type; only the name pattern is checked. | Images only, with a size limit. |
| M9 | Live driver-location channels are public (anyone with the ride id can join). | Private channels limited to the trip's participants. |
| M10 | No phone verification for riders or drivers. Guests type any number. | Every account has an SMS-verified phone. Needs Supabase phone auth and Twilio. |

## MEDIUM: UX and UI

| # | Issue | Uber standard |
|---|---|---|
| U1 | The licence plate is small grey text in the corner, and there's no driver photo field anywhere. | Big, bold plate plus car colour and model and a driver photo ("check the plate before you get in"). |
| U2 | No pickup PIN. | Optional 4-digit PIN that the rider tells the driver before the trip can start. |
| U3 | If Maps fails, the live-ride map is a blank white screen with no fallback. In demo mode it is always blank, and an uncaught error is thrown. | — |
| U4 | Two different "you're matched" screens appear back to back (RiderFlow card, then the live-ride screen 1.5 seconds later). | One continuous trip screen. |
| U5 | The rating screen is generic: no driver name or photo, no trip summary, no receipt link, and no tipping anywhere in the app. | Driver photo, stars, compliments, tip options (100% to the driver), receipt. |
| U6 | The dark-mode "Message" button is dark green text on a dark green background. | — |
| U7 | No wait timer once the driver arrives, and no push or SMS when the driver accepts or arrives (riders only find out with the app open). | "Your driver has arrived" push, plus visible wait time. |
| U8 | The driver request card shows trip length but not distance or time to the pickup. | Pickup ETA and distance, plus trip length and earnings. |
| U9 | No email receipt after a trip. | Receipt email every trip. |
| U10 | When a scheduled ride is dispatched or accepted, the rider isn't told. | Reminder and "driver assigned" notifications. |

## LOW
- `/api/csp-report` ignores reports sent with `application/csp-report` bodies, which arrive as raw bytes. Parse buffers too.
- When a request is cancelled, the driver's request card isn't told to close; the countdown just runs out.
- Online status sticks when a driver closes the tab without going offline (no heartbeat). It's cosmetic today because dispatch is broadcast.
- Promotions and Referrals are "coming soon" placeholders.

---

## What passed (re-checked)
- **Fares:** computed by the database. Clients can't change fare, payout or payment fields, or skip ride states.
- **Admin access:** comes only from server-set `app_metadata`.
- **Driver approval:** drivers can't approve themselves or edit their stats.
- **Accepting rides:** atomic, one winner. The card hold is required before a ride counts as accepted.
- **Payment APIs:** every one checks the signed-in user and ownership. Amounts always come from the database.
- **Cards:** saved only after the server re-checks with Stripe.
- **Chat privacy:** only the ride's participants can read messages.
- **Leads form:** hardened against duplicates and junk.
- **Security headers:** HSTS, frame denial, nosniff and referrer policy are set. The full CSP is in report-only mode with a reporting endpoint.
- **Secrets:** no keys or secrets in the repository or its history.
- **Copy:** no fake marketing claims. Legal pages match how the product actually works, apart from trip sharing (C3).

---

## Recommended plan

**Sprint A: code only, no new services.** I can do all of this now.
1. **Communication (C1):** wire the real chat into both live-ride screens and add Call and Message to the driver screen. Limit phone and chat to active trips (M1, M2).
2. **Trip recovery (C2):** reopening the app returns rider and driver to any active trip, and the driver is never locked out.
3. **Safety (C3):**
   - A shield button on both trip screens: emergency 919, Share trip, Report.
   - A **live tracking link** (`/track/<secret>`) that shows the driver, plate and live position to anyone the rider shares it with.
   - An admin Safety reports page.
4. **Accounts (C4, H7):** a set-new-password page, driver sign-up that survives email confirmation, and correct guest-to-account conversion.
5. **One cancel action (H1):**
   - A single server cancel for rider, driver and searching.
   - A wait timer after the driver arrives.
   - A driver "rider no-show" cancel after 5 minutes that charges the $5 fee.
6. **Driver earnings and ETA (H2, H3):**
   - Show driver earnings everywhere.
   - Fix the ETA bug and base the ETA on the driver's real location.
   - Show distance to pickup on requests (U8).
7. **Ratings (H4):** real averages, written once by the right person, only after completion, with honest errors.
8. **Admin (H5):** no fake data, correct statuses, a working rider suspend that blocks booking, and a document viewer.
9. **Booking guards and screen:**
   - One active ride per rider (H6).
   - Sticky Request bar with the card on file (H8).
   - Bigger plate and driver photo (U1).
   - A single matched screen (U4).
   - Map fallback (U3).
   - Dark-mode fix (U6).
10. **Hardening:** M3–M9 and the Low items.

**Sprint B: needs a service or a decision from you.**
- SMS-verified phones (M10): Supabase phone auth + Twilio.
- Masked calling (M1): Twilio Proxy.
- Push and SMS trip alerts (U7, U10): Web Push or OneSignal, plus Twilio.
- Email receipts (U9): Resend, already wired for driver emails.
- Tipping (U5): Stripe, with the tip going 100% to the driver.
- **Driver payouts:** Stripe Connect Express is the Uber-style option (weekly automatic payouts plus optional instant cash-out).
- Background checks and document expiry: needs a vendor or a manual process you define.
- Pickup PIN (U2): code-only, but it adds a step for every rider, so it's your call.
