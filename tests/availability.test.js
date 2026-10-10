import test from 'node:test'
import assert from 'node:assert/strict'
import { eligibleDrivers, availabilitySummary, pickupMinutes, etaStep } from '../api/_notifyDrivers.js'
import { etaLabel, canBook, unavailableNotice, optionStatus, availabilityFor } from '../src/lib/availability.js'

const NOW = Date.parse('2026-10-04T15:00:00Z')
const ago = (min) => new Date(NOW - min * 60_000).toISOString()
const CABLE_BEACH = { lat: 25.0663, lng: -77.3962 }
const CLIFTON = { lat: 25.0050, lng: -77.5420 } // far west end of the island
const PARADISE_ISLAND = { lat: 25.0840, lng: -77.3170 } // ~15 miles from Clifton, the island's two ends
const FREEPORT = { lat: 26.5285, lng: -78.6967 } // Grand Bahama, another island
const driver = (over = {}) => ({
  id: 'd1', auth_user_id: 'u1', vehicle_type: 'standard', last_lat: 25.07, last_lng: -77.35, last_seen_at: ago(1), ...over,
})
const pool = (drivers, { reachable = [], busy = [] } = {}) => ({ drivers, reachable: new Set(reachable), busy })
const eligible = (p, pickup, vehicleType = 'standard', extra = {}) => eligibleDrivers(p, { ...pickup, vehicleType, now: NOW, ...extra })

test('a driver using the app nearby can take a trip', () => {
  const [d] = eligible(pool([driver()]), CABLE_BEACH)
  assert.equal(d.id, 'd1')
  assert.equal(d.inBackground, false)
  assert.ok(d.miles > 2 && d.miles < 4)
})

test('a driver in another app still counts for up to 30 minutes, with or without notifications', () => {
  const away = driver({ last_seen_at: ago(10) })
  assert.equal(eligible(pool([away]), CABLE_BEACH).length, 1)
  assert.equal(eligible(pool([away], { reachable: ['u1'] }), CABLE_BEACH).length, 1)
  assert.deepEqual(eligible(pool([driver({ last_seen_at: ago(31) })], { reachable: ['u1'] }), CABLE_BEACH), [])
})

test('vehicle classes: bigger and better cars take Go trips, XL and Premium need their own', () => {
  const xl = driver({ vehicle_type: 'xl' })
  assert.equal(eligible(pool([xl]), CABLE_BEACH, 'standard').length, 1)
  assert.equal(eligible(pool([xl]), CABLE_BEACH, 'xl').length, 1)
  assert.equal(eligible(pool([xl]), CABLE_BEACH, 'premium').length, 0)
  assert.equal(eligible(pool([driver()]), CABLE_BEACH, 'xl').length, 0)
})

test('drivers on a trip are left out, and the answer is "busy" rather than "none"', () => {
  const p = pool([driver()], { busy: [{ driver_id: 'd1', vehicle_type: 'standard' }] })
  assert.deepEqual(eligible(p, CABLE_BEACH), [])
  const summary = availabilitySummary(p, { ...CABLE_BEACH, now: NOW })
  assert.deepEqual(summary.standard, { state: 'busy' })
  assert.deepEqual(summary.xl, { state: 'none' }) // a busy Go car could never take an XL trip
})

test('a driver anywhere on the island is offered the trip; off-island or declined drivers are not; nearest first', () => {
  assert.equal(eligible(pool([driver({ last_lat: PARADISE_ISLAND.lat, last_lng: PARADISE_ISLAND.lng })]), CLIFTON).length, 1)
  assert.deepEqual(eligible(pool([driver({ last_lat: FREEPORT.lat, last_lng: FREEPORT.lng })]), CLIFTON), [])
  const near = driver({ id: 'near', auth_user_id: 'u2', last_lat: 25.067, last_lng: -77.39 })
  const far = driver({ id: 'far', auth_user_id: 'u3', last_lat: 25.08, last_lng: -77.32 })
  assert.deepEqual(eligible(pool([far, near]), CABLE_BEACH).map((d) => d.id), ['near', 'far'])
  assert.deepEqual(eligible(pool([far, near]), CABLE_BEACH, 'standard', { skip: ['near'] }).map((d) => d.id), ['far'])
})

