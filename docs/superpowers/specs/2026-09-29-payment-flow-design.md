# Payment Flow — Design Spec

**Goal:** Require card payment for all rides (guest and logged-in). Save card at booking time via Stripe SetupIntent, pre-authorize when driver accepts, capture after ride completes.

**Architecture:** Client-side Stripe Elements for card collection. Server-side (Vercel serverless) for SetupIntent creation, PaymentIntent creation/capture/cancellation. Supabase stores Stripe IDs on rider and ride records.

**Tech Stack:** Vue 3, Stripe.js (`@stripe/stripe-js`), Stripe Node SDK (server), Supabase, Vercel serverless API routes.

---

## 1. Payment Flow Overview

### Booking time — Save card (no charge)

1. Rider taps "Request Ride" on `/book`
2. **If logged-in with saved card:** proceed directly to ride creation
3. **If logged-in without saved card:** show card collection bottom sheet (Stripe CardElement). On submit: call `POST /api/create-setup-intent` → `stripe.confirmCardSetup(client_secret)` → save `payment_method_id` on rider record → proceed to ride creation
4. **If guest (not logged in):** GuestInfoSheet slides up with Name, Phone, and Card fields. On submit:
   - `supabase.auth.signInAnonymously()` → create anonymous session
   - Insert rider record with `is_guest: true`
   - Call `POST /api/create-setup-intent` → `stripe.confirmCardSetup(client_secret)` → save `stripe_customer_id` and `payment_method_id` on rider record
   - Insert ride → emit `'requested'` → SearchingForDriver

### Driver accepts — Pre-authorize (hold)

