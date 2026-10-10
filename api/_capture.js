import Stripe from 'stripe'
import { admin } from './_auth.js'
import { sendEmail, tripReceiptEmail, splitReceiptEmail } from './_email.js'
import { pushToUser, rideParticipants } from './_push.js'
import { chargeOf, splitShares } from '../src/lib/discounts.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'your friend'

// Charges the held fare for a completed ride and sends the receipt. Safe to call more than once:
// the driver's app calls it at drop-off and the every-minute sweeper (dispatch-scheduled) retries any
// trip whose call never arrived. Stripe's idempotency keys prevent double charges, and only the call
// that flips the row to 'captured' sends the receipt.
// Split fare: friends who accepted are charged their share first; the rider's hold is then captured for
// the rest (a friend whose card fails is covered by the rider, like Uber).
// Cash trips: see settleCash.
export async function captureRide(rideId) {
  const { data: ride } = await admin
    .from('rides')
    .select('*')
    .eq('id', rideId)
    .maybeSingle()
  if (!ride) return { ok: false, status: 404, error: 'Ride not found' }
  if (ride.status !== 'completed') return { ok: false, status: 409, error: 'Ride is not completed' }
  if (ride.payment_method === 'cash') return settleCash(ride)
  if (ride.payment_status === 'captured') return { ok: true, already: true }
  if (!ride.payment_intent_id || ride.payment_status !== 'authorized') {
    return { ok: false, status: 400, error: 'No authorized payment for this ride' }
  }

  const split = await chargeSplits(ride)
  const amount = chargeOf(ride) - split.paid

  try {
    await stripe.paymentIntents.capture(
      ride.payment_intent_id,
      split.paid ? { amount_to_capture: amount } : undefined,
      { idempotencyKey: split.paid ? `capture-ride-${rideId}-${amount}` : `capture-ride-${rideId}` }
    )
  } catch (err) {
    // Already captured elsewhere, or the hold expired (Stripe drops uncaptured holds after 7 days), or the
    // hold doesn't exist under this Stripe key (made in test mode before the switch to live keys).
    let missing = false
    const pi = await stripe.paymentIntents.retrieve(ride.payment_intent_id)
      .catch((e) => { missing = e?.code === 'resource_missing'; return null })
    if (pi?.status !== 'succeeded') {
      if (pi?.status === 'canceled' || missing) {
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
  if (flipped?.[0]) await sendReceipt(flipped[0], split)
  return { ok: true }
}

// A cash trip is paid to the driver at drop-off: they tap "Cash collected", or the sweeper counts it as collected
// a while later (the driver can still report an unpaid fare). Marks it paid and sends the receipt, once.
// A fare the driver reported unpaid stays unpaid.
async function settleCash(ride) {
  if (ride.payment_status !== 'cash_due') return { ok: true, already: true }
  const { data: flipped } = await admin
    .from('rides')
    .update({ payment_status: 'cash_collected', paid_at: new Date().toISOString() })
    .eq('id', ride.id)
    .eq('payment_status', 'cash_due')
    .select('*')
  if (flipped?.[0]) await sendReceipt(flipped[0])
  return { ok: true }
}

async function sendReceipt(ride, split = { paid: 0, friends: 0 }) {
  const people = await rideParticipants(ride.id)
  if (people.riderEmail) {
    await sendEmail({ to: people.riderEmail, ...tripReceiptEmail({ ride, driverName: people.driverName, splitPaidCents: split.paid, splitFriends: split.friends }) })
  }
  await pushToUser(people.riderUserId, { title: 'You’ve arrived', body: 'Rate your trip and view your receipt.', url: `/rate/${ride.id}`, tag: `ride-${ride.id}` })
}

// Returns { paid, friends }: the total friends paid and how many of them.
async function chargeSplits(ride) {
  const { data: splits } = await admin
    .from('fare_splits')
    .select('id, rider_id, status, share_cents')
    .eq('ride_id', ride.id)
    .in('status', ['accepted', 'paid'])
    .order('created_at')
  const out = { paid: 0, friends: 0 }
  const expireRest = () => admin.from('fare_splits').update({ status: 'expired' }).eq('ride_id', ride.id).in('status', ['invited', 'accepted'])
  if (!splits?.length) { await expireRest(); return out }

  const already = splits.filter((s) => s.status === 'paid')
  const countPaid = () => already.forEach((s) => { out.paid += s.share_cents || 0; out.friends++ })
  // If the rider's hold was already captured (an earlier attempt), don't charge anyone new.
  const main = await stripe.paymentIntents.retrieve(ride.payment_intent_id).catch(() => null)
  if (main?.status !== 'requires_capture') { countPaid(); await expireRest(); return out }

  const { friendShare, friends } = splitShares(chargeOf(ride), splits.length)
  if (!friends) { await expireRest(); return out }

  for (const s of splits.slice(0, friends)) {
    if (s.status === 'paid') { out.paid += s.share_cents || 0; out.friends++; continue }
    const { data: friend } = await admin
      .from('riders')
      .select('stripe_customer_id, payment_method_id, card_brand, card_last4, auth_user_id, email')
      .eq('id', s.rider_id)
      .maybeSingle()
    if (!friend?.stripe_customer_id || !friend?.payment_method_id) {
      await admin.from('fare_splits').update({ status: 'failed' }).eq('id', s.id)
      continue
    }
    try {
      const pi = await stripe.paymentIntents.create(
        {
          amount: friendShare,
          currency: 'usd',
          customer: friend.stripe_customer_id,
          payment_method: friend.payment_method_id,
          off_session: true,
          confirm: true,
          description: 'RideUp split fare',
          metadata: { ride_id: ride.id, split_id: s.id, type: 'split' },
        },
        { idempotencyKey: `split-${s.id}` }
      )
      if (pi.status !== 'succeeded') throw new Error(`status ${pi.status}`)
      await admin.from('fare_splits')
        .update({ status: 'paid', share_cents: friendShare, payment_intent_id: pi.id, paid_at: new Date().toISOString() })
        .eq('id', s.id)
      out.paid += friendShare
      out.friends++
      const card = friend.card_last4 ? `${friend.card_brand || 'Card'} •••• ${friend.card_last4}` : ''
      if (friend.email) await sendEmail({ to: friend.email, ...splitReceiptEmail({ ride, inviter: firstName(ride.rider_name), shareCents: friendShare, card }) })
      await pushToUser(friend.auth_user_id, { title: 'Split fare paid', body: `Your share of the trip with ${firstName(ride.rider_name)} was charged.`, url: '/my-rides', tag: `split-${s.id}` })
    } catch (err) {
      console.error('Split fare charge failed:', s.id, err.message)
      await admin.from('fare_splits').update({ status: 'failed' }).eq('id', s.id)
    }
  }
  await expireRest()
  return out
}
