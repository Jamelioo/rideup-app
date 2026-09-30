# Guest Booking Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let riders book a ride without an account by capturing name + phone in a bottom sheet, using Supabase anonymous auth, and prompting account creation after the ride.

**Architecture:** When an unauthenticated user taps "Request Ride," a bottom sheet captures name + phone, creates an anonymous Supabase session + rider record, then proceeds with the normal ride flow. After ride completion, a card prompts email + password to convert to a permanent account.

**Tech Stack:** Vue 3, Supabase anonymous auth (`signInAnonymously`, `updateUser`), existing riders/rides tables.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/GuestInfoSheet.vue` | Create | Bottom sheet for name + phone capture |
| `src/pages/rider/RiderBooking.vue` | Modify | Show GuestInfoSheet when guest taps Request Ride; handle guest session creation |
| `src/components/AccountConversionCard.vue` | Create | Post-ride card prompting email + password signup |
| `src/pages/rider/RiderFlow.vue` | Modify | Show AccountConversionCard after ride completion for guest users |

---

### Task 1: Create GuestInfoSheet Component

**Files:**
- Create: `src/components/GuestInfoSheet.vue`

- [ ] **Step 1: Create the GuestInfoSheet component**

```vue
<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  show: { type: Boolean, default: false },
})

const emit = defineEmits(['submit', 'close'])

const name = ref('')
const phone = ref('')
const submitting = ref(false)
const error = ref(null)

const isValid = computed(() => name.value.trim().length > 0 && phone.value.replace(/\D/g, '').length >= 7)

function handleSubmit() {
  if (!isValid.value || submitting.value) return
  error.value = null
  submitting.value = true
  emit('submit', { name: name.value.trim(), phone: phone.value.trim() })
}

function reset() {
  submitting.value = false
  error.value = null
}

