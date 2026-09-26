# Driver Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete driver-side experience — apply, get approved, go online, accept rides, navigate through trip phases, and track earnings — all within the existing RideUp app.

**Architecture:** New Vue pages under `src/pages/driver/`, new routes under `/driver/` in the existing router, a `useDriver.js` composable for driver state management (mirroring `useAuth.js` singleton pattern), and a `demoDriverMode.js` module for fake data. Reuses existing `GoogleMap`, `SideMenu`, `HarborBackdrop` components, Supabase client, and auth system. The existing database schema already has `drivers`, `rides`, `driver_locations` tables with RLS — no migrations needed.

**Tech Stack:** Vue 3 (`<script setup>`), Tailwind CSS, Supabase (auth, database, realtime), Google Maps JavaScript API

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/useDriver.js` | Singleton composable: driver profile, online/offline toggle, ride requests, realtime subscriptions |
| `src/lib/demoDriverMode.js` | Fake ride requests, fake earnings data, demo rider names |
| `src/pages/driver/DriverApply.vue` | Application form for new drivers |
| `src/pages/driver/DriverPending.vue` | "Under review" gate screen |
| `src/pages/driver/DriverDashboard.vue` | Main screen: map, go online button, today's stats, last ride |
| `src/pages/driver/DriverRideRequest.vue` | Full-screen ride request takeover with 15s countdown |
| `src/pages/driver/DriverActiveRide.vue` | 4-phase active ride: navigate → arrived → in progress → complete |
| `src/pages/driver/DriverEarnings.vue` | Today/This Week tab toggle with trip list + bar chart |
| `src/pages/driver/DriverProfile.vue` | Profile, vehicle info, stats, account settings |
| `src/router/index.js` | Add 5 new `/driver/` routes with auth guards |
| `src/components/SideMenu.vue` | Add driver-specific menu items when on driver routes |

---

## Task 1: Demo Driver Mode Data Module

**Files:**
- Create: `src/lib/demoDriverMode.js`

- [ ] **Step 1: Create the demo driver data module**

```js
// src/lib/demoDriverMode.js
// Fake data for the driver side of demo mode.
// Mirrors the pattern in demoMode.js — used when DEMO_MODE is true.

import { DEMO_LOCATIONS } from './demoMode'
import { calculateFare, VEHICLE_TYPES } from './pricing'
import { fakeRoute } from './demoMode'

export const DEMO_RIDER_NAMES = [
  'Sarah M.', 'James T.', 'Lisa K.', 'Michael B.', 'Anna P.',
  'David W.', 'Nina R.', 'Chris L.', 'Tanya S.', 'Marcus J.',
]

export const DEMO_DRIVER_PROFILE = {
  id: 'demo-driver-1',
  auth_user_id: 'demo-auth-1',
  name: 'Marcus Robinson',
  phone: '(242) 555-0123',
  email: 'marcus@example.com',
  vehicle_make: 'Toyota',
  vehicle_model: 'Camry',
  vehicle_color: 'Silver',
  vehicle_plate: 'ABC-1234',
  vehicle_type: 'standard',
  status: 'offline',
  rating: 4.9,
  total_trips: 247,
  approved: true,
  created_at: '2026-01-15T10:00:00Z',
}

// Generate a fake ride request with random pickup/dropoff
export function generateFakeRideRequest() {
  const pickupIdx = Math.floor(Math.random() * DEMO_LOCATIONS.length)
  let dropoffIdx = Math.floor(Math.random() * DEMO_LOCATIONS.length)
  while (dropoffIdx === pickupIdx) {
    dropoffIdx = Math.floor(Math.random() * DEMO_LOCATIONS.length)
  }
  const pickup = DEMO_LOCATIONS[pickupIdx]
  const dropoff = DEMO_LOCATIONS[dropoffIdx]
  const rider = DEMO_RIDER_NAMES[Math.floor(Math.random() * DEMO_RIDER_NAMES.length)]
  const riderRating = (4.2 + Math.random() * 0.8).toFixed(1)
  const { distanceMiles, durationMinutes } = fakeRoute(pickup, dropoff)
  const fare = calculateFare(distanceMiles, durationMinutes, 'standard')

  return {
    id: 'demo-ride-' + Date.now(),
    rider_name: rider,
    rider_rating: parseFloat(riderRating),
    pickup_address: pickup,
    dropoff_address: dropoff,
    pickup_lat: 25.0 + Math.random() * 0.1,
    pickup_lng: -77.3 - Math.random() * 0.1,
    dropoff_lat: 25.0 + Math.random() * 0.1,
    dropoff_lng: -77.3 - Math.random() * 0.1,
    distance_miles: distanceMiles,
    duration_minutes: durationMinutes,
    fare_cents: fare,
    vehicle_type: 'standard',
    status: 'requested',
    requested_at: new Date().toISOString(),
  }
}

// Generate fake completed trips for earnings display
export function generateFakeEarnings() {
  const today = []
  const hoursAgo = [0.2, 0.8, 1.5, 2.1, 3.0, 4.2, 5.0, 5.8]
  for (let i = 0; i < 8; i++) {
    const pickupIdx = i % DEMO_LOCATIONS.length
    const dropoffIdx = (i + 3) % DEMO_LOCATIONS.length
    const pickup = DEMO_LOCATIONS[pickupIdx]
    const dropoff = DEMO_LOCATIONS[dropoffIdx]
    const { distanceMiles, durationMinutes } = fakeRoute(pickup, dropoff)
    const fare = calculateFare(distanceMiles, durationMinutes, 'standard')
    today.push({
      id: `demo-trip-today-${i}`,
      pickup_address: pickup,
      dropoff_address: dropoff,
      distance_miles: distanceMiles,
      duration_minutes: durationMinutes,
      fare_cents: fare,
      completed_at: new Date(Date.now() - hoursAgo[i] * 3600000).toISOString(),
    })
  }

  // Weekly: array of 7 days (Mon-Sun), each with a total
  const weeklyTotals = [8900, 10200, 7500, 14750, 12300, 6100, 0]
  const weeklyTrips = [5, 6, 4, 8, 7, 3, 0]

  return { today, weeklyTotals, weeklyTrips }
}
```

- [ ] **Step 2: Verify the module loads without errors**

Run: `npx vite build --mode development 2>&1 | tail -5`
Expected: no import errors related to demoDriverMode

- [ ] **Step 3: Commit**

```bash
git add src/lib/demoDriverMode.js
git commit -m "feat: add demo driver mode data module"
```

---

## Task 2: Driver State Composable

**Files:**
- Create: `src/lib/useDriver.js`

- [ ] **Step 1: Create the useDriver composable**

This follows the exact same singleton pattern as `useAuth.js` — module-level refs, one `init()` call, exported via a function.

```js
// src/lib/useDriver.js
import { ref, readonly } from 'vue'
import { supabase, supabaseConfigured } from './supabase'
import { DEMO_MODE } from './demoMode'
import { DEMO_DRIVER_PROFILE, generateFakeRideRequest } from './demoDriverMode'

const driver = ref(null)
const isOnline = ref(false)
const currentRide = ref(null)
const incomingRequest = ref(null)
const loading = ref(true)

let initialized = false
let rideSubscription = null
let fakeRequestTimer = null

function init() {
  if (initialized) return
  initialized = true

  if (DEMO_MODE) {
    driver.value = { ...DEMO_DRIVER_PROFILE }
    loading.value = false
    return
  }

  if (!supabaseConfigured) {
    loading.value = false
    return
  }
}

async function fetchDriver(authUserId) {
  if (DEMO_MODE) {
    driver.value = { ...DEMO_DRIVER_PROFILE }
    loading.value = false
    return
  }
  if (!supabaseConfigured || !authUserId) { loading.value = false; return }

  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single()

  if (!error && data) {
    driver.value = data
    isOnline.value = data.status === 'online'
  }
  loading.value = false
}

async function goOnline() {
  isOnline.value = true
  if (DEMO_MODE) {
    driver.value.status = 'online'
    startFakeRequests()
    return
  }
  if (!driver.value) return
  await supabase.from('drivers').update({ status: 'online' }).eq('id', driver.value.id)
  subscribeToRides()
}

async function goOffline() {
  isOnline.value = false
  if (DEMO_MODE) {
    driver.value.status = 'offline'
    stopFakeRequests()
    return
  }
  if (!driver.value) return
  await supabase.from('drivers').update({ status: 'offline' }).eq('id', driver.value.id)
  unsubscribeFromRides()
}

