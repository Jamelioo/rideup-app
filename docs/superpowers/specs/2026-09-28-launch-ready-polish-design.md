# RideUp Launch-Ready Polish — Design Spec

**Goal:** Fix 13 critical and high-priority UX/UI issues to bring RideUp to Uber/Bolt launch quality.

**Architecture:** Vue 3 + Tailwind CSS + Supabase. All changes are frontend-only except admin panel Supabase queries. No new API endpoints needed.

**Tech Stack:** Vue 3 (Composition API, `<script setup>`), Tailwind CSS with CSS custom properties for theming, Supabase JS client, Google Maps API.

---

## 1. Dark Mode — Global CSS Variable Migration

**Problem:** Every page and component uses hardcoded colors (`bg-white`, `text-[#191f1c]`, etc.). The ThemeToggle component sets CSS variables via `useDarkMode.js` but nothing reads them. Dark mode has zero visual effect.

**Solution:** Bulk find-and-replace across all ~40 Vue files:

| Hardcoded | CSS Variable |
|-----------|-------------|
| `bg-white` | `bg-[var(--color-surface)]` |
| `text-[#191f1c]` | `text-[var(--color-text-primary)]` |
| `text-[#191f1c]/50` | `text-[var(--color-text-muted)]` |
| `text-[#191f1c]/40` | `text-[var(--color-text-muted)]` |
| `bg-[#f0fdf4]` | `bg-[var(--color-surface-secondary)]` |
| `bg-[#f5f5f5]` | `bg-[var(--color-surface-secondary)]` |
| `border-[#191f1c]/8` | `border-[var(--color-border)]` |
| `border-[#191f1c]/10` | `border-[var(--color-border)]` |
| `bg-black/40` | `bg-[var(--color-overlay)]` |
| `bg-black/50` | `bg-[var(--color-overlay)]` |

**New CSS variables to add in `style.css`:**

Light mode:
```css
--color-border: rgba(25, 31, 28, 0.08);
--color-overlay: rgba(0, 0, 0, 0.4);
--color-danger: #ef4444;
--color-success: #22c55e;
```

Dark mode (`html.dark`):
```css
--color-border: rgba(255, 255, 255, 0.1);
--color-overlay: rgba(0, 0, 0, 0.6);
--color-danger: #f87171;
--color-success: #4ade80;
```

**Files affected:** All `.vue` files in `src/pages/`, `src/pages/rider/`, `src/pages/driver/`, `src/pages/admin/`, `src/components/`.

**Scope notes:**
- `bg-[#2b8659]` (brand green) stays hardcoded — it's the same in light and dark mode, already mapped to `--color-brand` in style.css but used directly for buttons.
- `text-white` on green buttons stays as-is.
- Admin panel sidebar `bg-[#191f1c]` stays — it's intentionally dark in both modes.

---

## 2. Bottom Navigation Bar

**Problem:** No persistent navigation. Users depend entirely on hamburger menu. Every major rideshare app has bottom tabs.

**Solution:** Create `src/components/BottomNav.vue`:

- **3 tabs:** Home (house icon → `/book`), Activity (clock icon → `/my-rides`), Account (person icon → `/profile`)
- Fixed to bottom, `safe-area-inset-bottom` padding
- Active tab: brand green icon + label. Inactive: muted gray
- Uses CSS variables for dark mode compatibility

**Visibility rules (in `App.vue`):**
- Show on: `/book`, `/my-rides`, `/scheduled-rides`, `/profile`, `/edit-profile`, `/payments`, `/saved-places`, `/support`, `/promotions`, `/referrals`, `/trusted-contacts`
- Hide on: `/login`, `/signup`, `/`, `/drive`, `/about`, `/privacy`, `/terms`, all `/driver/*`, all `/admin/*`, `/ride/*`, `/rate/*`, `/payment-success`, `/receipt/*`
- Hide when not logged in

**App.vue changes:** Import BottomNav, conditionally render based on route. Add `pb-20` to `<router-view>` wrapper when BottomNav is visible to prevent content from being hidden behind it.

---

## 3. PaymentSuccess — Show Real Ride Data

**Problem:** Hardcoded `$18.50`, `Bahamar Resort` values. Users see fake data after real payment.

**Solution:**
- Read `session_id` from URL query param (already passed by Stripe redirect)
- On mount, query Supabase `rides` table for the most recent ride by the current user with status `requested`
- Display real: fare (from `fare_cents`), pickup address, dropoff address, distance, vehicle type
- Fallback: if ride not found, show generic "Payment successful" with a "View your rides" button
- Remove the 10-second auto-redirect — let user navigate manually

---

## 4. DriverApply — Insert Missing Fields

**Problem:** `vehicle_year` and `license_number` are collected in the form but omitted from the Supabase insert.

**Solution:** Add two fields to the insert object in `DriverApply.vue`:

```js
vehicle_year: parseInt(f.vehicleYear),
license_number: f.licenseNumber.trim(),
```

**File:** `src/pages/driver/DriverApply.vue`, lines 69-80.

---

## 5. Admin Panel — Wire to Supabase

