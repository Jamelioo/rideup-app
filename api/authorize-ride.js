import Stripe from 'stripe'
import { admin, requireUser, getDriverForUser, fail } from './_auth.js'
import { rateLimit } from './_rateLimit.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const checkRate = rateLimit({ maxRequests: 20, windowMs: 60_000 })

async function cancelForPayment(rideId) {
  await admin
    .from('rides')
    .update({ status: 'cancelled', cancel_reason: 'payment_failed', cancelled_at: new Date().toISOString() })
    .eq('id', rideId)
}

// Called by the driver right after claiming a ride (accept_ride RPC leaves it in
// 'pending_driver_response'). Holds the rider's card, then promotes the ride to 'accepted'.
// If the hold fails the ride is cancelled and the driver is told so.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const blocked = checkRate(req)
  if (blocked) {
    res.setHeader('Retry-After', blocked.retryAfter)
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' })
  }

  const user = await requireUser(req, res)
  if (!user) return

  const { rideId } = req.body || {}
  if (!rideId) return res.status(400).json({ error: 'rideId is required' })

  try {
    const driver = await getDriverForUser(user.id)
    if (!driver?.approved) return res.status(403).json({ error: 'Not an approved driver' })

    const { data: ride } = await admin
      .from('rides')
      .select('id, fare_cents, rider_id, driver_id, status, payment_status, payment_intent_id')
      .eq('id', rideId)
      .maybeSingle()

    if (!ride) return res.status(404).json({ error: 'Ride not found' })
    if (ride.driver_id !== driver.id) return res.status(403).json({ error: 'Not your ride' })

    // Idempotent retry
    if (ride.payment_status === 'authorized' && ride.payment_intent_id) {
      return res.status(200).json({ success: true, payment_intent_id: ride.payment_intent_id })
    }
    if (ride.status !== 'pending_driver_response') {
      return res.status(409).json({ success: false, error: 'ride_unavailable' })
    }

    const { data: rider } = await admin
      .from('riders')
      .select('stripe_customer_id, payment_method_id, card_brand, card_last4')
      .eq('id', ride.rider_id)
      .maybeSingle()

    if (!rider?.stripe_customer_id || !rider?.payment_method_id) {
      await cancelForPayment(rideId)
      return res.status(400).json({ success: false, error: 'no_payment_method' })
    }

    let paymentIntent
    try {
      paymentIntent = await stripe.paymentIntents.create(
        {
          amount: ride.fare_cents,
          currency: 'usd',
          customer: rider.stripe_customer_id,
          payment_method: rider.payment_method_id,
          capture_method: 'manual',
          confirm: true,
          off_session: true,
          metadata: { ride_id: rideId },
        },
        { idempotencyKey: `authorize-ride-${rideId}` }
      )
    } catch (err) {
      console.error('Authorize ride Stripe error:', err.message)
      await cancelForPayment(rideId)
      return res.status(400).json({
        success: false,
        error: err.type === 'StripeCardError' ? 'card_declined' : 'payment_failed',
      })
    }

    if (paymentIntent.status !== 'requires_capture') {
      await cancelForPayment(rideId)
      return res.status(400).json({ success: false, error: 'payment_failed' })
    }

    const { data: promoted, error: updateErr } = await admin
      .from('rides')
      .update({
        status: 'accepted',
        payment_intent_id: paymentIntent.id,
        payment_status: 'authorized',
        payment_brand: rider.card_brand || null,
        payment_last4: rider.card_last4 || null,
      })
      .eq('id', rideId)
      .eq('status', 'pending_driver_response')
      .select('id')
    if (updateErr) throw updateErr

    // The rider cancelled while we were holding the card: release it and tell the driver.
    if (!promoted?.length) {
      await stripe.paymentIntents.cancel(paymentIntent.id).catch((e) => console.error('Release hold failed:', e.message))
      await admin.from('rides').update({ payment_status: 'cancelled' }).eq('id', rideId)
      return res.status(409).json({ success: false, error: 'ride_unavailable' })
    }

    return res.status(200).json({ success: true, payment_intent_id: paymentIntent.id })
  } catch (err) {
    return fail(res, 'Authorize ride error', err)
  }
}
