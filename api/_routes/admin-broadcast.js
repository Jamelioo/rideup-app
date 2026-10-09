import { admin, requireUser, isAdmin, fail } from '../_auth.js'
import { rateLimit } from '../_rateLimit.js'
import { pushToUser, usersWithPush } from '../_push.js'
import { logAdminAction } from '../_audit.js'

const checkRate = rateLimit({ maxRequests: 10, windowMs: 60 * 60_000 }) // a broadcast is a big deal: 10 an hour
const AUDIENCES = { riders: '/book', drivers: '/driver/dashboard', everyone: '/' }

// Admin › Messages: one push notification to every rider, every driver, or both ("$5 off this weekend",
// "Busy at the airport tonight"). Only reaches people who allowed RideUp notifications.
//   body: { audience: 'riders'|'drivers'|'everyone', title, body, test?: true }   (admins only)
//   test sends it to the admin's own devices first.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireUser(req, res)
  if (!user) return
  if (!isAdmin(user)) return res.status(403).json({ error: 'Admins only' })

  const { audience, title, body, test } = req.body || {}
  const t = String(title || '').trim()
  const b = String(body || '').trim()
  if (!AUDIENCES[audience]) return res.status(400).json({ error: 'Choose who to send it to.' })
  if (t.length < 3 || t.length > 60) return res.status(400).json({ error: 'The title needs 3 to 60 characters.' })
  if (b.length < 3 || b.length > 180) return res.status(400).json({ error: 'The message needs 3 to 180 characters.' })
  const message = { title: t, body: b, url: AUDIENCES[audience], tag: 'rideup-news' }

  try {
    if (test) {
      const sent = await pushToUser(user.id, message)
      return res.status(200).json({ test: true, sent })
    }
    const blocked = checkRate(req)
    if (blocked) {
      res.setHeader('Retry-After', blocked.retryAfter)
      return res.status(429).json({ error: 'That’s a lot of broadcasts. Try again later.' })
    }

    const lists = await Promise.all([
      audience !== 'drivers'
        ? admin.from('riders').select('auth_user_id').is('deleted_at', null).not('suspended', 'is', true).not('auth_user_id', 'is', null).limit(10000)
        : { data: [] },
      audience !== 'riders'
        ? admin.from('drivers').select('auth_user_id').eq('approved', true).is('deleted_at', null).not('auth_user_id', 'is', null).limit(5000)
        : { data: [] },
    ])
    const everyone = [...new Set(lists.flatMap((l) => (l.data || []).map((r) => r.auth_user_id)))]
    const reachable = [...(await usersWithPush(everyone))]

    // Ten at a time keeps it quick without flooding the push services.
    let sent = 0
    for (let i = 0; i < reachable.length; i += 10) {
      const batch = await Promise.all(reachable.slice(i, i + 10).map((id) => pushToUser(id, message)))
      sent += batch.filter((n) => n > 0).length
    }

    await logAdminAction(user, {
      action: 'broadcast', targetType: audience, summary: `“${t}” to ${sent} of ${everyone.length} ${audience}`,
      details: { title: t, body: b, audience, people: everyone.length, reachable: reachable.length, reached: sent },
    })
    return res.status(200).json({ people: everyone.length, reachable: reachable.length, reached: sent })
  } catch (err) {
    return fail(res, 'Broadcast error', err)
  }
}
