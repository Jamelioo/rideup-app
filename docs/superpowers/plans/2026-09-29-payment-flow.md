# Payment Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require card payment for all rides — save card at booking via Stripe SetupIntent, pre-authorize when driver accepts, capture after ride completes.

**Architecture:** Client-side Stripe Elements (via `@stripe/stripe-js`) for card collection in bottom sheets. Four Vercel serverless API endpoints handle SetupIntent creation, PaymentIntent authorization, capture, and cancellation. Supabase stores Stripe IDs on rider/ride records.

**Tech Stack:** Vue 3 (`<script setup>`), `@stripe/stripe-js`, Stripe Node SDK (server), Supabase, Vercel serverless, Tailwind CSS with CSS custom properties.

---

## File Structure

### New files
| File | Responsibility |
|---|---|
| `src/lib/stripe.js` | Singleton Stripe.js loader using `VITE_STRIPE_PUBLISHABLE_KEY` |
| `src/components/CardCollectionSheet.vue` | Bottom sheet with Stripe CardElement for logged-in users without saved card |
| `api/create-setup-intent.js` | Creates Stripe Customer + SetupIntent, returns `client_secret` + `customer_id` |
| `api/authorize-ride.js` | Creates PaymentIntent with `capture_method: 'manual'`, confirms immediately |
| `api/capture-payment.js` | Captures a held PaymentIntent after ride completion |
| `api/cancel-payment.js` | Cancels a PaymentIntent (releases hold) on ride cancellation |

### Modified files
| File | Change |
|---|---|
| `src/components/GuestInfoSheet.vue` | Add Stripe CardElement below phone field, run SetupIntent on submit |
| `src/pages/rider/RiderBooking.vue` | Check for saved card before ride request, show CardCollectionSheet or GuestInfoSheet with card |
| `src/lib/useDriver.js` | `acceptRide()` calls `/api/authorize-ride` before updating ride status |
| `src/pages/driver/DriverActiveRide.vue` | Call `/api/capture-payment` when ride completes, `/api/cancel-payment` on cancel |
| `src/pages/rider/SearchingForDriver.vue` | Handle `payment_failed` cancellation — show message to rider |

---

## Task 1: Install `@stripe/stripe-js` and create Stripe loader

**Files:**
- Create: `src/lib/stripe.js`

- [ ] **Step 1: Install the Stripe.js package**

```bash
cd /Users/jamelioo/Downloads/rideup-app-final/rideup-app && npm install @stripe/stripe-js
```

Expected: Package added to `dependencies` in `package.json`.

- [ ] **Step 2: Create the Stripe loader singleton**

Create `src/lib/stripe.js`:

```js
import { loadStripe } from '@stripe/stripe-js'

let stripePromise = null

export function getStripe() {
  if (!stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
    if (!key) {
      console.warn('Missing VITE_STRIPE_PUBLISHABLE_KEY in .env')
      return Promise.resolve(null)
    }
    stripePromise = loadStripe(key)
  }
  return stripePromise
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/stripe.js package.json package-lock.json
git commit -m "feat: add Stripe.js loader singleton"
```

---

## Task 2: Create `POST /api/create-setup-intent` endpoint

**Files:**
- Create: `api/create-setup-intent.js`

This endpoint creates a Stripe Customer (or reuses existing) and a SetupIntent for saving a card without charging.

- [ ] **Step 1: Create the endpoint**

Create `api/create-setup-intent.js`:

```js
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId, name, email } = req.body

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' })
  }

  try {
    // Check if rider already has a Stripe customer
    const { data: rider } = await supabase
      .from('riders')
      .select('stripe_customer_id')
      .eq('auth_user_id', userId)
      .maybeSingle()

    let customerId = rider?.stripe_customer_id

    if (!customerId) {
      // Create a new Stripe customer
      const customer = await stripe.customers.create({
        name: name || undefined,
        email: email || undefined,
        metadata: { supabase_user_id: userId },
      })
      customerId = customer.id

      // Save customer ID to rider record
      await supabase
        .from('riders')
        .update({ stripe_customer_id: customerId })
        .eq('auth_user_id', userId)
    }

    // Create a SetupIntent for saving a card
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    })

    res.status(200).json({
      client_secret: setupIntent.client_secret,
      customer_id: customerId,
    })
  } catch (err) {
    console.error('Setup intent error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
```

