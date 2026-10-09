import { admin, requireUser, isAdmin, fail } from '../_auth.js'
import { rateLimit } from '../_rateLimit.js'
import { pushToUser } from '../_push.js'
import { logAdminAction } from '../_audit.js'

const checkRate = rateLimit({ maxRequests: 20, windowMs: 60_000 })
const MAX_CENTS = 10_000 // $100 per grant

// Admin-only goodwill credit for a rider, not tied to a ride (a welcome gift, an apology for a late driver).
// Ride-specific refunds go through admin-refund. Credit is used automatically on the rider's next rides.
//   body: { riderId, amountCents, reason }
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const blocked = checkRate(req)
  if (blocked) {
    res.setHeader('Retry-After', blocked.retryAfter)
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' })
  }
  const user = await requireUser(req, res)
  if (!user) return
  if (!isAdmin(user)) return res.status(403).json({ error: 'Admins only' })

  const { riderId, amountCents, reason } = req.body || {}
  const amount = Math.round(Number(amountCents))
  const note = String(reason || '').trim()
  if (!riderId) return res.status(400).json({ error: 'riderId is required' })
  if (!(amount > 0) || amount > MAX_CENTS) return res.status(400).json({ error: 'Enter an amount between $0.01 and $100.' })
  if (note.length < 3 || note.length > 300) return res.status(400).json({ error: 'Add a short reason.' })

  try {
    const { data: rider } = await admin.from('riders').select('id, auth_user_id, credit_cents, deleted_at').eq('id', riderId).maybeSingle()
    if (!rider || rider.deleted_at) return res.status(404).json({ error: 'Rider not found' })
    const credit = (rider.credit_cents || 0) + amount
    // Only apply if the balance hasn't changed since it was read (a ride using credit at the same moment).
    const { data: updated, error } = await admin.from('riders')
      .update({ credit_cents: credit })
      .eq('id', riderId)
      .eq('credit_cents', rider.credit_cents || 0)
      .select('credit_cents')
    if (error) throw error
    if (!updated?.length) return res.status(409).json({ error: 'The rider’s balance just changed. Try again.' })
    await logAdminAction(user, { action: 'rider.credit', targetType: 'rider', targetId: riderId, summary: `$${(amount / 100).toFixed(2)} credit: ${note}`, details: { amount_cents: amount } })
    await pushToUser(rider.auth_user_id, {
      title: 'You got RideUp credit',
      body: `$${(amount / 100).toFixed(2)} was added to your account. It’s used automatically on your next ride.`,
      url: '/book',
      tag: 'credit',
    })
    return res.status(200).json({ credit_cents: credit })
  } catch (err) {
    return fail(res, 'Admin credit error', err)
  }
}
