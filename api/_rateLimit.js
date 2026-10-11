// Simple in-memory rate limiter for Vercel serverless functions.
// Best-effort only: counters live in one warm instance, so this slows abuse and accidents but is not a
// hard guarantee. Auth, ownership checks and Stripe idempotency keys are the real protections.
// For hard limits put Vercel's WAF / rate-limit rules or an external store in front of /api.
// Each limiter keeps its own counters: every route runs in one function (api/[action].js), so a shared store
// would let calls to one route (say the booking screen's availability checks) use up another route's limit.

const CLEANUP_INTERVAL = 60_000

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
  const store = new Map()
  let lastCleanup = Date.now()

  function cleanup(now) {
    if (now - lastCleanup < CLEANUP_INTERVAL) return
    lastCleanup = now
    for (const [key, entry] of store) {
      if (now - entry.start > windowMs) store.delete(key)
    }
  }

  return function check(req) {
    const now = Date.now()
    cleanup(now)
    const ip = clientIp(req)
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
