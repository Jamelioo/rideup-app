import { admin, requireUser, isStaff, fail } from '../_auth.js'
import { rateLimit } from '../_rateLimit.js'
import { settleRide } from '../_cash.js'
import { pushToUser, rideParticipants } from '../_push.js'
import { logAdminAction } from '../_audit.js'

const checkRate = rateLimit({ maxRequests: 20, windowMs: 60_000 })

// Admin › Live: end a trip that's under way but stuck (the driver's phone died at the drop-off). Completes it,
// counts the cash fare as collected (the driver can still report it unpaid), sends the receipt and frees the
// driver. If that step fails here, the every-minute job retries it.   body: { rideId }   (admins and support staff)
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

  const { rideId } = req.body || {}
  if (!rideId) return res.status(400).json({ error: 'rideId is required' })

  try {
    const { data: done, error } = await admin
      .from('rides')
      .update({ status: 'completed' })
      .eq('id', rideId)
      .eq('status', 'in_progress')
      .select('*')
    if (error) throw error
    if (!done?.length) return res.status(409).json({ error: 'Only a trip that has started can be completed. Cancel it instead.' })

    if (done[0].driver_id) await admin.from('drivers').update({ status: 'online' }).eq('id', done[0].driver_id).eq('status', 'on_trip')

    let settled = true
    try {
      settled = (await settleRide(rideId)).ok
    } catch (err) {
      console.error('Admin complete settle failed (the job will retry):', err.message)
      settled = false
    }

    const people = await rideParticipants(rideId)
    await pushToUser(people.driverUserId, { title: 'Trip completed', body: 'RideUp support ended this trip for you. Thanks for driving!', url: '/driver/dashboard', tag: `ride-${rideId}` })
    const summary = settled ? 'Ended the trip; cash counted as collected' : 'Ended the trip; receipt will retry'
    await logAdminAction(user, { action: 'ride.complete', targetType: 'ride', targetId: rideId, summary })
    return res.status(200).json({ success: true, settled })
  } catch (err) {
    return fail(res, 'Admin complete error', err)
  }
}
