import test from 'node:test'
import assert from 'node:assert/strict'
import { proofLines, driverProofLines, quotesToShow, PROOF_MIN_TRIPS, PROOF_MIN_RATINGS, PROOF_MIN_REQUESTS } from '../src/lib/proofRules.js'
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

test('the driver page shows demand only once there is some', () => {
  assert.deepEqual(driverProofLines({ requests_30d: PROOF_MIN_REQUESTS - 1, completed_trips: 3 }), [])
  assert.deepEqual(driverProofLines({ requests_30d: 140, completed_trips: 90 }).map((l) => l.text),
    ['140 ride requests in Nassau in the last 30 days', '90 trips completed so far'])
})

test('rider quotes: only approved ones the server sent, at most three, never empty ones', () => {
  assert.deepEqual(quotesToShow(null), [])
  assert.deepEqual(quotesToShow({ quotes: [] }), [], 'no quotes yet: the section stays hidden')
  const four = [1, 2, 3, 4].map((i) => ({ quote: `Great ride number ${i}`, name: `Rider ${i}.` }))
  assert.deepEqual(quotesToShow({ quotes: [{ quote: '', name: 'X.' }, ...four] }).map((q) => q.name), ['Rider 1.', 'Rider 2.', 'Rider 3.'])
})

// A stand-in for the Supabase client: rides counts and ratings, approved quotes, or "no quotes table yet".
function fakeDb({ completed = 0, requested = 0, ratings = [], quotes = [], quotesError = null, error = null } = {}) {
  return {
    from(table) {
      let head = false
      const filters = []
      const result = () => {
        if (error) return { data: null, count: null, error }
        if (table === 'testimonials') {
          assert.deepEqual(filters, [['status', 'approved']], 'only approved quotes go out')
          return quotesError ? { data: null, error: quotesError } : { data: quotes, error: null }
        }
        assert.equal(table, 'rides')
        if (head) return { count: filters.some(([c]) => c === 'created_at>=') ? requested : completed, error: null }
        return { data: ratings.map((r) => ({ rider_rating: r })), error: null }
      }
      const chain = {
        select: (_cols, opts) => { head = !!opts?.head; return chain },
        eq: (col, val) => { filters.push([col, val]); return chain },
        gte: (col, val) => { filters.push([`${col}>=`, val]); return chain },
        not: () => chain,
        order: () => chain,
        limit: () => chain,
        then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject),
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

test('stats endpoint: real trips, ratings, requests and approved quotes, cached by the CDN', async () => {
  assert.deepEqual(await loadStats(fakeDb({ completed: 3, requested: 9, ratings: [5, 4, 5, 9, 0] })),
    { completed_trips: 3, ratings: 3, average_rating: 4.7, requests_30d: 9, quotes: [] }, 'out-of-range ratings are ignored')
  const res = await call(statsHandler(fakeDb({ completed: 120, requested: 300, ratings: [5, 5, 4],
    quotes: [{ quote: 'Price was exactly what the app said.', display_name: 'Ann R.' }] })))
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { completed_trips: 120, ratings: 3, average_rating: 4.7, requests_30d: 300,
    quotes: [{ quote: 'Price was exactly what the app said.', name: 'Ann R.' }] })
  assert.match(res.headers['Cache-Control'], /s-maxage=600/)
  // Before migration 022 there's no quotes table: everything else still works.
  const noTable = await call(statsHandler(fakeDb({ completed: 5, quotesError: { code: 'PGRST205', message: 'Could not find the table' } })))
  assert.equal(noTable.statusCode, 200)
  assert.deepEqual(noTable.body.quotes, [])
  assert.equal((await call(statsHandler(fakeDb({ quotesError: { code: 'XX000', message: 'boom' } })))).statusCode, 500, 'other quote errors are real errors')
  assert.equal((await call(statsHandler(fakeDb()), 'POST')).statusCode, 405)
  assert.equal((await call(statsHandler(null))).statusCode, 500)
  const broken = await call(statsHandler(fakeDb({ error: { message: 'boom' } })))
  assert.equal(broken.statusCode, 500)
  assert.equal(broken.headers['Cache-Control'], 'no-store', 'a failure is never cached')
})