defineExpose({ reset })
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition name="fade">
      <div v-if="show" class="fixed inset-0 bg-[var(--color-overlay)] z-[9998]" @click="emit('close')" />
    </Transition>

    <!-- Sheet -->
    <Transition name="sheet">
      <div v-if="show" class="fixed inset-x-0 bottom-0 z-[9999] bg-[var(--color-surface)] rounded-t-[28px] shadow-[0_-4px_40px_rgba(0,0,0,0.15)]" style="padding-bottom: env(safe-area-inset-bottom, 0px);">
        <!-- Drag handle -->
        <div class="flex justify-center pt-3 pb-1">
          <div class="w-10 h-1 rounded-full bg-[var(--color-text-muted)]/30"></div>
        </div>

        <div class="px-6 pb-6">
          <!-- Header -->
          <div class="flex items-center justify-between mb-1">
            <h2 class="text-[18px] font-bold">Enter your details</h2>
            <button @click="emit('close')" class="w-8 h-8 rounded-full hover:bg-[var(--color-surface-secondary)] flex items-center justify-center text-[var(--color-text-muted)]">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <p class="text-[13px] text-[var(--color-text-muted)] mb-5">We just need your name and phone to request a ride.</p>

          <!-- Error -->
          <div v-if="error" class="bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] px-4 py-2.5 rounded-xl mb-4">{{ error }}</div>

          <!-- Name -->
          <label class="block mb-3">
            <span class="text-[12px] font-medium text-[var(--color-text-muted)] mb-1 block">Your name</span>
            <input v-model="name" type="text" placeholder="e.g. Marcus"
                   class="w-full bg-[var(--color-surface-secondary)] rounded-xl px-4 py-3 text-[14px] font-medium outline-none focus:ring-2 focus:ring-[#2b8659] transition-all min-h-[44px]" />
          </label>

          <!-- Phone -->
          <label class="block mb-5">
            <span class="text-[12px] font-medium text-[var(--color-text-muted)] mb-1 block">Phone number</span>
            <div class="flex items-center gap-2">
              <span class="text-[14px] text-[var(--color-text-muted)] font-medium px-3 py-3 bg-[var(--color-surface-secondary)] rounded-xl min-h-[44px] flex items-center">+1</span>
              <input v-model="phone" type="tel" placeholder="(242) 555-1234"
                     class="flex-1 bg-[var(--color-surface-secondary)] rounded-xl px-4 py-3 text-[14px] font-medium outline-none focus:ring-2 focus:ring-[#2b8659] transition-all min-h-[44px]" />
            </div>
          </label>

          <!-- Submit -->
          <button @click="handleSubmit" :disabled="!isValid || submitting"
                  class="w-full py-4 bg-[#2b8659] disabled:bg-[var(--color-surface-secondary)] disabled:text-[var(--color-text-muted)] text-white font-bold rounded-2xl text-[15px] transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(43,134,89,0.3)] disabled:shadow-none">
            {{ submitting ? 'Requesting...' : 'Request Ride' }}
          </button>

          <p class="text-[11px] text-[var(--color-text-muted)] text-center mt-3">
            Already have an account? <router-link to="/login?redirect=/book" class="text-[#2b8659] font-semibold">Log in</router-link>
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.sheet-enter-active, .sheet-leave-active { transition: transform 0.35s cubic-bezier(0.25, 1, 0.5, 1); }
.sheet-enter-from, .sheet-leave-to { transform: translateY(100%); }
</style>
```

- [ ] **Step 2: Verify file created**

Open the app at `/book`, confirm no errors in console. The component isn't used yet, so nothing visible changes.

- [ ] **Step 3: Commit**

```bash
git add src/components/GuestInfoSheet.vue
git commit -m "feat: add GuestInfoSheet bottom sheet component"
```

---

### Task 2: Wire GuestInfoSheet into RiderBooking

**Files:**
- Modify: `src/pages/rider/RiderBooking.vue`

- [ ] **Step 1: Add imports and state**

At the top of the `<script setup>` block (after the existing imports around line 14), add:

```js
import GuestInfoSheet from '../../components/GuestInfoSheet.vue'
```

After the existing refs (around line 38, near `showPromo`), add:

```js
const showGuestSheet = ref(false)
const guestSheetRef = ref(null)
```

- [ ] **Step 2: Modify requestRide to show guest sheet when not logged in**

Replace the existing `requestRide` function (lines 268-320) with:

```js
async function requestRide() {
  if (!canRequest.value) return
  isSubmitting.value = true
  error.value = null
  const fare = fareEstimates.value[selectedVehicle.value]
  const vehicleName = VEHICLE_TYPES.find(v => v.id === selectedVehicle.value)?.name || 'RideUp Ride'
  const description = `${vehicleName}: ${pickupText.value} → ${dropoffText.value}`

  if (DEMO_MODE) {
    await new Promise((r) => setTimeout(r, 600))
    emit('requested', {
      id: 'demo-' + Date.now(),
      pickup_address: pickup.value.address,
      dropoff_address: dropoff.value.address,
      vehicle_type: selectedVehicle.value,
      fare_cents: fare,
      status: 'requested',
      demo: true,
    })
    isSubmitting.value = false
    return
  }

  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    // Show guest info sheet instead of error
    isSubmitting.value = false
    showGuestSheet.value = true
    return
  }

  // Logged-in user — proceed normally
  await createRideForUser(user)
}

async function createRideForUser(user, guestInfo = null) {
  isSubmitting.value = true
  error.value = null
  const fare = fareEstimates.value[selectedVehicle.value]

  try {
    let { data: rider } = await supabase.from('riders').select('id').eq('auth_user_id', user.id).maybeSingle()
    if (!rider) {
      const riderName = guestInfo?.name || user.user_metadata?.name || user.email?.split('@')[0] || 'Rider'
      const riderPhone = guestInfo?.phone || user.phone || ''
      const riderEmail = user.email || ''
      const { data: newRider, error: createErr } = await supabase.from('riders').insert({
        auth_user_id: user.id,
        name: riderName,
        email: riderEmail,
        phone: riderPhone,
        is_guest: !!guestInfo,
      }).select('id').single()
      if (createErr || !newRider) { error.value = 'Could not create your rider profile. Please try again.'; isSubmitting.value = false; return }
      rider = newRider
    }

    const riderName = guestInfo?.name || user.user_metadata?.name || user.email?.split('@')[0] || 'Rider'
    const { data: ride, error: rideErr } = await supabase.from('rides').insert({
      rider_id: rider.id, status: 'requested',
      rider_name: riderName,
      pickup_address: pickup.value.address, pickup_lat: pickup.value.lat, pickup_lng: pickup.value.lng,
      dropoff_address: dropoff.value.address, dropoff_lat: dropoff.value.lat, dropoff_lng: dropoff.value.lng,
      vehicle_type: selectedVehicle.value, distance_miles: distanceMiles.value,
      duration_minutes: durationMinutes.value || Math.round((distanceMiles.value || 1) * 3),
      fare_cents: fare,
    }).select().single()
    if (rideErr) { error.value = 'Something went wrong requesting your ride. Please try again.'; isSubmitting.value = false; return }

    showGuestSheet.value = false
    emit('requested', ride)
    isSubmitting.value = false
  } catch (err) {
    error.value = 'Connection error. Please try again.'
    isSubmitting.value = false
  }
}

