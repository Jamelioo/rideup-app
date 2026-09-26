# Driver Dashboard Design Spec

## Overview

Add a complete driver-side experience to the RideUp Nassau app. Drivers can apply, get approved, go online, accept ride requests, navigate to riders, complete trips, and track earnings — all within the existing Vue 3 + Tailwind + Supabase codebase.

**Design language:** Light theme matching the rider app. Map-centered dashboard. Full-width buttons (no pills). Same color palette (`#58cc02` primary, `#1a1a1a` dark, `#f5f5f5` surface).

## Architecture

### Routing

All driver screens live under `/driver/` as separate routes in the existing router (`src/router/index.js`). They share the same auth system — a `role` check on the user profile determines whether someone accesses rider or driver routes.

| Route | Component | Auth | Purpose |
|-------|-----------|------|---------|
| `/driver/apply` | `DriverApply.vue` | Guest or auth | Application form |
| `/driver/pending` | `DriverPending.vue` | Auth | "Under review" gate |
| `/driver/dashboard` | `DriverDashboard.vue` | Auth + approved driver | Main screen |
| `/driver/earnings` | `DriverEarnings.vue` | Auth + approved driver | Earnings breakdown |
| `/driver/profile` | `DriverProfile.vue` | Auth + approved driver | Profile & settings |

### File Structure

All driver pages go in `src/pages/driver/`. Shared driver logic goes in composables:

```
src/pages/driver/
  DriverApply.vue
  DriverPending.vue
  DriverDashboard.vue
  DriverEarnings.vue
  DriverProfile.vue
  DriverActiveRide.vue
  DriverRideRequest.vue

src/lib/
  useDriver.js          — driver state composable (online/offline, current ride, profile)
  demoDriverMode.js     — fake ride requests, fake earnings data for demo mode
```

### Database

The existing schema already has everything needed:

- `drivers` table — name, phone, vehicle info, `approved` boolean, `status` (offline/online/on_trip), rating, total_trips
- `rides` table — `driver_id` foreign key, status flow, timestamps
- `driver_locations` table — live GPS updates
- RLS policies already configured for driver access

No schema changes required.

---

## Screen Specifications

### 1. Driver Application (`/driver/apply`)

**Purpose:** Collect driver information for manual approval in Supabase.

**Layout:**
- Top bar: back arrow + "RideUp Driver" title
- Form sections with clear labels

**Form fields:**
- Full name (text)
- Email (email)
- Phone number (tel)
- Vehicle make (text)
- Vehicle model (text)
- Vehicle year (number)
- Vehicle color (text)
- License plate (text)
- Vehicle type (select: Standard 4-seat / XL 6-seat)
- Driver's license number (text)

**Behavior:**
- On submit: creates auth account (if not logged in) + inserts row into `drivers` table with `approved: false`
- Shows success state, redirects to `/driver/pending`
- Demo mode: skips Supabase, shows success immediately, redirects to `/driver/dashboard` (auto-approved)

**Validation:**
- All fields required
- Phone must be valid format
- Email must be valid format

### 2. Pending Approval (`/driver/pending`)

**Purpose:** Gate screen shown to unapproved drivers.

**Layout:**
- Centered content, clean and simple
- RideUp logo at top
- Clock/hourglass icon
- "Application Under Review" heading
- "We're reviewing your application. You'll receive an email when you're approved to start driving." body text
- "Check Status" button that re-fetches the driver row
- "Back to Home" link

**Behavior:**
- On load: checks `drivers.approved` for current user
- If `approved === true`: redirect to `/driver/dashboard`
- "Check Status" button re-queries and shows inline feedback
- Demo mode: shows a "Skip to Dashboard" button

### 3. Driver Dashboard (`/driver/dashboard`)

**Purpose:** Main screen — this is what drivers see when they open the app. Map-centered with action button and stats.

**Layout — Offline state:**

