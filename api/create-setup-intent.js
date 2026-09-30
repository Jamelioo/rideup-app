import Stripe from 'stripe'
import { admin, requireUser, fail } from './_auth.js'
import { rateLimit } from './_rateLimit.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const checkRate = rateLimit({ maxRequests: 10, windowMs: 60_000 })

// Creates a SetupIntent for the *signed-in* user. The user id comes from the verified JWT, never the body.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const blocked = checkRate(req)
  if (blocked) {
    res.setHeader('Retry-After', blocked.retryAfter)
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' })
  }

  const user = await requireUser(req, res)
  if (!user) return

  const { name } = req.body || {}

  try {
    const { data: rider } = await admin
      .from('riders')
      .select('stripe_customer_id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    let customerId = rider?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        name: typeof name === 'string' ? name.slice(0, 100) : undefined,
        email: user.email || undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      await admin.from('riders').update({ stripe_customer_id: customerId }).eq('auth_user_id', user.id)
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    })

    return res.status(200).json({ client_secret: setupIntent.client_secret, customer_id: customerId })
  } catch (err) {
    return fail(res, 'Setup intent error', err)
  }
}
