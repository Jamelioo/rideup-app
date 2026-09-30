import Stripe from 'stripe'
import { admin, requireUser, rideRoles, fail } from './_auth.js'
import { rateLimit } from './_rateLimit.js'
import { cancellationFeeCents } from './_fees.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const checkRate = rateLimit({ maxRequests: 20, windowMs: 60_000 })

// Cancellation fee (off by default). A rider who cancels after the free grace period, once a driver has
// accepted, pays a flat fee (never more than the fare) taken from the card hold. Driver/admin cancels are free.
//   CANCEL_FEE_CENTS      e.g. 300 for $3.00 (0 or unset = no fee)
//   CANCEL_GRACE_SECONDS  free window after the driver accepts (default 120)
const FEE_CENTS = Math.max(0, parseInt(process.env.CANCEL_FEE_CENTS || '0', 10) || 0)
const GRACE_SECONDS = Math.max(0, parseInt(process.env.CANCEL_GRACE_SECONDS || '120', 10) || 0)

// Releases a payment hold. Only the ride's rider, its driver, or an admin may call it,
// and never once the trip has started.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const blocked = checkRate(req)
  if (blocked) {
    res.setHeader('Retry-After', blocked.retryAfter)
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' })
  }

  const user = await requireUser(req, res)
  if (!user) return

  const { rideId, preview } = req.body || {}
  if (!rideId) return res.status(400).json({ error: 'rideId is required' })

  try {
    const { data: ride } = await admin
      .from('rides')
      .select('id, rider_id, driver_id, status, fare_cents, accepted_at, payment_intent_id, payment_status')
      .eq('id', rideId)
      .maybeSingle()
    if (!ride) return res.status(404).json({ error: 'Ride not found' })

    const roles = await rideRoles(ride, user)
    if (!roles.rider && !roles.driver && !roles.admin) return res.status(403).json({ error: 'Not allowed' })

    if (['in_progress', 'completed'].includes(ride.status) && !roles.admin) {
      return res.status(409).json({ error: 'Trip already started' })
    }

    const feeCents = cancellationFeeCents({
      role: roles.rider && !roles.driver && !roles.admin ? 'rider' : 'other',
      status: ride.status,
      paymentStatus: ride.payment_status,
      acceptedAt: ride.accepted_at,
      fareCents: ride.fare_cents,
      feeCents: FEE_CENTS,
      graceSeconds: GRACE_SECONDS,
    })

    // The app asks first so it can warn the rider before they cancel.
    if (preview) return res.status(200).json({ fee_cents: feeCents, grace_seconds: GRACE_SECONDS })

    if (feeCents > 0) {
      await stripe.paymentIntents.capture(ride.payment_intent_id, { amount_to_capture: feeCents }, {
        idempotencyKey: `cancel-fee-${rideId}`,
      })
      await admin
        .from('rides')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancel_reason: 'cancelled_by_rider',
          cancel_fee_cents: feeCents,
          payment_status: 'captured',
          paid_at: new Date().toISOString(),
        })
        .eq('id', rideId)
      return res.status(200).json({ success: true, fee_cents: feeCents })
    }

    if (ride.payment_intent_id && ride.payment_status === 'authorized') {
      await stripe.paymentIntents.cancel(ride.payment_intent_id)
      await admin.from('rides').update({ payment_status: 'cancelled' }).eq('id', rideId)
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    return fail(res, 'Cancel payment error', err)
  }
}
