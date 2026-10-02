import Stripe from 'stripe'
import { admin } from './_auth.js'
import { sendEmail, tripReceiptEmail } from './_email.js'
import { pushToUser, rideParticipants } from './_push.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Charges the held fare for a completed ride and sends the receipt. Safe to call more than once:
// the driver's app calls it at drop-off and the every-minute sweeper (dispatch-scheduled) retries any
// trip whose call never arrived. Stripe's idempotency key prevents a double capture, and only the call
// that flips the row to 'captured' sends the receipt.
export async function captureRide(rideId) {
  const { data: ride } = await admin
    .from('rides')
    .select('id, status, payment_intent_id, payment_status')
    .eq('id', rideId)
    .maybeSingle()
  if (!ride) return { ok: false, status: 404, error: 'Ride not found' }
  if (ride.status !== 'completed') return { ok: false, status: 409, error: 'Ride is not completed' }
  if (ride.payment_status === 'captured') return { ok: true, already: true }
  if (!ride.payment_intent_id || ride.payment_status !== 'authorized') {
    return { ok: false, status: 400, error: 'No authorized payment for this ride' }
  }

  try {
    await stripe.paymentIntents.capture(ride.payment_intent_id, undefined, { idempotencyKey: `capture-ride-${rideId}` })
  } catch (err) {
    // Already captured elsewhere, or the hold expired (Stripe drops uncaptured holds after 7 days).
    const pi = await stripe.paymentIntents.retrieve(ride.payment_intent_id).catch(() => null)
    if (pi?.status !== 'succeeded') {
      if (pi?.status === 'canceled') {
        await admin.from('rides').update({ payment_status: 'failed' }).eq('id', rideId).eq('payment_status', 'authorized')
      }
      throw err
    }
  }

  const { data: flipped } = await admin
    .from('rides')
    .update({ payment_status: 'captured', paid_at: new Date().toISOString() })
    .eq('id', rideId)
    .eq('payment_status', 'authorized')
    .select('*')
  const full = flipped?.[0]
  if (full) {
    const people = await rideParticipants(rideId)
    if (people.riderEmail) await sendEmail({ to: people.riderEmail, ...tripReceiptEmail({ ride: full, driverName: people.driverName }) })
    await pushToUser(people.riderUserId, { title: 'You’ve arrived', body: 'Rate your trip and view your receipt.', url: `/rate/${rideId}`, tag: `ride-${rideId}` })
  }
  return { ok: true }
}
