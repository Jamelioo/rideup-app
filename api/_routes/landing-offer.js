import { admin, fail } from '../_auth.js'
import { promoProblem } from './promo-preview.js'
import { featuredCode } from '../../src/lib/landingOfferRules.js'

// The offer the landing and booking pages give every new visitor automatically (src/lib/landingOffer.js):
// the code picked in Admin › Promos, if it can be used right now. Only the code's own rules are checked, as in
// promo-preview; the database checks each rider's own when they book.
// The same answer for everyone, so the CDN keeps it for 5 minutes: no database work or rate limit per visitor,
// and an admin's change shows within 5 minutes.   GET → { offer: { code, amount_cents, … } | null }
export function landingOfferHandler(db) {
  return async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
    if (!db) return res.status(500).json({ error: 'Server is not configured' })

    try {
      const { data: setting, error: settingErr } = await db.from('app_settings').select('value').eq('key', 'landing_promo').maybeSingle()
      if (settingErr) throw settingErr
      const code = featuredCode(setting)
      let offer = null
      if (code) {
        const { data: p, error } = await db
          .from('promo_codes')
          .select('code, amount_cents, description, first_ride_only, active, expires_at, max_uses, uses')
          .eq('code', code)
          .maybeSingle()
        if (error) throw error
        if (!promoProblem(p)) {
          offer = { code: p.code, amount_cents: p.amount_cents, description: p.description, first_ride_only: p.first_ride_only, expires_at: p.expires_at }
        }
      }
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
      return res.status(200).json({ offer })
    } catch (err) {
      res.setHeader('Cache-Control', 'no-store')
      return fail(res, 'Landing offer error', err)
    }
  }
}

export default landingOfferHandler(admin)
