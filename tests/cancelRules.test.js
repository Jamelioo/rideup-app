import test from 'node:test'
import assert from 'node:assert/strict'
import { isLateCancel, noShowAllowed } from '../api/_cancelRules.js'

const now = Date.parse('2026-10-01T12:00:00Z')
const ago = (s) => new Date(now - s * 1000).toISOString()
const base = { status: 'accepted', graceSeconds: 120, now }

test('late cancellation: not inside the grace period', () => assert.equal(isLateCancel({ ...base, acceptedAt: ago(60) }), false))
test('late cancellation: after the grace period, on the way or waiting', () => {
  assert.equal(isLateCancel({ ...base, acceptedAt: ago(300) }), true)
  assert.equal(isLateCancel({ ...base, status: 'driver_arrived', acceptedAt: ago(300) }), true)
})
test('late cancellation: never before a driver accepts or once the trip started', () => {
  assert.equal(isLateCancel({ ...base, status: 'requested', acceptedAt: ago(300) }), false)
  assert.equal(isLateCancel({ ...base, status: 'pending_driver_response', acceptedAt: ago(300) }), false)
  assert.equal(isLateCancel({ ...base, status: 'in_progress', acceptedAt: ago(300) }), false)
  assert.equal(isLateCancel({ ...base, acceptedAt: null }), false)
})

const arrived = { status: 'driver_arrived', waitSeconds: 300, now }
test('no-show: not before the free wait is over', () => assert.equal(noShowAllowed({ ...arrived, arrivedAt: ago(299) }), false))
test('no-show: allowed once the driver has waited', () => assert.equal(noShowAllowed({ ...arrived, arrivedAt: ago(300) }), true))
test('no-show: only after arriving', () => {
  assert.equal(noShowAllowed({ ...arrived, status: 'accepted', arrivedAt: ago(900) }), false)
  assert.equal(noShowAllowed({ ...arrived, arrivedAt: null }), false)
})
