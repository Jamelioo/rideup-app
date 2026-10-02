import Stripe from 'stripe'
import { admin, requireUser, getRiderForUser, fail } from '../_auth.js'
import { rateLimit } from '../_rateLimit.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const checkRate = rateLimit({ maxRequests: 10, windowMs: 60_000 })

// After the browser confirms a SetupIntent, the client tells us its id. We re-read it from
// Stripe, make sure it belongs to THIS user's customer, and only then store the card.
// (riders.payment_method_id is not writable by the client.)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const blocked = checkRate(req)
  if (blocked) {
    res.setHeader('Retry-After', blocked.retryAfter)
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' })
  }

  const user = await requireUser(req, res)
  if (!user) return

  const { setupIntentId } = req.body || {}
  if (typeof setupIntentId !== 'string' || !setupIntentId.startsWith('seti_')) {
    return res.status(400).json({ error: 'setupIntentId is required' })
  }

  try {
    const rider = await getRiderForUser(user.id)
    if (!rider?.stripe_customer_id) return res.status(400).json({ error: 'No customer for this account' })

    const si = await stripe.setupIntents.retrieve(setupIntentId, { expand: ['payment_method'] })
    if (si.customer !== rider.stripe_customer_id) return res.status(403).json({ error: 'Not your card' })
    if (si.status !== 'succeeded' || !si.payment_method) return res.status(400).json({ error: 'Card was not confirmed' })

    const pm = si.payment_method
    const { error } = await admin
      .from('riders')
      .update({
        payment_method_id: pm.id,
        card_brand: pm.card?.brand || null,
        card_last4: pm.card?.last4 || null,
        card_fingerprint: pm.card?.fingerprint || null, // same card on another account → promo/referral abuse checks
      })
      .eq('id', rider.id)
    if (error) throw error

    return res.status(200).json({ success: true, brand: pm.card?.brand || null, last4: pm.card?.last4 || null })
  } catch (err) {
    return fail(res, 'Save payment method error', err)
  }
}
