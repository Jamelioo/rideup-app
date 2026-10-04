import { admin, optionalUser, fail } from '../_auth.js'
import { rateLimit } from '../_rateLimit.js'
import { loadDriverPool, availabilitySummary } from '../_notifyDrivers.js'

const checkRate = rateLimit({ maxRequests: 30, windowMs: 60_000 })

// Before booking, like Uber: can a car come to this pickup, and roughly how soon? For each trip type the answer
// is 'available' (with a pickup estimate in 5-minute steps for signed-in riders), 'busy' (every driver who could
// take it is on a trip) or 'none'. The booking screen asks every 30 seconds. Never reveals where a driver is.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (checkRate(req)) return res.status(429).json({ error: 'Too many requests.' })
  if (!admin) return res.status(500).json({ error: 'Server is not configured' })

  const lat = Number(req.body?.lat)
  const lng = Number(req.body?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: 'Bad request' })
  }

  try {
    const [user, pool] = await Promise.all([optionalUser(req), loadDriverPool()])
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ types: availabilitySummary(pool, { lat, lng, withEta: Boolean(user) }) })
  } catch (err) {
    return fail(res, 'Availability error', err)
  }
}
