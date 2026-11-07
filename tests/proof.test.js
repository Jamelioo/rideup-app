import test from 'node:test'
import assert from 'node:assert/strict'
import { proofLines, PROOF_MIN_TRIPS, PROOF_MIN_RATINGS } from '../src/lib/proofRules.js'
import { statsHandler, loadStats } from '../api/_routes/stats.js'

test('landing-page proof stays hidden until the real numbers mean something', () => {
  assert.deepEqual(proofLines(null), [])
  assert.deepEqual(proofLines({ completed_trips: 0, ratings: 0, average_rating: null }), [], 'a new service shows nothing')
  assert.deepEqual(proofLines({ completed_trips: PROOF_MIN_TRIPS - 1, ratings: PROOF_MIN_RATINGS - 1, average_rating: 5 }), [])
  const both = proofLines({ completed_trips: 1250, ratings: 87, average_rating: 4.86 })
  assert.deepEqual(both.map((l) => l.text), ['4.9 average driver rating from 87 rider ratings', '1,250 trips completed in Nassau'])
  // A weak average isn't advertised, but the trip count still is.
  assert.deepEqual(proofLines({ completed_trips: 40, ratings: 30, average_rating: 4.2 }).map((l) => l.kind), ['trips'])
})

function fakeDb({ completed = 0, ratings = [], error = null } = {}) {
  return {
    from(table) {
      assert.equal(table, 'rides')
      let head = false
      const filters = []
      const result = () => (error ? { data: null, count: null, error }
        : head ? { count: completed, error: null } : { data: ratings.map((r) => ({ rider_rating: r })), error: null })
      const chain = {
        select: (_cols, opts) => { head = !!opts?.head; return chain },
        eq: (col, val) => { filters.push([col, val]); return chain },
        not: () => chain,
        order: () => chain,
        limit: () => chain,
        then: (resolve, reject) => {
          assert.deepEqual(filters[0], ['status', 'completed'], 'only completed trips count')
          return Promise.resolve(result()).then(resolve, reject)
        },
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

test('stats endpoint: completed trips and riders’ average rating, cached by the CDN', async () => {
  assert.deepEqual(await loadStats(fakeDb({ completed: 3, ratings: [5, 4, 5, 9, 0] })), { completed_trips: 3, ratings: 3, average_rating: 4.7 }, 'out-of-range ratings are ignored')
  const res = await call(statsHandler(fakeDb({ completed: 120, ratings: [5, 5, 4] })))
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { completed_trips: 120, ratings: 3, average_rating: 4.7 })
  assert.match(res.headers['Cache-Control'], /s-maxage=600/)
  assert.deepEqual((await call(statsHandler(fakeDb()))).body, { completed_trips: 0, ratings: 0, average_rating: null })
  assert.equal((await call(statsHandler(fakeDb()), 'POST')).statusCode, 405)
  assert.equal((await call(statsHandler(null))).statusCode, 500)
  const broken = await call(statsHandler(fakeDb({ error: { message: 'boom' } })))
  assert.equal(broken.statusCode, 500)
  assert.equal(broken.headers['Cache-Control'], 'no-store', 'a failure is never cached')
})
