import Stripe from 'stripe'
import { admin, requireUser, fail } from '../_auth.js'
import { rateLimit } from '../_rateLimit.js'
import { usableCustomerId, stripeConfigMessage } from '../_stripeCustomer.js'
import { captureServerError } from '../_monitor.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const checkRate = rateLimit({ maxRequests: 10, windowMs: 60_000 })

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const blocked = checkRate(req)
  if (blocked) {
    res.setHeader('Retry-After', blocked.retryAfter)
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' })
  }

  const user = await requireUser(req, res)
  if (!user) return

  try {
    const domain = process.env.DOMAIN || 'https://rideupnassau.com'

    // Use the customer stored for this user (created on demand) instead of looking one up by an emailed-in address.
    const { data: rider } = await admin
      .from('riders')
      .select('stripe_customer_id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    const customerId = await usableCustomerId(stripe, { userId: user.id, savedId: rider?.stripe_customer_id, email: user.email })

    const session = await stripe.checkout.sessions.create({
      mode: 'setup',
      ui_mode: 'hosted_page',
      customer: customerId,
      success_url: `${domain}/payments?card=added`,
      cancel_url: `${domain}/payments`,
      payment_method_types: ['card'],
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    const message = stripeConfigMessage(err)
    if (message) { console.error('Setup session error (Stripe key):', err.message); await captureServerError('Setup session error (Stripe key)', err); return res.status(503).json({ error: message }) }
    return fail(res, 'Setup session error', err)
  }
}