- [ ] **Step 2: Verify the endpoint exports correctly**

Check that the file uses the same pattern as existing endpoints (e.g., `api/create-checkout-session.js`): default export, `req`/`res` handler signature, Stripe SDK instantiation at module level.

- [ ] **Step 3: Commit**

```bash
git add api/create-setup-intent.js
git commit -m "feat: add /api/create-setup-intent endpoint for saving cards"
```

---

## Task 3: Create `POST /api/authorize-ride` endpoint

**Files:**
- Create: `api/authorize-ride.js`

Called when a driver accepts a ride. Creates a PaymentIntent with manual capture and confirms it immediately to place a hold on the rider's card.

- [ ] **Step 1: Create the endpoint**

Create `api/authorize-ride.js`:

```js
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { rideId } = req.body

  if (!rideId) {
    return res.status(400).json({ error: 'rideId is required' })
  }

  try {
    // Look up the ride
    const { data: ride, error: rideErr } = await supabase
      .from('rides')
      .select('fare_cents, rider_id')
      .eq('id', rideId)
      .single()

    if (rideErr || !ride) {
      return res.status(404).json({ error: 'Ride not found' })
    }

    // Look up the rider's Stripe info
    const { data: rider, error: riderErr } = await supabase
      .from('riders')
      .select('stripe_customer_id, payment_method_id')
      .eq('id', ride.rider_id)
      .single()

    if (riderErr || !rider) {
      return res.status(404).json({ error: 'Rider not found' })
    }

    if (!rider.stripe_customer_id || !rider.payment_method_id) {
      // Cancel the ride — no payment method on file
      await supabase
        .from('rides')
        .update({ status: 'cancelled', cancel_reason: 'payment_failed' })
        .eq('id', rideId)
      return res.status(400).json({ success: false, error: 'no_payment_method' })
    }

    // Create and confirm a PaymentIntent with manual capture (hold)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: ride.fare_cents,
      currency: 'usd',
      customer: rider.stripe_customer_id,
      payment_method: rider.payment_method_id,
      capture_method: 'manual',
      confirm: true,
      off_session: true,
      metadata: { ride_id: rideId },
    })

    if (paymentIntent.status === 'requires_capture') {
      // Hold placed successfully
      await supabase
        .from('rides')
        .update({
          payment_intent_id: paymentIntent.id,
          payment_status: 'authorized',
        })
        .eq('id', rideId)

      return res.status(200).json({ success: true, payment_intent_id: paymentIntent.id })
    }

    // Payment failed
    await supabase
      .from('rides')
      .update({ status: 'cancelled', cancel_reason: 'payment_failed' })
      .eq('id', rideId)

    return res.status(400).json({ success: false, error: 'payment_failed' })
  } catch (err) {
    console.error('Authorize ride error:', err.message)

    // If Stripe threw a card error, cancel the ride
    if (err.type === 'StripeCardError') {
      await supabase
        .from('rides')
        .update({ status: 'cancelled', cancel_reason: 'payment_failed' })
        .eq('id', rideId)
      return res.status(400).json({ success: false, error: 'card_declined' })
    }

    res.status(500).json({ error: err.message })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add api/authorize-ride.js
git commit -m "feat: add /api/authorize-ride endpoint for pre-auth on driver accept"
```

---

## Task 4: Create `POST /api/capture-payment` and `POST /api/cancel-payment` endpoints

**Files:**
- Create: `api/capture-payment.js`
- Create: `api/cancel-payment.js`

- [ ] **Step 1: Create the capture endpoint**

Create `api/capture-payment.js`:

```js
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { rideId } = req.body

  if (!rideId) {
    return res.status(400).json({ error: 'rideId is required' })
  }

  try {
    const { data: ride } = await supabase
      .from('rides')
      .select('payment_intent_id, payment_status')
      .eq('id', rideId)
      .single()

    if (!ride?.payment_intent_id) {
      return res.status(400).json({ error: 'No payment intent for this ride' })
    }

    if (ride.payment_status === 'captured') {
      return res.status(200).json({ success: true, already_captured: true })
    }

    await stripe.paymentIntents.capture(ride.payment_intent_id)

    await supabase
      .from('rides')
      .update({
        payment_status: 'captured',
        paid_at: new Date().toISOString(),
      })
      .eq('id', rideId)

    res.status(200).json({ success: true })
  } catch (err) {
    console.error('Capture payment error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
```

