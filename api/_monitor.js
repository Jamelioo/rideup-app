import { parseDsn, buildEnvelope } from '../src/lib/sentryEnvelope.js'

// Server-side error reports to Sentry (SENTRY_DSN). Awaited with a short timeout so the report leaves
// before the serverless function is frozen; never throws.
const dsn = parseDsn(process.env.SENTRY_DSN)

export async function captureServerError(label, err, extra = {}) {
  if (!dsn) return
  try {
    const { url, body } = buildEnvelope(dsn, err, {
      platform: 'node',
      environment: process.env.VERCEL_ENV || 'production',
      release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
      tags: { area: label },
      extra,
    })
    await fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/x-sentry-envelope' }, signal: AbortSignal.timeout(1500) })
  } catch { /* reporting must never break a request */ }
}
