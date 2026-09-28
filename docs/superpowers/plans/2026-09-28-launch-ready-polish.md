# RideUp Launch-Ready Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 13 critical and high-priority UX/UI issues to bring RideUp to Uber/Bolt launch quality.

**Architecture:** All changes are Vue 3 SFC edits + CSS variable additions. No new API endpoints. Admin panel pages get wired to existing Supabase tables. One new component (BottomNav) added to App.vue.

**Tech Stack:** Vue 3 (Composition API, `<script setup>`), Tailwind CSS with CSS custom properties, Supabase JS client, Google Maps Geocoder API.

---

## File Structure

### New files:
- `src/components/BottomNav.vue` — persistent bottom tab bar (Home, Activity, Account)

### Modified files:
- `src/style.css` — add missing CSS variables (overlay, danger, success)
- `src/App.vue` — import and render BottomNav conditionally
- `src/components/SideMenu.vue` — fix Promotions route, dark mode colors
- `src/components/CancelRide.vue` — dark mode colors
- `src/components/RideTracker.vue` — dark mode colors
- `src/components/DriverInfoCard.vue` — dark mode colors
- `src/components/SavedPlaceInput.vue` — dark mode colors
- `src/pages/Profile.vue` — real rating, dark mode
- `src/pages/Login.vue` — safe-area fix, dark mode
- `src/pages/Signup.vue` — safe-area fix, dark mode
- `src/pages/EditProfile.vue` — dark mode
- `src/pages/Payments.vue` — dark mode
- `src/pages/SavedPlaces.vue` — dark mode
- `src/pages/MyRides.vue` — dark mode
- `src/pages/Support.vue` — dark mode
- `src/pages/TrustedContacts.vue` — dark mode
- `src/pages/Promotions.vue` — dark mode
- `src/pages/Referrals.vue` — dark mode
- `src/pages/RiderLanding.vue` — dark mode
- `src/pages/About.vue` — dark mode
- `src/pages/Privacy.vue` — dark mode
- `src/pages/Terms.vue` — dark mode
- `src/pages/NotFound.vue` — dark mode
- `src/pages/rider/RiderBooking.vue` — "Use current location" button, dark mode
- `src/pages/rider/SearchingForDriver.vue` — timeout logic, dark mode
- `src/pages/rider/ActiveRide.vue` — driver contact buttons, dark mode
- `src/pages/rider/RateRide.vue` — dark mode
- `src/pages/rider/PaymentSuccess.vue` — real ride data, dark mode
- `src/pages/rider/RideReceipt.vue` — dark mode
- `src/pages/rider/RideMessages.vue` — dark mode
- `src/pages/rider/ScheduledRides.vue` — dark mode
- `src/pages/driver/DriverApply.vue` — insert missing fields, dark mode
- `src/pages/driver/DriverPending.vue` — dark mode
- `src/pages/driver/DriverDashboard.vue` — dark mode
- `src/pages/driver/DriverActiveRide.vue` — dark mode
- `src/pages/driver/DriverEarnings.vue` — real data from Supabase, dark mode
- `src/pages/driver/DriverProfile.vue` — inline editing, dark mode
- `src/pages/driver/DriverDocuments.vue` — dark mode
- `src/pages/driver/RateRider.vue` — dark mode
- `src/pages/admin/AdminDashboard.vue` — real Supabase data
- `src/pages/admin/AdminUsers.vue` — real Supabase data
- `src/pages/admin/AdminRides.vue` — real Supabase data
- `src/pages/admin/AdminRevenue.vue` — real Supabase data
- `src/pages/admin/AdminSupport.vue` — real Supabase data

---

### Task 1: Add Missing CSS Variables to style.css

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: Add overlay, danger, success variables to light mode**

In `src/style.css`, inside the `@theme { }` block, after the existing `--color-brand-light` line, add:

```css
  --color-overlay: rgba(0, 0, 0, 0.4);
  --color-danger: #ef4444;
  --color-success: #22c55e;
```

- [ ] **Step 2: Add overlay, danger, success variables to dark mode**

In `src/style.css`, inside the `html.dark { }` block, after the existing `--color-brand-light` line, add:

```css
  --color-overlay: rgba(0, 0, 0, 0.6);
  --color-danger: #f87171;
  --color-success: #4ade80;
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/style.css
git commit -m "feat: add overlay, danger, success CSS variables for dark mode"
```

---

