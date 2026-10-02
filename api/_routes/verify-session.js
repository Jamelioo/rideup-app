import Stripe from 'stripe'
import { admin, requireUser, getRiderForUser, fail } from '../_auth.js'
import { rateLimit } from '../_rateLimit.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const checkRate = rateLimit({ maxRequests: 10, windowMs: 60_000 })

// Confirms a Checkout session was paid. Signed-in riders only, and only for sessions that belong to
// one of their own rides, so a leaked session id can't be used to read someone else's payment.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const blocked = checkRate(req)
  if (blocked) {
    res.setHeader('Retry-After', blocked.retryAfter)
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' })
  }

  const user = await requireUser(req, res)
  if (!user) return

  const { sessionId } = req.body || {}
  if (typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
    return res.status(400).json({ error: 'Missing session_id' })
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const rideId = session.metadata?.rideId || null

    if (rideId) {
      const rider = await getRiderForUser(user.id)
      const { data: ride } = await admin.from('rides').select('rider_id').eq('id', rideId).maybeSingle()
      if (!rider || !ride || ride.rider_id !== rider.id) return res.status(404).json({ error: 'Session not found' })
    } else {
      return res.status(404).json({ error: 'Session not found' })
    }

    return res.status(200).json({
      paid: session.payment_status === 'paid',
      amount: session.amount_total,
      rideId,
    })
  } catch (err) {
    return fail(res, 'Stripe verify error', err)
  }
}