```
┌─────────────────────────────┐
│ ☰  RideUp Driver        [avatar] │
├─────────────────────────────┤
│                                   │
│         [ Google Map ]            │
│         centered on driver        │
│         location                  │
│                                   │
├─────────────────────────────┤
│                                   │
│  ┌─────────────────────────┐│
│  │      Go Online          ││  ← full-width green button
│  └─────────────────────────┘│
│                                   │
│  ┌──────────┐ ┌──────────┐  │
│  │  Today   │ │  Rating  │  │
│  │ $147.50  │ │  4.9 ★   │  │
│  │ 8 trips  │ │          │  │
│  └──────────┘ └──────────┘  │
│                                   │
│  Last ride: Cable Beach → ...     │
└─────────────────────────────┘
```

**Layout — Online state:**
- "Go Online" button changes to "Go Offline" (dark/outlined style)
- Pulsing green dot next to status indicator text "You're online"
- Map shows driver's current location with a green marker
- Listening for incoming ride requests via Supabase Realtime

**Top bar:**
- Hamburger menu (left) — opens existing SideMenu with driver-specific items
- "RideUp" logo (center, clickable to `/driver/dashboard`)
- Driver avatar circle (right) — taps to `/driver/profile`

**Stats cards (below map):**
- Two cards side by side: Today's earnings (amount + trip count) and Rating
- Tap earnings card → navigates to `/driver/earnings`

**Last ride preview:**
- Shows most recent completed ride: route, time ago, fare
- If no rides yet: "No rides yet — go online to start earning"

**Responsive:**
- Mobile: map top half, content bottom half (scrollable)
- Desktop: same side-panel layout as rider booking (400px left panel, map fills right)

### 4. Incoming Ride Request (`DriverRideRequest.vue`)

**Purpose:** Full-screen takeover when a ride request comes in. Driver must accept or decline within 15 seconds.

**Layout:**

```
┌─────────────────────────────┐
│                                   │
│        [ Countdown Ring ]         │  ← 15s circular timer
│            14s                    │
│                                   │
│  ┌─────────────────────────┐│
│  │  Rider: Sarah M.  ★4.8 ││
│  │                         ││
│  │  📍 Cable Beach         ││  ← pickup
│  │  📍 Downtown Nassau     ││  ← dropoff
│  │                         ││
│  │  2.3 mi · ~8 min        ││
│  │                         ││
│  │  Est. fare: $14.50      ││
│  └─────────────────────────┘│
│                                   │
│  ┌─────────────────────────┐│
│  │     ACCEPT RIDE          ││  ← full-width green
│  └─────────────────────────┘│
│                                   │
│     Decline                       │  ← text button, subtle
│                                   │
└─────────────────────────────┘
```

**Behavior:**
- Appears as an overlay/route change when ride request matches driver
- 15-second countdown with animated circular progress ring
- If timer expires: auto-decline, return to dashboard, ride goes to next driver
- Accept: updates ride status to `accepted`, navigates to active ride screen
- Decline: adds driver ID to `declined_by` array, returns to dashboard
- Audio/vibration alert on request arrival (if supported)
- Demo mode: generates fake requests every 15-30 seconds while online

**Ride info shown:**
- Rider name + rating
- Pickup address
- Dropoff address
- Distance + estimated duration
- Estimated fare

### 5. Active Ride (`DriverActiveRide.vue`)

**Purpose:** Guides driver through the ride lifecycle: navigate to pickup → confirm arrival → start trip → navigate to dropoff → complete trip.

**Ride phases:**

**Phase 1 — Navigating to pickup:**
- Map shows route from driver location to pickup
- Rider info card at bottom: name, pickup address
- "I've Arrived" full-width button
- Option to cancel with reason

**Phase 2 — Waiting for rider:**
- Status: "Waiting for [Rider Name]"
- Timer showing wait time
- "Start Trip" button (enabled when rider is picked up)
- "Cancel — Rider No Show" after 5 min wait

