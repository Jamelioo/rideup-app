import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_LANDING_PROMO, featuredCode, offerStep, offerPill, endsLabel } from '../src/lib/landingOfferRules.js'
import { PLACES, placeById, tripLink } from '../src/lib/places.js'
import { AIRPORT, isAirportPickup, formatAmount } from '../src/lib/pricing.js'
import { landingOfferHandler } from '../api/_routes/landing-offer.js'

const WELCOME5 = { code: 'WELCOME5', amount_cents: 500, description: '$5 off your first ride', first_ride_only: true, expires_at: null }
const saved = (o) => ({ code: o.code, amount_cents: o.amount_cents, description: o.description })

test('landing offer: WELCOME5 until an admin picks another code, or none', () => {
  assert.equal(DEFAULT_LANDING_PROMO, 'WELCOME5')
  assert.equal(featuredCode(null), 'WELCOME5', 'never set')
  assert.equal(featuredCode({ value: ' new10 ' }), 'NEW10')
  assert.equal(featuredCode({ value: '' }), '', '"No landing offer"')
  assert.equal(featuredCode({ value: false }), '')
})

test('landing offer: given once to each new visitor, never over another code', () => {
  const visitor = { offer: WELCOME5, saved: null, pending: null, applied: null, hasRides: false }
  assert.equal(offerStep(visitor), 'apply')
  assert.equal(offerStep({ ...visitor, applied: 'WELCOME5' }), null, 'removed after it was given: not given again')
  assert.equal(offerStep({ ...visitor, applied: 'WELCOME5', offer: { ...WELCOME5, code: 'SUMMER5' } }), 'apply', 'a new offer is new')
  assert.equal(offerStep({ ...visitor, saved: saved(WELCOME5) }), null, 'already saved')
  assert.equal(offerStep({ ...visitor, saved: { code: 'FB10', amount_cents: 1000 } }), null, 'an ad link’s code wins')
  assert.equal(offerStep({ ...visitor, pending: 'FB10' }), null, 'an ad link’s code is still being checked')
  assert.equal(offerStep({ ...visitor, offer: null }), null, 'no offer right now')
})

test('landing offer: riders who have taken a trip don’t get a first-ride offer', () => {
  const rider = { offer: WELCOME5, saved: null, pending: null, applied: null, hasRides: true }
  assert.equal(offerStep(rider), null)
  assert.equal(offerStep({ ...rider, saved: saved(WELCOME5) }), 'drop', 'saved before they signed in: it would only fail at booking')
  assert.equal(offerStep({ ...rider, saved: saved(WELCOME5), offer: { ...WELCOME5, first_ride_only: false } }), null, 'any-ride codes stay')
  assert.equal(offerStep({ ...rider, saved: { code: 'FB10', amount_cents: 1000 } }), null, 'their own code stays')
})

test('landing offer pill: says what the offer is, and the end date only when it is close', () => {
  const now = Date.parse('2026-10-11T12:00:00-04:00')
  assert.deepEqual(offerPill({ offer: WELCOME5, saved: saved(WELCOME5) }, now), { title: 'First ride $5 off', note: 'no code needed', ends: null })
  assert.equal(offerPill({ offer: { ...WELCOME5, first_ride_only: false }, saved: saved(WELCOME5) }, now).title, '$5 off your next ride')
  assert.equal(offerPill({ offer: { ...WELCOME5, expires_at: '2026-10-31T23:59:59-04:00' }, saved: saved(WELCOME5) }, now).ends, 'Oct 31')
  assert.equal(offerPill({ offer: { ...WELCOME5, expires_at: '2026-12-31T23:59:59-05:00' }, saved: saved(WELCOME5) }, now).ends, null, 'over 30 days away')
  assert.deepEqual(offerPill({ offer: WELCOME5, saved: { code: 'FB10', amount_cents: 1000 } }, now), { title: '$10 off with FB10', note: 'applied automatically' })
  assert.deepEqual(offerPill({ offer: WELCOME5, saved: null, pending: 'FB10' }, now), { title: 'Code FB10', note: 'comes off when you book' })
  assert.equal(offerPill({ offer: WELCOME5, saved: null }, now), null, 'nothing saved: nothing promised')
  assert.equal(offerPill({ offer: WELCOME5, saved: saved(WELCOME5), hasRides: true }, now), null)
  assert.equal(formatAmount(750), '$7.50')
  assert.equal(formatAmount(1000), '$10')
  assert.equal(endsLabel('2026-10-10T00:00:00Z', now), null, 'already ended')
  assert.equal(endsLabel(null, now), null)
})

