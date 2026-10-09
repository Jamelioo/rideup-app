import Stripe from 'stripe'
import { admin } from './_auth.js'
import { chargeOf } from '../src/lib/discounts.js'
import { pushToUser, rideParticipants } from './_push.js'
import { notifyPassenger } from './_passenger.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// The rider's screen waits on this status, and the driver can't take another ride until it changes,
// so make sure it is written (retry once) and log loudly if it isn't.
async function cancelForPayment(rideId) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await admin
      .from('rides')
      .update({ status: 'cancelled', cancel_reason: 'payment_failed', cancelled_at: new Date().toISOString() })
      .eq('id', rideId)
      .in('status', ['requested', 'pending_driver_response'])
    if (!error) return
    console.error('Cancel after failed payment did not save:', rideId, error.message)
  }
}

// Holds the rider's card for a ride a driver has just claimed ('pending_driver_response'), then confirms the
// ride ('accepted') and tells the rider their driver is on the way. Used when a driver accepts
// (authorize-ride) and when an admin assigns a driver (admin-assign). If the hold fails the ride is cancelled.
//   ride: id, fare_cents, promo_discount_cents, credit_applied_cents, rider_id, status, payment_status, payment_intent_id
// Returns { ok: true, paymentIntentId } or { ok: false, status, error } with error one of
// 'ride_unavailable', 'no_payment_method', 'card_declined', 'payment_failed'.
export async function holdCardAndConfirm(ride) {
  const rideId = ride.id
  // Idempotent retry
  if (ride.payment_status === 'authorized' && ride.payment_intent_id) {
    return { ok: true, paymentIntentId: ride.payment_intent_id }
  }
  if (ride.status !== 'pending_driver_response') return { ok: false, status: 409, error: 'ride_unavailable' }

  const { data: rider } = await admin
    .from('riders')
    .select('stripe_customer_id, payment_method_id, card_brand, card_last4')
    .eq('id', ride.rider_id)
    .maybeSingle()

  if (!rider?.stripe_customer_id || !rider?.payment_method_id) {
    await cancelForPayment(rideId)
    return { ok: false, status: 400, error: 'no_payment_method' }
  }

  let paymentIntent
  try {
    paymentIntent = await stripe.paymentIntents.create(
      {
        amount: chargeOf(ride), // fare minus promo/referral discount and ride credit (RideUp pays those)
        currency: 'usd',
        customer: rider.stripe_customer_id,
        payment_method: rider.payment_method_id,
        capture_method: 'manual',
        confirm: true,
        off_session: true,
        metadata: { ride_id: rideId },
      },
      { idempotencyKey: `authorize-ride-${rideId}` }
    )
  } catch (err) {
    console.error('Authorize ride Stripe error:', err.message)
    await cancelForPayment(rideId)
    return { ok: false, status: 400, error: err.type === 'StripeCardError' ? 'card_declined' : 'payment_failed' }
  }

  if (paymentIntent.status !== 'requires_capture') {
    await cancelForPayment(rideId)
    return { ok: false, status: 400, error: 'payment_failed' }
  }

  const { data: promoted, error: updateErr } = await admin
    .from('rides')
    .update({
      status: 'accepted',
      payment_intent_id: paymentIntent.id,
      payment_status: 'authorized',
      payment_brand: rider.card_brand || null,
      payment_last4: rider.card_last4 || null,
    })
    .eq('id', rideId)
    .eq('status', 'pending_driver_response')
    .select('id')
  if (updateErr) throw updateErr

  // The rider cancelled while we were holding the card: release it.
  if (!promoted?.length) {
    await stripe.paymentIntents.cancel(paymentIntent.id).catch((e) => console.error('Release hold failed:', e.message))
    await admin.from('rides').update({ payment_status: 'cancelled' }).eq('id', rideId)
    return { ok: false, status: 409, error: 'ride_unavailable' }
  }

  const people = await rideParticipants(rideId)
  await pushToUser(people.riderUserId, {
    title: 'Driver on the way',
    body: `${(people.driverName || 'Your driver').split(' ')[0]} accepted your ride.`,
    url: `/ride/${rideId}`,
    tag: `ride-${rideId}`,
  })

  await notifyPassenger(rideId, 'accepted') // booked for someone else: text them the driver and a trip link

  return { ok: true, paymentIntentId: paymentIntent.id }
}
