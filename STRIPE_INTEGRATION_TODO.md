# Stripe Integration TODO

## Values to Replace

The following values are placeholders and must be updated before going live.

**Files containing placeholders:**
- [.env](.env)
- [api/create-checkout-session.js](api/create-checkout-session.js)

| Field | Current Value | What to Set |
|-------|--------------|-------------|
| `STRIPE_SECRET_KEY` | `sk_live_REPLACE_ME` | Your Stripe secret key from [Dashboard → API Keys](https://dashboard.stripe.com/apikeys) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_REPLACE_ME` | Your webhook signing secret from [Dashboard → Webhooks](https://dashboard.stripe.com/webhooks) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_live_REPLACE_ME` | Your Stripe publishable key from [Dashboard → API Keys](https://dashboard.stripe.com/apikeys) |
| `DOMAIN` | `https://rideupnassau.com` | Your production domain (already set correctly if using rideupnassau.com) |

## Configured Parameters

These parameters were configured in Checkout Studio and are already set correctly.

**Files containing these parameters:**
- [api/create-checkout-session.js](api/create-checkout-session.js)

| Parameter | Value |
|-----------|-------|
| `ui_mode` | `hosted_page` |
| `billing_address_collection` | `auto` |
| `name_collection.individual.enabled` | `true` |
| `name_collection.individual.optional` | `true` |
| `phone_number_collection.enabled` | `true` |
| `allow_promotion_codes` | `true` |
| `submit_type` | `auto` |
| `integration_identifier` | `hosted_web_0001` |
| `saved_payment_method_options.payment_method_save` | `enabled` |
| `origin_context` | `web` |
| `mode` | `payment` (one-time per ride) |

## Setup Steps

### 1. Add Stripe Keys to Vercel

Go to [Vercel Dashboard](https://vercel.com) → your project → Settings → Environment Variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | Production |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Production |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | Production |
| `DOMAIN` | `https://rideupnassau.com` | Production |

### 2. Create Stripe Webhook

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Endpoint URL: `https://rideupnassau.com/api/webhook`
4. Events to listen for: `checkout.session.completed`
5. Copy the signing secret → add as `STRIPE_WEBHOOK_SECRET` in Vercel

### 3. Redeploy

After adding env vars, trigger a new deployment on Vercel for the changes to take effect.

## Project Structure

```
api/
├── create-checkout-session.js   — Creates Stripe Checkout session with ride fare
└── webhook.js                   — Handles Stripe webhook events (payment confirmation)
```

## How It Works

1. User selects pickup/dropoff and vehicle type
2. Fare is calculated client-side using `src/lib/pricing.js`
3. User clicks "Confirm ride"
4. Frontend calls `POST /api/create-checkout-session` with `{ amount, description }`
5. Serverless function creates a Stripe Checkout Session with the fare
6. User is redirected to Stripe's hosted payment page
7. After payment, user is redirected back to `/book?payment=success`
8. Stripe sends `checkout.session.completed` webhook to `/api/webhook`

## Currency

Payments are processed in **BSD** (Bahamian Dollar), which is pegged 1:1 to USD.

## Testing

Use these test card numbers in [Stripe test mode](https://dashboard.stripe.com/test/apikeys):

| Card Number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 3220` | 3D Secure required |
| `4000 0000 0000 9995` | Declined |

Use any future expiry date and any 3-digit CVC.

## Next Steps

- [ ] Replace placeholder keys in `.env` with real Stripe keys
- [ ] Add Stripe keys to Vercel environment variables
- [ ] Create webhook endpoint in Stripe Dashboard
- [ ] Test a payment flow with test keys first (`pk_test_...`, `sk_test_...`)
- [ ] Switch to live keys when ready
- [ ] Add ride creation in Supabase after successful payment (webhook handler)
- [ ] Add payment receipt/confirmation screen at `/book?payment=success`

## Resources

- Stripe Support: https://support.stripe.com
- Stripe Docs: https://docs.stripe.com
- Stripe MCP: https://docs.stripe.com/mcp
