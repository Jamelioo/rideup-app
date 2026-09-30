// Simple in-memory rate limiter for Vercel serverless functions.
// Best-effort only: counters live in one warm instance, so this slows abuse and accidents but is not a
// hard guarantee. Auth, ownership checks and Stripe idempotency keys are the real protections.
// For hard limits put Vercel's WAF / rate-limit rules or an external store in front of /api.
const store = new Map()

const CLEANUP_INTERVAL = 60_000
let lastCleanup = Date.now()

function cleanup(windowMs) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of store) {
    if (now - entry.start > windowMs) store.delete(key)
  }
}

// On Vercel the edge sets x-vercel-forwarded-for / x-real-ip itself. The left-most x-forwarded-for
// entry is whatever the client sent, so it must not be trusted as the rate-limit key.
function clientIp(req) {
  return (
    req.headers['x-vercel-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}

export function rateLimit({ maxRequests = 10, windowMs = 60_000 } = {}) {
  return function check(req) {
    cleanup(windowMs)
    const ip = clientIp(req)
    const now = Date.now()
    const entry = store.get(ip)

    if (!entry || now - entry.start > windowMs) {
      store.set(ip, { count: 1, start: now })
      return null // allowed
    }

    entry.count++
    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.start + windowMs - now) / 1000)
      return { retryAfter } // blocked
    }

    return null // allowed
  }
}
