import test from 'node:test'
import assert from 'node:assert/strict'
import { cancellationFeeCents } from '../api/_fees.js'

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