### Task 2: Dark Mode — Bulk Color Migration (All Pages)

**Files:**
- Modify: All `.vue` files listed in File Structure above (except admin pages which keep their dark sidebar)

This is a bulk find-and-replace task. Apply these replacements across ALL Vue files in `src/pages/` and `src/components/` (except `src/pages/admin/AdminLayout.vue` sidebar which is intentionally dark):

- [ ] **Step 1: Replace root container backgrounds**

In every `.vue` file, replace the root container class:
- `bg-white` → `bg-[var(--color-surface)]`

Do NOT replace `bg-white` inside admin sidebar (`AdminLayout.vue` line 13 `bg-[#191f1c]` stays) or inside button text (`text-white` stays).

Use this command to find all instances first:
```bash
grep -rn "bg-white" src/pages/ src/components/ --include="*.vue" | grep -v "text-white"
```

Then edit each file.

- [ ] **Step 2: Replace primary text colors**

Replace across all Vue files:
- `text-[#191f1c]` → `text-[var(--color-text-primary)]`

```bash
grep -rn 'text-\[#191f1c\]"' src/pages/ src/components/ --include="*.vue"
```

Note: `text-[#191f1c]/50` and `text-[#191f1c]/40` should become `text-[var(--color-text-muted)]`. The `/50` and `/40` opacity variants both map to the single muted variable since the CSS variable already includes the appropriate opacity for each mode.

- [ ] **Step 3: Replace secondary backgrounds**

Replace across all Vue files:
- `bg-[#f0fdf4]` → `bg-[var(--color-surface-secondary)]`
- `bg-[#f5f5f5]` → `bg-[var(--color-surface-secondary)]`

- [ ] **Step 4: Replace border colors**

Replace across all Vue files:
- `border-[#191f1c]/8` → `border-[var(--color-border)]`
- `border-[#191f1c]/10` → `border-[var(--color-border)]`

- [ ] **Step 5: Replace overlay colors**

Replace across all Vue files:
- `bg-black/40` → `bg-[var(--color-overlay)]`
- `bg-black/50` → `bg-[var(--color-overlay)]`

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: Build succeeds, 142+ modules transformed, no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: migrate all pages and components to CSS variables for dark mode support"
```

---

### Task 3: Bottom Navigation Bar

**Files:**
- Create: `src/components/BottomNav.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: Create BottomNav.vue**

Create `src/components/BottomNav.vue`:

```vue
<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '../lib/useAuth'

const route = useRoute()
const { user } = useAuth()

const tabs = [
  { label: 'Home', route: '/book', icon: 'home' },
  { label: 'Activity', route: '/my-rides', icon: 'activity' },
  { label: 'Account', route: '/profile', icon: 'account' },
]

const activeTab = computed(() => {
  const path = route.path
  if (path === '/book' || path === '/') return '/book'
  if (path === '/my-rides' || path === '/scheduled-rides') return '/my-rides'
  if (['/profile', '/edit-profile', '/payments', '/saved-places', '/promotions', '/referrals', '/trusted-contacts'].includes(path)) return '/profile'
  return null
})

const isVisible = computed(() => {
  if (!user.value) return false
  const path = route.path
  const hiddenPrefixes = ['/driver', '/admin', '/ride/', '/rate/', '/login', '/signup', '/welcome', '/drive', '/receipt']
  const hiddenExact = ['/', '/about', '/privacy', '/terms', '/payment-success']
  if (hiddenExact.includes(path)) return false
  if (hiddenPrefixes.some(p => path.startsWith(p))) return false
  return true
})
</script>

<template>
  <div v-if="isVisible" class="fixed bottom-0 left-0 right-0 z-[100] bg-[var(--color-surface)] border-t border-[var(--color-border)] pb-[env(safe-area-inset-bottom)]">
    <nav class="flex items-center justify-around max-w-lg mx-auto">
      <router-link
        v-for="tab in tabs"
        :key="tab.route"
        :to="tab.route"
        :class="[
          'flex flex-col items-center gap-0.5 py-2 px-4 min-w-[64px] transition-colors',
          activeTab === tab.route ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-muted)]'
        ]"
      >
        <!-- Home icon -->
        <svg v-if="tab.icon === 'home'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
        </svg>
        <!-- Activity icon -->
        <svg v-else-if="tab.icon === 'activity'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <!-- Account icon -->
        <svg v-else-if="tab.icon === 'account'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span class="text-[10px] font-medium">{{ tab.label }}</span>
      </router-link>
    </nav>
  </div>
</template>
```