- [ ] **Step 2: Create the cancel endpoint**

Create `api/cancel-payment.js`:

```js
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { rideId } = req.body

  if (!rideId) {
    return res.status(400).json({ error: 'rideId is required' })
  }

  try {
    const { data: ride } = await supabase
      .from('rides')
      .select('payment_intent_id, payment_status')
      .eq('id', rideId)
      .single()

    if (ride?.payment_intent_id && ride.payment_status === 'authorized') {
      await stripe.paymentIntents.cancel(ride.payment_intent_id)

      await supabase
        .from('rides')
        .update({ payment_status: 'cancelled' })
        .eq('id', rideId)
    }

    res.status(200).json({ success: true })
  } catch (err) {
    console.error('Cancel payment error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add api/capture-payment.js api/cancel-payment.js
git commit -m "feat: add /api/capture-payment and /api/cancel-payment endpoints"
```

---

## Task 5: Update GuestInfoSheet to include Stripe CardElement

**Files:**
- Modify: `src/components/GuestInfoSheet.vue`

Add a Stripe CardElement below the phone number field. The parent component (RiderBooking) will handle the SetupIntent flow after the card is tokenized.

- [ ] **Step 1: Update the component**

Replace the entire content of `src/components/GuestInfoSheet.vue` with:

```vue
<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { getStripe } from '../lib/stripe'

const props = defineProps({
  show: { type: Boolean, default: false },
})

const emit = defineEmits(['submit', 'close'])

const name = ref('')
const phone = ref('')
const submitting = ref(false)
const error = ref(null)
const cardError = ref(null)

let stripe = null
let elements = null
let cardElement = null
const cardMountRef = ref(null)
const cardComplete = ref(false)

const isValid = computed(() =>
  name.value.trim().length > 0 &&
  phone.value.replace(/\D/g, '').length >= 7 &&
  cardComplete.value
)

onMounted(async () => {
  stripe = await getStripe()
})

watch(() => props.show, async (open) => {
  if (open && stripe && !cardElement) {
    // Wait for DOM to render the mount point
    await new Promise(r => setTimeout(r, 50))
    if (!cardMountRef.value) return

    elements = stripe.elements()
    cardElement = elements.create('card', {
      style: {
        base: {
          color: 'var(--color-text-primary, #fff)',
          fontFamily: 'inherit',
          fontSize: '14px',
          '::placeholder': { color: 'var(--color-text-muted, #888)' },
        },
        invalid: { color: '#ef4444' },
      },
    })
    cardElement.mount(cardMountRef.value)
    cardElement.on('change', (event) => {
      cardComplete.value = event.complete
      cardError.value = event.error ? event.error.message : null
    })
  }
})

function handleSubmit() {
  if (!isValid.value || submitting.value) return
  error.value = null
  cardError.value = null
  submitting.value = true
  emit('submit', {
    name: name.value.trim(),
    phone: phone.value.trim(),
    cardElement,
    stripe,
  })
}

function reset() {
  submitting.value = false
  error.value = null
  cardError.value = null
}

defineExpose({ reset })
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="fixed inset-0 bg-[var(--color-overlay)] z-[9998]" @click="emit('close')" />
    </Transition>

    <Transition name="sheet">
      <div v-if="show" class="fixed inset-x-0 bottom-0 z-[9999] bg-[var(--color-surface)] rounded-t-[28px] shadow-[0_-4px_40px_rgba(0,0,0,0.15)]" style="padding-bottom: env(safe-area-inset-bottom, 0px);">
        <div class="flex justify-center pt-3 pb-1">
          <div class="w-10 h-1 rounded-full bg-[var(--color-text-muted)]/30"></div>
        </div>

        <div class="px-6 pb-6">
          <div class="flex items-center justify-between mb-1">
            <h2 class="text-[18px] font-bold">Enter your details</h2>
            <button @click="emit('close')" class="w-8 h-8 rounded-full hover:bg-[var(--color-surface-secondary)] flex items-center justify-center text-[var(--color-text-muted)]">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <p class="text-[13px] text-[var(--color-text-muted)] mb-5">Name, phone, and payment to request a ride.</p>

          <div v-if="error" class="bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] px-4 py-2.5 rounded-xl mb-4">{{ error }}</div>

          <label class="block mb-3">
            <span class="text-[12px] font-medium text-[var(--color-text-muted)] mb-1 block">Your name</span>
            <input v-model="name" type="text" placeholder="e.g. Marcus"
                   class="w-full bg-[var(--color-surface-secondary)] rounded-xl px-4 py-3 text-[14px] font-medium outline-none focus:ring-2 focus:ring-[#2b8659] transition-all min-h-[44px]" />
          </label>

          <label class="block mb-3">
            <span class="text-[12px] font-medium text-[var(--color-text-muted)] mb-1 block">Phone number</span>
            <div class="flex items-center gap-2">
              <span class="text-[14px] text-[var(--color-text-muted)] font-medium px-3 py-3 bg-[var(--color-surface-secondary)] rounded-xl min-h-[44px] flex items-center">+1</span>
              <input v-model="phone" type="tel" placeholder="(242) 555-1234"
                     class="flex-1 bg-[var(--color-surface-secondary)] rounded-xl px-4 py-3 text-[14px] font-medium outline-none focus:ring-2 focus:ring-[#2b8659] transition-all min-h-[44px]" />
            </div>
          </label>

          <label class="block mb-5">
            <span class="text-[12px] font-medium text-[var(--color-text-muted)] mb-1 block">Card</span>
            <div ref="cardMountRef"
                 class="bg-[var(--color-surface-secondary)] rounded-xl px-4 py-3.5 min-h-[44px]"></div>
            <p v-if="cardError" class="text-red-400 text-[12px] mt-1">{{ cardError }}</p>
          </label>

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

- [ ] **Step 2: Commit**

```bash
git add src/components/GuestInfoSheet.vue
git commit -m "feat: add Stripe CardElement to GuestInfoSheet"
```

---

## Task 6: Create CardCollectionSheet for logged-in users

**Files:**
- Create: `src/components/CardCollectionSheet.vue`

A simpler bottom sheet for logged-in users who don't have a saved card. Only shows the Stripe CardElement (no name/phone fields — we already have those).

- [ ] **Step 1: Create the component**

Create `src/components/CardCollectionSheet.vue`:

```vue
<script setup>
import { ref, watch, onMounted } from 'vue'
import { getStripe } from '../lib/stripe'