test('pickup estimates: 5-minute steps, extra time from the background, and a ~1 km grid for privacy', () => {
  assert.deepEqual([3, 5, 6, 12, 29, 31, null].map(etaStep), [5, 5, 10, 15, 30, 45, null])
  const here = driver({ last_lat: 25.0712, last_lng: -77.3488 })
  const sameCell = driver({ last_lat: 25.0698, last_lng: -77.3502 })
  assert.equal(pickupMinutes(here, CABLE_BEACH), pickupMinutes(sameCell, CABLE_BEACH))
  assert.equal(pickupMinutes({ ...here, inBackground: true }, CABLE_BEACH), pickupMinutes(here, CABLE_BEACH) + 2)
  assert.equal(pickupMinutes(driver({ last_lat: null, last_lng: null }), CABLE_BEACH), null)
})

test('the summary never says who or where a driver is, and logged-out visitors get no estimate', () => {
  const p = pool([driver({ last_lat: 25.0712, last_lng: -77.3488 })])
  const signedIn = availabilitySummary(p, { ...CABLE_BEACH, now: NOW })
  assert.equal(signedIn.standard.state, 'available')
  assert.ok([5, 10, 15].includes(signedIn.standard.eta_max))
  const text = JSON.stringify(signedIn)
  for (const secret of ['d1', 'u1', '25.07', '77.34', 'miles', 'lat', 'lng']) assert.ok(!text.includes(secret), `leaked ${secret}`)
  assert.deepEqual(availabilitySummary(p, { ...CABLE_BEACH, withEta: false, now: NOW }).standard, { state: 'available' })
  assert.deepEqual(availabilitySummary(pool([]), { ...CABLE_BEACH, now: NOW }).premium, { state: 'none' })
})

test('cash trips: only drivers who take cash count, and a rider paying cash is told when only card would work', () => {
  const noCash = driver({ accept_cash: false })
  assert.equal(eligible(pool([noCash]), CABLE_BEACH).length, 1)
  assert.deepEqual(eligible(pool([noCash]), CABLE_BEACH, 'standard', { cash: true }), [])
  assert.equal(eligible(pool([driver()]), CABLE_BEACH, 'standard', { cash: true }).length, 1, 'drivers take cash unless they turn it off')
  assert.deepEqual(availabilitySummary(pool([noCash]), { ...CABLE_BEACH, cash: true, now: NOW }).standard, { state: 'no_cash' })
  assert.equal(availabilitySummary(pool([noCash]), { ...CABLE_BEACH, now: NOW }).standard.state, 'available')
  assert.deepEqual(availabilitySummary(pool([]), { ...CABLE_BEACH, cash: true, now: NOW }).standard, { state: 'none' })
  assert.equal(canBook({ state: 'no_cash' }), true)
  assert.equal(unavailableNotice({ state: 'no_cash' }).title, 'No drivers taking cash nearby')
  assert.match(unavailableNotice({ state: 'no_cash' }).body, /^Pay by card to get a driver now\. Or request with cash/)
  assert.equal(optionStatus({ state: 'no_cash' }), 'Card only right now')
})

test('booking screen wording: nobody online can still request, every driver busy waits, unknown never blocks', () => {
  assert.deepEqual([5, 10, 15, 20, 30, 45, null].map(etaLabel), ['5 min', '5–10 min', '10–15 min', '15–20 min', '20–30 min', '30+ min', ''])
  assert.equal(canBook(null), true)
  assert.equal(canBook({ state: 'available' }), true)
  assert.equal(canBook({ state: 'none' }), true)
  assert.equal(canBook({ state: 'busy' }), false)
  assert.equal(unavailableNotice(null), null)
  assert.equal(unavailableNotice({ state: 'available', eta_max: 5 }), null)
  assert.equal(unavailableNotice({ state: 'none' }).title, 'No drivers online right now')
  assert.match(unavailableNotice({ state: 'none' }).body, /still request.*up to 5 minutes.*won’t be charged/)
  assert.equal(unavailableNotice({ state: 'busy' }).title, 'All drivers are on trips right now')
  assert.equal(optionStatus({ state: 'available', eta_max: 10 }), '5–10 min away')
  assert.equal(optionStatus({ state: 'available' }), '')
  assert.equal(optionStatus({ state: 'none' }), 'No drivers online')
  assert.equal(optionStatus({ state: 'busy' }), 'Unavailable')
  assert.equal(availabilityFor({ types: { xl: { state: 'none' } } }, 'xl').state, 'none')
  assert.equal(availabilityFor(null, 'standard'), null)
})
