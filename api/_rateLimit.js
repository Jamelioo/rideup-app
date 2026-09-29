// Simple in-memory rate limiter for Vercel serverless functions
// Resets per-instance (shared across requests within the same warm instance)
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

export function rateLimit({ maxRequests = 10, windowMs = 60_000 } = {}) {
  return function check(req) {
    cleanup(windowMs)
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
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
