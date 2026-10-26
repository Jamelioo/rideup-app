import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BOOKING_PAUSED, isCashRide } from '../src/lib/cash.js'
import { chargeOf } from '../src/lib/discounts.js'

test('the cash a driver collects is what the rider pays: the fare less promo and credit', () => {
  const ride = { payment_method: 'cash', fare_cents: 2000, promo_discount_cents: 500, credit_applied_cents: 250 }
  assert.equal(isCashRide(ride), true)
  assert.equal(chargeOf(ride), 1250)
})

test('every ride is cash, except old card trips in the history', () => {
  assert.equal(isCashRide({}), true, 'a demo ride or a row from before payment methods existed')
  assert.equal(isCashRide({ payment_method: 'card' }), false)
  assert.equal(isCashRide(null), false)
})

test('a paused rider reads the database’s own words on the booking screen', () => {
  const sql = readFileSync(new URL('../supabase/migrations/021_cash_only.sql', import.meta.url), 'utf8')
  assert.ok(sql.includes(`raise exception '${BOOKING_PAUSED}'`), 'guard_rides_insert says the same thing')
})
