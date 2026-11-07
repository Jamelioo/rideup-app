import { admin, fail } from '../_auth.js'

// Public proof for the landing pages (src/lib/proofRules.js decides what's shown): how many trips RideUp has
// completed, the average rating riders gave their drivers, how many rides were requested in the last 30 days (for
// the driver page), and rider quotes an admin approved (migration 022). Only real numbers and real words; the pages
// show them once there are enough to mean something.
// The same answer for everyone, so the CDN keeps it for 10 minutes: no database work per visitor.
//   GET → { completed_trips, ratings, average_rating | null, requests_30d, quotes: [{ quote, name }] }
const RECENT_RATINGS = 1000 // the average covers the latest ratings, like a driver's own rating
const QUOTES = 6

export async function loadStats(db, now = Date.now()) {
  const since = new Date(now - 30 * 24 * 3600 * 1000).toISOString()
  const [completed, rated, requested, quotes] = await Promise.all([
    db.from('rides').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    db.from('rides').select('rider_rating').eq('status', 'completed').not('rider_rating', 'is', null)
      .order('completed_at', { ascending: false }).limit(RECENT_RATINGS),
    db.from('rides').select('id', { count: 'exact', head: true }).gte('created_at', since),
    db.from('testimonials').select('quote, display_name').eq('status', 'approved')
      .order('created_at', { ascending: false }).limit(QUOTES),
  ])
  for (const r of [completed, rated, requested]) if (r.error) throw r.error
  // Before migration 022 there's no quotes table yet: no quotes, not an error.
  if (quotes.error && !['PGRST205', '42P01'].includes(quotes.error.code)) throw quotes.error

  const ratings = (rated.data || []).map((r) => Number(r.rider_rating)).filter((n) => n >= 1 && n <= 5)
  const average = ratings.length ? Math.round((ratings.reduce((sum, n) => sum + n, 0) / ratings.length) * 10) / 10 : null
  return {
    completed_trips: completed.count || 0,
    ratings: ratings.length,
    average_rating: average,
    requests_30d: requested.count || 0,
    quotes: quotes.error ? [] : (quotes.data || []).map((q) => ({ quote: q.quote, name: q.display_name })),
  }
}

export function statsHandler(db) {
  return async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
    if (!db) return res.status(500).json({ error: 'Server is not configured' })
    try {
      const stats = await loadStats(db)
      res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600')
      return res.status(200).json(stats)
    } catch (err) {
      res.setHeader('Cache-Control', 'no-store')
      return fail(res, 'Stats error', err)
    }
  }
}

export default statsHandler(admin)
