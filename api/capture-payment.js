import { admin, requireUser, rideRoles, fail } from './_auth.js'
import { rateLimit } from './_rateLimit.js'
import { captureRide } from './_capture.js'

const checkRate = rateLimit({ maxRequests: 20, windowMs: 60_000 })

// Captures the held payment once the ride is completed. Only the ride's driver (or an admin) may call it.
// The every-minute sweeper in dispatch-scheduled retries any capture this call missed.
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
      .select('id, rider_id, driver_id')
      .eq('id', rideId)
      .maybeSingle()
    if (!ride) return res.status(404).json({ error: 'Ride not found' })

    const roles = await rideRoles(ride, user)
    if (!roles.driver && !roles.admin) return res.status(403).json({ error: 'Not allowed' })

    const result = await captureRide(rideId)
    if (!result.ok) return res.status(result.status || 400).json({ error: result.error })
    return res.status(200).json({ success: true, ...(result.already ? { already_captured: true } : {}) })
  } catch (err) {
    return fail(res, 'Capture payment error', err)
  }
}
