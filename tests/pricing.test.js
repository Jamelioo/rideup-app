import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateFare, driverPayout, formatFare, RATES } from '../src/lib/pricing.js'

// These expected values are also what the database trigger (migration 002) produces — keep them in sync.
test('standard fare: 5 mi / 15 min', () => assert.equal(calculateFare(5, 15, 'standard'), 1375))
test('premium fare: 5 mi / 15 min', () => assert.equal(calculateFare(5, 15, 'premium'), 2900))
test('xl fare: 5 mi / 15 min', () => assert.equal(calculateFare(5, 15, 'xl'), 450 + 5 * 230 + 15 * 30))
test('minimum fare applies to very short trips', () => {
  assert.equal(calculateFare(0.1, 1, 'standard'), RATES.standard.minimum)
  assert.equal(calculateFare(0.1, 1, 'premium'), RATES.premium.minimum)
})
test('unknown vehicle type falls back to standard', () => assert.equal(calculateFare(5, 15, 'spaceship'), 1375))

test('driver keeps 80%, stored value wins, old rows fall back to 80%', () => {
  assert.equal(driverPayout({ fare_cents: 1375, driver_payout_cents: 1100 }), 1100)
  assert.equal(driverPayout({ fare_cents: 1000 }), 800)
  assert.equal(driverPayout(null), 0)
})

test('formatFare', () => {
  assert.equal(formatFare(1375), '$13.75')
  assert.equal(formatFare(undefined), '$0.00')
})
