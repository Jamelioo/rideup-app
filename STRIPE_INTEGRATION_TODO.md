# Stripe integration

RideUp charges riders with a **card on file**: the card is saved once, a hold is placed when a driver accepts a
ride, and the hold is captured when the trip is completed. All Stripe calls happen in `api/` (server side);
the browser only ever talks to Stripe to collect card details.

## Environment variables (Vercel → Settings → Environment Variables)

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | server-side Stripe API key (`sk_live_…` in production) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | browser key for the card form (`pk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | signing secret for `/api/webhook` (`whsec_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | lets the API read/write rides and riders (every protected route needs it) |
| `DOMAIN` | used for Stripe redirect URLs, e.g. `https://rideupnassau.com` |

Never commit real keys; `.env` is gitignored.

## Stripe webhook

Dashboard → Developers → Webhooks → add endpoint `https://rideupnassau.com/api/webhook` and subscribe to:

- `checkout.session.completed` — saves a card added from the Payments page (Checkout setup mode)
- `payment_intent.payment_failed` — marks the ride's payment as failed

Copy the signing secret into `STRIPE_WEBHOOK_SECRET`. **Not handled yet:** refunds and disputes
(`charge.refunded`, `charge.dispute.created`).

## How a ride is paid

1. **Save a card.** `POST /api/create-setup-intent` creates (or reuses) the rider's Stripe customer and a
   SetupIntent. The browser confirms it with Stripe Elements, then calls `POST /api/save-payment-method`, which
   re-reads the SetupIntent from Stripe, checks it belongs to this rider's customer, and stores the payment
   method id, brand and last 4 digits. Riders cannot write these columns themselves.
2. **Hold.** A driver accepts (`accept_ride` in Postgres claims the ride) and the app calls
   `POST /api/authorize-ride`, which creates a manual-capture PaymentIntent for the ride's fare. If it fails the
   ride is cancelled and the driver is told why.
3. **Capture.** When the driver completes the trip, `POST /api/capture-payment` captures the hold.
4. **Release.** `POST /api/cancel-payment` releases the hold if the ride is cancelled before the trip starts.

Every route requires a signed-in user (`Authorization: Bearer <Supabase access token>`), checks that the ride
belongs to the caller, and takes the amount from the `rides` row, never from the request. Stripe calls use
idempotency keys so retries can't double-charge.

`api/create-checkout-session.js` (hosted Checkout payment) is kept for a possible pay-after-ride flow; the app does
not call it today.

## Currency

Everything is charged in **USD** (the Bahamian dollar is pegged 1:1). Fares are stored in cents in
`rides.fare_cents`; the database recomputes them on insert from distance and time.

## Testing

Use Stripe **test mode** keys and these cards: `4242 4242 4242 4242` (succeeds), `4000 0000 0000 9995`
(declined — the ride should be cancelled with a payment message). Any future expiry and any CVC.
Forward webhooks locally with `stripe listen --forward-to localhost:3000/api/webhook`.
