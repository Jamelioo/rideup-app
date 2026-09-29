import Stripe from 'stripe'
import { rateLimit } from './_rateLimit.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const checkRate = rateLimit({ maxRequests: 10, windowMs: 60_000 })

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const blocked = checkRate(req)
  if (blocked) {
    res.setHeader('Retry-After', blocked.retryAfter)
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' })
  }

  const { sessionId } = req.body

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing session_id' })
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    res.status(200).json({
      paid: session.payment_status === 'paid',
      amount: session.amount_total,
      rideId: session.metadata?.rideId || null,
    })
  } catch (err) {
    console.error('Stripe verify error:', err.message)
    res.status(500).json({ error: 'Could not verify payment session' })
  }
}
