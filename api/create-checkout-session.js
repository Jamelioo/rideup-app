import Stripe from 'stripe'
import { admin, requireUser, getRiderForUser, fail } from './_auth.js'
import { rateLimit } from './_rateLimit.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const checkRate = rateLimit({ maxRequests: 5, windowMs: 60_000 })

// The amount always comes from the ride row in the database, never from the request.
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
    const rider = await getRiderForUser(user.id)
    const { data: ride } = await admin
      .from('rides')
      .select('id, rider_id, fare_cents, payment_status')
      .eq('id', rideId)
      .maybeSingle()

    if (!ride || !rider || ride.rider_id !== rider.id) return res.status(404).json({ error: 'Ride not found' })
    if (!ride.fare_cents || ride.fare_cents < 100) return res.status(400).json({ error: 'Invalid amount' })
    if (['captured', 'paid'].includes(ride.payment_status)) return res.status(409).json({ error: 'Already paid' })

    const domain = process.env.DOMAIN || 'https://rideupnassau.com'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `${domain}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${domain}/book?payment=cancelled`,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'RideUp Ride' },
            unit_amount: ride.fare_cents,
          },
          quantity: 1,
        },
      ],
      phone_number_collection: { enabled: true },
      customer_email: user.email || undefined,
      metadata: { rideId: ride.id },
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    return fail(res, 'Stripe checkout error', err)
  }
}