test('trip links: only known places, with the airport at the airport', () => {
  const airport = placeById('airport')
  assert.deepEqual([airport.lat, airport.lng], [AIRPORT.lat, AIRPORT.lng])
  assert.ok(isAirportPickup(airport), 'trips from it include the airport pickup fee')
  assert.ok(!airport.area && !placeById('cruise-port').area, 'pickup spots')
  assert.ok(placeById('cable-beach').area, 'a neighbourhood: the rider is asked for the exact pickup')
  for (const bad of ['nowhere', '__proto__', 'constructor', 'toString', '', undefined, ['airport'], { id: 'airport' }]) {
    assert.equal(placeById(bad), null, String(bad))
  }
  for (const p of Object.values(PLACES)) {
    assert.ok(p.lat > 24.95 && p.lat < 25.15 && p.lng > -77.55 && p.lng < -77.25, `${p.label} is on New Providence`)
  }
  assert.deepEqual(tripLink('airport', 'cable-beach'), { path: '/book', query: { from: 'airport', to: 'cable-beach' } })
})

function fakeDb({ setting = null, promo = WELCOME5, error = null } = {}) {
  const queries = []
  return {
    queries,
    from(table) {
      const q = { table, filters: [] }
      queries.push(q)
      const chain = {
        select: () => chain,
        eq: (col, val) => { q.filters.push([col, val]); return chain },
        maybeSingle: async () => (error ? { data: null, error }
          : { data: table === 'app_settings' ? setting : promo ? { ...promo, active: true, max_uses: null, uses: 0 } : null, error: null }),
      }
      return chain
    },
  }
}

function call(handler, method = 'GET') {
  const res = { statusCode: 0, body: null, headers: {}, status(c) { this.statusCode = c; return this },
    json(b) { this.body = b; return this }, setHeader(k, v) { this.headers[k] = v } }
  return handler({ method, headers: {}, query: {} }, res).then(() => res)
}

test('landing offer endpoint: one answer for everyone, cached by the CDN', async () => {
  const db = fakeDb()
  const res = await call(landingOfferHandler(db))
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { offer: WELCOME5 })
  assert.match(res.headers['Cache-Control'], /public, s-maxage=300/)
  assert.deepEqual(db.queries.map((q) => [q.table, q.filters]), [['app_settings', [['key', 'landing_promo']]], ['promo_codes', [['code', 'WELCOME5']]]])
  const picked = fakeDb({ setting: { value: 'SUMMER10' }, promo: { ...WELCOME5, code: 'SUMMER10', amount_cents: 1000 } })
  assert.equal((await call(landingOfferHandler(picked))).body.offer.amount_cents, 1000)
  assert.deepEqual(picked.queries[1].filters, [['code', 'SUMMER10']])
})

test('landing offer endpoint: no offer when it is turned off, missing or expired', async (t) => {
  const none = fakeDb({ setting: { value: '' } })
  assert.deepEqual((await call(landingOfferHandler(none))).body, { offer: null })
  assert.equal(none.queries.length, 1, 'no code: promo codes aren’t looked up')
  assert.deepEqual((await call(landingOfferHandler(fakeDb({ promo: null })))).body, { offer: null }, 'code doesn’t exist')
  const expired = fakeDb({ promo: { ...WELCOME5, expires_at: '2020-01-01T00:00:00Z' } })
  assert.deepEqual((await call(landingOfferHandler(expired))).body, { offer: null })
  assert.equal((await call(landingOfferHandler(fakeDb()), 'POST')).statusCode, 405)
  assert.equal((await call(landingOfferHandler(null))).statusCode, 500)
  t.mock.method(console, 'error', () => {})
  const broken = await call(landingOfferHandler(fakeDb({ error: { message: 'connection refused' } })))
  assert.equal(broken.statusCode, 500)
  assert.equal(broken.headers['Cache-Control'], 'no-store', 'errors are never cached')
})
