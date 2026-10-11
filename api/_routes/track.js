import { admin } from '../_auth.js'
import { rateLimit } from '../_rateLimit.js'
import { FUNNEL_STEPS } from '../../src/lib/funnelSteps.js'

// Anonymous booking-funnel counts for Admin › Money (migration 020). The app sends each step at most once per
// browser per day (src/lib/funnel.js); this adds one to today's count. Counting is best effort, so the answer is
// always 204 and never holds up the page.   body: { step: 'landing' | 'booking' | 'price' | 'request' }
// Per IP address, generous: mobile carriers put many customers behind one address, and each person sends at most
// 4 steps a day.
export function trackHandler(db, checkRate = rateLimit({ maxRequests: 60, windowMs: 60_000 })) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    res.setHeader('Cache-Control', 'no-store')
    const step = String(req.body?.step || '')
    if (!FUNNEL_STEPS.includes(step) || checkRate(req) || !db) return res.status(204).end()
    try {
      const { error } = await db.rpc('funnel_bump', { p_step: step })
      // PGRST202: no such function yet, because migration 020 hasn't run. Expected, so not reported.
      if (error && error.code !== 'PGRST202') console.error('Funnel count failed:', error.message)
    } catch (err) {
      console.error('Funnel count failed:', err.message)
    }
    return res.status(204).end()
  }
}

export default trackHandler(admin)