**Phase 3 — Trip in progress:**
- Map shows route to dropoff
- Progress bar or ETA display
- Dropoff address shown
- "Complete Trip" button (appears near destination)

**Phase 4 — Trip complete:**
- Summary overlay: fare earned, trip distance, trip duration
- Rider rating (1-5 stars, optional)
- "Done" button returns to dashboard

**Behavior:**
- Updates ride status at each transition: `accepted` → `driver_arrived` → `in_progress` → `completed`
- Updates `driver_locations` periodically (every 10s) for rider to track
- Demo mode: simulates phase progression with timers

### 6. Earnings (`/driver/earnings`)

**Purpose:** Detailed earnings breakdown with Today/This Week toggle.

**Layout:**

```
┌─────────────────────────────┐
│  ←  Earnings                      │
├─────────────────────────────┤
│  ┌──────────┬──────────┐    │
│  │  Today   │ This Week│    │  ← tab toggle
│  └──────────┴──────────┘    │
│                                   │
│  TODAY TAB:                       │
│  Total: $147.50                   │
│  8 trips · 6h 23m online          │
│                                   │
│  ┌─────────────────────────┐│
│  │ Cable Beach → Downtown  ││
│  │ 12 min ago · 2.3 mi     ││
│  │                  +$14.50 ││
│  ├─────────────────────────┤│
│  │ Airport → Bahamar       ││
│  │ 48 min ago · 5.1 mi     ││
│  │                  +$22.00 ││
│  └─────────────────────────┘│
│                                   │
│  THIS WEEK TAB:                   │
│  Total: $612.00                   │
│  34 trips                         │
│                                   │
│  ┌─ Bar chart ─────────────┐│
│  │ M  T  W  T  F  S  S    ││
│  │ █  █  █  █  █  ▄  ░    ││
│  └─────────────────────────┘│
│                                   │
│  Mon $89 · Tue $102 · ...         │
└─────────────────────────────┘
```

**Today tab:**
- Total earnings prominently displayed
- Trip count + online hours
- Chronological list of completed trips
- Each trip: pickup → dropoff, time ago, distance, fare earned
- Tap trip to expand: fare breakdown (base + distance + time), tip if any

**This Week tab:**
- Weekly total + trip count
- Simple bar chart (CSS-only, no chart library) showing daily earnings
- Each bar is proportional to max day's earnings
- Day labels below bars
- Tap a bar/day to see that day's trip list

**Responsive:**
- Mobile: full screen, scrollable
- Desktop: max-width container centered, or side panel

### 7. Driver Profile (`/driver/profile`)

**Purpose:** View and edit driver info, vehicle details, documents, account settings.

**Layout:**

```
┌─────────────────────────────┐
│  ←  Profile                       │
├─────────────────────────────┤
│         [Avatar]                  │
│       Marcus R.                   │
│       ★ 4.9 · 247 trips          │
│                                   │
│  ── Vehicle ──                    │
│  2024 Toyota Camry · Silver       │
│  Plate: ABC-1234                  │
│  Type: Standard (4 seats)         │
│  [Edit Vehicle]                   │
│                                   │
│  ── Stats ──                      │
│  Acceptance rate: 94%             │
│  Cancellation rate: 2%            │
│  Total earnings: $4,280           │
│  Member since: Jan 2026           │
│                                   │
│  ── Documents ──                  │
│  Driver's License    ✓ On file    │
│  Insurance           ✓ On file    │
│  [Upload / Update]                │
│                                   │
│  ── Account ──                    │
│  Phone: (242) 555-0123    [Edit]  │
│  Email: marcus@email.com  [Edit]  │
│  [Change Password]                │
│                                   │
│  [Log Out]                        │
└─────────────────────────────┘
```

