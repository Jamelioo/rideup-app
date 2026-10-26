import { admin, requireUser, rideRoles, fail } from '../_auth.js'
import { rateLimit } from '../_rateLimit.js'
import { isLateCancel, noShowAllowed } from '../_cancelRules.js'
import { pushToUser, rideParticipants } from '../_push.js'
import { notifyNearbyDrivers } from '../_notifyDrivers.js'
import { alertRideRequest } from '../_staffAlerts.js'
import { logAdminAction } from '../_audit.js'
import { grantDriverCancelCredit } from '../_credit.js'
import { guaranteeApplies } from '../../src/lib/guarantee.js'

const checkRate = rateLimit({ maxRequests: 20, windowMs: 60_000 })

// Policy (Uber-style), overridable with env vars. The database counts late cancellations after 2 minutes, so keep
// CANCEL_GRACE_SECONDS at 120 unless the database rule changes too.
const GRACE_SECONDS = Math.max(0, parseInt(process.env.CANCEL_GRACE_SECONDS || '120', 10) || 0)
const FREE_WAIT_SECONDS = Math.max(0, parseInt(process.env.FREE_WAIT_SECONDS || '300', 10) || 0)

const CANCELLABLE = ['requested', 'pending_driver_response', 'accepted', 'driver_arrived']

// One endpoint for every cancellation. Cancelling is always free (trips are paid in cash at drop-off); late
// cancellations and no-shows count towards booking being paused (api/_cancelRules.js).
//   body: { rideId, preview?: boolean, noShow?: boolean }
//   rider  → free; after GRACE_SECONDS from a driver accepting it counts as a late cancellation
//   driver → free; or (noShow) once the driver has waited FREE_WAIT_SECONDS at pickup, counted as a no-show
//   admin  → free and never counted (admins and support staff; the rider and driver are both told)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const blocked = checkRate(req)
  if (blocked) {
    res.setHeader('Retry-After', blocked.retryAfter)
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' })
  }

  const user = await requireUser(req, res)
  if (!user) return

  const { rideId, preview, noShow } = req.body || {}
  if (!rideId) return res.status(400).json({ error: 'rideId is required' })

  try {
    const { data: ride } = await admin
      .from('rides')
      .select('id, rider_id, driver_id, status, accepted_at, arrived_at')
      .eq('id', rideId)
      .maybeSingle()
    if (!ride) return res.status(404).json({ error: 'Ride not found' })

    const roles = await rideRoles(ride, user)
    const actor = roles.staff ? 'admin' : roles.driver ? 'driver' : roles.rider ? 'rider' : null
    if (!actor) return res.status(403).json({ error: 'Not allowed' })

    if (!CANCELLABLE.includes(ride.status) && !(actor === 'admin' && ride.status === 'in_progress')) {
      return res.status(409).json({ error: ride.status === 'in_progress' ? 'The trip has already started.' : 'This ride is already finished.' })
    }

    if (actor === 'driver' && noShow && !noShowAllowed({ status: ride.status, arrivedAt: ride.arrived_at, waitSeconds: FREE_WAIT_SECONDS })) {
      return res.status(409).json({ error: `You can mark a no-show after waiting ${Math.round(FREE_WAIT_SECONDS / 60)} minutes at the pickup.` })
    }

    if (preview) {
      return res.status(200).json({
        fee_cents: 0, // kept for apps already installed, which show a fee when it's above 0
        late: actor === 'rider' && isLateCancel({ status: ride.status, acceptedAt: ride.accepted_at, graceSeconds: GRACE_SECONDS }),
        grace_seconds: GRACE_SECONDS,
        free_wait_seconds: FREE_WAIT_SECONDS,
        no_show_allowed: actor === 'driver' && noShowAllowed({ status: ride.status, arrivedAt: ride.arrived_at, waitSeconds: FREE_WAIT_SECONDS }),
      })
    }

    // 1. Claim the cancellation atomically (guards against a race with accept/arrive/start).
    const reason = actor === 'driver' ? (noShow ? 'rider_no_show' : 'driver_cancelled') : actor === 'admin' ? 'admin_cancelled' : 'rider_cancelled'
    const { data: claimed, error: claimErr } = await admin
      .from('rides')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: actor,
        cancel_reason: reason,
        platform_fee_cents: 0,
        driver_payout_cents: 0,
      })
      .eq('id', rideId)
      .eq('status', ride.status)
      .select('id')
    if (claimErr) throw claimErr
    if (!claimed?.length) return res.status(409).json({ error: 'The ride changed just now. Please try again.' })

    // 2. Free the driver. If the driver cancelled, keep the rider's trip going with a new request
    //    (same route, same upfront price, not offered to this driver again), like Uber's automatic re-match.
    if (ride.driver_id) {
      await admin.from('drivers').update({ status: 'online' }).eq('id', ride.driver_id).eq('status', 'on_trip')
    }
    // The RideUp guarantee: a driver cancelling after accepting also adds credit to the rider's next ride. Given
    // before the re-match is written, so the rider's screen finds it as soon as it follows the new request.
    const creditCents = guaranteeApplies({ actor, noShow, status: ride.status }) ? await grantDriverCancelCredit(ride) : 0
    const creditText = creditCents ? ` We also added $${(creditCents / 100).toFixed(2)} RideUp credit for your next booking.` : ''
    const rebookedRideId = actor === 'driver' && !noShow ? await rebook(rideId, ride.driver_id) : null

    // 3. Tell the other side.
    const people = await rideParticipants(rideId)
    if (actor === 'rider' && people.driverUserId) {
      await pushToUser(people.driverUserId, { title: 'Ride cancelled', body: 'The rider cancelled this trip.', url: '/driver/dashboard', tag: `ride-${rideId}` })
    } else if (actor !== 'rider' && people.riderUserId) {
      const minutes = Math.round(FREE_WAIT_SECONDS / 60)
      const body = noShow
        ? `Your driver waited ${minutes} minutes and marked the ride as a no-show. Missed pickups can pause booking on your account.`
        : rebookedRideId
          ? `Your driver had to cancel. We’re finding you another driver now, at the same price.${creditText}`
          : `Your ride was cancelled. Request again and we’ll find you a driver.${creditText}`
      await pushToUser(people.riderUserId, { title: rebookedRideId ? 'Finding you a new driver' : 'Ride cancelled', body, url: '/book', tag: `ride-${rideId}` })
    }
    if (actor === 'admin' && people.driverUserId) {
      await pushToUser(people.driverUserId, { title: 'Trip cancelled', body: 'RideUp support cancelled this trip. You’re free for your next ride.', url: '/driver/dashboard', tag: `ride-${rideId}` })
    }
    if (actor === 'admin') {
      await logAdminAction(user, { action: 'ride.cancel', targetType: 'ride', targetId: rideId, summary: `Cancelled a ${ride.status.replace(/_/g, ' ')} trip` })
    }

    return res.status(200).json({ success: true, fee_cents: 0, rebooked_ride_id: rebookedRideId, credit_cents: creditCents })
  } catch (err) {
    return fail(res, 'Cancel ride error', err)
  }
}