const props = defineProps({
  show: { type: Boolean, default: false },
})

const emit = defineEmits(['submit', 'close'])

const submitting = ref(false)
const error = ref(null)
const cardError = ref(null)

let stripe = null
let elements = null
let cardElement = null
const cardMountRef = ref(null)
const cardComplete = ref(false)

onMounted(async () => {
  stripe = await getStripe()
})

watch(() => props.show, async (open) => {
  if (open && stripe && !cardElement) {
    await new Promise(r => setTimeout(r, 50))
    if (!cardMountRef.value) return

    elements = stripe.elements()
    cardElement = elements.create('card', {
      style: {
        base: {
          color: 'var(--color-text-primary, #fff)',
          fontFamily: 'inherit',
          fontSize: '14px',
          '::placeholder': { color: 'var(--color-text-muted, #888)' },
        },
        invalid: { color: '#ef4444' },
      },
    })
    cardElement.mount(cardMountRef.value)
    cardElement.on('change', (event) => {
      cardComplete.value = event.complete
      cardError.value = event.error ? event.error.message : null
    })
  }
})

function handleSubmit() {
  if (!cardComplete.value || submitting.value) return
  error.value = null
  cardError.value = null
  submitting.value = true
  emit('submit', { cardElement, stripe })
}

function reset() {
  submitting.value = false
  error.value = null
  cardError.value = null
}

