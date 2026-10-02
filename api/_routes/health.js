import { admin } from '../_auth.js'

const CRON_STALE_SECONDS = 5 * 60

// For uptime monitors (UptimeRobot, Better Stack…): GET /api/health → 200 when the database answers and the
// every-minute job ran in the last 5 minutes, otherwise 503 with what's wrong. No secrets in the response.
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Cache-Control', 'no-store')
  const out = { ok: false, database: 'unknown', background_job: 'unknown', checked_at: new Date().toISOString() }
  if (!admin) return res.status(503).json({ ...out, database: 'not configured' })
  try {
    const { data, error } = await admin.from('system_heartbeats').select('last_run_at, last_ok').eq('name', 'dispatch').maybeSingle()
    if (error) throw error
    out.database = 'ok'
    if (!data) {
      out.background_job = 'never ran'
    } else {
      const age = Math.round((Date.now() - new Date(data.last_run_at).getTime()) / 1000)
      out.background_job_last_run_seconds_ago = age
      out.background_job = age > CRON_STALE_SECONDS ? 'stale' : data.last_ok ? 'ok' : 'failing'
    }
  } catch {
    out.database = 'error'
  }
  out.ok = out.database === 'ok' && out.background_job === 'ok'
  return res.status(out.ok ? 200 : 503).json(out)
}