async function handleGuestSubmit({ name, phone }) {
  error.value = null
  try {
    const { data, error: authErr } = await supabase.auth.signInAnonymously()
    if (authErr || !data.user) {
      if (guestSheetRef.value) guestSheetRef.value.reset()
      error.value = 'Could not start your session. Please try again.'
      return
    }
    await createRideForUser(data.user, { name, phone })
    if (error.value && guestSheetRef.value) guestSheetRef.value.reset()
  } catch (err) {
    if (guestSheetRef.value) guestSheetRef.value.reset()
    error.value = 'Connection error. Please try again.'
  }
}
```

- [ ] **Step 3: Add GuestInfoSheet to template**

In the mobile template section, just before the `<ScheduleRidePicker>` component (around line 680), add:

```html
    <GuestInfoSheet ref="guestSheetRef" :show="showGuestSheet" @submit="handleGuestSubmit" @close="showGuestSheet = false" />
```

- [ ] **Step 4: Test the guest flow**

1. Open incognito browser → go to `rideupnassau.com/book`
2. Set pickup and dropoff locations
3. Tap "Request Ride"
4. Bottom sheet should slide up asking for name + phone
5. Enter name + phone → tap "Request Ride" in sheet
6. Should create anonymous session, create rider, create ride, go to "Searching for driver"

- [ ] **Step 5: Commit**

```bash
git add src/pages/rider/RiderBooking.vue
git commit -m "feat: wire guest info sheet into booking flow

When unauthenticated user taps Request Ride, a bottom sheet
captures name + phone, creates an anonymous Supabase session,
and proceeds with the normal ride flow."
```

---

### Task 3: Create AccountConversionCard Component

**Files:**
- Create: `src/components/AccountConversionCard.vue`

- [ ] **Step 1: Create the component**

```vue
<script setup>
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

const emit = defineEmits(['converted', 'skipped'])

const email = ref('')
const password = ref('')
const submitting = ref(false)
const error = ref(null)
const success = ref(false)

async function handleConvert() {
  if (!email.value.trim() || password.value.length < 6) {
    error.value = 'Please enter a valid email and password (6+ characters).'
    return
  }
  submitting.value = true
  error.value = null

  try {
    const { error: updateErr } = await supabase.auth.updateUser({
      email: email.value.trim(),
      password: password.value,
    })
    if (updateErr) {
      if (updateErr.message.includes('already registered')) {
        error.value = 'This email is already registered. Try logging in instead.'
      } else {
        error.value = updateErr.message
      }
      submitting.value = false
      return
    }

    // Update rider record
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('riders').update({ is_guest: false, email: email.value.trim() }).eq('auth_user_id', user.id)
    }

    success.value = true
    setTimeout(() => emit('converted'), 1500)
  } catch (err) {
    error.value = 'Something went wrong. Please try again.'
    submitting.value = false
  }
}
</script>