defineExpose({ reset })
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="fixed inset-0 bg-[var(--color-overlay)] z-[9998]" @click="emit('close')" />
    </Transition>

    <Transition name="sheet">
      <div v-if="show" class="fixed inset-x-0 bottom-0 z-[9999] bg-[var(--color-surface)] rounded-t-[28px] shadow-[0_-4px_40px_rgba(0,0,0,0.15)]" style="padding-bottom: env(safe-area-inset-bottom, 0px);">
        <div class="flex justify-center pt-3 pb-1">
          <div class="w-10 h-1 rounded-full bg-[var(--color-text-muted)]/30"></div>
        </div>

        <div class="px-6 pb-6">
          <div class="flex items-center justify-between mb-1">
            <h2 class="text-[18px] font-bold">Add payment method</h2>
            <button @click="emit('close')" class="w-8 h-8 rounded-full hover:bg-[var(--color-surface-secondary)] flex items-center justify-center text-[var(--color-text-muted)]">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <p class="text-[13px] text-[var(--color-text-muted)] mb-5">A card is required to request a ride. You'll only be charged after your trip.</p>

          <div v-if="error" class="bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] px-4 py-2.5 rounded-xl mb-4">{{ error }}</div>

          <label class="block mb-5">
            <span class="text-[12px] font-medium text-[var(--color-text-muted)] mb-1 block">Card details</span>
            <div ref="cardMountRef"
                 class="bg-[var(--color-surface-secondary)] rounded-xl px-4 py-3.5 min-h-[44px]"></div>
            <p v-if="cardError" class="text-red-400 text-[12px] mt-1">{{ cardError }}</p>
          </label>

          <button @click="handleSubmit" :disabled="!cardComplete || submitting"
                  class="w-full py-4 bg-[#2b8659] disabled:bg-[var(--color-surface-secondary)] disabled:text-[var(--color-text-muted)] text-white font-bold rounded-2xl text-[15px] transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(43,134,89,0.3)] disabled:shadow-none">
            {{ submitting ? 'Saving...' : 'Save & Request Ride' }}
          </button>

          <p class="text-[11px] text-[var(--color-text-muted)] text-center mt-3 flex items-center justify-center gap-1">
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            Secured by Stripe
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

- [ ] **Step 2: Commit**

```bash
git add src/components/CardCollectionSheet.vue
git commit -m "feat: add CardCollectionSheet for logged-in users without saved card"
```

---

## Task 7: Update RiderBooking to integrate card collection

**Files:**
- Modify: `src/pages/rider/RiderBooking.vue`

This is the most complex task. We need to:
1. Import CardCollectionSheet and the Stripe helper
2. Check if logged-in user has a saved card before requesting
3. Run the SetupIntent flow to save the card
4. Then proceed to ride creation

- [ ] **Step 1: Add imports and new refs**

In the `<script setup>` section of `RiderBooking.vue`, add after the existing imports (line 16):

```js
import CardCollectionSheet from '../../components/CardCollectionSheet.vue'
```

Add after the existing refs around line 42 (after `guestSheetRef`):

```js
const showCardSheet = ref(false)
const cardSheetRef = ref(null)
```

- [ ] **Step 2: Add helper to save card via SetupIntent**

Add this function after the existing `handleGuestSubmit` function (around line 365):

```js
async function saveCardForUser(user, cardElement, stripe) {
  // Call our API to create a SetupIntent
  const res = await fetch('/api/create-setup-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: user.id,
      name: user.user_metadata?.name || user.email?.split('@')[0] || 'Rider',
      email: user.email || null,
    }),
  })
  const { client_secret, customer_id, error: apiError } = await res.json()
  if (apiError) throw new Error(apiError)

  // Confirm the SetupIntent with the card element
  const { setupIntent, error: stripeError } = await stripe.confirmCardSetup(client_secret, {
    payment_method: { card: cardElement },
  })
  if (stripeError) throw new Error(stripeError.message)

  // Save the payment method ID on the rider record
  await supabase
    .from('riders')
    .update({
      stripe_customer_id: customer_id,
      payment_method_id: setupIntent.payment_method,
    })
    .eq('auth_user_id', user.id)

  return { customer_id, payment_method_id: setupIntent.payment_method }
}
```

- [ ] **Step 3: Update `requestRide` to check for saved card**

Replace the existing `requestRide` function with:

