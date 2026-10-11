import test from 'node:test'
import assert from 'node:assert/strict'
import { FUNNEL_STEPS, markStep } from '../src/lib/funnelSteps.js'
import { trackHandler } from '../api/_routes/track.js'

test('funnel: each step is counted once per browser per day', () => {
  const first = markStep({}, 'landing', '2026-10-11')
  assert.deepEqual(first, { send: true, seen: { landing: '2026-10-11' } })
  assert.equal(markStep(first.seen, 'landing', '2026-10-11').send, false, 'a second visit the same day isn’t counted')
  const booking = markStep(first.seen, 'booking', '2026-10-11')
  assert.deepEqual(booking.seen, { landing: '2026-10-11', booking: '2026-10-11' }, 'other steps are kept')
  assert.equal(markStep(booking.seen, 'landing', '2026-10-12').send, true, 'the next day counts again')
  assert.equal(markStep(null, 'price', '2026-10-11').send, true, 'nothing stored yet')
  assert.deepEqual(markStep({}, 'checkout', '2026-10-11'), { send: false, seen: {} }, 'unknown steps are never sent')
  assert.deepEqual(FUNNEL_STEPS, ['landing', 'booking', 'price', 'request'])
})

function call(handler, { method = 'POST', body = {}, ip = '203.0.113.80' } = {}) {
  const res = { statusCode: 0, headers: {}, ended: false,
    status(c) { this.statusCode = c; return this }, json() { this.ended = true; return this },
    end() { this.ended = true; return this }, setHeader(k, v) { this.headers[k] = v } }
  return handler({ method, body, headers: { 'x-vercel-forwarded-for': ip }, socket: {} }, res).then(() => res)
}

function fakeDb(result = { error: null }) {
  const calls = []
  return { calls, rpc: async (fn, args) => { calls.push([fn, args]); if (result instanceof Error) throw result; return result } }
}

test('funnel counts: known steps only, always 204, never cached', async () => {
  const db = fakeDb()
  const handler = trackHandler(db)
  const ok = await call(handler, { body: { step: 'price' } })
  assert.equal(ok.statusCode, 204)
  assert.equal(ok.headers['Cache-Control'], 'no-store')
  assert.deepEqual(db.calls, [['funnel_bump', { p_step: 'price' }]])
  for (const body of [{ step: 'checkout' }, { step: "landing'; --" }, {}, null]) {
    assert.equal((await call(handler, { body })).statusCode, 204)
  }
  assert.equal(db.calls.length, 1, 'junk never reaches the database')
  assert.equal((await call(handler, { method: 'GET' })).statusCode, 405)
  assert.equal((await call(trackHandler(null), { body: { step: 'landing' } })).statusCode, 204, 'no server key: still 204')
})

test('funnel counts: a flood from one address stops being counted', async () => {
  const db = fakeDb()
  const handler = trackHandler(db)
  for (let i = 0; i < 61; i++) await call(handler, { body: { step: 'landing' }, ip: '203.0.113.81' })
  assert.equal(db.calls.length, 60)
  const other = await call(handler, { body: { step: 'landing' }, ip: '203.0.113.82' })
  assert.equal(other.statusCode, 204)
  assert.equal(db.calls.length, 61, 'other addresses are still counted')
})

test('funnel counts: database trouble never reaches the visitor; only real errors are logged', async (t) => {
  const logged = []
  t.mock.method(console, 'error', (...args) => logged.push(args.join(' ')))
  const missing = await call(trackHandler(fakeDb({ error: { code: 'PGRST202', message: 'Could not find the function public.funnel_bump(p_step)' } })), { body: { step: 'booking' } })
  assert.equal(missing.statusCode, 204)
  assert.equal(logged.length, 0, 'before migration 020 runs, nothing is logged')
  const denied = await call(trackHandler(fakeDb({ error: { code: '42501', message: 'permission denied for function funnel_bump' } })), { body: { step: 'booking' } })
  assert.equal(denied.statusCode, 204)
  assert.match(logged[0], /permission denied/)
  const down = await call(trackHandler(fakeDb(new Error('fetch failed'))), { body: { step: 'booking' } })
  assert.equal(down.statusCode, 204)
  assert.match(logged[1], /fetch failed/)
})
