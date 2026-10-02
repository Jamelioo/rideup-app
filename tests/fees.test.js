import test from 'node:test'
import assert from 'node:assert/strict'
import { cancellationFeeCents, noShowFeeCents, noShowAllowed, splitFee } from '../api/_fees.js'

const now = Date.parse('2026-10-01T12:00:00Z')
const base = { role: 'rider', status: 'accepted', paymentStatus: 'authorized', fareCents: 1500, feeCents: 300, graceSeconds: 120, now }
const acceptedAgo = (s) => new Date(now - s * 1000).toISOString()

test('free inside the grace period', () => assert.equal(cancellationFeeCents({ ...base, acceptedAt: acceptedAgo(60) }), 0))
test('fee after the grace period', () => assert.equal(cancellationFeeCents({ ...base, acceptedAt: acceptedAgo(300) }), 300))
test('fee never exceeds the fare', () => assert.equal(cancellationFeeCents({ ...base, fareCents: 200, acceptedAt: acceptedAgo(300) }), 200))
test('driver and admin cancels are free', () => {
  assert.equal(cancellationFeeCents({ ...base, role: 'other', acceptedAt: acceptedAgo(300) }), 0)
})
test('off by default (fee 0)', () => assert.equal(cancellationFeeCents({ ...base, feeCents: 0, acceptedAt: acceptedAgo(300) }), 0))
test('no fee once the trip started, before acceptance, or without a hold', () => {
  assert.equal(cancellationFeeCents({ ...base, status: 'in_progress', acceptedAt: acceptedAgo(300) }), 0)
  assert.equal(cancellationFeeCents({ ...base, status: 'requested', acceptedAt: acceptedAgo(300) }), 0)
  assert.equal(cancellationFeeCents({ ...base, paymentStatus: null, acceptedAt: acceptedAgo(300) }), 0)
  assert.equal(cancellationFeeCents({ ...base, acceptedAt: null }), 0)
})

const arrived = { status: 'driver_arrived', paymentStatus: 'authorized', fareCents: 1500, feeCents: 500, waitSeconds: 300, now }
test('no-show: not before the free wait is over', () => {
  assert.equal(noShowAllowed({ ...arrived, arrivedAt: acceptedAgo(299) }), false)
  assert.equal(noShowFeeCents({ ...arrived, arrivedAt: acceptedAgo(299) }), 0)
})
test('no-show: allowed with the fee once the driver has waited', () => {
  assert.equal(noShowAllowed({ ...arrived, arrivedAt: acceptedAgo(300) }), true)
  assert.equal(noShowFeeCents({ ...arrived, arrivedAt: acceptedAgo(420) }), 500)
})
test('no-show: only after arriving, and never more than the fare', () => {
  assert.equal(noShowAllowed({ ...arrived, status: 'accepted', arrivedAt: acceptedAgo(900) }), false)
  assert.equal(noShowFeeCents({ ...arrived, fareCents: 300, arrivedAt: acceptedAgo(900) }), 300)
  assert.equal(noShowFeeCents({ ...arrived, paymentStatus: null, arrivedAt: acceptedAgo(900) }), 0)
})
test('fees split 80/20 like fares and add up exactly', () => {
  assert.deepEqual(splitFee(500), { platform_fee_cents: 100, driver_payout_cents: 400 })
  const odd = splitFee(333)
  assert.equal(odd.platform_fee_cents + odd.driver_payout_cents, 333)
})