1. Driver taps "Accept" → client calls `POST /api/authorize-ride` with `{ rideId }`
2. Server looks up ride → gets fare amount, rider's `stripe_customer_id` and `payment_method_id`
3. Server creates a Stripe PaymentIntent:
   - `amount`: fare in cents (BSD)
   - `currency`: `'usd'` (BSD is pegged 1:1 to USD; Stripe doesn't support BSD directly)
   - `customer`: rider's `stripe_customer_id`
   - `payment_method`: rider's `payment_method_id`
   - `capture_method: 'manual'`
   - `confirm: true`
4. Server stores `payment_intent_id` on the ride record, sets `payment_status: 'authorized'`
5. Server updates ride status to `'accepted'` with driver info
6. Returns success → driver proceeds to active ride

**If pre-auth fails** (card declined, insufficient funds):
- Ride stays in `'requested'` status
- Driver gets error message: "Rider's payment couldn't be authorized"
- Ride is cancelled with `cancel_reason: 'payment_failed'`
- Rider is notified that their ride was cancelled due to a payment issue

### Ride completes — Capture (charge)

1. Driver marks ride complete → ride status changes to `'completed'`
2. Server calls `POST /api/capture-payment` with `{ rideId }`
3. Captures the held PaymentIntent → rider is charged the fare
4. Updates ride with `paid_at`, `payment_status: 'captured'`

### Cancellation — Release hold

1. If ride is cancelled after driver accepted:
2. Server calls `POST /api/cancel-payment` with `{ rideId }`
3. Cancels the PaymentIntent → hold released on rider's card
4. Updates ride with `payment_status: 'cancelled'`

---

## 2. GuestInfoSheet Changes

The existing `GuestInfoSheet.vue` bottom sheet currently collects Name + Phone. Add a Stripe CardElement below:

- **Name** (text input, required)
- **Phone** (tel input, +1 242 format, required)
- **Card** (Stripe CardElement — single field showing card number, expiry, CVC)
- **"Request Ride"** green CTA button

On submit:
1. Validate name, phone, and card element completeness
2. `supabase.auth.signInAnonymously()` → get anonymous user
3. Insert rider record: `{ auth_user_id, name, phone, is_guest: true }`
4. Call `POST /api/create-setup-intent` with `{ userId: user.id, name, email: null }` → get `{ client_secret, customer_id }`
5. `stripe.confirmCardSetup(client_secret, { payment_method: { card: cardElement } })` → get `payment_method_id` from result
6. Update rider record: `{ stripe_customer_id: customer_id, payment_method_id }`
7. Insert ride record → emit `'requested'` → SearchingForDriver

---

## 3. Logged-In User Card Collection

For logged-in users who don't have a saved `payment_method_id` on their rider record:

- Show a `CardCollectionSheet.vue` bottom sheet with just the Stripe CardElement
- Same SetupIntent flow: `POST /api/create-setup-intent` → `stripe.confirmCardSetup()` → save payment method
- After card is saved, proceed to ride creation

For logged-in users who already have a saved card:
- Skip straight to ride creation (no sheet)

---

## 4. API Endpoints

### `POST /api/create-setup-intent`

Creates a Stripe Customer (or reuses existing) and a SetupIntent for saving a card.

**Request:** `{ userId, name, email }` (email may be null for guests)
**Response:** `{ client_secret, customer_id }`

Logic:
1. Look up rider by `auth_user_id = userId` to check for existing `stripe_customer_id`
2. If no customer, create one: `stripe.customers.create({ name, email, metadata: { supabase_user_id: userId } })`
3. Create SetupIntent: `stripe.setupIntents.create({ customer: customer_id })`
4. Update rider record with `stripe_customer_id` if newly created
5. Return `{ client_secret: setupIntent.client_secret, customer_id }`

### `POST /api/authorize-ride`

Called when driver accepts a ride. Creates and confirms a PaymentIntent with manual capture.

**Request:** `{ rideId }`
**Response:** `{ success: true, payment_intent_id }` or `{ success: false, error }`

Logic:
1. Look up ride by `rideId` → get `fare_amount`, `rider_id`
2. Look up rider → get `stripe_customer_id`, `payment_method_id`
3. Validate both exist, fail if not
4. Create PaymentIntent: `stripe.paymentIntents.create({ amount: fare_amount, currency: 'usd', customer, payment_method, capture_method: 'manual', confirm: true, off_session: true })`
5. If PaymentIntent status is `'requires_capture'` → success:
   - Update ride: `{ payment_intent_id, payment_status: 'authorized' }`
   - Return success
6. If PaymentIntent fails (card_declined, etc.) → fail:
   - Update ride: `{ status: 'cancelled', cancel_reason: 'payment_failed' }`
   - Return `{ success: false, error: 'payment_failed' }`

### `POST /api/capture-payment`

Called when ride completes. Captures the held PaymentIntent.

**Request:** `{ rideId }`
**Response:** `{ success: true }` or `{ success: false, error }`

Logic:
1. Look up ride → get `payment_intent_id`
2. `stripe.paymentIntents.capture(payment_intent_id)`
3. Update ride: `{ payment_status: 'captured', paid_at: new Date().toISOString() }`

### `POST /api/cancel-payment`

Called when ride is cancelled after driver accepted. Releases the hold.

**Request:** `{ rideId }`
**Response:** `{ success: true }`

Logic:
1. Look up ride → get `payment_intent_id`
2. If `payment_intent_id` exists: `stripe.paymentIntents.cancel(payment_intent_id)`
3. Update ride: `{ payment_status: 'cancelled' }`

---

## 5. Supabase Schema Changes

```sql
ALTER TABLE riders ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE riders ADD COLUMN IF NOT EXISTS payment_method_id text;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS payment_intent_id text;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'none';
```

`payment_status` values: `'none'` → `'authorized'` → `'captured'` (or `'cancelled'`)

---

## 6. Client-Side Stripe Setup

Install `@stripe/stripe-js` (lightweight loader, ~12KB):

```bash
npm install @stripe/stripe-js
```

Create `src/lib/stripe.js`:
- `import { loadStripe } from '@stripe/stripe-js'`
- Export a singleton: `export const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)`

Mount Stripe CardElement in GuestInfoSheet and CardCollectionSheet using the Stripe.js `elements.create('card')` API.

---

## 7. Files to Create or Modify

### Create
- `src/lib/stripe.js` — Stripe.js singleton loader
- `src/components/CardCollectionSheet.vue` — Bottom sheet with Stripe CardElement for logged-in users without saved card
- `api/create-setup-intent.js` — SetupIntent + Customer creation
- `api/authorize-ride.js` — Pre-auth on driver accept
- `api/capture-payment.js` — Capture on ride complete
- `api/cancel-payment.js` — Release hold on cancellation

### Modify
- `src/components/GuestInfoSheet.vue` — Add Stripe CardElement, SetupIntent flow on submit
- `src/pages/rider/RiderBooking.vue` — Check for saved card, show CardCollectionSheet if needed, pass Stripe to GuestInfoSheet
- `src/lib/useDriver.js` — `acceptRide()` calls `/api/authorize-ride` before proceeding
- `src/pages/driver/DriverActiveRide.vue` — `completeRide()` calls `/api/capture-payment`
- `src/pages/rider/ActiveRide.vue` — Handle `payment_failed` cancellation status
- `src/pages/rider/SearchingForDriver.vue` — Handle `payment_failed` status, notify rider

---

## 8. Edge Cases

- **Card declined on pre-auth:** Driver gets error, ride cancelled with reason, rider notified. Rider can rebook with a different card.
- **Guest closes browser after saving card:** Anonymous session persists (Supabase stores it). Card is saved on the Stripe customer. If they return, their rider record still has the payment method.
- **Ride fare changes (e.g., route change):** Out of scope for launch. Fare is fixed at booking time.
- **Driver completes ride but capture fails:** Log the error, flag the ride for manual review. Don't block the driver's flow.
- **Rider cancels before driver accepts:** No payment was authorized, nothing to release. Just cancel the ride.
- **Rider cancels after driver accepts:** Release the pre-auth hold via `/api/cancel-payment`.
- **Stripe webhook for payment confirmation:** The existing `api/webhook.js` can be extended to handle `payment_intent.succeeded` events as a backup confirmation, but the primary flow is server-initiated capture.