```js
async function requestRide() {
  if (!canRequest.value) return
  isSubmitting.value = true
  error.value = null

  if (DEMO_MODE) {
    const fare = fareEstimates.value[selectedVehicle.value]
    const vehicleName = VEHICLE_TYPES.find(v => v.id === selectedVehicle.value)?.name || 'RideUp Ride'
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
    // Show guest info sheet (which now includes card)
    isSubmitting.value = false
    showGuestSheet.value = true
    return
  }

  // Logged-in user — check if they have a saved payment method
  const { data: rider } = await supabase
    .from('riders')
    .select('payment_method_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!rider?.payment_method_id) {
    // No saved card — show card collection sheet
    isSubmitting.value = false
    showCardSheet.value = true
    return
  }

  // Has saved card — proceed directly
  await createRideForUser(user)
}
```

- [ ] **Step 4: Update `handleGuestSubmit` to handle card saving**

Replace the existing `handleGuestSubmit` function with:

```js
async function handleGuestSubmit({ name, phone, cardElement, stripe }) {
  error.value = null
  try {
    // Create anonymous session
    const { data, error: authErr } = await supabase.auth.signInAnonymously()
    if (authErr || !data.user) {
      if (guestSheetRef.value) guestSheetRef.value.reset()
      error.value = 'Could not start your session. Please try again.'
      return
    }

    // Create rider record first (saveCardForUser needs it)
    let { data: rider } = await supabase.from('riders').select('id').eq('auth_user_id', data.user.id).maybeSingle()
    if (!rider) {
      const { data: newRider, error: createErr } = await supabase.from('riders').insert({
        auth_user_id: data.user.id,
        name,
        phone,
        is_guest: true,
      }).select('id').single()
      if (createErr || !newRider) {
        if (guestSheetRef.value) guestSheetRef.value.reset()
        error.value = 'Could not create your profile. Please try again.'
        return
      }
      rider = newRider
    }

    // Save card via SetupIntent
    await saveCardForUser(data.user, cardElement, stripe)

    // Now create the ride
    await createRideForUser(data.user, { name, phone })
    if (error.value && guestSheetRef.value) guestSheetRef.value.reset()
  } catch (err) {
    if (guestSheetRef.value) guestSheetRef.value.reset()
    error.value = err.message || 'Connection error. Please try again.'
  }
}
```

- [ ] **Step 5: Add handler for CardCollectionSheet submit**

Add this function after `handleGuestSubmit`:

```js
async function handleCardSubmit({ cardElement, stripe }) {
  error.value = null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      if (cardSheetRef.value) cardSheetRef.value.reset()
      error.value = 'Session expired. Please log in again.'
      return
    }

    await saveCardForUser(user, cardElement, stripe)

    // Card saved — now create the ride
    showCardSheet.value = false
    await createRideForUser(user)
  } catch (err) {
    if (cardSheetRef.value) cardSheetRef.value.reset()
    error.value = err.message || 'Could not save card. Please try again.'
  }
}
```

- [ ] **Step 6: Add CardCollectionSheet to template**

In the template, find the line with GuestInfoSheet and ScheduleRidePicker (around line 713):

```html
<GuestInfoSheet ref="guestSheetRef" :show="showGuestSheet" @submit="handleGuestSubmit" @close="showGuestSheet = false" />
<ScheduleRidePicker :show="showSchedulePicker" @close="showSchedulePicker = false" @confirm="scheduleRide" />
```

Add the CardCollectionSheet after ScheduleRidePicker:

```html
<CardCollectionSheet ref="cardSheetRef" :show="showCardSheet" @submit="handleCardSubmit" @close="showCardSheet = false" />
```

- [ ] **Step 7: Commit**

```bash
git add src/pages/rider/RiderBooking.vue
git commit -m "feat: integrate card collection into booking flow for guests and logged-in users"
```

---

## Task 8: Update `acceptRide` in `useDriver.js` to call `/api/authorize-ride`

**Files:**
- Modify: `src/lib/useDriver.js`

When a driver accepts a ride, call the authorize endpoint to place a hold on the rider's card before updating the ride status.

- [ ] **Step 1: Update the `acceptRide` function**

Replace the existing `acceptRide` function (lines 175-194) with:

```js
async function acceptRide(ride) {
  incomingRequest.value = null

  if (DEMO_MODE) {
    currentRide.value = { ...ride, status: 'accepted', accepted_at: new Date().toISOString() }
    return
  }

  try {
    // Pre-authorize payment on rider's card
    const res = await fetch('/api/authorize-ride', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rideId: ride.id }),
    })
    const result = await res.json()

    if (!result.success) {
      // Payment failed — ride was cancelled server-side
      console.error('Payment authorization failed:', result.error)
      // Show the request again to indicate failure, then clear
      incomingRequest.value = null
      return
    }

    // Payment authorized — now update ride status
    const { error: rideErr } = await supabase.from('rides').update({
      driver_id: driver.value.id,
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    }).eq('id', ride.id)
    if (rideErr) console.error('Accept ride DB error:', rideErr.message)

    const { error: driverErr } = await supabase.from('drivers').update({ status: 'on_trip' }).eq('id', driver.value.id)
    if (driverErr) console.error('Driver status update error:', driverErr.message)

    currentRide.value = { ...ride, status: 'accepted', accepted_at: new Date().toISOString() }
  } catch (err) {
    console.error('Accept ride error:', err)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/useDriver.js
git commit -m "feat: call /api/authorize-ride on driver accept for payment pre-auth"
```

---

## Task 9: Capture payment on ride completion, release on cancel

**Files:**
- Modify: `src/pages/driver/DriverActiveRide.vue`

- [ ] **Step 1: Update `handleSlideComplete` to capture payment**

Find the `handleSlideComplete` function (line 63) and replace it:

```js
async function handleSlideComplete() {
  if (slideComplete.value) return
  slideComplete.value = true
  await updateRideStatus('completed')

  // Capture the payment hold
  if (!DEMO_MODE && currentRide.value?.id) {
    try {
      await fetch('/api/capture-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId: currentRide.value.id }),
      })
    } catch (err) {
      console.error('Capture payment error:', err)
    }
  }
}
```

- [ ] **Step 2: Update `cancelRide` to release payment hold**

Find the `cancelRide` function (line 141) and replace it:

```js
async function cancelRide() {
  if (!DEMO_MODE && currentRide.value) {
    // Release payment hold if one exists
    try {
      await fetch('/api/cancel-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId: currentRide.value.id }),
      })
    } catch (err) {
      console.error('Cancel payment error:', err)
    }

    await supabase.from('rides').update({ status: 'cancelled' }).eq('id', currentRide.value.id)
    await supabase.from('drivers').update({ status: 'online' }).eq('id', driver.value.id)
  }
  completeRide()
  router.push('/driver/dashboard')
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/driver/DriverActiveRide.vue
git commit -m "feat: capture payment on ride completion, release hold on cancel"
```

---

## Task 10: Handle `payment_failed` on rider side

**Files:**
- Modify: `src/pages/rider/SearchingForDriver.vue`

If the ride is cancelled with `cancel_reason: 'payment_failed'`, show the rider a message instead of just timing out.

- [ ] **Step 1: Update the realtime subscription**

In `SearchingForDriver.vue`, find the `postgres_changes` subscription (line 72) and replace the callback:

```js
.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${props.rideId}` }, (payload) => {
  ride.value = payload.new
  if (payload.new.status === 'accepted') {
    emit('matched', payload.new)
    navigateToActiveRide(payload.new)
  } else if (payload.new.status === 'cancelled' && payload.new.cancel_reason === 'payment_failed') {
    // Payment couldn't be authorized
    if (elapsedTimer) clearInterval(elapsedTimer)
    if (timeoutTimer) clearTimeout(timeoutTimer)
    paymentFailed.value = true
  }
})
```

- [ ] **Step 2: Add the `paymentFailed` ref**

Add after the existing refs (line 14):

```js
const paymentFailed = ref(false)
```

- [ ] **Step 3: Add payment failed UI**

In the template, after the timeout section (after the closing `</div>` for `v-if="timedOut"` around line 146), add:

```html
<div v-if="paymentFailed" class="text-center px-6">
  <div class="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
    <svg class="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  </div>
  <h2 class="text-xl font-bold text-[var(--color-text-primary)] mb-2">Payment issue</h2>
  <p class="text-[var(--color-text-muted)] text-sm mb-6">We couldn't authorize payment on your card. Please check your card details and try again.</p>
  <button @click="emit('cancelled')" class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px]">
    Try again
  </button>