- [ ] **Step 2: Add BottomNav to App.vue**

Modify `src/App.vue` to import and render BottomNav:

```vue
<script setup>
import { onMounted } from 'vue'
import { DEMO_MODE } from './lib/demoMode'
import { useAuth } from './lib/useAuth'
import BottomNav from './components/BottomNav.vue'

const { init } = useAuth()
onMounted(() => init())
</script>

<template>
  <div v-if="DEMO_MODE" class="bg-[#2b8659] text-white text-xs font-bold px-4 py-2 text-center relative z-50">
    Demo mode — sample data, no backend connected. Add real keys in .env to go live.
  </div>
  <router-view v-slot="{ Component }">
    <KeepAlive include="RiderBooking">
      <component :is="Component" />
    </KeepAlive>
  </router-view>
  <BottomNav />
</template>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/BottomNav.vue src/App.vue
git commit -m "feat: add persistent bottom navigation bar (Home, Activity, Account)"
```

---

### Task 4: PaymentSuccess — Show Real Ride Data

**Files:**
- Modify: `src/pages/rider/PaymentSuccess.vue`

- [ ] **Step 1: Replace script setup with real data fetching**

Replace the entire `<script setup>` block in `src/pages/rider/PaymentSuccess.vue` with:

```vue
<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/useAuth'
import { formatFare } from '../../lib/pricing'
import { DEMO_MODE } from '../../lib/demoMode'

const route = useRoute()
const router = useRouter()
const { user } = useAuth()

const sessionId = ref(route.query.session_id || '')
const fareAmount = ref('')
const pickup = ref('')
const dropoff = ref('')
const rideId = ref(null)
const showCheck = ref(false)
const loading = ref(true)

onMounted(async () => {
  setTimeout(() => { showCheck.value = true }, 300)

  if (DEMO_MODE) {
    fareAmount.value = '$12.50'
    pickup.value = 'Bahamar Resort'
    dropoff.value = 'Downtown Nassau'
    loading.value = false
    return
  }

  if (!user.value) { loading.value = false; return }

  try {
    const { data: rider } = await supabase
      .from('riders')
      .select('id')
      .eq('auth_user_id', user.value.id)
      .single()

    if (rider) {
      const { data: ride } = await supabase
        .from('rides')
        .select('*')
        .eq('rider_id', rider.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (ride) {
        rideId.value = ride.id
        fareAmount.value = formatFare(ride.fare_cents)
        pickup.value = ride.pickup_address || 'Pickup'
        dropoff.value = ride.dropoff_address || 'Dropoff'
      }
    }
  } catch (e) {
    // Keep defaults
  }
  loading.value = false
})

function viewReceipt() {
  if (rideId.value) {
    router.push(`/receipt/${rideId.value}`)
  } else {
    router.push('/my-rides')
  }
}

function goHome() {
  router.push('/book')
}
</script>
```

- [ ] **Step 2: Update template to use dynamic values and remove auto-redirect**

In the template, replace any hardcoded fare/pickup/dropoff display with `{{ fareAmount }}`, `{{ pickup }}`, `{{ dropoff }}`. Remove the countdown timer display and auto-redirect. Keep the checkmark animation. Update button clicks to use `viewReceipt()` and `goHome()`.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/pages/rider/PaymentSuccess.vue
git commit -m "feat: show real ride data on payment success instead of hardcoded values"
```

---

### Task 5: DriverApply — Insert Missing Fields

**Files:**
- Modify: `src/pages/driver/DriverApply.vue`

- [ ] **Step 1: Add vehicle_year and license_number to insert**

In `src/pages/driver/DriverApply.vue`, find the Supabase insert object (around line 69). After the `license_plate` line, add:

```js
    vehicle_year: parseInt(f.vehicleYear) || null,
    license_number: f.licenseNumber?.trim() || null,