**Problem:** All 5 admin sub-pages show hardcoded placeholder data. Supabase fetches exist but silently fall back to dummies on error.

**Solution for each page:**

### AdminDashboard.vue
- Query `riders` count, `drivers` count, `rides` count, sum of `fare_cents` from completed rides
- Replace hardcoded metric cards with real values
- Replace hardcoded chart with real ride-count-per-day for last 7 days
- Recent rides: already partially working, keep as-is

### AdminUsers.vue
- Fetch from `riders` table: `id`, `name`, `email`, `phone`, `rating`, `total_rides`, `created_at`
- Remove hardcoded array entirely
- `toggleUserStatus` → no Supabase column for user suspension exists; keep as local-only for now, note limitation

### AdminRides.vue
- Fetch from `rides` table with joins to `riders` (for rider name) and `drivers` (for driver name)
- Map `fare_cents` → formatted dollar amount
- Map `status` to display badges
- Remove hardcoded array

### AdminRevenue.vue
- Query completed rides grouped by day for chart data
- Calculate totals: today, this week, this month, all-time from real `fare_cents`
- Remove hardcoded revenue numbers and `Math.random()` chart

### AdminSupport.vue
- Fetch from `support_tickets` table
- Wire status update buttons to Supabase `update`
- Remove hardcoded array

**Empty states:** When tables are empty, show "No [items] yet" with an appropriate icon instead of a blank table.

---

## 6. Profile — Real Rating from Database

**Problem:** Rating `4.9` and `(28 rides)` are hardcoded.

**Solution:** On mount, fetch the rider's `rating` and `total_rides` from the `riders` table using `auth_user_id = user.id`. Display real values. If no rider record, show `--` for rating and `0 rides`.

**File:** `src/pages/Profile.vue`, lines 78-84.

---

## 7. Use Current Location for Pickup

**Problem:** No "Use current location" button. Users must type their address.

**Solution:** Add a button in `RiderBooking.vue` below the pickup input:
- Icon: crosshair/GPS icon
- Label: "Use current location"
- On click: `navigator.geolocation.getCurrentPosition()` → get lat/lng → reverse geocode via `google.maps.Geocoder` → populate pickup field with formatted address, lat, lng
- Show loading spinner while geolocating
- Error state: "Location access denied" or "Could not determine location"

**Placement:** Between the pickup input and the "Where to?" input, styled as a tappable row with the GPS icon.

---

## 8. Driver Search Timeout

**Problem:** `SearchingForDriver.vue` never times out. If no driver accepts, user waits forever.

**Solution:**
- Start a 90-second timer on mount
- At 90s, show "No drivers available right now" message
- Two buttons: "Try again" (resets timer, re-emits search) and "Cancel" (goes back to booking)
- Show elapsed time as a subtle counter: "Searching... 45s"

**File:** `src/pages/rider/SearchingForDriver.vue`

---

## 9. Fix Promotions Menu Link

**Problem:** SideMenu "Promotions" routes to `/support` instead of `/promotions`.

**Solution:** Change line 53 in `SideMenu.vue`:
```js
{ label: 'Promotions', route: '/promotions', icon: 'tag', requiresAuth: true },
```
Remove the misleading subtitle.

---

## 10. DriverEarnings — Real Data

**Problem:** Shows empty state outside demo mode. Non-functional.

**Solution:**
- On mount, fetch completed rides for this driver from `rides` table where `driver_id` matches
- Calculate: today's earnings, this week's, total
- Group rides by day for the earnings chart
- Show ride count and average fare
- Empty state: "Complete your first ride to start earning"

**File:** `src/pages/driver/DriverEarnings.vue`

---

## 11. Driver Contact During Active Ride

**Problem:** No way for rider to call or message their driver during an active ride.

**Solution:** Add to `ActiveRide.vue` in the driver info section:
- **Call button:** `<a href="tel:DRIVER_PHONE">` with phone icon
- **Message button:** links to `/ride/:rideId/messages`
- Styled as two icon buttons side-by-side, matching Uber's layout

Requires the ride query to join with `drivers` table to get phone number.

---

## 12. DriverProfile — Inline Editing

**Problem:** Every "Edit" button shows "Contact support" toast. No in-app editing.

**Solution:**
- Phone and email: tap "Edit" → field becomes an input → "Save" button → update Supabase `drivers` table
- Password: route to a password change flow (Supabase `updateUser({ password })`)
- Vehicle details: keep "Contact support" — vehicle changes require verification in real rideshare apps

**File:** `src/pages/driver/DriverProfile.vue`

---

## 13. Login/Signup Safe Area

**Problem:** `pt-12` pushes content under iPhone notch.

**Solution:** Replace `pt-12` with `pt-[max(3rem,env(safe-area-inset-top))]` on both Login.vue and Signup.vue top containers.

---

## Out of Scope

These items are deferred to post-launch:
- Page transition animations
- Promo code server validation
- SOS/emergency button
- Tipping in rating flow
- Password show/hide toggle
- Pull-to-refresh on lists
- Loading skeletons
- Haptic feedback
