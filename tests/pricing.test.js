import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateFare, driverPayout, formatFare, RATES, BOOKING_FEE_CENTS, isAirportPickup, normalizeSurge } from '../src/lib/pricing.js'
import { previewDiscounts, chargeOf, splitShares } from '../src/lib/discounts.js'

// These expected values are also what the database trigger (migration 002) produces — keep them in sync.
test('standard fare: 5 mi / 15 min', () => assert.equal(calculateFare(5, 15, 'standard'), 1600))
test('premium fare: 5 mi / 15 min', () => assert.equal(calculateFare(5, 15, 'premium'), 3150))
test('xl fare: 5 mi / 15 min', () => assert.equal(calculateFare(5, 15, 'xl'), 450 + 5 * 230 + 15 * 30 + 250))
test('minimum fare applies to very short trips', () => {
  assert.equal(calculateFare(0.1, 1, 'standard'), RATES.standard.minimum + BOOKING_FEE_CENTS)
  assert.equal(calculateFare(0.1, 1, 'premium'), RATES.premium.minimum + BOOKING_FEE_CENTS)
})
test('unknown vehicle type falls back to standard', () => assert.equal(calculateFare(5, 15, 'spaceship'), 1600))

test('driver keeps 70%, stored value wins, old rows fall back to 70%', () => {
  assert.equal(driverPayout({ fare_cents: 1375, driver_payout_cents: 1100 }), 1100)
  assert.equal(driverPayout({ fare_cents: 1000 }), 700)
  assert.equal(driverPayout(null), 0)
})

test('formatFare', () => {
  assert.equal(formatFare(1375), '$13.75')
  assert.equal(formatFare(undefined), '$0.00')
})

test('minimum fares: standard $10, xl $15, premium $20', () => {
  assert.equal(RATES.standard.minimum, 1000)
  assert.equal(RATES.xl.minimum, 1500)
  assert.equal(RATES.premium.minimum, 2000)
  assert.equal(calculateFare(0.5, 2, 'standard'), 1250)
})

test('booking fee goes to RideUp; driver keeps 70% of the rest', () => {
  assert.equal(driverPayout({ fare_cents: 1560, booking_fee_cents: 250 }), 917)
})
test('trip time is never priced faster than 2 min per mile', () => {
  // 10 mi claimed in 5 min is priced as 20 min
  assert.equal(calculateFare(10, 5, 'standard'), calculateFare(10, 20, 'standard'))
})
test('screenshot trip: 4.4 mi / 16 min normal, 35 min rush hour', () => {
  assert.equal(calculateFare(4.4, 16, 'standard'), 1560)
  assert.equal(calculateFare(4.4, 35, 'standard'), 2225)
})

test('LPIA pickups add the $3 airport fee (same numbers as the database test)', () => {
  const lpia = { lat: 25.0392, lng: -77.4655 }
  assert.equal(isAirportPickup(lpia), true)
  assert.equal(isAirportPickup({ lat: 25.04, lng: -77.35 }), false)
  assert.equal(calculateFare(10, 25, 'standard', { pickup: lpia }), 2875)
  assert.equal(calculateFare(10, 25, 'standard'), 2575)
})
test('discount preview matches the database: promo or referral, then credit, rider pays at least $1', () => {
  assert.deepEqual(previewDiscounts(1410, { promo: { code: 'BIG', amount_cents: 5000 } }).charge, 100)
  assert.equal(previewDiscounts(1410, { referralPending: true }).charge, 910)
  assert.equal(previewDiscounts(1410, { creditCents: 500 }).charge, 910)
  assert.equal(previewDiscounts(1410, { promo: { code: 'W', amount_cents: 500 }, creditCents: 2000 }).charge, 100)
  assert.equal(chargeOf({ fare_cents: 1410, promo_discount_cents: 500, credit_applied_cents: 0 }), 910)
})

test('busy-time pricing multiplies the trip part only, capped at 1.5x (same numbers as the database test)', () => {
  assert.equal(calculateFare(4.4, 16, 'standard', { surge: 1.3 }), 1953)
  const lpia = { lat: 25.0392, lng: -77.4655 }
  assert.equal(calculateFare(10, 25, 'standard', { pickup: lpia, surge: 1.5 }), Math.round(2325 * 1.5) + 300 + 250)
  assert.equal(normalizeSurge(3), 1.5)
  assert.equal(normalizeSurge(0.5), 1)
  assert.equal(normalizeSurge(undefined), 1)
})
test('an extra stop adds 3 minutes to the time floor (same numbers as the database test)', () => {
  // 6.38 mi through the stop, app claimed 1 min -> priced as 6.38*2 + 3 = 15.76 min
  assert.equal(calculateFare(6.38, 1, 'standard', { stop: true }), 1799)
  assert.equal(calculateFare(6.38, 30, 'standard', { stop: true }), calculateFare(6.38, 30, 'standard'))
})
test('split fare: equal shares, the rider covers the leftover cent; tiny fares are not split', () => {
  assert.deepEqual(splitShares(1803, 2), { friendShare: 601, ownerShare: 601, friends: 2 })
  assert.deepEqual(splitShares(1000, 3), { friendShare: 250, ownerShare: 250, friends: 3 })
  assert.deepEqual(splitShares(1001, 1), { friendShare: 500, ownerShare: 501, friends: 1 })
  assert.deepEqual(splitShares(1000, 9).friends, 3)
  assert.deepEqual(splitShares(150, 3), { friendShare: 0, ownerShare: 150, friends: 0 })
})
