import { admin, requireUser, getDriverForUser, getRiderForUser, fail } from '../_auth.js'
import { rateLimit } from '../_rateLimit.js'
import { pushToUser, rideParticipants } from '../_push.js'
import { notifyPassenger } from '../_passenger.js'
import { notifyNearbyDrivers } from '../_notifyDrivers.js'
import { alertRideRequest } from '../_staffAlerts.js'

const checkRate = rateLimit({ maxRequests: 30, windowMs: 60_000 })
const FREE_WAIT_MINUTES = Math.round(Math.max(0, parseInt(process.env.FREE_WAIT_SECONDS || '300', 10) || 0) / 60)

// The app reports trip moments here so the other side gets a push notification even when
// their app is in the background (Uber: "Your driver has arrived", "New trip request").
//   events: 'requested' (rider) → nearby online drivers; 'arrived' (driver) → rider; 'started' (driver) → rider
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (checkRate(req)) return res.status(429).json({ error: 'Too many requests.' })

  const user = await requireUser(req, res)
  if (!user) return

  const { rideId, event } = req.body || {}
  if (!rideId || !['requested', 'expired', 'arrived', 'started'].includes(event)) return res.status(400).json({ error: 'Bad request' })

  try {
    const { data: ride } = await admin
      .from('rides')
      .select('id, rider_id, driver_id, status, cancel_reason, cancelled_at')
      .eq('id', rideId)
      .maybeSingle()
    if (!ride) return res.status(404).json({ error: 'Ride not found' })

    if (event === 'requested') {
      const rider = await getRiderForUser(user.id)
      if (!rider || rider.id !== ride.rider_id || ride.status !== 'requested') return res.status(403).json({ error: 'Not allowed' })
      // When no driver can be alerted (nobody online), the request stays open for the full search and the team's
      // alert asks them to go online or assign a driver from Live. Nothing is charged unless a driver accepts.
      const notified = await notifyNearbyDrivers(rideId)
      await alertRideRequest(rideId, { notified }) // the team sees every request
      return res.status(200).json({ success: true, notified: notified ?? 0 })
    }

    // The rider's search ran out without a driver (their app ended it): a missed ride the team can call back.
    if (event === 'expired') {
      const rider = await getRiderForUser(user.id)
      if (!rider || rider.id !== ride.rider_id || ride.status !== 'cancelled' || ride.cancel_reason !== 'no_drivers') {
        return res.status(403).json({ error: 'Not allowed' })
      }
      // Only right after it ended, so a repeated call can't flood the team with alerts.
      if (Date.now() - new Date(ride.cancelled_at).getTime() > 120_000) return res.status(200).json({ success: true })
      await alertRideRequest(rideId, { expired: true })
      return res.status(200).json({ success: true })
    }

    const driver = await getDriverForUser(user.id)
    if (!driver || driver.id !== ride.driver_id) return res.status(403).json({ error: 'Not allowed' })
    const expected = event === 'arrived' ? 'driver_arrived' : 'in_progress'
    if (ride.status !== expected) return res.status(409).json({ error: 'Ride is not in that state' })

    const people = await rideParticipants(rideId)
    await pushToUser(people.riderUserId, event === 'arrived'
      ? { title: 'Your driver has arrived', body: `Meet them at the pickup. Free waiting time is ${FREE_WAIT_MINUTES} minutes.`, url: `/ride/${rideId}`, tag: `ride-${rideId}` }
      : { title: 'Trip started', body: 'Enjoy your ride. You can share your trip from the shield button.', url: `/ride/${rideId}`, tag: `ride-${rideId}` })
    if (event === 'arrived') await notifyPassenger(rideId, 'arrived')
    return res.status(200).json({ success: true })
  } catch (err) {
    return fail(res, 'Trip event error', err)
  }
}
