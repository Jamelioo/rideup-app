import { admin } from './_auth.js'
import { sendEmail, tripReceiptEmail } from './_email.js'
import { chargeOf } from '../src/lib/discounts.js'
import { formatFare } from '../src/lib/pricing.js'
import { pushToUser, rideParticipants } from './_push.js'
import { notifyPassenger } from './_passenger.js'

// Every trip is paid in cash to the driver at drop-off. Two steps, both safe to call more than once:
//   confirmRide: a driver has claimed the ride ('pending_driver_response'); confirm it ('accepted', cash due) and tell
//                the rider their driver is on the way and how much cash to have ready.
//   settleRide:  the trip is over; the driver tapped "Cash collected" (or the sweeper counts it as collected a while
//                later). Marks it paid and sends the receipt, once. A fare the driver reported unpaid stays unpaid.

const CONFIRMED = ['accepted', 'driver_arrived', 'in_progress', 'completed']

// Used when a driver accepts (authorize-ride) and when an admin assigns a driver (admin-assign).
//   ride: id, status, payment_status, fare_cents, promo_discount_cents, credit_applied_cents
// Returns { ok: true } or { ok: false, status, error: 'ride_unavailable' }.
export async function confirmRide(ride) {
  if (CONFIRMED.includes(ride.status) && ride.payment_status === 'cash_due') return { ok: true } // a retry
  if (ride.status !== 'pending_driver_response') return { ok: false, status: 409, error: 'ride_unavailable' }
  const { data: promoted, error } = await admin
    .from('rides')
    .update({ status: 'accepted', payment_method: 'cash', payment_status: 'cash_due' })
    .eq('id', ride.id)
    .eq('status', 'pending_driver_response')
    .select('id')
  if (error) throw error
  if (!promoted?.length) return { ok: false, status: 409, error: 'ride_unavailable' }

  const people = await rideParticipants(ride.id)
  const driver = (people.driverName || 'Your driver').split(' ')[0]
  await pushToUser(people.riderUserId, {
    title: 'Driver on the way',
    body: `${driver} accepted your ride. Pay ${formatFare(chargeOf(ride))} in cash at drop-off.`,
    url: `/ride/${ride.id}`,
    tag: `ride-${ride.id}`,
  })
  await notifyPassenger(ride.id, 'accepted') // booked for someone else: text them the driver and a trip link
  return { ok: true }
}

// Used by the driver's "Cash collected" (capture-payment), Admin › Live "Complete trip" (admin-complete) and the
// every-minute sweeper (dispatch-scheduled).
// Returns { ok: true, already? } or { ok: false, status, error }.
export async function settleRide(rideId) {
  const { data: ride } = await admin.from('rides').select('*').eq('id', rideId).maybeSingle()
  if (!ride) return { ok: false, status: 404, error: 'Ride not found' }
  if (ride.status !== 'completed') return { ok: false, status: 409, error: 'Ride is not completed' }
  if (ride.payment_status !== 'cash_due') return { ok: true, already: true }
  const { data: flipped, error } = await admin
    .from('rides')
    .update({ payment_status: 'cash_collected', paid_at: new Date().toISOString() })
    .eq('id', ride.id)
    .eq('payment_status', 'cash_due')
    .select('*')
  if (error) throw error
  if (flipped?.[0]) await sendReceipt(flipped[0])
  return { ok: true }
}

async function sendReceipt(ride) {
  const people = await rideParticipants(ride.id)
  if (people.riderEmail) await sendEmail({ to: people.riderEmail, ...tripReceiptEmail({ ride, driverName: people.driverName }) })
  await pushToUser(people.riderUserId, { title: 'You’ve arrived', body: 'Rate your trip and view your receipt.', url: `/rate/${ride.id}`, tag: `ride-${ride.id}` })
}
