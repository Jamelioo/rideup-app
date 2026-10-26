import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { guaranteeApplies, isGuaranteeCredit, GUARANTEE_REASON } from '../src/lib/guarantee.js'
import { guaranteeCents } from '../api/_credit.js'

test('the guarantee credit is for a driver cancelling after accepting, nothing else', () => {
  assert.equal(guaranteeApplies({ actor: 'driver', noShow: false, status: 'accepted' }), true)
  assert.equal(guaranteeApplies({ actor: 'driver', noShow: false, status: 'driver_arrived' }), true)
  assert.equal(guaranteeApplies({ actor: 'driver', noShow: true, status: 'driver_arrived' }), false, 'a no-show is the rider’s miss')
  assert.equal(guaranteeApplies({ actor: 'rider', status: 'accepted' }), false)
  assert.equal(guaranteeApplies({ actor: 'admin', status: 'accepted' }), false)
  assert.equal(guaranteeApplies({ actor: 'driver', status: 'pending_driver_response' }), false, 'not accepted yet')
})

test('the credit amount: $5 by default, 0 switches it off, junk falls back, capped at $50', () => {
  assert.equal(guaranteeCents({}), 500)
  assert.equal(guaranteeCents({ DRIVER_CANCEL_CREDIT_CENTS: '' }), 500)
  assert.equal(guaranteeCents({ DRIVER_CANCEL_CREDIT_CENTS: '0' }), 0)
  assert.equal(guaranteeCents({ DRIVER_CANCEL_CREDIT_CENTS: '300' }), 300)
  assert.equal(guaranteeCents({ DRIVER_CANCEL_CREDIT_CENTS: 'five' }), 500)
  assert.equal(guaranteeCents({ DRIVER_CANCEL_CREDIT_CENTS: '-100' }), 0)
  assert.equal(guaranteeCents({ DRIVER_CANCEL_CREDIT_CENTS: '999999' }), 5000)
})

test('receipts name the guarantee credit by its reason, which fits the refunds table rule', () => {
  assert.equal(isGuaranteeCredit({ reason: GUARANTEE_REASON }), true)
  assert.equal(isGuaranteeCredit({ reason: 'Long route' }), false)
  assert.ok(GUARANTEE_REASON.length >= 3 && GUARANTEE_REASON.length <= 300)
})

test('the cancel endpoint gives the credit before writing the re-match, and says so in the push', () => {
  const src = readFileSync(new URL('../api/_routes/cancel-ride.js', import.meta.url), 'utf8')
  assert.ok(src.indexOf('grantDriverCancelCredit(ride)') < src.indexOf('await rebook('), 'credit first, so the rider’s screen finds it')
  assert.match(src, /creditText/)
})
