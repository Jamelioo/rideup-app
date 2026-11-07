import { admin, fail } from '../_auth.js'

// Public proof for the landing pages (src/lib/proof.js): how many trips RideUp has completed and the average
// rating riders gave their drivers. Only real numbers; the pages show them once there are enough to mean something.
// The same answer for everyone, so the CDN keeps it for 10 minutes: no database work per visitor.
//   GET → { completed_trips, ratings, average_rating | null }
const RECENT_RATINGS = 1000 // the average covers the latest ratings, like a driver's own rating

export async function loadStats(db) {
  const { count, error: countErr } = await db.from('rides').select('id', { count: 'exact', head: true }).eq('status', 'completed')
  if (countErr) throw countErr
  const { data, error } = await db
    .from('rides')
    .select('rider_rating')
    .eq('status', 'completed')
    .not('rider_rating', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(RECENT_RATINGS)
  if (error) throw error
  const ratings = (data || []).map((r) => Number(r.rider_rating)).filter((n) => n >= 1 && n <= 5)
  const average = ratings.length ? Math.round((ratings.reduce((sum, n) => sum + n, 0) / ratings.length) * 10) / 10 : null
  return { completed_trips: count || 0, ratings: ratings.length, average_rating: average }
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