// What a re-match copies from the cancelled trip: same route, same upfront price (paid in cash, like every trip).
const REBOOK_FIELDS = ['rider_id', 'rider_name', 'pickup_address', 'pickup_lat', 'pickup_lng', 'dropoff_address', 'dropoff_lat', 'dropoff_lng',
  'vehicle_type', 'distance_miles', 'duration_minutes', 'fare_cents', 'booking_fee_cents', 'airport_fee_cents', 'promo_code',
  'promo_discount_cents', 'credit_applied_cents', 'surge_multiplier', 'stop_address', 'stop_lat', 'stop_lng', 'passenger_name',
  'passenger_phone']

// Creates a fresh request for the rider after their driver cancelled. Best effort: if it fails the rider
// simply sees "ride cancelled" and can request again.
async function rebook(rideId, cancellingDriverId) {
  try {
    const { data: old } = await admin.from('rides').select('*').eq('id', rideId).maybeSingle()
    if (!old) return null
    const copy = Object.fromEntries(REBOOK_FIELDS.filter((k) => k in old).map((k) => [k, old[k]]))
    const { data: fresh, error } = await admin
      .from('rides')
      .insert({ ...copy, status: 'requested', declined_by: cancellingDriverId ? [cancellingDriverId] : [] })
      .select('id')
      .single()
    if (error || !fresh) {
      console.error('Rebook after driver cancel failed:', error?.message)
      return null
    }
    await admin.from('rides').update({ replaced_by_ride_id: fresh.id }).eq('id', rideId)
    const notified = await notifyNearbyDrivers(fresh.id)
    await alertRideRequest(fresh.id, { notified })
    return fresh.id
  } catch (err) {
    console.error('Rebook after driver cancel failed:', err.message)
    return null
  }
}
