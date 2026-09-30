import Stripe from 'stripe'
import { admin, requireUser, rideRoles, fail } from './_auth.js'
import { rateLimit } from './_rateLimit.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const checkRate = rateLimit({ maxRequests: 20, windowMs: 60_000 })

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

  const { rideId } = req.body || {}
  if (!rideId) return res.status(400).json({ error: 'rideId is required' })

  try {
    const { data: ride } = await admin
      .from('rides')
      .select('id, rider_id, driver_id, status, payment_intent_id, payment_status')
      .eq('id', rideId)
      .maybeSingle()
    if (!ride) return res.status(404).json({ error: 'Ride not found' })

    const roles = await rideRoles(ride, user)
    if (!roles.rider && !roles.driver && !roles.admin) return res.status(403).json({ error: 'Not allowed' })

    if (['in_progress', 'completed'].includes(ride.status) && !roles.admin) {
      return res.status(409).json({ error: 'Trip already started' })
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