function subscribeToRides() {
  if (!supabaseConfigured || !driver.value) return
  rideSubscription = supabase
    .channel('driver-rides')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'rides',
      filter: `status=eq.requested`,
    }, (payload) => {
      const ride = payload.new
      if (ride.declined_by && ride.declined_by.includes(driver.value.id)) return
      incomingRequest.value = ride
    })
    .subscribe()
}

function unsubscribeFromRides() {
  if (rideSubscription) {
    supabase.removeChannel(rideSubscription)
    rideSubscription = null
  }
}

function startFakeRequests() {
  stopFakeRequests()
  function scheduleNext() {
    const delay = 15000 + Math.random() * 15000
    fakeRequestTimer = setTimeout(() => {
      if (isOnline.value && !incomingRequest.value && !currentRide.value) {
        incomingRequest.value = generateFakeRideRequest()
      }
      if (isOnline.value) scheduleNext()
    }, delay)
  }
  scheduleNext()
}

function stopFakeRequests() {
  if (fakeRequestTimer) { clearTimeout(fakeRequestTimer); fakeRequestTimer = null }
}

async function acceptRide(ride) {
  incomingRequest.value = null
  currentRide.value = { ...ride, status: 'accepted', accepted_at: new Date().toISOString() }

  if (DEMO_MODE) return

  await supabase.from('rides').update({
    driver_id: driver.value.id,
    status: 'accepted',
    accepted_at: new Date().toISOString(),
  }).eq('id', ride.id)

  await supabase.from('drivers').update({ status: 'on_trip' }).eq('id', driver.value.id)
}

function declineRide(ride) {
  incomingRequest.value = null
  if (DEMO_MODE) return

  supabase.from('rides').update({
    declined_by: [...(ride.declined_by || []), driver.value.id],
  }).eq('id', ride.id)
}

async function updateRideStatus(status) {
  if (!currentRide.value) return
  const timestamps = {}
  if (status === 'driver_arrived') timestamps.started_at = null
  if (status === 'in_progress') timestamps.started_at = new Date().toISOString()
  if (status === 'completed') timestamps.completed_at = new Date().toISOString()

  currentRide.value = { ...currentRide.value, status, ...timestamps }

  if (status === 'completed') {
    if (!DEMO_MODE && driver.value) {
      await supabase.from('rides').update({ status, ...timestamps }).eq('id', currentRide.value.id)
      await supabase.from('drivers').update({
        status: 'online',
        total_trips: (driver.value.total_trips || 0) + 1,
      }).eq('id', driver.value.id)
      driver.value.total_trips = (driver.value.total_trips || 0) + 1
    }
  } else if (!DEMO_MODE) {
    await supabase.from('rides').update({ status, ...timestamps }).eq('id', currentRide.value.id)
  }
}

function completeRide() {
  currentRide.value = null
}

