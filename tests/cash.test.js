import test from 'node:test'
import assert from 'node:assert/strict'
import { cashOption, isCashRide } from '../src/lib/cash.js'
import { chargeOf } from '../src/lib/discounts.js'

test('who can choose cash on the booking screen, in the database’s words', () => {
  assert.deepEqual(cashOption({ signedIn: true }), { ok: true, reason: '' })
  const out = cashOption({ signedIn: false })
  assert.equal(out.ok, false)
  assert.equal(out.reason, 'Log in or sign up to pay with cash.')
  assert.equal(out.action.to, '/signup?redirect=/book')
  assert.equal(cashOption({ signedIn: true, guest: true }).action.label, 'Create account')
  assert.match(cashOption({ signedIn: true, guest: true }).reason, /^Create an account to pay with cash\./)
  // Same wording as guard_rides_insert (migration 019), so the rider reads one message either way.
  assert.equal(cashOption({ signedIn: true, blocked: true }).reason, 'Cash isn’t available on your account. Please pay by card.')
  assert.equal(cashOption({ signedIn: true, forSomeoneElse: true }).reason, 'Cash is for your own rides. When you book for someone else, pay by card.')
  assert.equal(cashOption({ signedIn: true, guest: true, blocked: true }).action.label, 'Create account', 'a guest is asked to sign up first')
})

test('the cash a driver collects is what the rider pays: the fare less promo and credit', () => {
  const ride = { payment_method: 'cash', fare_cents: 2000, promo_discount_cents: 500, credit_applied_cents: 250 }
  assert.equal(isCashRide(ride), true)
  assert.equal(chargeOf(ride), 1250)
  assert.equal(isCashRide({ payment_method: 'card' }), false)
  assert.equal(isCashRide(null), false)
})