</div>
```

- [ ] **Step 4: Hide the searching UI when payment failed**

Update the `v-if` on the searching template section. Find `<template v-if="!timedOut">` (line 113) and change to:

```html
<template v-if="!timedOut && !paymentFailed">
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/rider/SearchingForDriver.vue
git commit -m "feat: handle payment_failed cancellation on rider's searching screen"
```

---

## Task 11: Supabase schema migration

**Files:**
- None (SQL run in Supabase Dashboard)

- [ ] **Step 1: Run the following SQL in Supabase SQL Editor**

```sql
-- Add Stripe columns to riders
ALTER TABLE riders ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE riders ADD COLUMN IF NOT EXISTS payment_method_id text;

-- Add payment columns to rides
ALTER TABLE rides ADD COLUMN IF NOT EXISTS payment_intent_id text;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'none';
ALTER TABLE rides ADD COLUMN IF NOT EXISTS cancel_reason text;

-- Allow server-side updates to these columns (service role bypasses RLS)
-- No RLS changes needed since API endpoints use the service role key
```

- [ ] **Step 2: Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel environment variables**

The API endpoints use `createClient` with the service role key to bypass RLS. Add this env var in Vercel Dashboard → Settings → Environment Variables:

- Key: `SUPABASE_SERVICE_ROLE_KEY`
- Value: (from Supabase Dashboard → Project Settings → API → service_role key)

Also ensure `SUPABASE_URL` (or `VITE_SUPABASE_URL`) is set in Vercel env vars.

- [ ] **Step 3: Add `VITE_STRIPE_PUBLISHABLE_KEY` to `.env` and Vercel**

The client-side Stripe.js needs the publishable key. Add to `.env`:

```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51TK9x8D6VW0MGIWs...
```

And add the same key in Vercel Dashboard → Settings → Environment Variables.

---

## Task 12: End-to-end testing

- [ ] **Step 1: Test guest booking flow**

1. Open `/book` in an incognito window (not logged in)
2. Set pickup and dropoff locations
3. Select a vehicle type
4. Tap "Request Ride" → GuestInfoSheet should appear with Name, Phone, and Card fields
5. Enter name, phone, and Stripe test card `4242 4242 4242 4242` (any future expiry, any CVC)
6. Tap "Request Ride" → should create anonymous session, save card, insert ride, and navigate to SearchingForDriver

- [ ] **Step 2: Test logged-in user without saved card**

1. Log in with a test account
2. Go to `/book`, set pickup/dropoff, select vehicle
3. Tap "Request Ride" → CardCollectionSheet should appear
4. Enter test card `4242 4242 4242 4242`
5. Tap "Save & Request Ride" → card saved, ride created, navigate to SearchingForDriver

- [ ] **Step 3: Test logged-in user with saved card**

1. Same logged-in user (card now saved from step 2)
2. Go to `/book`, set pickup/dropoff
3. Tap "Request Ride" → should skip card collection and go directly to SearchingForDriver

- [ ] **Step 4: Test driver accept with pre-auth**

1. Open driver dashboard in another browser/tab
2. Go online, see the ride request
3. Accept the ride → should call `/api/authorize-ride`
4. Check Stripe Dashboard → should see a PaymentIntent with status `requires_capture`

- [ ] **Step 5: Test ride completion with capture**

1. Driver advances through ride phases: Arrived → Start Trip → Slide to Complete
2. On completion → should call `/api/capture-payment`
3. Check Stripe Dashboard → PaymentIntent should be `succeeded` (captured)

- [ ] **Step 6: Test card declined**

1. Create a new ride with test card `4000 0000 0000 0002` (always declines)
2. Driver accepts → `/api/authorize-ride` should fail
3. Rider should see "Payment issue" screen on SearchingForDriver
4. Driver should not navigate to active ride

- [ ] **Step 7: Test ride cancellation releases hold**

1. Create a ride with valid test card, driver accepts
2. Driver cancels the ride → should call `/api/cancel-payment`
3. Check Stripe Dashboard → PaymentIntent should be `canceled`