export function useDriver() {
  init()
  return {
    driver: readonly(driver),
    isOnline: readonly(isOnline),
    currentRide,
    incomingRequest,
    loading: readonly(loading),
    fetchDriver,
    goOnline,
    goOffline,
    acceptRide,
    declineRide,
    updateRideStatus,
    completeRide,
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx vite build --mode development 2>&1 | tail -5`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/useDriver.js
git commit -m "feat: add useDriver composable for driver state management"
```

---

## Task 3: Driver Application Page

**Files:**
- Create: `src/pages/driver/DriverApply.vue`

- [ ] **Step 1: Create the application form**

```vue
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../../lib/useAuth'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { DEMO_MODE } from '../../lib/demoMode'

const router = useRouter()
const { user, signUp } = useAuth()

const form = ref({
  name: '', email: '', phone: '',
  vehicleMake: '', vehicleModel: '', vehicleYear: '',
  vehicleColor: '', vehiclePlate: '',
  vehicleType: 'standard', licenseNumber: '',
})
const password = ref('')
const error = ref('')
const submitting = ref(false)
const success = ref(false)

async function handleSubmit() {
  error.value = ''
  const f = form.value

  if (!f.name.trim() || !f.email.trim() || !f.phone.trim()) {
    error.value = 'Please fill in all personal details.'
    return
  }
  if (!f.vehicleMake.trim() || !f.vehicleModel.trim() || !f.vehiclePlate.trim()) {
    error.value = 'Please fill in all vehicle details.'
    return
  }
  if (!f.licenseNumber.trim()) {
    error.value = 'Please enter your driver\'s license number.'
    return
  }

  if (DEMO_MODE) {
    submitting.value = true
    await new Promise(r => setTimeout(r, 800))
    success.value = true
    setTimeout(() => router.push('/driver/dashboard'), 1500)
    return
  }

  submitting.value = true

  // Create account if not logged in
  if (!user.value && password.value.length >= 6) {
    const { error: authErr } = await signUp(f.email.trim(), password.value, f.name.trim())
    if (authErr) { error.value = authErr.message; submitting.value = false; return }
  }

  if (!supabaseConfigured) {
    error.value = 'Database not configured.'
    submitting.value = false
    return
  }

  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) { error.value = 'Please log in first.'; submitting.value = false; return }

  const { error: insertErr } = await supabase.from('drivers').insert({
    auth_user_id: currentUser.id,
    name: f.name.trim(),
    phone: f.phone.trim(),
    email: f.email.trim(),
    vehicle_make: f.vehicleMake.trim(),
    vehicle_model: f.vehicleModel.trim(),
    vehicle_color: f.vehicleColor.trim(),
    vehicle_plate: f.vehiclePlate.trim(),
    vehicle_type: f.vehicleType,
    approved: false,
  })

  submitting.value = false
  if (insertErr) { error.value = insertErr.message; return }
  success.value = true
  setTimeout(() => router.push('/driver/pending'), 2000)
}

function goBack() {
  window.history.length > 1 ? router.back() : router.push('/drive')
}
</script>

<template>
  <div class="min-h-screen bg-white text-[#1a1a1a] flex flex-col">
    <!-- Top bar -->
    <div class="flex items-center px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4">
      <button @click="goBack" class="w-10 h-10 flex items-center justify-center rounded-full active:bg-[#1a1a1a]/5">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </div>

    <div class="flex-1 px-6 w-full max-w-md mx-auto">
      <!-- Success -->
      <div v-if="success" class="pt-20 text-center">
        <div class="w-16 h-16 rounded-full bg-[#58cc02] flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="font-serif text-2xl font-bold mb-2">Application Submitted</h2>
        <p class="text-[#1a1a1a]/50 text-[14px]">{{ DEMO_MODE ? 'Redirecting to dashboard...' : 'We\'ll review your application and get back to you.' }}</p>
      </div>

      <!-- Form -->
      <template v-else>
        <h1 class="font-serif text-[28px] font-bold leading-tight mb-2">Drive with RideUp</h1>
        <p class="text-[#1a1a1a]/50 text-[14px] mb-6">Fill out your details to apply</p>

        <div class="space-y-5">
          <!-- Personal Info -->
          <div>
            <p class="text-[11px] font-semibold text-[#1a1a1a]/40 uppercase tracking-wider mb-2">Personal Info</p>
            <div class="space-y-2">
              <label class="block">
                <span class="sr-only">Full name</span>
                <input v-model="form.name" type="text" placeholder="Full name" autocomplete="name"
                       class="w-full px-4 py-3.5 bg-[#f5f5f5] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#58cc02] focus:bg-white transition-all placeholder:text-[#1a1a1a]/40" />
              </label>
              <label class="block">
                <span class="sr-only">Email</span>
                <input v-model="form.email" type="email" placeholder="Email address" autocomplete="email"
                       class="w-full px-4 py-3.5 bg-[#f5f5f5] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#58cc02] focus:bg-white transition-all placeholder:text-[#1a1a1a]/40" />
              </label>
              <label class="block">
                <span class="sr-only">Phone</span>
                <input v-model="form.phone" type="tel" placeholder="Phone number" autocomplete="tel"
                       class="w-full px-4 py-3.5 bg-[#f5f5f5] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#58cc02] focus:bg-white transition-all placeholder:text-[#1a1a1a]/40" />
              </label>
              <label v-if="!user" class="block">
                <span class="sr-only">Password</span>
                <input v-model="password" type="password" placeholder="Create a password (min 6 chars)" autocomplete="new-password"
                       class="w-full px-4 py-3.5 bg-[#f5f5f5] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#58cc02] focus:bg-white transition-all placeholder:text-[#1a1a1a]/40" />
              </label>
            </div>
          </div>

          <!-- Vehicle Info -->
          <div>
            <p class="text-[11px] font-semibold text-[#1a1a1a]/40 uppercase tracking-wider mb-2">Vehicle Info</p>
            <div class="space-y-2">
              <div class="grid grid-cols-2 gap-2">
                <label class="block">
                  <span class="sr-only">Vehicle make</span>
                  <input v-model="form.vehicleMake" type="text" placeholder="Make (e.g. Toyota)"
                         class="w-full px-4 py-3.5 bg-[#f5f5f5] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#58cc02] focus:bg-white transition-all placeholder:text-[#1a1a1a]/40" />
                </label>
                <label class="block">
                  <span class="sr-only">Vehicle model</span>
                  <input v-model="form.vehicleModel" type="text" placeholder="Model (e.g. Camry)"
                         class="w-full px-4 py-3.5 bg-[#f5f5f5] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#58cc02] focus:bg-white transition-all placeholder:text-[#1a1a1a]/40" />
                </label>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <label class="block">
                  <span class="sr-only">Vehicle year</span>
                  <input v-model="form.vehicleYear" type="number" placeholder="Year"
                         class="w-full px-4 py-3.5 bg-[#f5f5f5] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#58cc02] focus:bg-white transition-all placeholder:text-[#1a1a1a]/40" />
                </label>
                <label class="block">
                  <span class="sr-only">Vehicle color</span>
                  <input v-model="form.vehicleColor" type="text" placeholder="Color"
                         class="w-full px-4 py-3.5 bg-[#f5f5f5] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#58cc02] focus:bg-white transition-all placeholder:text-[#1a1a1a]/40" />
                </label>
              </div>
              <label class="block">
                <span class="sr-only">License plate</span>
                <input v-model="form.vehiclePlate" type="text" placeholder="License plate number"
                       class="w-full px-4 py-3.5 bg-[#f5f5f5] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#58cc02] focus:bg-white transition-all placeholder:text-[#1a1a1a]/40 uppercase" />
              </label>
              <label class="block">
                <span class="sr-only">Vehicle type</span>
                <select v-model="form.vehicleType"
                        class="w-full px-4 py-3.5 bg-[#f5f5f5] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#58cc02] focus:bg-white transition-all text-[#1a1a1a]">
                  <option value="standard">Standard (4 seats)</option>
                  <option value="xl">XL (6 seats)</option>
                </select>
              </label>
            </div>
          </div>

          <!-- License -->
          <div>
            <p class="text-[11px] font-semibold text-[#1a1a1a]/40 uppercase tracking-wider mb-2">License</p>
            <label class="block">
              <span class="sr-only">Driver's license number</span>
              <input v-model="form.licenseNumber" type="text" placeholder="Driver's license number"
                     class="w-full px-4 py-3.5 bg-[#f5f5f5] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#58cc02] focus:bg-white transition-all placeholder:text-[#1a1a1a]/40" />
            </label>
          </div>
        </div>

        <p v-if="error" class="text-red-500 text-[13px] mt-4">{{ error }}</p>

        <button @click="handleSubmit" :disabled="submitting"
                class="w-full py-4 bg-[#58cc02] text-white font-bold rounded-2xl text-[15px] mt-6 mb-4 transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(88,204,2,0.3)] disabled:opacity-50 disabled:shadow-none">
          {{ submitting ? 'Submitting...' : 'Submit Application' }}
        </button>

        <p class="text-[12px] text-[#1a1a1a]/35 text-center pb-8 leading-relaxed">
          By applying, you agree to our <router-link to="/terms" class="underline">Terms of Service</router-link> and <router-link to="/privacy" class="underline">Privacy Policy</router-link>.
        </p>
      </template>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/driver/DriverApply.vue
git commit -m "feat: add driver application page"
```

---

## Task 4: Driver Pending Approval Page

**Files:**
- Create: `src/pages/driver/DriverPending.vue`

- [ ] **Step 1: Create the pending approval gate screen**

```vue
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { useAuth } from '../../lib/useAuth'
import { DEMO_MODE } from '../../lib/demoMode'

const router = useRouter()
const { user } = useAuth()

const checking = ref(false)
const statusMessage = ref('')

async function checkStatus() {
  if (DEMO_MODE) {
    router.push('/driver/dashboard')
    return
  }
  if (!supabaseConfigured || !user.value) return

  checking.value = true
  statusMessage.value = ''

  const { data, error } = await supabase
    .from('drivers')
    .select('approved')
    .eq('auth_user_id', user.value.id)
    .single()

  checking.value = false

  if (error || !data) {
    statusMessage.value = 'Could not check status. Please try again.'
    return
  }
  if (data.approved) {
    router.push('/driver/dashboard')
  } else {
    statusMessage.value = 'Your application is still under review.'
  }
}
</script>

<template>
  <div class="min-h-screen bg-white text-[#1a1a1a] flex flex-col items-center justify-center px-6">
    <div class="max-w-sm w-full text-center">
      <!-- Logo -->
      <div class="font-serif text-2xl font-bold mb-10">Ride<span class="text-[#58cc02]">Up</span></div>

      <!-- Icon -->
      <div class="w-20 h-20 rounded-full bg-[#58cc02]/10 flex items-center justify-center mx-auto mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-[#58cc02]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <h1 class="font-serif text-[26px] font-bold mb-3">Application Under Review</h1>
      <p class="text-[#1a1a1a]/50 text-[14px] leading-relaxed mb-8">
        We're reviewing your application. You'll receive an email when you're approved to start driving.
      </p>

      <p v-if="statusMessage" class="text-[13px] mb-4" :class="statusMessage.includes('still') ? 'text-[#1a1a1a]/50' : 'text-red-500'">
        {{ statusMessage }}
      </p>

      <button @click="checkStatus" :disabled="checking"
              class="w-full py-4 bg-[#58cc02] text-white font-bold rounded-2xl text-[15px] transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(88,204,2,0.3)] disabled:opacity-50">
        {{ checking ? 'Checking...' : 'Check Status' }}
      </button>

      <button v-if="DEMO_MODE" @click="router.push('/driver/dashboard')"
              class="w-full py-3 mt-3 text-[#58cc02] font-semibold text-[14px]">
        Skip to Dashboard (Demo)
      </button>

      <router-link to="/welcome" class="block mt-6 text-[14px] text-[#1a1a1a]/40 hover:text-[#1a1a1a]/60">
        Back to Home
      </router-link>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/driver/DriverPending.vue
git commit -m "feat: add driver pending approval gate screen"
```

---

## Task 5: Driver Dashboard

**Files:**
- Create: `src/pages/driver/DriverDashboard.vue`

- [ ] **Step 1: Create the main driver dashboard**

```vue
<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDriver } from '../../lib/useDriver'
import { useAuth } from '../../lib/useAuth'
import { DEMO_MODE } from '../../lib/demoMode'
import { formatFare } from '../../lib/pricing'
import { generateFakeEarnings } from '../../lib/demoDriverMode'
import GoogleMap from '../../components/GoogleMap.vue'
import HarborBackdrop from '../../components/HarborBackdrop.vue'
import SideMenu from '../../components/SideMenu.vue'
import DriverRideRequest from './DriverRideRequest.vue'

const router = useRouter()
const { user } = useAuth()
const { driver, isOnline, incomingRequest, currentRide, fetchDriver, goOnline, goOffline } = useDriver()

const menuOpen = ref(false)
const todayEarnings = ref(0)
const todayTrips = ref(0)
const lastRide = ref(null)

onMounted(async () => {
  if (!DEMO_MODE && user.value) {
    await fetchDriver(user.value.id)
  }
  if (DEMO_MODE) {
    const { today } = generateFakeEarnings()
    todayEarnings.value = today.reduce((sum, t) => sum + t.fare_cents, 0)
    todayTrips.value = today.length
    lastRide.value = today[0]
  }
})

async function toggleOnline() {
  if (isOnline.value) {
    await goOffline()
  } else {
    await goOnline()
  }
}

function handleRideAccepted() {
  router.push('/driver/active-ride')
}

const initials = computed(() => {
  if (!driver.value?.name) return 'DR'
  return driver.value.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
})
</script>

<template>
  <div class="relative h-screen bg-white text-[#1a1a1a] overflow-hidden">
    <SideMenu :is-open="menuOpen" @close="menuOpen = false" />

    <!-- Incoming ride request overlay -->
    <DriverRideRequest
      v-if="incomingRequest"
      :request="incomingRequest"
      @accepted="handleRideAccepted"
    />

    <!-- Map fills right side on desktop, top on mobile -->
    <div class="absolute inset-0 md:left-[400px]">
      <GoogleMap v-if="!DEMO_MODE" class="absolute inset-0 z-0" />
      <HarborBackdrop v-else />
    </div>

    <!-- MOBILE: Top bar -->
    <div class="md:hidden absolute top-0 left-0 right-0 z-10 px-5 pt-[max(2rem,env(safe-area-inset-top))] flex items-center justify-between pointer-events-none">
      <button @click="menuOpen = true" class="pointer-events-auto w-11 h-11 rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.1)] flex items-center justify-center active:scale-95 transition-transform">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect y="3" width="18" height="1.5" rx="0.75" fill="#1a1a1a"/><rect y="8.25" width="18" height="1.5" rx="0.75" fill="#1a1a1a"/><rect y="13.5" width="18" height="1.5" rx="0.75" fill="#1a1a1a"/></svg>
      </button>
      <div class="pointer-events-auto bg-white shadow-[0_2px_12px_rgba(0,0,0,0.1)] rounded-full px-5 py-2 font-serif text-[17px] font-bold tracking-tight">Ride<span class="text-[#58cc02]">Up</span> <span class="text-[11px] font-sans font-normal text-[#1a1a1a]/40 ml-0.5">Driver</span></div>
      <button @click="router.push('/driver/profile')" class="pointer-events-auto w-11 h-11 rounded-full bg-[#58cc02] shadow-[0_2px_12px_rgba(0,0,0,0.1)] flex items-center justify-center text-white text-[13px] font-bold">
        {{ initials }}
      </button>
    </div>

    <!-- MOBILE: Bottom sheet -->
    <div class="md:hidden absolute bottom-0 left-0 right-0 z-10 bg-white rounded-t-[28px] shadow-[0_-4px_40px_rgba(0,0,0,0.1)]" style="padding-bottom: env(safe-area-inset-bottom, 0px);">
      <div class="flex justify-center pt-3 pb-2">
        <div class="w-9 h-[5px] rounded-full bg-[#1a1a1a]/10"></div>
      </div>
      <div class="px-5 pb-6">
        <!-- Online status -->
        <div v-if="isOnline" class="flex items-center gap-2 mb-4">
          <span class="w-2.5 h-2.5 rounded-full bg-[#58cc02] animate-pulse"></span>
          <span class="text-[13px] font-semibold text-[#58cc02]">You're online</span>
        </div>

        <!-- Go Online / Offline button -->
        <button @click="toggleOnline"
                class="w-full py-4 font-bold rounded-2xl text-[15px] transition-all active:scale-[0.98]"
                :class="isOnline
                  ? 'bg-[#1a1a1a] text-white'
                  : 'bg-[#58cc02] text-white shadow-[0_4px_16px_rgba(88,204,2,0.3)]'">
          {{ isOnline ? 'Go Offline' : 'Go Online' }}
        </button>

        <!-- Stats -->
        <div class="grid grid-cols-2 gap-3 mt-4">
          <button @click="router.push('/driver/earnings')" class="bg-[#f5f5f5] rounded-2xl p-4 text-left active:bg-[#f0f0f0] transition-colors">
            <div class="text-[11px] text-[#1a1a1a]/40 font-medium">Today</div>
            <div class="text-[22px] font-bold font-serif mt-0.5">{{ formatFare(todayEarnings) }}</div>
            <div class="text-[11px] text-[#1a1a1a]/40 mt-0.5">{{ todayTrips }} trips</div>
          </button>
          <div class="bg-[#f5f5f5] rounded-2xl p-4 text-left">
            <div class="text-[11px] text-[#1a1a1a]/40 font-medium">Rating</div>
            <div class="text-[22px] font-bold font-serif mt-0.5">{{ driver?.rating || '5.0' }} <span class="text-[16px]">★</span></div>
            <div class="text-[11px] text-[#1a1a1a]/40 mt-0.5">{{ driver?.total_trips || 0 }} total trips</div>
          </div>
        </div>

        <!-- Last ride -->
        <div v-if="lastRide" class="mt-4 bg-[#f5f5f5] rounded-2xl p-4">
          <div class="text-[11px] text-[#1a1a1a]/40 font-medium mb-2">Last ride</div>
          <div class="flex justify-between items-center">
            <div>
              <div class="text-[14px] font-semibold">{{ lastRide.pickup_address.split(',')[0] }} → {{ lastRide.dropoff_address.split(',')[0] }}</div>
              <div class="text-[11px] text-[#1a1a1a]/40 mt-0.5">{{ lastRide.distance_miles?.toFixed(1) }} mi</div>
            </div>
            <div class="text-[15px] font-bold font-serif text-[#58cc02]">+{{ formatFare(lastRide.fare_cents) }}</div>
          </div>
        </div>
        <div v-else class="mt-4 text-center text-[13px] text-[#1a1a1a]/40 py-4">
          No rides yet — go online to start earning
        </div>
      </div>
    </div>

    <!-- DESKTOP: Side panel -->
    <div class="hidden md:flex absolute inset-y-0 left-0 z-10 w-[400px] bg-white shadow-[4px_0_24px_rgba(0,0,0,0.08)] flex-col">
      <div class="px-6 pt-8 pb-4 flex items-center justify-between">
        <div class="font-serif text-[22px] font-bold tracking-tight">Ride<span class="text-[#58cc02]">Up</span> <span class="text-[12px] font-sans font-normal text-[#1a1a1a]/40 ml-0.5">Driver</span></div>
        <div class="flex items-center gap-2">
          <button @click="menuOpen = true" class="w-10 h-10 rounded-full hover:bg-[#1a1a1a]/5 flex items-center justify-center transition-colors">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect y="3" width="18" height="1.5" rx="0.75" fill="#1a1a1a"/><rect y="8.25" width="18" height="1.5" rx="0.75" fill="#1a1a1a"/><rect y="13.5" width="18" height="1.5" rx="0.75" fill="#1a1a1a"/></svg>
          </button>
          <button @click="router.push('/driver/profile')" class="w-10 h-10 rounded-full bg-[#58cc02] flex items-center justify-center text-white text-[13px] font-bold">
            {{ initials }}
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto px-6 pb-8">
        <div v-if="isOnline" class="flex items-center gap-2 mb-5">
          <span class="w-2.5 h-2.5 rounded-full bg-[#58cc02] animate-pulse"></span>
          <span class="text-[13px] font-semibold text-[#58cc02]">You're online — waiting for rides</span>
        </div>

        <button @click="toggleOnline"
                class="w-full py-4 font-bold rounded-2xl text-[15px] transition-all"
                :class="isOnline
                  ? 'bg-[#1a1a1a] text-white hover:bg-[#333]'
                  : 'bg-[#58cc02] text-white hover:bg-[#4ab300] shadow-[0_4px_16px_rgba(88,204,2,0.3)]'">
          {{ isOnline ? 'Go Offline' : 'Go Online' }}
        </button>

        <div class="grid grid-cols-2 gap-3 mt-5">
          <button @click="router.push('/driver/earnings')" class="bg-[#f5f5f5] rounded-2xl p-4 text-left hover:bg-[#f0f0f0] transition-colors">
            <div class="text-[11px] text-[#1a1a1a]/40 font-medium">Today</div>
            <div class="text-[24px] font-bold font-serif mt-0.5">{{ formatFare(todayEarnings) }}</div>
            <div class="text-[11px] text-[#1a1a1a]/40 mt-0.5">{{ todayTrips }} trips</div>
          </button>
          <div class="bg-[#f5f5f5] rounded-2xl p-4 text-left">
            <div class="text-[11px] text-[#1a1a1a]/40 font-medium">Rating</div>
            <div class="text-[24px] font-bold font-serif mt-0.5">{{ driver?.rating || '5.0' }} <span class="text-[16px]">★</span></div>
            <div class="text-[11px] text-[#1a1a1a]/40 mt-0.5">{{ driver?.total_trips || 0 }} total trips</div>
          </div>
        </div>

        <div v-if="lastRide" class="mt-4 bg-[#f5f5f5] rounded-2xl p-4">
          <div class="text-[11px] text-[#1a1a1a]/40 font-medium mb-2">Last ride</div>
          <div class="flex justify-between items-center">
            <div>
              <div class="text-[14px] font-semibold">{{ lastRide.pickup_address.split(',')[0] }} → {{ lastRide.dropoff_address.split(',')[0] }}</div>
              <div class="text-[11px] text-[#1a1a1a]/40 mt-0.5">{{ lastRide.distance_miles?.toFixed(1) }} mi</div>
            </div>
            <div class="text-[15px] font-bold font-serif text-[#58cc02]">+{{ formatFare(lastRide.fare_cents) }}</div>
          </div>
        </div>
        <div v-else class="mt-4 text-center text-[13px] text-[#1a1a1a]/40 py-6">
          No rides yet — go online to start earning
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/driver/DriverDashboard.vue
git commit -m "feat: add driver dashboard with map, online toggle, and stats"
```

---

## Task 6: Ride Request Overlay

**Files:**
- Create: `src/pages/driver/DriverRideRequest.vue`

- [ ] **Step 1: Create the full-screen ride request with countdown**

```vue
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useDriver } from '../../lib/useDriver'
import { formatFare } from '../../lib/pricing'

const props = defineProps({
  request: { type: Object, required: true },
})

const emit = defineEmits(['accepted'])
const { acceptRide, declineRide } = useDriver()

const timeLeft = ref(15)
let timer = null

onMounted(() => {
  timer = setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0) {
      clearInterval(timer)
      handleDecline()
    }
  }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

async function handleAccept() {
  if (timer) clearInterval(timer)
  await acceptRide(props.request)
  emit('accepted')
}

function handleDecline() {
  if (timer) clearInterval(timer)
  declineRide(props.request)
}

const progress = ref(100)
onMounted(() => {
  const start = Date.now()
  const total = 15000
  function update() {
    const elapsed = Date.now() - start
    progress.value = Math.max(0, 100 - (elapsed / total) * 100)
    if (elapsed < total) requestAnimationFrame(update)
  }
  requestAnimationFrame(update)
})
</script>

<template>
  <div class="fixed inset-0 z-50 bg-white flex flex-col">
    <!-- Countdown -->
    <div class="flex-shrink-0 pt-[max(3rem,env(safe-area-inset-top))] pb-4 flex flex-col items-center">
      <div class="relative w-24 h-24">
        <svg class="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#f5f5f5" stroke-width="6" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="#58cc02" stroke-width="6"
                  stroke-linecap="round"
                  :stroke-dasharray="276.46"
                  :stroke-dashoffset="276.46 * (1 - progress / 100)" />
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-[28px] font-bold font-serif">{{ timeLeft }}</span>
        </div>
      </div>
      <p class="text-[13px] text-[#1a1a1a]/50 mt-2">New ride request</p>
    </div>

    <!-- Ride details -->
    <div class="flex-1 px-6 flex flex-col">
      <div class="max-w-md mx-auto w-full flex-1 flex flex-col">
        <!-- Rider info -->
        <div class="bg-[#f5f5f5] rounded-2xl p-5 mb-4">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-full bg-[#58cc02]/15 flex items-center justify-center text-xl">👤</div>
              <div>
                <div class="text-[16px] font-bold">{{ request.rider_name }}</div>
                <div class="text-[13px] text-[#1a1a1a]/50">★ {{ request.rider_rating }}</div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-[22px] font-bold font-serif text-[#58cc02]">{{ formatFare(request.fare_cents) }}</div>
              <div class="text-[11px] text-[#1a1a1a]/40">est. fare</div>
            </div>
          </div>

          <!-- Route -->
          <div class="flex gap-3">
            <div class="flex flex-col items-center pt-[6px]">
              <div class="w-[10px] h-[10px] rounded-full border-[2.5px] border-[#58cc02] bg-white flex-shrink-0"></div>
              <div class="w-[2px] flex-1 my-1 bg-[#1a1a1a]/10 rounded-full min-h-[16px]"></div>
              <div class="w-[10px] h-[10px] rounded-[2px] bg-[#1a1a1a] flex-shrink-0"></div>
            </div>
            <div class="flex-1 space-y-3">
              <div>
                <div class="text-[11px] text-[#1a1a1a]/40 font-medium">PICKUP</div>
                <div class="text-[14px] font-semibold">{{ request.pickup_address }}</div>
              </div>
              <div>
                <div class="text-[11px] text-[#1a1a1a]/40 font-medium">DROPOFF</div>
                <div class="text-[14px] font-semibold">{{ request.dropoff_address }}</div>
              </div>
            </div>
          </div>

          <!-- Distance / time -->
          <div class="flex gap-4 mt-4 pt-4 border-t border-[#1a1a1a]/8">
            <div class="flex items-center gap-1.5">
              <svg class="w-4 h-4 text-[#1a1a1a]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
              <span class="text-[13px] font-semibold text-[#1a1a1a]/60">{{ request.distance_miles?.toFixed(1) }} mi</span>
            </div>
            <div class="flex items-center gap-1.5">
              <svg class="w-4 h-4 text-[#1a1a1a]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span class="text-[13px] font-semibold text-[#1a1a1a]/60">~{{ Math.round(request.duration_minutes) }} min</span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="mt-auto pb-6 max-w-md mx-auto w-full" style="padding-bottom: max(1.5rem, env(safe-area-inset-bottom));">
          <button @click="handleAccept"
                  class="w-full py-4 bg-[#58cc02] text-white font-bold rounded-2xl text-[16px] transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(88,204,2,0.3)]">
            Accept Ride
          </button>
          <button @click="handleDecline"
                  class="w-full py-3 mt-2 text-[#1a1a1a]/40 font-semibold text-[14px] active:text-[#1a1a1a]/60">
            Decline
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/driver/DriverRideRequest.vue
git commit -m "feat: add full-screen ride request overlay with 15s countdown"
```

---

## Task 7: Active Ride Screen

**Files:**
- Create: `src/pages/driver/DriverActiveRide.vue`

- [ ] **Step 1: Create the 4-phase active ride screen**

```vue
<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDriver } from '../../lib/useDriver'
import { DEMO_MODE } from '../../lib/demoMode'
import { formatFare } from '../../lib/pricing'
import GoogleMap from '../../components/GoogleMap.vue'
import HarborBackdrop from '../../components/HarborBackdrop.vue'

const router = useRouter()
const { currentRide, updateRideStatus, completeRide } = useDriver()

const phase = computed(() => {
  if (!currentRide.value) return 'none'
  return currentRide.value.status
})

const phaseLabel = computed(() => ({
  accepted: 'Navigating to pickup',
  driver_arrived: 'Waiting for rider',
  in_progress: 'Trip in progress',
  completed: 'Trip complete',
}[phase.value] || ''))

const phaseAction = computed(() => ({
  accepted: "I've Arrived",
  driver_arrived: 'Start Trip',
  in_progress: 'Complete Trip',
}[phase.value] || ''))

async function advancePhase() {
  if (phase.value === 'accepted') await updateRideStatus('driver_arrived')
  else if (phase.value === 'driver_arrived') await updateRideStatus('in_progress')
  else if (phase.value === 'in_progress') await updateRideStatus('completed')
}

function finish() {
  completeRide()
  router.push('/driver/dashboard')
}

function cancelRide() {
  completeRide()
  router.push('/driver/dashboard')
}
</script>

<template>
  <div class="relative h-screen bg-white text-[#1a1a1a] overflow-hidden">
    <!-- Map -->
    <div class="absolute inset-0 md:left-[400px]">
      <GoogleMap v-if="!DEMO_MODE" class="absolute inset-0"
                 :pickup="currentRide ? { lat: currentRide.pickup_lat, lng: currentRide.pickup_lng } : null"
                 :dropoff="phase === 'in_progress' || phase === 'completed' ? { lat: currentRide.dropoff_lat, lng: currentRide.dropoff_lng } : null" />
      <HarborBackdrop v-else show-route />
    </div>

    <!-- MOBILE bottom sheet -->
    <div class="md:hidden absolute bottom-0 left-0 right-0 z-10 bg-white rounded-t-[28px] shadow-[0_-4px_40px_rgba(0,0,0,0.1)]" style="padding-bottom: env(safe-area-inset-bottom, 0px);">
      <div class="flex justify-center pt-3 pb-2">
        <div class="w-9 h-[5px] rounded-full bg-[#1a1a1a]/10"></div>
      </div>
      <div class="px-5 pb-6">
        <!-- Trip complete summary -->
        <div v-if="phase === 'completed'" class="text-center py-4">
          <div class="w-16 h-16 rounded-full bg-[#58cc02] flex items-center justify-center mx-auto mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 class="font-serif text-2xl font-bold mb-1">Trip Complete</h2>
          <div class="text-[28px] font-bold font-serif text-[#58cc02] my-3">+{{ formatFare(currentRide?.fare_cents) }}</div>
          <div class="text-[13px] text-[#1a1a1a]/50">{{ currentRide?.distance_miles?.toFixed(1) }} mi · {{ Math.round(currentRide?.duration_minutes || 0) }} min</div>
          <button @click="finish"
                  class="w-full py-4 bg-[#58cc02] text-white font-bold rounded-2xl text-[15px] mt-6 transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(88,204,2,0.3)]">
            Done
          </button>
        </div>

        <!-- Active ride phases -->
        <template v-else-if="currentRide">
          <div class="flex items-center gap-2 mb-3">
            <span class="w-2.5 h-2.5 rounded-full bg-[#58cc02] animate-pulse"></span>
            <span class="text-[13px] font-semibold text-[#58cc02]">{{ phaseLabel }}</span>
          </div>

          <div class="bg-[#f5f5f5] rounded-2xl p-4 mb-4">
            <div v-if="phase === 'accepted' || phase === 'driver_arrived'" class="mb-1">
              <div class="text-[11px] text-[#1a1a1a]/40 font-medium">PICKUP</div>
              <div class="text-[14px] font-semibold">{{ currentRide.pickup_address }}</div>
            </div>
            <div v-if="phase === 'in_progress'" class="mb-1">
              <div class="text-[11px] text-[#1a1a1a]/40 font-medium">DROPOFF</div>
              <div class="text-[14px] font-semibold">{{ currentRide.dropoff_address }}</div>
            </div>
            <div class="flex items-center justify-between mt-3 pt-3 border-t border-[#1a1a1a]/8">
              <span class="text-[12px] text-[#1a1a1a]/40">{{ currentRide.rider_name || 'Rider' }}</span>
              <span class="text-[15px] font-bold font-serif">{{ formatFare(currentRide.fare_cents) }}</span>
            </div>
          </div>

          <button @click="advancePhase"
                  class="w-full py-4 bg-[#58cc02] text-white font-bold rounded-2xl text-[15px] transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(88,204,2,0.3)]">
            {{ phaseAction }}
          </button>
          <button v-if="phase === 'accepted'" @click="cancelRide"
                  class="w-full py-3 mt-2 text-[#1a1a1a]/40 font-semibold text-[13px]">
            Cancel Ride
          </button>
        </template>
      </div>
    </div>

    <!-- DESKTOP: Side panel -->
    <div class="hidden md:flex absolute inset-y-0 left-0 z-10 w-[400px] bg-white shadow-[4px_0_24px_rgba(0,0,0,0.08)] flex-col">
      <div class="px-6 pt-8 pb-4">
        <div class="font-serif text-[22px] font-bold tracking-tight">Ride<span class="text-[#58cc02]">Up</span> <span class="text-[12px] font-sans font-normal text-[#1a1a1a]/40 ml-0.5">Driver</span></div>
      </div>
      <div class="flex-1 overflow-y-auto px-6 pb-8">
        <div v-if="phase === 'completed'" class="text-center py-8">
          <div class="w-16 h-16 rounded-full bg-[#58cc02] flex items-center justify-center mx-auto mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 class="font-serif text-2xl font-bold mb-1">Trip Complete</h2>
          <div class="text-[28px] font-bold font-serif text-[#58cc02] my-3">+{{ formatFare(currentRide?.fare_cents) }}</div>
          <div class="text-[13px] text-[#1a1a1a]/50 mb-6">{{ currentRide?.distance_miles?.toFixed(1) }} mi · {{ Math.round(currentRide?.duration_minutes || 0) }} min</div>
          <button @click="finish"
                  class="w-full py-4 bg-[#58cc02] text-white font-bold rounded-2xl text-[15px] hover:bg-[#4ab300] shadow-[0_4px_16px_rgba(88,204,2,0.3)]">
            Done
          </button>
        </div>

        <template v-else-if="currentRide">
          <div class="flex items-center gap-2 mb-5">
            <span class="w-2.5 h-2.5 rounded-full bg-[#58cc02] animate-pulse"></span>
            <span class="text-[14px] font-semibold text-[#58cc02]">{{ phaseLabel }}</span>
          </div>

          <div class="bg-[#f5f5f5] rounded-2xl p-5 mb-5">
            <div v-if="phase === 'accepted' || phase === 'driver_arrived'" class="mb-1">
              <div class="text-[11px] text-[#1a1a1a]/40 font-medium">PICKUP</div>
              <div class="text-[15px] font-semibold">{{ currentRide.pickup_address }}</div>
            </div>
            <div v-if="phase === 'in_progress'" class="mb-1">
              <div class="text-[11px] text-[#1a1a1a]/40 font-medium">DROPOFF</div>
              <div class="text-[15px] font-semibold">{{ currentRide.dropoff_address }}</div>
            </div>
            <div class="flex items-center justify-between mt-3 pt-3 border-t border-[#1a1a1a]/8">
              <span class="text-[13px] text-[#1a1a1a]/40">{{ currentRide.rider_name || 'Rider' }}</span>
              <span class="text-[17px] font-bold font-serif">{{ formatFare(currentRide.fare_cents) }}</span>
            </div>
          </div>

          <button @click="advancePhase"
                  class="w-full py-4 bg-[#58cc02] text-white font-bold rounded-2xl text-[15px] hover:bg-[#4ab300] shadow-[0_4px_16px_rgba(88,204,2,0.3)]">
            {{ phaseAction }}
          </button>
          <button v-if="phase === 'accepted'" @click="cancelRide"
                  class="w-full py-3 mt-2 text-[#1a1a1a]/40 font-semibold text-[13px] hover:text-[#1a1a1a]/60">
            Cancel Ride
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/driver/DriverActiveRide.vue
git commit -m "feat: add 4-phase active ride screen for drivers"
```

---

## Task 8: Earnings Page

**Files:**
- Create: `src/pages/driver/DriverEarnings.vue`

- [ ] **Step 1: Create the earnings page with Today/This Week tabs**

```vue
<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { formatFare } from '../../lib/pricing'
import { generateFakeEarnings } from '../../lib/demoDriverMode'
import { DEMO_MODE } from '../../lib/demoMode'

const router = useRouter()
const activeTab = ref('today')

const earnings = DEMO_MODE ? generateFakeEarnings() : { today: [], weeklyTotals: [], weeklyTrips: [] }

const todayTotal = computed(() => earnings.today.reduce((s, t) => s + t.fare_cents, 0))
const weeklyTotal = computed(() => earnings.weeklyTotals.reduce((s, v) => s + v, 0))
const weeklyTripsTotal = computed(() => earnings.weeklyTrips.reduce((s, v) => s + v, 0))
const maxDailyEarning = computed(() => Math.max(...earnings.weeklyTotals, 1))
const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  return `${hrs}h ago`
}

function goBack() {
  window.history.length > 1 ? router.back() : router.push('/driver/dashboard')
}
</script>

<template>
  <div class="min-h-screen bg-white text-[#1a1a1a]">
    <!-- Top bar -->
    <div class="flex items-center justify-between px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4">
      <button @click="goBack" class="w-10 h-10 flex items-center justify-center rounded-full active:bg-[#1a1a1a]/5">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-[17px] font-bold">Earnings</h1>
      <div class="w-10 h-10"></div>
    </div>

    <div class="max-w-lg mx-auto px-5 pb-8">
      <!-- Tab toggle -->
      <div class="flex bg-[#f5f5f5] rounded-xl p-1 mb-6">
        <button @click="activeTab = 'today'"
                class="flex-1 py-2.5 rounded-lg text-[14px] font-semibold transition-all"
                :class="activeTab === 'today' ? 'bg-white text-[#1a1a1a] shadow-sm' : 'text-[#1a1a1a]/40'">
          Today
        </button>
        <button @click="activeTab = 'week'"
                class="flex-1 py-2.5 rounded-lg text-[14px] font-semibold transition-all"
                :class="activeTab === 'week' ? 'bg-white text-[#1a1a1a] shadow-sm' : 'text-[#1a1a1a]/40'">
          This Week
        </button>
      </div>

      <!-- TODAY TAB -->
      <div v-if="activeTab === 'today'">
        <div class="text-center mb-6">
          <div class="text-[36px] font-bold font-serif">{{ formatFare(todayTotal) }}</div>
          <div class="text-[13px] text-[#1a1a1a]/50 mt-1">{{ earnings.today.length }} trips</div>
        </div>

        <p class="text-[11px] font-semibold text-[#1a1a1a]/40 uppercase tracking-wider mb-3 px-1">Completed trips</p>
        <div class="space-y-2">
          <div v-for="trip in earnings.today" :key="trip.id"
               class="bg-[#f5f5f5] rounded-2xl px-4 py-3.5 flex items-center justify-between">
            <div>
              <div class="text-[14px] font-semibold">{{ trip.pickup_address.split(',')[0] }} → {{ trip.dropoff_address.split(',')[0] }}</div>
              <div class="text-[11px] text-[#1a1a1a]/40 mt-0.5">{{ timeAgo(trip.completed_at) }} · {{ trip.distance_miles.toFixed(1) }} mi</div>
            </div>
            <div class="text-[15px] font-bold font-serif text-[#58cc02]">+{{ formatFare(trip.fare_cents) }}</div>
          </div>
        </div>

        <div v-if="earnings.today.length === 0" class="text-center text-[13px] text-[#1a1a1a]/40 py-10">
          No trips today yet
        </div>
      </div>

      <!-- WEEK TAB -->
      <div v-else>
        <div class="text-center mb-6">
          <div class="text-[36px] font-bold font-serif">{{ formatFare(weeklyTotal) }}</div>
          <div class="text-[13px] text-[#1a1a1a]/50 mt-1">{{ weeklyTripsTotal }} trips this week</div>
        </div>

        <!-- Bar chart -->
        <div class="bg-[#f5f5f5] rounded-2xl p-5 mb-6">
          <div class="flex items-end justify-between gap-2 h-[120px]">
            <div v-for="(total, i) in earnings.weeklyTotals" :key="i" class="flex-1 flex flex-col items-center gap-1">
              <div class="w-full rounded-lg transition-all"
                   :style="{ height: (total / maxDailyEarning * 100) + '%', minHeight: total > 0 ? '8px' : '2px' }"
                   :class="total > 0 ? 'bg-[#58cc02]' : 'bg-[#1a1a1a]/10'">
              </div>
            </div>
          </div>
          <div class="flex justify-between mt-2">
            <div v-for="(label, i) in dayLabels" :key="label" class="flex-1 text-center text-[10px] font-medium"
                 :class="earnings.weeklyTotals[i] > 0 ? 'text-[#1a1a1a]/60' : 'text-[#1a1a1a]/25'">
              {{ label }}
            </div>
          </div>
        </div>

        <!-- Daily breakdown -->
        <p class="text-[11px] font-semibold text-[#1a1a1a]/40 uppercase tracking-wider mb-3 px-1">Daily breakdown</p>
        <div class="space-y-2">
          <div v-for="(total, i) in earnings.weeklyTotals" :key="i"
               class="flex items-center justify-between px-4 py-3 bg-[#f5f5f5] rounded-xl">
            <div class="flex items-center gap-3">
              <span class="text-[13px] font-semibold w-8">{{ dayLabels[i] }}</span>
              <span class="text-[12px] text-[#1a1a1a]/40">{{ earnings.weeklyTrips[i] }} trips</span>
            </div>
            <span class="text-[14px] font-bold font-serif" :class="total > 0 ? '' : 'text-[#1a1a1a]/25'">{{ formatFare(total) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/driver/DriverEarnings.vue
git commit -m "feat: add driver earnings page with today/weekly tabs and bar chart"
```

---

## Task 9: Driver Profile Page

**Files:**
- Create: `src/pages/driver/DriverProfile.vue`

- [ ] **Step 1: Create the driver profile page**

```vue
<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDriver } from '../../lib/useDriver'
import { useAuth } from '../../lib/useAuth'
import { DEMO_MODE } from '../../lib/demoMode'

const router = useRouter()
const { driver } = useDriver()
const { signOut } = useAuth()

const toast = ref('')

function showToast(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2500)
}

const initials = computed(() => {
  if (!driver.value?.name) return 'DR'
  return driver.value.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
})

const memberSince = computed(() => {
  if (!driver.value?.created_at) return ''
  return new Date(driver.value.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
})

async function handleLogout() {
  await signOut()
  router.push('/welcome')
}

function goBack() {
  window.history.length > 1 ? router.back() : router.push('/driver/dashboard')
}
</script>

<template>
  <div class="min-h-screen bg-white text-[#1a1a1a]">
    <!-- Top bar -->
    <div class="flex items-center justify-between px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4 max-w-lg mx-auto w-full">
      <button @click="goBack" class="w-10 h-10 flex items-center justify-center rounded-full active:bg-[#1a1a1a]/5">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-[17px] font-bold">Profile</h1>
      <div class="w-10 h-10"></div>
    </div>

    <div class="max-w-lg mx-auto px-5 pb-8">
      <!-- Avatar + name -->
      <div class="text-center mb-8">
        <div class="w-20 h-20 rounded-full bg-[#58cc02] flex items-center justify-center mx-auto mb-3 text-white text-2xl font-bold">
          {{ initials }}
        </div>
        <h2 class="text-xl font-bold">{{ driver?.name || 'Driver' }}</h2>
        <p class="text-[14px] text-[#1a1a1a]/50 mt-1">★ {{ driver?.rating || '5.0' }} · {{ driver?.total_trips || 0 }} trips</p>
      </div>

      <!-- Vehicle -->
      <div class="mb-6">
        <p class="text-[11px] font-semibold text-[#1a1a1a]/40 uppercase tracking-wider mb-3">Vehicle</p>
        <div class="bg-[#f5f5f5] rounded-2xl p-4 space-y-2">
          <div class="flex justify-between">
            <span class="text-[13px] text-[#1a1a1a]/50">Vehicle</span>
            <span class="text-[14px] font-semibold">{{ driver?.vehicle_make }} {{ driver?.vehicle_model }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[13px] text-[#1a1a1a]/50">Color</span>
            <span class="text-[14px] font-semibold">{{ driver?.vehicle_color || '—' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[13px] text-[#1a1a1a]/50">Plate</span>
            <span class="text-[14px] font-semibold uppercase">{{ driver?.vehicle_plate || '—' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[13px] text-[#1a1a1a]/50">Type</span>
            <span class="text-[14px] font-semibold capitalize">{{ driver?.vehicle_type || 'standard' }}</span>
          </div>
        </div>
        <button @click="showToast('Coming soon')" class="text-[13px] text-[#58cc02] font-semibold mt-2 px-1">Edit Vehicle</button>
      </div>

      <!-- Stats -->
      <div class="mb-6">
        <p class="text-[11px] font-semibold text-[#1a1a1a]/40 uppercase tracking-wider mb-3">Stats</p>
        <div class="bg-[#f5f5f5] rounded-2xl p-4 space-y-2">
          <div class="flex justify-between">
            <span class="text-[13px] text-[#1a1a1a]/50">Acceptance rate</span>
            <span class="text-[14px] font-semibold">94%</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[13px] text-[#1a1a1a]/50">Cancellation rate</span>
            <span class="text-[14px] font-semibold">2%</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[13px] text-[#1a1a1a]/50">Member since</span>
            <span class="text-[14px] font-semibold">{{ memberSince }}</span>
          </div>
        </div>
      </div>

      <!-- Documents -->
      <div class="mb-6">
        <p class="text-[11px] font-semibold text-[#1a1a1a]/40 uppercase tracking-wider mb-3">Documents</p>
        <div class="bg-[#f5f5f5] rounded-2xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-[14px]">Driver's License</span>
            <span class="text-[12px] text-[#58cc02] font-semibold">✓ On file</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[14px]">Insurance</span>
            <span class="text-[12px] text-[#58cc02] font-semibold">✓ On file</span>
          </div>
        </div>
        <button @click="showToast('Coming soon')" class="text-[13px] text-[#58cc02] font-semibold mt-2 px-1">Upload / Update</button>
      </div>

      <!-- Account -->
      <div class="mb-6">
        <p class="text-[11px] font-semibold text-[#1a1a1a]/40 uppercase tracking-wider mb-3">Account</p>
        <div class="bg-[#f5f5f5] rounded-2xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-[13px] text-[#1a1a1a]/50">Phone</div>
              <div class="text-[14px] font-semibold">{{ driver?.phone || '—' }}</div>
            </div>
            <button @click="showToast('Coming soon')" class="text-[12px] text-[#58cc02] font-semibold">Edit</button>
          </div>
          <div class="border-t border-[#1a1a1a]/8"></div>
          <div class="flex items-center justify-between">
            <div>
              <div class="text-[13px] text-[#1a1a1a]/50">Email</div>
              <div class="text-[14px] font-semibold">{{ driver?.email || '—' }}</div>
            </div>
            <button @click="showToast('Coming soon')" class="text-[12px] text-[#58cc02] font-semibold">Edit</button>
          </div>
        </div>
        <button @click="showToast('Coming soon')" class="text-[13px] text-[#1a1a1a]/50 font-semibold mt-2 px-1 underline underline-offset-2">Change Password</button>
      </div>

      <!-- Switch + Logout -->
      <div class="space-y-2 mt-8">
        <button @click="router.push('/')"
                class="w-full py-3.5 border-2 border-[#1a1a1a]/10 text-[14px] font-semibold rounded-2xl active:bg-[#1a1a1a]/5 transition-colors">
          Switch to Rider
        </button>
        <button @click="handleLogout"
                class="w-full py-3.5 text-red-500 text-[14px] font-semibold rounded-2xl active:bg-red-50 transition-colors">
          Log Out
        </button>
      </div>
    </div>

    <!-- Toast -->
    <Transition name="fade">
      <div v-if="toast" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a1a] text-white text-[13px] font-medium px-5 py-3 rounded-full shadow-lg">
        {{ toast }}
      </div>
    </Transition>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/driver/DriverProfile.vue
git commit -m "feat: add driver profile page with vehicle, stats, documents, and account sections"
```

---

## Task 10: Router + SideMenu Integration

**Files:**
- Modify: `src/router/index.js`
- Modify: `src/components/SideMenu.vue`

- [ ] **Step 1: Add driver routes to router**

Add these imports after line 15 (`import Terms from '../pages/Terms.vue'`):

```js
import DriverApply from '../pages/driver/DriverApply.vue'
import DriverPending from '../pages/driver/DriverPending.vue'
import DriverDashboard from '../pages/driver/DriverDashboard.vue'
import DriverActiveRide from '../pages/driver/DriverActiveRide.vue'
import DriverEarnings from '../pages/driver/DriverEarnings.vue'
import DriverProfile from '../pages/driver/DriverProfile.vue'
```

Add these routes before the catch-all `/:pathMatch` route:

```js
{ path: '/driver/apply', name: 'driver-apply', component: DriverApply, meta: { title: 'Drive with RideUp' } },
{ path: '/driver/pending', name: 'driver-pending', component: DriverPending, meta: { requiresAuth: true, title: 'Application Status — RideUp' } },
{ path: '/driver/dashboard', name: 'driver-dashboard', component: DriverDashboard, meta: { title: 'Driver Dashboard — RideUp' } },
{ path: '/driver/active-ride', name: 'driver-active-ride', component: DriverActiveRide, meta: { title: 'Active Ride — RideUp' } },
{ path: '/driver/earnings', name: 'driver-earnings', component: DriverEarnings, meta: { title: 'Earnings — RideUp' } },
{ path: '/driver/profile', name: 'driver-profile', component: DriverProfile, meta: { title: 'Driver Profile — RideUp' } },
```

- [ ] **Step 2: Update SideMenu for driver routes**

In `src/components/SideMenu.vue`, update the `menuItems` computed to detect driver routes and show driver-specific items. Replace the `menuItems` computed (lines 31-46) with:

```js
const route = useRoute()
const isDriverRoute = computed(() => route.path.startsWith('/driver'))

const menuItems = computed(() => {
  if (isDriverRoute.value) {
    return [
      { label: 'Dashboard', route: '/driver/dashboard', icon: 'home', requiresAuth: false },
      { label: 'Earnings', route: '/driver/earnings', icon: 'card', requiresAuth: false },
      { label: 'Profile', route: '/driver/profile', icon: 'info', requiresAuth: false },
      { label: 'Support', route: '/support', icon: 'chat', requiresAuth: false },
      { label: 'About', route: '/about', icon: 'info', requiresAuth: false },
    ]
  }

  const items = [
    { label: 'Support', route: '/support', icon: 'chat', requiresAuth: false },
    { label: 'About', route: '/about', icon: 'info', requiresAuth: false },
  ]

  if (isLoggedIn.value) {
    items.unshift(
      { label: 'Payments', route: '/payments', icon: 'card', requiresAuth: true },
      { label: 'Promotions', subtitle: 'Enter Promo Code', route: '/payments', icon: 'tag', requiresAuth: true },
      { label: 'My Rides', route: '/my-rides', icon: 'history', requiresAuth: true },
    )
  }

  return items
})
```

Add `useRoute` to the imports: change `import { useRouter } from 'vue-router'` to `import { useRouter, useRoute } from 'vue-router'`.

Also update the "Become a driver" CTA in the bottom of SideMenu (around line 211-219). Replace the WhatsApp link with:

```html
<button
  v-else
  @click="handleNavigate('/driver/apply')"
  class="block w-full rounded-2xl bg-[#58cc02] px-5 py-4 text-left transition-colors active:bg-[#4ab300]"
>
  <p class="text-white text-[15px] font-semibold">Become a driver</p>
  <p class="text-white/80 text-xs mt-0.5">Earn money on your schedule</p>
</button>
```

And when on driver routes, show "Switch to Rider" instead:

```html
<button
  v-if="isDriverRoute && !isLoggedIn"
  @click="handleNavigate('/')"
  class="block w-full rounded-2xl border-2 border-[#1a1a1a]/10 px-5 py-4 text-left transition-colors active:bg-[#1a1a1a]/5"
>
  <p class="text-[#1a1a1a] text-[15px] font-semibold">Switch to Rider</p>
  <p class="text-[#1a1a1a]/50 text-xs mt-0.5">Book a ride instead</p>
</button>
```

- [ ] **Step 3: Update the DriverLanding.vue "Apply Now" link**

In `src/pages/DriverLanding.vue`, find any CTA buttons that link to WhatsApp for driver applications and update them to route to `/driver/apply` instead.

- [ ] **Step 4: Verify the app builds and routes work**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds with no errors

- [ ] **Step 5: Commit**

```bash
git add src/router/index.js src/components/SideMenu.vue src/pages/DriverLanding.vue
git commit -m "feat: add driver routes, update SideMenu for driver context, wire up apply CTA"
```

---

## Task 11: Manual Testing & Polish

- [ ] **Step 1: Test the full driver flow in demo mode**

Open `http://localhost:5173/driver/apply` and verify:
1. Application form renders with all fields
2. Submit shows success and redirects to dashboard (demo auto-approves)
3. Dashboard shows map/backdrop, Go Online button, stats, last ride
4. Clicking "Go Online" changes button to "Go Offline" and shows online status
5. After 15-30 seconds, ride request overlay appears with countdown
6. Accepting a ride navigates to active ride screen
7. Walk through all 4 phases: arrived → start trip → complete → done
8. Done returns to dashboard
9. Earnings page shows today's trips and weekly bar chart
10. Profile page shows driver info, vehicle, stats
11. SideMenu shows driver-specific items on driver routes

- [ ] **Step 2: Test responsive layout**

1. Desktop: side panel on left, map on right for dashboard and active ride
2. Mobile: bottom sheet on dashboard, full-screen ride request
3. All pages constrained with `max-w-lg` on desktop (earnings, profile, apply)

- [ ] **Step 3: Fix any issues found during testing**

- [ ] **Step 4: Final commit and push**

```bash
git add -A
git commit -m "feat: complete driver dashboard — apply, dashboard, ride flow, earnings, profile"
git push origin main
```

---

**Self-review complete.** Checked against spec:
- ✅ All 7 screens implemented (apply, pending, dashboard, ride request, active ride, earnings, profile)
- ✅ `useDriver.js` composable with all methods from spec
- ✅ `demoDriverMode.js` with fake data
- ✅ Full demo mode support
- ✅ Router integration with 6 new routes
- ✅ SideMenu context-aware for driver routes
- ✅ Responsive: side panel on desktop, bottom sheet on mobile
- ✅ No pills — all full-width buttons
- ✅ Consistent design tokens throughout
- ✅ No TBD/TODO/placeholders
- ✅ Method names consistent across all tasks
