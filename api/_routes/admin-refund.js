import Stripe from 'stripe'
import { admin, requireUser, isAdmin, fail } from '../_auth.js'
import { rateLimit } from '../_rateLimit.js'
import { chargeOf } from '../../src/lib/discounts.js'
import { pushToUser } from '../_push.js'
import { sendEmail, refundEmail } from '../_email.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const checkRate = rateLimit({ maxRequests: 20, windowMs: 60_000 })
const PAID = ['captured', 'paid', 'partially_refunded']

// Admin-only refunds and goodwill credit, recorded with a reason (Uber-style support tools).
//   body: { rideId, target: 'fare'|'tip', method: 'card'|'credit', amountCents, reason, chargeDriver?: boolean }
//   card   → refunded to the rider's card through Stripe
//   credit → added to the rider's RideUp credit (used automatically on their next rides)
//   chargeDriver → the driver's share of the refunded amount comes off their earnings (e.g. a much longer route).
//                  Tip refunds always come out of the driver's earnings, since tips are 100% theirs.
//   { rideId, preview: true } returns what can still be refunded.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const blocked = checkRate(req)
  if (blocked) {
    res.setHeader('Retry-After', blocked.retryAfter)
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' })
  }
  const user = await requireUser(req, res)
  if (!user) return
  if (!isAdmin(user)) return res.status(403).json({ error: 'Admins only' })

  const { rideId, target = 'fare', method = 'card', amountCents, reason, chargeDriver = false, preview } = req.body || {}
  if (!rideId) return res.status(400).json({ error: 'rideId is required' })

  try {
    const { data: ride } = await admin
      .from('rides')
      .select('id, rider_id, status, payment_status, payment_intent_id, fare_cents, promo_discount_cents, credit_applied_cents, cancel_fee_cents, driver_payout_cents, tip_cents, tip_payment_intent_id, pickup_address, dropoff_address')
      .eq('id', rideId)
      .maybeSingle()
    if (!ride) return res.status(404).json({ error: 'Ride not found' })

    const limits = await refundable(ride)
    if (preview) return res.status(200).json(limits)

    if (!['fare', 'tip'].includes(target) || !['card', 'credit'].includes(method)) return res.status(400).json({ error: 'Choose what to refund and how.' })
    const amount = Math.round(Number(amountCents))
    const note = String(reason || '').trim()
    if (!(amount > 0)) return res.status(400).json({ error: 'Enter an amount.' })
    if (note.length < 3 || note.length > 300) return res.status(400).json({ error: 'Add a short reason (it’s kept with the ride).' })
    const left = target === 'tip' ? limits.tip_left_cents : limits.fare_left_cents
    if (amount > left) return res.status(400).json({ error: `At most $${(left / 100).toFixed(2)} can be refunded.` })

    // Driver's part: all of a tip; for a fare, their share of the amount if they were at fault.
    const base = ride.status === 'completed' ? ride.fare_cents : ride.cancel_fee_cents
    const driverDeduction = target === 'tip' ? amount
      : chargeDriver && base > 0 ? Math.round(amount * Math.max(0, ride.driver_payout_cents || 0) / base) : 0

    let stripeRefundId = null
    if (method === 'card') {
      const intent = target === 'tip' ? ride.tip_payment_intent_id : ride.payment_intent_id
      const refund = await stripe.refunds.create(
        { payment_intent: intent, amount, reason: 'requested_by_customer', metadata: { ride_id: ride.id, target, admin_id: user.id } },
        { idempotencyKey: `refund-${ride.id}-${target}-${limits.refund_count}-${amount}` }
      )
      stripeRefundId = refund.id
    } else {
      const { data: r } = await admin.from('riders').select('credit_cents').eq('id', ride.rider_id).maybeSingle()
      const { error: creditErr } = await admin.from('riders').update({ credit_cents: (r?.credit_cents || 0) + amount }).eq('id', ride.rider_id)
      if (creditErr) throw creditErr
    }

    const { data: saved, error: saveErr } = await admin.from('ride_refunds').insert({
      ride_id: ride.id, target, method, amount_cents: amount, driver_deduction_cents: driverDeduction,
      reason: note, stripe_refund_id: stripeRefundId, created_by: user.id,
    }).select('*').single()
    if (saveErr) throw saveErr

    if (method === 'card' && target === 'fare') {
      const fully = amount >= limits.fare_left_cents
      await admin.from('rides').update({ payment_status: fully ? 'refunded' : 'partially_refunded' }).eq('id', ride.id)
    }

    const { data: rider } = await admin.from('riders').select('auth_user_id, email').eq('id', ride.rider_id).maybeSingle()
    const what = method === 'card' ? 'refunded to your card' : 'added to your RideUp credit'
    await pushToUser(rider?.auth_user_id, { title: 'Refund issued', body: `$${(amount / 100).toFixed(2)} was ${what}.`, url: `/receipt/${ride.id}`, tag: `refund-${saved.id}` })
    if (rider?.email) await sendEmail({ to: rider.email, ...refundEmail({ ride, amountCents: amount, method, target }) })

    return res.status(200).json({ ok: true, refund: saved, ...(await refundable(ride)) })
  } catch (err) {
    if (err?.type === 'StripeInvalidRequestError') return res.status(400).json({ error: `Stripe: ${err.message}` })
    return fail(res, 'Admin refund error', err)
  }
}

// What was paid for the fare (or cancellation fee) and the tip, minus earlier refunds.
async function refundable(ride) {
  const { data: prior } = await admin.from('ride_refunds').select('target, method, amount_cents').eq('ride_id', ride.id)
  const sum = (t, m) => (prior || []).filter((p) => p.target === t && (!m || p.method === m)).reduce((s, p) => s + p.amount_cents, 0)
  const { data: splits } = await admin.from('fare_splits').select('share_cents').eq('ride_id', ride.id).eq('status', 'paid')
  const splitPaid = (splits || []).reduce((s, x) => s + (x.share_cents || 0), 0)

  const farePaid = !PAID.includes(ride.payment_status) && ride.payment_status !== 'refunded' ? 0
    : ride.status === 'completed' ? Math.max(0, chargeOf(ride) - splitPaid)
    : ride.status === 'cancelled' ? (ride.cancel_fee_cents || 0) : 0
  const tipPaid = ride.tip_payment_intent_id ? ride.tip_cents || 0 : 0
  return {
    fare_paid_cents: farePaid,
    fare_left_cents: Math.max(0, farePaid - sum('fare')),
    tip_paid_cents: tipPaid,
    tip_left_cents: Math.max(0, tipPaid - sum('tip')),
    refund_count: (prior || []).length,
    refunds: prior || [],
  }
}
