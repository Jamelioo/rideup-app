import { admin, requireUser, isStaff, fail } from '../_auth.js'
import { rateLimit } from '../_rateLimit.js'
import { holdCardAndConfirm } from '../_hold.js'
import { driverCanTake, BUSY_STATUSES } from '../_notifyDrivers.js'
import { pushToUser } from '../_push.js'
import { logAdminAction } from '../_audit.js'
import { REQUEST_SEARCH_MINUTES } from '../../src/lib/dispatch.js'

const checkRate = rateLimit({ maxRequests: 20, windowMs: 60_000 })
const short = (address) => String(address || '').split(',')[0].trim() || '—'

const PAYMENT_ERRORS = {
  no_payment_method: 'The rider has no card saved, so the ride was cancelled.',
  card_declined: 'The rider’s card was declined, so the ride was cancelled.',
  payment_failed: 'The rider’s card couldn’t be held, so the ride was cancelled.',
  ride_unavailable: 'This ride was cancelled or taken while assigning.',
}

// Admin › Live: give a waiting request to a chosen driver, like a dispatcher. Same steps as a driver accepting
// (claim, hold the card, confirm), then the driver gets a notification and their app opens the trip.
//   body: { rideId, driverId }   (admins and support staff)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const blocked = checkRate(req)
  if (blocked) {
    res.setHeader('Retry-After', blocked.retryAfter)
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' })
  }
  const user = await requireUser(req, res)
  if (!user) return
  if (!isStaff(user)) return res.status(403).json({ error: 'Admins only' })

  const { rideId, driverId } = req.body || {}
  if (!rideId || !driverId) return res.status(400).json({ error: 'Choose a ride and a driver.' })

  try {
    const [{ data: ride }, { data: driver }, { data: busy }] = await Promise.all([
      admin.from('rides').select('id, status, driver_id, vehicle_type, pickup_address, dropoff_address, created_at').eq('id', rideId).maybeSingle(),
      admin.from('drivers').select('id, auth_user_id, name, approved, deleted_at, vehicle_type, status').eq('id', driverId).maybeSingle(),
      admin.from('rides').select('id').eq('driver_id', driverId).in('status', BUSY_STATUSES).limit(1),
    ])
    if (!ride) return res.status(404).json({ error: 'Ride not found' })
    if (ride.status !== 'requested' || ride.driver_id) return res.status(409).json({ error: 'This ride already has a driver or has ended.' })
    // Past the search time the rider has been told no cars were found and may have left (the background job
    // normally cancels it by now). Holding their card then would charge someone who isn't waiting.
    if (Date.now() - new Date(ride.created_at).getTime() > (REQUEST_SEARCH_MINUTES + 1) * 60_000) {
      return res.status(409).json({ error: 'This request is too old to assign: the rider may have left. Call them, and ask them to book again if they still need a ride.' })
    }
    if (!driver || !driver.approved || driver.deleted_at) return res.status(400).json({ error: 'That driver isn’t approved to drive.' })
    if (busy?.length) return res.status(409).json({ error: `${driver.name || 'That driver'} is on another trip.` })
    if (!driverCanTake(driver.vehicle_type, ride.vehicle_type)) {
      return res.status(400).json({ error: `This is a ${ride.vehicle_type === 'xl' ? 'XL' : 'Premium'} trip; ${driver.name || 'that driver'}’s car isn’t approved for it.` })
    }

    // 1. Claim it for this driver (fails if a driver accepted or the rider cancelled a moment ago).
    const { data: claimed, error: claimErr } = await admin
      .from('rides')
      .update({ driver_id: driver.id, status: 'pending_driver_response', accepted_at: new Date().toISOString() })
      .eq('id', rideId)
      .eq('status', 'requested')
      .is('driver_id', null)
      .select('id, fare_cents, promo_discount_cents, credit_applied_cents, rider_id, driver_id, status, payment_status, payment_intent_id')
    if (claimErr) throw claimErr
    if (!claimed?.length) return res.status(409).json({ error: 'This ride was taken or cancelled just now.' })

    // 2. Hold the rider's card and confirm (tells the rider their driver is on the way).
    const result = await holdCardAndConfirm(claimed[0])
    if (!result.ok) return res.status(result.status).json({ error: PAYMENT_ERRORS[result.error] || 'The ride couldn’t be assigned.' })

    // 3. The driver is now on this trip; their app picks it up and opens it.
    await admin.from('drivers').update({ status: 'on_trip' }).eq('id', driver.id)
    await pushToUser(driver.auth_user_id, {
      title: 'New trip assigned to you',
      body: `${short(ride.pickup_address)} → ${short(ride.dropoff_address)}. Open RideUp to head to the pickup.`,
      url: '/driver/active-ride',
      tag: `ride-${rideId}`,
    })
    await logAdminAction(user, { action: 'ride.assign', targetType: 'ride', targetId: rideId, summary: `Assigned to ${driver.name || 'a driver'}`, details: { driver_id: driver.id } })
    return res.status(200).json({ success: true })
  } catch (err) {
    return fail(res, 'Admin assign error', err)
  }
}
