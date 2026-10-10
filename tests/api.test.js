import test from 'node:test'
import assert from 'node:assert/strict'
import { isAdmin } from '../api/_auth.js'
import { rateLimit } from '../api/_rateLimit.js'
import { rideAlertText } from '../api/_staffAlerts.js'
import promoPreview, { promoProblem } from '../api/_routes/promo-preview.js'

test('promo check before an account: the code’s own rules, in the database’s words', () => {
  const now = Date.parse('2026-10-10T12:00:00Z')
  const code = { active: true, expires_at: null, max_uses: null, uses: 0 }
  assert.equal(promoProblem(code, now), null)
  assert.equal(promoProblem({ ...code, max_uses: 100, uses: 99 }, now), null)
  assert.equal(promoProblem(null, now), 'That promo code isn’t valid.')
  assert.equal(promoProblem({ ...code, active: false }, now), 'That promo code isn’t valid.')
  assert.equal(promoProblem({ ...code, expires_at: '2026-10-09T00:00:00Z' }, now), 'That promo code has expired.')
  assert.equal(promoProblem({ ...code, expires_at: '2026-10-11T00:00:00Z' }, now), null)
  assert.equal(promoProblem({ ...code, max_uses: 50, uses: 50 }, now), 'That promo code has been fully used.')
})

test('promo check before an account: junk is refused before the database, and it is rate limited', async () => {
  const call = async (body, ip) => {
    const res = { statusCode: 0, body: null, headers: {}, status(c) { this.statusCode = c; return this }, json(b) { this.body = b; return this }, setHeader(k, v) { this.headers[k] = v } }
    await promoPreview({ method: 'POST', body, headers: { 'x-vercel-forwarded-for': ip }, socket: {} }, res)
    return res
  }
  const junk = await call({ code: "x'; drop table promo_codes;--" }, '203.0.113.50')
  assert.equal(junk.statusCode, 200)
  assert.deepEqual(junk.body, { ok: false, error: 'That promo code isn’t valid.' })
  assert.equal((await call({}, '203.0.113.50')).body.ok, false)
  let last
  for (let i = 0; i < 31; i++) last = await call({ code: 'WELCOME5' }, '203.0.113.51')
  assert.equal(last.statusCode, 429)
  assert.ok(Number(last.headers['Retry-After']) > 0)
})

test('ride alerts: a request nobody online can take asks the team to act while the rider waits', () => {
  const ride = { pickup_address: 'Cable Beach, Nassau', dropoff_address: 'Downtown, Nassau', fare_cents: 1868, riders: { name: 'Ann Rolle', phone: '+12425550101' } }
  const fresh = rideAlertText(ride, { notified: 2 })
  assert.equal(fresh.title, 'New ride request')
  assert.equal(fresh.body, 'Cable Beach → Downtown · $18.68 · 2 drivers alerted')
  const waiting = rideAlertText(ride, { notified: 0 })
  assert.equal(waiting.title, 'Rider waiting: no driver online')
  assert.match(waiting.body, /Go online in the driver app, or assign a driver in Live\. It stays open for 5 minutes\./)
  assert.match(waiting.emailHtml, /the rider is waiting/)
  assert.doesNotMatch(waiting.emailHtml, /told no cars/)
  const missed = rideAlertText(ride, { expired: true })
  assert.equal(missed.title, 'Missed ride request')
  assert.match(missed.body, /No driver accepted in time\. Call Ann back from Live\./)
  assert.match(missed.emailHtml, /tel:\+12425550101/)
})

test('ride alerts escape what riders typed', () => {
  const { emailHtml } = rideAlertText({ pickup_address: '<img src=x onerror=alert(1)>', dropoff_address: 'B', fare_cents: 1000, rider_name: '<b>Eve</b>' }, { notified: 1 })
  assert.doesNotMatch(emailHtml, /<img|<b>Eve/)
})

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