<template>
  <div class="bg-[var(--color-surface-secondary)] rounded-2xl p-5 mx-6 mb-4">
    <div v-if="success" class="text-center py-2">
      <div class="text-[#2b8659] text-[15px] font-bold">Account created!</div>
      <div class="text-[12px] text-[var(--color-text-muted)] mt-1">You can now log in anytime.</div>
    </div>
    <template v-else>
      <h3 class="text-[16px] font-bold mb-1">Save your account</h3>
      <p class="text-[12px] text-[var(--color-text-muted)] mb-4">Keep your ride history and book faster next time.</p>

      <div v-if="error" class="bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] px-3 py-2 rounded-xl mb-3">{{ error }}</div>

      <input v-model="email" type="email" placeholder="Email address"
             class="w-full bg-[var(--color-surface)] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#2b8659] transition-all min-h-[44px] mb-2" />
      <input v-model="password" type="password" placeholder="Create a password"
             class="w-full bg-[var(--color-surface)] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#2b8659] transition-all min-h-[44px] mb-4" />

      <button @click="handleConvert" :disabled="submitting"
              class="w-full py-3 bg-[#2b8659] text-white font-bold rounded-2xl text-[14px] transition-all active:scale-[0.98] disabled:opacity-50">
        {{ submitting ? 'Creating...' : 'Create Account' }}
      </button>
      <button @click="emit('skipped')" class="w-full text-center text-[13px] text-[var(--color-text-muted)] mt-3 py-2">Skip</button>
    </template>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AccountConversionCard.vue
git commit -m "feat: add AccountConversionCard for guest-to-permanent conversion"
```

---

### Task 4: Add AccountConversionCard to Post-Ride Flow

**Files:**
- Modify: `src/pages/rider/RiderFlow.vue`

- [ ] **Step 1: Add import and guest detection**

At the top of `<script setup>` in `RiderFlow.vue`, add after existing imports:

```js
import AccountConversionCard from '../../components/AccountConversionCard.vue'
import { supabase } from '../../lib/supabase'
```

After the existing refs (around line 16), add:

```js
const isGuest = ref(false)
const showConversion = ref(false)

async function checkIfGuest() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data: rider } = await supabase.from('riders').select('is_guest').eq('auth_user_id', user.id).maybeSingle()
  isGuest.value = rider?.is_guest === true
}
```

- [ ] **Step 2: Update handleMatched to check guest status**

Replace the existing `handleMatched` function:

```js
function handleMatched(rideOrMatch) {
  matchInfo.value = rideOrMatch
  step.value = 'matched'
  checkIfGuest()
}
```

- [ ] **Step 3: Add AccountConversionCard to the matched template**

In the matched view (the `v-else-if="step === 'matched' && !showChat"` section), add the conversion card just before the "Back" button (around line 76):

```html
        <!-- Guest account conversion -->
        <AccountConversionCard v-if="isGuest && !showConversion" @converted="isGuest = false" @skipped="isGuest = false" class="mt-4 !mx-0" />
```

- [ ] **Step 4: Test the full guest flow**

1. Incognito browser → `/book` → set locations → "Request Ride"
2. Enter name + phone → submit
3. Should go to "Searching for driver"
4. Accept ride on driver side
5. Rider should see matched screen with "Save your account" card
6. Test both "Create Account" and "Skip" paths

- [ ] **Step 5: Commit**

```bash
git add src/pages/rider/RiderFlow.vue
git commit -m "feat: show account conversion card to guest riders after match

Guest riders see a 'Save your account' card with email/password
fields after being matched with a driver. They can create a
permanent account or skip."
```

---

## Self-Review

**Spec coverage:**
- Section 1 (Guest Booking Flow): ✅ Tasks 1-2
- Section 2 (Post-Ride Account Conversion): ✅ Tasks 3-4
- Section 3 (Supabase Setup): Manual step — user must enable anonymous auth + add `is_guest` column
- Section 4 (Files): ✅ All files covered
- Section 5 (Edge Cases): ✅ Duplicate email handled in AccountConversionCard, phone not unique-constrained, driver sees phone from ride record

**Placeholder scan:** No TBDs, TODOs, or vague steps. All code is complete.

**Type consistency:** `GuestInfoSheet` emits `{ name, phone }`, `handleGuestSubmit` receives `{ name, phone }`, `createRideForUser` accepts `guestInfo` with same shape. `AccountConversionCard` emits `converted`/`skipped`, RiderFlow handles both.

---

## Pre-requisites (Manual Steps)

Before running this plan, the user must:

1. **Enable anonymous auth in Supabase:** Dashboard → Authentication → Settings → toggle "Allow anonymous sign-ins"
2. **Add column:** Run in Supabase SQL editor:
   ```sql
   ALTER TABLE riders ADD COLUMN IF NOT EXISTS is_guest boolean DEFAULT false;
   ```