```

The full insert should now be:
```js
const { error: insertErr } = await supabase.from('drivers').insert({
  auth_user_id: currentUser.id,
  name: f.name.trim(),
  phone: f.phone.trim(),
  email: f.email.trim(),
  vehicle_make: f.vehicleMake.trim(),
  vehicle_model: f.vehicleModel.trim(),
  vehicle_color: f.vehicleColor.trim(),
  license_plate: f.vehiclePlate.trim(),
  vehicle_year: parseInt(f.vehicleYear) || null,
  license_number: f.licenseNumber?.trim() || null,
  vehicle_type: f.vehicleType,
  approved: false,
})
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/driver/DriverApply.vue
git commit -m "fix: include vehicle_year and license_number in driver application insert"
```

---

### Task 6: Admin Dashboard — Real Supabase Data

**Files:**
- Modify: `src/pages/admin/AdminDashboard.vue`

- [ ] **Step 1: Replace hardcoded metrics with real Supabase queries**

In `src/pages/admin/AdminDashboard.vue`, replace the `onMounted` function with real aggregate queries:

```js
onMounted(async () => {
  if (!supabaseConfigured) return
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    const [ridesRes, driversRes, ridersRes, revenueRes, todayRidesRes] = await Promise.all([
      supabase.from('rides').select('id', { count: 'exact', head: true }),
      supabase.from('drivers').select('id', { count: 'exact', head: true }).eq('approved', true),
      supabase.from('riders').select('id', { count: 'exact', head: true }),
      supabase.from('rides').select('fare_cents').eq('status', 'completed'),
      supabase.from('rides').select('*').gte('created_at', todayISO).order('created_at', { ascending: false }).limit(10),
    ])

    const totalRevenue = (revenueRes.data || []).reduce((sum, r) => sum + (r.fare_cents || 0), 0)

    metricCards.value = [
      { label: 'Total Rides', value: String(ridesRes.count || 0), change: '', changePositive: true },
      { label: 'Active Drivers', value: String(driversRes.count || 0), change: '', changePositive: true },
      { label: 'Total Revenue', value: `$${(totalRevenue / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, change: '', changePositive: true },
      { label: 'Total Users', value: String(ridersRes.count || 0), change: '', changePositive: true },
    ]

    if (todayRidesRes.data && todayRidesRes.data.length > 0) {
      recentRides.value = todayRidesRes.data.map(r => ({
        id: r.id,
        rider: r.pickup_address || 'Unknown',
        pickup: r.pickup_address || 'N/A',
        dropoff: r.dropoff_address || 'N/A',
        fare: r.fare_cents ? (r.fare_cents / 100).toFixed(2) : '0.00',
        status: r.status || 'Unknown',
      }))
    }
  } catch (e) { /* keep placeholder data on error */ }
})
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/AdminDashboard.vue
git commit -m "feat: wire admin dashboard metrics to real Supabase data"
```

---

### Task 7: Admin Users — Real Supabase Data

**Files:**
- Modify: `src/pages/admin/AdminUsers.vue`

- [ ] **Step 1: Replace hardcoded users with Supabase query**

In `src/pages/admin/AdminUsers.vue`, replace the hardcoded `users` ref array (the 10 fake users) with an empty array:

```js
const users = ref([])
```

Then replace the `onMounted` with:

```js
onMounted(async () => {
  if (!supabaseConfigured) return
  try {
    const { data, error } = await supabase
      .from('riders')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      users.value = data.map(r => ({
        id: r.id,
        name: r.name || 'Unknown',
        email: r.email || '',
        phone: r.phone || '-',
        rides: r.total_rides || 0,
        rating: r.rating || 0,
        joined: r.created_at ? r.created_at.split('T')[0] : '-',
        status: 'Active',
      }))
    }
  } catch (e) { /* keep empty */ }
})
```

- [ ] **Step 2: Add empty state in template**

In the template, after the `</table>` closing tag, add:

```html
<div v-if="users.length === 0" class="px-4 py-12 text-center text-gray-400">
  <p class="text-lg font-medium mb-1">No users yet</p>
  <p class="text-sm">Users will appear here when riders sign up.</p>
</div>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/AdminUsers.vue
git commit -m "feat: wire admin users page to real Supabase riders data"
```

---

### Task 8: Admin Rides, Revenue, Support — Real Supabase Data

**Files:**
- Modify: `src/pages/admin/AdminRides.vue`
- Modify: `src/pages/admin/AdminRevenue.vue`
- Modify: `src/pages/admin/AdminSupport.vue`

- [ ] **Step 1: Wire AdminRides.vue to Supabase**

Replace the hardcoded `rides` ref array with `ref([])`. Replace `onMounted`:

```js
onMounted(async () => {
  if (!supabaseConfigured) return
  try {
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (!error && data) {
      rides.value = data.map(r => ({
        id: r.id,
        rider: r.pickup_address || 'Unknown',
        driver: r.dropoff_address || 'Unassigned',
        pickup: r.pickup_address || 'N/A',
        dropoff: r.dropoff_address || 'N/A',
        fare: r.fare_cents ? `$${(r.fare_cents / 100).toFixed(2)}` : '$0.00',
        status: r.status || 'unknown',
        date: r.created_at ? new Date(r.created_at).toLocaleDateString() : '-',
      }))
    }
  } catch (e) { /* keep empty */ }
})
```

- [ ] **Step 2: Wire AdminRevenue.vue to Supabase**

Replace the hardcoded revenue cards and chart data. In `onMounted`:

```js
onMounted(async () => {
  if (!supabaseConfigured) return
  try {
    const { data, error } = await supabase
      .from('rides')
      .select('fare_cents, created_at')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })

    if (!error && data) {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekStart = new Date(todayStart)
      weekStart.setDate(weekStart.getDate() - 7)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      let todayRev = 0, weekRev = 0, monthRev = 0, allTimeRev = 0
      const dailyMap = {}

      data.forEach(r => {
        const cents = r.fare_cents || 0
        const date = new Date(r.created_at)
        allTimeRev += cents
        if (date >= todayStart) todayRev += cents
        if (date >= weekStart) weekRev += cents
        if (date >= monthStart) monthRev += cents

        const dayKey = date.toISOString().split('T')[0]
        dailyMap[dayKey] = (dailyMap[dayKey] || 0) + cents
      })

      const fmt = (c) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      revenueCards.value = [
        { label: 'Today', value: fmt(todayRev) },
        { label: 'This Week', value: fmt(weekRev) },
        { label: 'This Month', value: fmt(monthRev) },
        { label: 'All Time', value: fmt(allTimeRev) },
      ]

      // Last 30 days chart
      const chartData = []
      for (let i = 29; i >= 0; i--) {
        const d = new Date(todayStart)
        d.setDate(d.getDate() - i)
        const key = d.toISOString().split('T')[0]
        chartData.push(dailyMap[key] || 0)
      }
      dailyRevenue.value = chartData
    }
  } catch (e) { /* keep defaults */ }
})
```

- [ ] **Step 3: Wire AdminSupport.vue to Supabase**

Replace hardcoded `tickets` ref with `ref([])`. Replace `onMounted`:

```js
onMounted(async () => {
  if (!supabaseConfigured) return
  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      tickets.value = data.map(t => ({
        id: t.id,
        subject: t.subject || 'No subject',
        description: t.description || '',
        status: t.status || 'open',
        created: t.created_at ? new Date(t.created_at).toLocaleDateString() : '-',
        user: t.user_id || 'Unknown',
      }))
    }
  } catch (e) { /* keep empty */ }
})
```

Wire the resolve/close buttons to Supabase:

```js
async function resolveTicket(ticket) {
  if (supabaseConfigured) {
    await supabase.from('support_tickets').update({ status: 'resolved' }).eq('id', ticket.id)
  }
  ticket.status = 'resolved'
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/AdminRides.vue src/pages/admin/AdminRevenue.vue src/pages/admin/AdminSupport.vue
git commit -m "feat: wire admin rides, revenue, and support pages to real Supabase data"
```

---

### Task 9: Profile — Real Rating from Database

**Files:**
- Modify: `src/pages/Profile.vue`

- [ ] **Step 1: Add Supabase import and fetch rider data**

In `src/pages/Profile.vue`, add imports after the existing imports:

```js
import { supabase } from '../lib/supabase'
```

Add reactive refs and fetch logic after the existing `computed` properties:

```js
const riderRating = ref(null)
const riderTotalRides = ref(0)

onMounted(async () => {
  if (!user.value) return
  try {
    const { data } = await supabase
      .from('riders')
      .select('rating, total_rides')
      .eq('auth_user_id', user.value.id)
      .single()
    if (data) {
      riderRating.value = data.rating
      riderTotalRides.value = data.total_rides || 0
    }
  } catch (e) { /* keep defaults */ }
})
```

Add the missing `onMounted` import — change the import line to:

```js
import { ref, computed, onMounted } from 'vue'
```

- [ ] **Step 2: Update template to use real values**

Replace the hardcoded rating display (around line 82-84):

From:
```html
<span class="text-[15px] font-bold">4.9</span>
<span class="text-[13px] text-[#191f1c]/40">(28 rides)</span>
```

To:
```html
<span class="text-[15px] font-bold">{{ riderRating !== null ? Number(riderRating).toFixed(1) : '--' }}</span>
<span class="text-[13px] text-[var(--color-text-muted)]">({{ riderTotalRides }} rides)</span>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Profile.vue
git commit -m "feat: display real rider rating and ride count from Supabase"
```

---

### Task 10: Use Current Location for Pickup

**Files:**
- Modify: `src/pages/rider/RiderBooking.vue`

- [ ] **Step 1: Add geolocation state and function**

In `src/pages/rider/RiderBooking.vue`, after the existing refs (around line 27), add:

```js
const isLocating = ref(false)

async function useCurrentLocation() {
  if (!navigator.geolocation) {
    showToast('Location not supported on this device')
    return
  }
  isLocating.value = true
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
      })
    })
    const { latitude, longitude } = pos.coords
    const address = await reverseGeocode(latitude, longitude)
    pickup.value = { lat: latitude, lng: longitude, address }
    pickupText.value = address
    isLocating.value = false
  } catch (err) {
    isLocating.value = false
    showToast(err.code === 1 ? 'Location access denied' : 'Could not get location')
  }
}
```

- [ ] **Step 2: Add the button in the template**

In the template, find the pickup input area. After the pickup input `<div>`, before the "Where to?" input, add:

```html
<button
  @click="useCurrentLocation"
  :disabled="isLocating"
  class="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-[var(--color-brand)] active:bg-[var(--color-surface-secondary)] rounded-lg transition-colors"
>
  <svg v-if="!isLocating" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v4m0 12v4m10-10h-4M6 12H2" />
  </svg>
  <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
  {{ isLocating ? 'Locating...' : 'Use current location' }}
</button>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/pages/rider/RiderBooking.vue
git commit -m "feat: add Use Current Location button for pickup in booking flow"
```

---

### Task 11: Driver Search Timeout

**Files:**
- Modify: `src/pages/rider/SearchingForDriver.vue`

- [ ] **Step 1: Add timeout logic**

In `src/pages/rider/SearchingForDriver.vue`, after the existing refs (around line 13), add:

```js
const timedOut = ref(false)
const elapsedSeconds = ref(0)
let timeoutTimer = null
let elapsedTimer = null
```

In the `onMounted`, after the demo check block and after the Supabase subscription setup, add:

```js
// Start elapsed counter
elapsedTimer = setInterval(() => {
  elapsedSeconds.value++
}, 1000)

// 90-second timeout
timeoutTimer = setTimeout(() => {
  timedOut.value = true
  if (elapsedTimer) clearInterval(elapsedTimer)
}, 90000)
```

Add a cleanup in `onUnmounted` (find the existing one or add):

```js
onUnmounted(() => {
  if (timeoutTimer) clearTimeout(timeoutTimer)
  if (elapsedTimer) clearInterval(elapsedTimer)
  // ... existing cleanup for channel, demoTimer
})
```

Add a retry function:

```js
function retrySearch() {
  timedOut.value = false
  elapsedSeconds.value = 0
  elapsedTimer = setInterval(() => { elapsedSeconds.value++ }, 1000)
  timeoutTimer = setTimeout(() => {
    timedOut.value = true
    if (elapsedTimer) clearInterval(elapsedTimer)
  }, 90000)
}
```

- [ ] **Step 2: Add timeout UI in template**

In the template, after the existing searching animation, add a conditional block:

```html
<div v-if="timedOut" class="text-center px-6">
  <div class="w-16 h-16 rounded-full bg-[var(--color-surface-secondary)] flex items-center justify-center mx-auto mb-4">
    <svg class="w-8 h-8 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  </div>
  <h2 class="text-xl font-bold text-[var(--color-text-primary)] mb-2">No drivers available</h2>
  <p class="text-[var(--color-text-muted)] text-sm mb-6">All drivers are currently busy. Please try again in a moment.</p>
  <button @click="retrySearch" class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px] mb-3">
    Try again
  </button>
  <button @click="emit('cancelled')" class="w-full py-3 text-[var(--color-text-muted)] text-[14px] font-medium">
    Cancel ride
  </button>
</div>
```

Also add an elapsed time display near the searching text:

```html
<p v-if="!timedOut && elapsedSeconds > 10" class="text-[var(--color-text-muted)] text-xs mt-2">
  Searching... {{ elapsedSeconds }}s
</p>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/pages/rider/SearchingForDriver.vue
git commit -m "feat: add 90-second timeout with retry on driver search"
```

---

### Task 12: Fix Promotions Menu Link + Driver Contact + Login/Signup Safe Area

**Files:**
- Modify: `src/components/SideMenu.vue`
- Modify: `src/pages/rider/ActiveRide.vue`
- Modify: `src/pages/Login.vue`
- Modify: `src/pages/Signup.vue`

- [ ] **Step 1: Fix SideMenu Promotions route**

In `src/components/SideMenu.vue`, find line 53:

```js
{ label: 'Promotions', subtitle: 'Contact support for promo codes', route: '/support', icon: 'tag', requiresAuth: true },
```

Replace with:

```js
{ label: 'Promotions', route: '/promotions', icon: 'tag', requiresAuth: true },
```

- [ ] **Step 2: Add driver contact buttons to ActiveRide.vue**

In `src/pages/rider/ActiveRide.vue`, find the driver info display area in the template (the section showing driver name, rating, vehicle). After the driver info text, add call and message buttons:

```html
<div class="flex gap-3 mt-3">
  <a :href="'tel:' + driverPhone" class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] font-medium text-[13px]">
    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
    Call
  </a>
  <router-link :to="'/ride/' + rideId + '/messages'" class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] font-medium text-[13px]">
    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
    Message
  </router-link>
</div>
```

- [ ] **Step 3: Fix Login.vue safe area**

In `src/pages/Login.vue`, find the top bar `div` with `pt-12` (around line 59):

```html
<div class="flex items-center px-4 pt-12 pb-4">
```

Replace with:

```html
<div class="flex items-center px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4">
```

- [ ] **Step 4: Fix Signup.vue safe area**

In `src/pages/Signup.vue`, find the same `pt-12` pattern (around line 58) and replace with:

```html
<div class="flex items-center px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4">
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/SideMenu.vue src/pages/rider/ActiveRide.vue src/pages/Login.vue src/pages/Signup.vue
git commit -m "fix: promotions link, driver contact buttons, login/signup safe area"
```

---

### Task 13: DriverEarnings — Real Supabase Data

**Files:**
- Modify: `src/pages/driver/DriverEarnings.vue`

- [ ] **Step 1: Add Supabase data fetching**

In `src/pages/driver/DriverEarnings.vue`, add imports:

```js
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { useAuth } from '../../lib/useAuth'
```

Replace the `onMounted`:

```js
onMounted(async () => {
  if (DEMO_MODE || !supabaseConfigured) return

  const { user } = useAuth()
  if (!user.value) return

  try {
    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('auth_user_id', user.value.id)
      .single()

    if (!driver) return

    const { data: rides } = await supabase
      .from('rides')
      .select('fare_cents, completed_at, created_at')
      .eq('driver_id', driver.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })

    if (!rides || rides.length === 0) return

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Today's rides
    const todayRides = rides.filter(r => new Date(r.completed_at || r.created_at) >= todayStart)
    earnings.value.today = todayRides.map(r => ({ fare_cents: r.fare_cents || 0 }))

    // Weekly totals (Mon-Sun)
    const weekTotals = [0, 0, 0, 0, 0, 0, 0]
    const weekTrips = [0, 0, 0, 0, 0, 0, 0]
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Monday

    rides.forEach(r => {
      const d = new Date(r.completed_at || r.created_at)
      if (d >= weekStart) {
        const dayIdx = (d.getDay() + 6) % 7 // Mon=0, Sun=6
        weekTotals[dayIdx] += r.fare_cents || 0
        weekTrips[dayIdx]++
      }
    })

    earnings.value.weeklyTotals = weekTotals
    earnings.value.weeklyTrips = weekTrips
  } catch (e) { /* keep defaults */ }
})
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/driver/DriverEarnings.vue
git commit -m "feat: wire driver earnings page to real Supabase ride data"
```

---

### Task 14: DriverProfile — Inline Editing

**Files:**
- Modify: `src/pages/driver/DriverProfile.vue`

- [ ] **Step 1: Add editing state and save function**

In `src/pages/driver/DriverProfile.vue`, add to the script setup:

```js
import { supabase, supabaseConfigured } from '../../lib/supabase'

const editingPhone = ref(false)
const editingEmail = ref(false)
const editPhone = ref('')
const editEmail = ref('')
const saving = ref(false)

function startEditPhone() {
  editPhone.value = driver.value?.phone || ''
  editingPhone.value = true
}

function startEditEmail() {
  editEmail.value = driver.value?.email || ''
  editingEmail.value = true
}

async function savePhone() {
  if (!supabaseConfigured || !driver.value) return
  saving.value = true
  const { error } = await supabase
    .from('drivers')
    .update({ phone: editPhone.value.trim() })
    .eq('id', driver.value.id)
  saving.value = false
  if (error) { showToast('Failed to save'); return }
  driver.value.phone = editPhone.value.trim()
  editingPhone.value = false
  showToast('Phone updated')
}

async function saveEmail() {
  if (!supabaseConfigured || !driver.value) return
  saving.value = true
  const { error } = await supabase
    .from('drivers')
    .update({ email: editEmail.value.trim() })
    .eq('id', driver.value.id)
  saving.value = false
  if (error) { showToast('Failed to save'); return }
  driver.value.email = editEmail.value.trim()
  editingEmail.value = false
  showToast('Email updated')
}
```

- [ ] **Step 2: Replace phone/email display with editable fields**

In the template, find the phone display section (around line 130). Replace the static display + "Edit" toast button with:

```html
<div class="flex items-center justify-between py-3">
  <div class="flex items-center gap-3">
    <span class="text-[13px] text-[var(--color-text-muted)]">Phone</span>
  </div>
  <div v-if="editingPhone" class="flex items-center gap-2">
    <input v-model="editPhone" type="tel" class="text-[14px] bg-[var(--color-surface-secondary)] px-3 py-1.5 rounded-lg w-40 outline-none" />
    <button @click="savePhone" :disabled="saving" class="text-[13px] text-[var(--color-brand)] font-semibold">Save</button>
    <button @click="editingPhone = false" class="text-[13px] text-[var(--color-text-muted)]">Cancel</button>
  </div>
  <div v-else class="flex items-center gap-2">
    <span class="text-[14px]">{{ driver?.phone || '—' }}</span>
    <button @click="startEditPhone" class="text-[13px] text-[var(--color-brand)] font-semibold">Edit</button>
  </div>
</div>
```

Do the same for email (around line 138):

```html
<div class="flex items-center justify-between py-3">
  <div class="flex items-center gap-3">
    <span class="text-[13px] text-[var(--color-text-muted)]">Email</span>
  </div>
  <div v-if="editingEmail" class="flex items-center gap-2">
    <input v-model="editEmail" type="email" class="text-[14px] bg-[var(--color-surface-secondary)] px-3 py-1.5 rounded-lg w-40 outline-none" />
    <button @click="saveEmail" :disabled="saving" class="text-[13px] text-[var(--color-brand)] font-semibold">Save</button>
    <button @click="editingEmail = false" class="text-[13px] text-[var(--color-text-muted)]">Cancel</button>
  </div>
  <div v-else class="flex items-center gap-2">
    <span class="text-[14px]">{{ driver?.email || '—' }}</span>
    <button @click="startEditEmail" class="text-[13px] text-[var(--color-brand)] font-semibold">Edit</button>
  </div>
</div>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/pages/driver/DriverProfile.vue
git commit -m "feat: add inline phone and email editing on driver profile"
```

---

## Self-Review Checklist

**Spec coverage:**
1. Dark mode CSS variables ✅ (Task 1)
2. Dark mode bulk migration ✅ (Task 2)
3. Bottom nav bar ✅ (Task 3)
4. PaymentSuccess real data ✅ (Task 4)
5. DriverApply missing fields ✅ (Task 5)
6. Admin Dashboard real data ✅ (Task 6)
7. Admin Users real data ✅ (Task 7)
8. Admin Rides/Revenue/Support real data ✅ (Task 8)
9. Profile real rating ✅ (Task 9)
10. Use current location ✅ (Task 10)
11. Driver search timeout ✅ (Task 11)
12. Fix Promotions link ✅ (Task 12)
13. Driver contact during ride ✅ (Task 12)
14. Login/Signup safe area ✅ (Task 12)
15. DriverEarnings real data ✅ (Task 13)
16. DriverProfile inline editing ✅ (Task 14)

**Placeholder scan:** No TBD, TODO, or vague steps found. All code blocks are complete.

**Type consistency:** `fare_cents` used consistently. `supabaseConfigured` imported where needed. `formatFare` from pricing.js used for display.
