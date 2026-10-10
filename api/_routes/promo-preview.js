import { admin, fail } from '../_auth.js'
import { rateLimit } from '../_rateLimit.js'

// Per IP address. Generous because mobile carriers put many customers behind one address, and an ad can send a
// lot of them at once; codes are marketing codes, and the database still checks each rider at booking.
const checkRate = rateLimit({ maxRequests: 30, windowMs: 60_000 })

// Why a promo_codes row can't be used right now, in the database's words (promo_discount_for), or null.
export function promoProblem(p, now = Date.now()) {
  if (!p || !p.active) return 'That promo code isn’t valid.'
  if (p.expires_at && new Date(p.expires_at).getTime() < now) return 'That promo code has expired.'
  if (p.max_uses != null && p.uses >= p.max_uses) return 'That promo code has been fully used.'
  return null
}

// Before someone has an account (a code from an ad link like ?promo=WELCOME5, or one typed on the booking
// screen): is it a live promo code, and what is it worth? Only the code's own rules are checked here, with the
// same messages as the database. The rider's own (first ride, already used with this card or phone) are checked
// by the database when the ride is booked. Signed-in riders use the check_promo RPC, which checks both.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const blocked = checkRate(req)
  if (blocked) {
    res.setHeader('Retry-After', blocked.retryAfter)
    return res.status(429).json({ error: 'Too many tries. Please wait a minute and try again.' })
  }
  res.setHeader('Cache-Control', 'no-store')
  const code = String(req.body?.code || '').trim().toUpperCase()
  if (!/^[A-Z0-9-]{3,20}$/.test(code)) return res.status(200).json({ ok: false, error: 'That promo code isn’t valid.' })
  if (!admin) return res.status(500).json({ error: 'Server is not configured' })

  try {
    const { data: p, error } = await admin
      .from('promo_codes')
      .select('code, amount_cents, description, active, expires_at, max_uses, uses')
      .eq('code', code)
      .maybeSingle()
    if (error) throw error
    const problem = promoProblem(p)
    if (problem) return res.status(200).json({ ok: false, error: problem })
    return res.status(200).json({ ok: true, promo: { code: p.code, amount_cents: p.amount_cents, description: p.description } })
  } catch (err) {
    return fail(res, 'Promo preview error', err)
  }
}
