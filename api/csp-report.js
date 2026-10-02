import { rateLimit } from './_rateLimit.js'

const checkRate = rateLimit({ maxRequests: 30, windowMs: 60_000 })

// Receives Content-Security-Policy-Report-Only violation reports (browsers POST them here) and logs a
// compact line per violation to the Vercel function logs. Review them, fix or allow-list what is legitimate,
// then promote the report-only policy in vercel.json to an enforced one.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (checkRate(req)) return res.status(429).end()

  try {
    const body = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body
    const raw = typeof body === 'string' ? JSON.parse(body) : body
    const reports = Array.isArray(raw) ? raw : [raw]
    for (const r of reports.slice(0, 5)) {
      const v = r?.['csp-report'] || r?.body || r || {}
      console.warn('[CSP]', JSON.stringify({
        directive: String(v['violated-directive'] || v.effectiveDirective || '').slice(0, 80),
        blocked: String(v['blocked-uri'] || v.blockedURL || '').slice(0, 200),
        page: String(v['document-uri'] || v.documentURL || '').slice(0, 200),
      }))
    }
  } catch { /* malformed report: ignore */ }
  return res.status(204).end()
}
