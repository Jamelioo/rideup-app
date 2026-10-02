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
- `charge.refunded` — marks the ride `refunded` / `partially_refunded`
- `charge.dispute.created` — marks the ride `disputed` and logs a warning; answer the dispute in the Stripe dashboard before the deadline

Copy the signing secret into `STRIPE_WEBHOOK_SECRET`. Refunds themselves are issued from the Stripe dashboard.

## How a ride is paid

1. **Save a card.** `POST /api/create-setup-intent` creates (or reuses) the rider's Stripe customer and a
   SetupIntent. The browser confirms it with Stripe Elements, then calls `POST /api/save-payment-method`, which
   re-reads the SetupIntent from Stripe, checks it belongs to this rider's customer, and stores the payment
   method id, brand and last 4 digits. Riders cannot write these columns themselves.
2. **Hold.** A driver accepts (`accept_ride` in Postgres claims the ride) and the app calls
   `POST /api/authorize-ride`, which creates a manual-capture PaymentIntent for the ride's fare. If it fails the
   ride is cancelled and the driver is told why.
3. **Capture.** When the driver completes the trip, the driver app calls `POST /api/capture-payment` (retried a few
   times if the phone is offline). As a safety net, the every-minute cron (`/api/dispatch-scheduled`) captures any
   completed trip still on hold after 2 minutes. Both use the same code (`api/_capture.js`) and the same Stripe
   idempotency key, so a trip can never be charged twice, and only one receipt email is sent.
4. **Cancellations and no-shows (one endpoint).** `POST /api/cancel-ride` handles every cancellation, so the ride
   status and the card hold always change together:
   - Rider cancels before a driver accepts, or within `CANCEL_GRACE_SECONDS` (default 120) of acceptance: free,
     hold released.
   - Rider cancels after that: `CANCEL_FEE_CENTS` (default 500 = $5.00, capped at the fare) is captured from the
     hold with `amount_to_capture`; the rest of the hold is released. The app shows the fee first (`preview: true`).
   - Driver marks a no-show after waiting `FREE_WAIT_SECONDS` (default 300) at pickup: same fee.
   - Driver cancels otherwise: free for the rider, and the server books the rider a fresh request at the same price
     (not offered to that driver again).
   - The driver gets 80% of any fee (`platform_fee_cents` / `driver_payout_cents` on the ride).
   Set `CANCEL_FEE_CENTS=0` to turn fees off.
5. **Tips.** `POST /api/add-tip` charges a separate off-session PaymentIntent ($1–$100, up to 72 hours after a
   completed trip) to the card on file. The ride is claimed before charging so a double tap can't charge twice;
   100% of the tip is credited to the driver's balance.
6. **Driver payouts.** Drivers are paid outside Stripe (bank transfer, cash or mobile money). Admins record each
   payout on Admin → Payouts; balances are computed by `driver_earnings_summary()` from paid trips, fees and tips.

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
To test the capture safety net, complete a trip with the driver phone offline and check that the ride shows
`captured` within about 3 minutes (the cron must be running).
Forward webhooks locally with `stripe listen --forward-to localhost:3000/api/webhook`.