**Sections:**
- **Header:** Avatar, name, rating, total trip count
- **Vehicle:** Make, model, year, color, plate, type. Edit button opens inline edit form
- **Stats:** Acceptance rate, cancellation rate, total lifetime earnings, member-since date
- **Documents:** License number (shown as "on file"), insurance status. Upload button (placeholder for MVP — shows "Coming soon" toast)
- **Account:** Phone, email with edit buttons. Change password link. Log out button

**Responsive:**
- Mobile: full screen, sections stacked
- Desktop: max-w-lg centered

---

## Demo Mode

When `DEMO_MODE` is active (no Supabase/Google Maps env vars):

**Application:** Auto-approved, skips to dashboard immediately.

**Dashboard:**
- Shows the HarborBackdrop instead of Google Map
- Fake driver stats: $147.50 today, 8 trips, 4.9 rating
- "Go Online" works — starts fake ride request generator

**Fake ride requests:**
- Generated every 15-30 seconds while online
- Random rider names from a pool (e.g., "Sarah M.", "James T.", "Lisa K.")
- Random pickup/dropoff from `DEMO_LOCATIONS`
- Fake distance/duration/fare using existing `fakeRoute()` and `calculateFare()`
- Countdown timer works normally

**Active ride:**
- Phase transitions happen on button press (no real GPS)
- Simulated trip duration

**Earnings:**
- Pre-populated with 5-8 fake trips for today
- Weekly data shows a realistic-looking distribution

---

## Navigation

**Driver SideMenu items:**
- Dashboard (home icon)
- Earnings (chart icon)
- My Trips (car icon)
- Profile (person icon)
- Support (help icon)
- About (info icon)
- Switch to Rider (swap icon) — navigates to `/`
- Log Out

**Route guards:**
- `/driver/dashboard`, `/driver/earnings`, `/driver/profile` require auth + `drivers.approved === true`
- If not approved: redirect to `/driver/pending`
- If no driver record: redirect to `/driver/apply`
- Demo mode: bypass all guards

---

## Composable: `useDriver.js`

Singleton composable (same pattern as `useAuth.js`) managing:

```js
// Reactive state
const driver = ref(null)          // driver row from Supabase
const isOnline = ref(false)       // online/offline status
const currentRide = ref(null)     // active ride if any
const incomingRequest = ref(null) // pending ride request

// Methods
fetchDriver()                     // load driver profile
goOnline() / goOffline()          // toggle status
acceptRide(rideId)                // accept incoming request
declineRide(rideId)               // decline incoming request
updateLocation(lat, lng)          // push GPS update
completeRide(rideId, rating)      // finish trip
```

**Realtime subscriptions (when online):**
- Listen for rides with `status = 'requested'` matching driver's vehicle type
- Filter out rides where driver's ID is in `declined_by`

---

## Design Tokens

Consistent with the rider app:

| Token | Value | Usage |
|-------|-------|-------|
| Primary green | `#58cc02` | Buttons, accents, online status |
| Dark green hover | `#4ab300` | Button hover state |
| Dark | `#1a1a1a` | Text, dark buttons |
| Surface | `#f5f5f5` | Input backgrounds, card backgrounds |
| Text secondary | `#1a1a1a` at 50% opacity | Subtitles, descriptions |
| Border | `#1a1a1a` at 8% opacity | Input borders, dividers |
| Font serif | Fraunces | Headings, prices |
| Font sans | Manrope | Body text, UI |
| Border radius | `xl` (12px) inputs, `2xl` (16px) cards/buttons | Consistent rounding |

**Button styles:**
- Primary: full-width, `bg-[#58cc02]`, white text, bold, rounded-2xl, green shadow
- Secondary: full-width, `bg-[#1a1a1a]`, white text, bold, rounded-2xl
- Outlined: full-width, border-2 `border-[#1a1a1a]/15`, rounded-2xl
- Text: no background, colored text, semibold

**No pills** — all interactive elements use full-width buttons or standard rectangular shapes.
