import test from 'node:test'
import assert from 'node:assert/strict'
import { isAdmin } from '../api/_auth.js'
import { rateLimit } from '../api/_rateLimit.js'

test('admin comes from app_metadata only — user_metadata is user-editable', () => {
  assert.equal(isAdmin({ app_metadata: { role: 'admin' } }), true)
  assert.equal(isAdmin({ user_metadata: { role: 'admin' } }), false)
  assert.equal(isAdmin({ app_metadata: {}, user_metadata: { role: 'admin' } }), false)
  assert.equal(isAdmin(null), false)
})

test('rate limiter blocks after the limit and reports retry-after', () => {
  const check = rateLimit({ maxRequests: 3, windowMs: 60_000 })
  const req = { headers: { 'x-vercel-forwarded-for': '203.0.113.7' }, socket: {} }
  assert.equal(check(req), null)
  assert.equal(check(req), null)
  assert.equal(check(req), null)
  const blocked = check(req)
  assert.ok(blocked && blocked.retryAfter > 0)
})

test('rate limiter ignores a client-supplied x-forwarded-for', () => {
  const check = rateLimit({ maxRequests: 1, windowMs: 60_000 })
  const real = '198.51.100.9'
  const spoof = (n) => ({ headers: { 'x-vercel-forwarded-for': real, 'x-forwarded-for': `10.0.0.${n}` }, socket: {} })
  assert.equal(check(spoof(1)), null)
  assert.ok(check(spoof(2)), 'rotating the spoofed header must not reset the counter')
})

test('different real clients get separate counters', () => {
  const check = rateLimit({ maxRequests: 1, windowMs: 60_000 })
  assert.equal(check({ headers: { 'x-vercel-forwarded-for': '192.0.2.1' }, socket: {} }), null)
  assert.equal(check({ headers: { 'x-vercel-forwarded-for': '192.0.2.2' }, socket: {} }), null)
})

test('distance helper used for nearby-driver alerts', async () => {
  const { milesBetween } = await import('../api/_notifyDrivers.js')
  assert.equal(Math.round(milesBetween(25.04, -77.35, 25.04, -77.35) * 100), 0)
  const cableBeachToAirport = milesBetween(25.0750, -77.4040, 25.0389, -77.4659)
  assert.ok(cableBeachToAirport > 4 && cableBeachToAirport < 5, String(cableBeachToAirport))
})
