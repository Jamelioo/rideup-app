import Stripe from 'stripe'
import { admin, requireUser, getRiderForUser, fail } from './_auth.js'
import { rateLimit } from './_rateLimit.js'
import { sendEmail, tipReceiptEmail } from './_email.js'
import { pushToUser, rideParticipants } from './_push.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const checkRate = rateLimit({ maxRequests: 10, windowMs: 60_000 })

const MIN_TIP = 100        // $1
const MAX_TIP = 10_000     // $100
const TIP_WINDOW_HOURS = 72

// Rider tips after a completed trip (Uber: within a few days, 100% to the driver).
// Charged as its own payment on the card on file.
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
  const amount = Math.round(Number(req.body?.amountCents))
  if (!rideId) return res.status(400).json({ error: 'rideId is required' })
  if (!Number.isFinite(amount) || amount < MIN_TIP || amount > MAX_TIP) {
    return res.status(400).json({ error: 'Tips can be between $1 and $100.' })
  }

  try {
    const rider = await getRiderForUser(user.id)
    const { data: ride } = await admin
      .from('rides')
      .select('id, rider_id, status, completed_at, tip_cents, pickup_address, dropoff_address')
      .eq('id', rideId)
      .maybeSingle()
    if (!ride || !rider || ride.rider_id !== rider.id) return res.status(404).json({ error: 'Ride not found' })
    if (ride.status !== 'completed') return res.status(409).json({ error: 'You can tip after the trip is completed.' })
    if (ride.tip_cents > 0) return res.status(409).json({ error: 'You already tipped for this trip.' })
    if (!ride.completed_at || Date.now() - new Date(ride.completed_at).getTime() > TIP_WINDOW_HOURS * 3600_000) {
      return res.status(409).json({ error: 'Tips can be added up to 3 days after a trip.' })
    }
    if (!rider.stripe_customer_id || !rider.payment_method_id) return res.status(400).json({ error: 'Add a card to tip.' })

    const pi = await stripe.paymentIntents.create(
      {
        amount,
        currency: 'usd',
        customer: rider.stripe_customer_id,
        payment_method: rider.payment_method_id,
        confirm: true,
        off_session: true,
        description: 'RideUp tip',
        metadata: { ride_id: rideId, type: 'tip' },
      },
      { idempotencyKey: `tip-${rideId}` }
    )
    if (pi.status !== 'succeeded') return res.status(402).json({ error: 'Your card didn’t go through for the tip.' })

    await admin.from('rides').update({ tip_cents: amount, tip_payment_intent_id: pi.id }).eq('id', rideId).eq('tip_cents', 0)

    const people = await rideParticipants(rideId)
    await pushToUser(people.driverUserId, { title: 'You got a tip!', body: `A rider tipped you $${(amount / 100).toFixed(2)}.`, url: '/driver/earnings' })
    if (people.riderEmail) await sendEmail({ to: people.riderEmail, ...tipReceiptEmail({ ride, tipCents: amount }) })

    return res.status(200).json({ success: true, tip_cents: amount })
  } catch (err) {
    if (err.type === 'StripeCardError') return res.status(402).json({ error: 'Your card was declined for the tip.' })
    return fail(res, 'Add tip error', err)
  }
}
