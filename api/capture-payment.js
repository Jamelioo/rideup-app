import Stripe from 'stripe'
import { admin, requireUser, rideRoles, fail } from './_auth.js'
import { rateLimit } from './_rateLimit.js'
import { sendEmail, tripReceiptEmail } from './_email.js'
import { pushToUser, rideParticipants } from './_push.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const checkRate = rateLimit({ maxRequests: 20, windowMs: 60_000 })

// Captures the held payment once the ride is completed. Only the ride's driver (or an admin) may call it.
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
    if (!roles.driver && !roles.admin) return res.status(403).json({ error: 'Not allowed' })

    if (ride.status !== 'completed') return res.status(409).json({ error: 'Ride is not completed' })
    if (ride.payment_status === 'captured') return res.status(200).json({ success: true, already_captured: true })
    if (!ride.payment_intent_id || ride.payment_status !== 'authorized') {
      return res.status(400).json({ error: 'No authorized payment for this ride' })
    }

    await stripe.paymentIntents.capture(ride.payment_intent_id, undefined, {
      idempotencyKey: `capture-ride-${rideId}`,
    })

    await admin
      .from('rides')
      .update({ payment_status: 'captured', paid_at: new Date().toISOString() })
      .eq('id', rideId)

    // Receipt (email + push), like Uber's end-of-trip receipt.
    const { data: full } = await admin.from('rides').select('*').eq('id', rideId).maybeSingle()
    const people = await rideParticipants(rideId)
    if (full && people.riderEmail) await sendEmail({ to: people.riderEmail, ...tripReceiptEmail({ ride: full, driverName: people.driverName }) })
    await pushToUser(people.riderUserId, { title: 'You’ve arrived', body: 'Rate your trip and view your receipt.', url: `/rate/${rideId}`, tag: `ride-${rideId}` })

    return res.status(200).json({ success: true })
  } catch (err) {
    return fail(res, 'Capture payment error', err)
  }
}
