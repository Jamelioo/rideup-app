import { admin, requireUser, getDriverForUser, fail } from '../_auth.js'
import { rateLimit } from '../_rateLimit.js'
import { confirmRide } from '../_cash.js'

const checkRate = rateLimit({ maxRequests: 20, windowMs: 60_000 })

// Called by the driver right after claiming a ride (accept_ride RPC leaves it in 'pending_driver_response'):
// confirms it ('accepted', cash due at drop-off) and tells the rider their driver is on the way. The name is kept
// from the card days so apps already installed keep working.
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
    const driver = await getDriverForUser(user.id)
    if (!driver?.approved) return res.status(403).json({ error: 'Not an approved driver' })

    const { data: ride } = await admin
      .from('rides')
      .select('*')
      .eq('id', rideId)
      .maybeSingle()

    if (!ride) return res.status(404).json({ error: 'Ride not found' })
    if (ride.driver_id !== driver.id) return res.status(403).json({ error: 'Not your ride' })

    const result = await confirmRide(ride)
    if (!result.ok) return res.status(result.status).json({ success: false, error: result.error })
    return res.status(200).json({ success: true })
  } catch (err) {
    return fail(res, 'Authorize ride error', err)
  }
}
