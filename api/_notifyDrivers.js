import { driverPayout, formatFare } from '../src/lib/pricing.js'
import { chargeOf } from '../src/lib/discounts.js'
import { MAX_PICKUP_MILES } from '../src/lib/dispatch.js'
import { admin } from './_auth.js'
import { pushToUser, usersWithPush } from './_push.js'

const MAX_DRIVERS = 10
const POOL_COLUMNS = 'id, auth_user_id, vehicle_type, last_lat, last_lng, last_seen_at'
// A driver's app checks in every few seconds while it is open. Once it stops (closed, or the driver switched
// to another app), they stay online for DRIVER_IDLE_MIN, or for DRIVER_BACKGROUND_MIN if we can still reach
// them with a notification (like Uber's app, which keeps alerting drivers while it runs in the background).
// Both are 30 minutes for now, so every driver stays online that long; set DRIVER_IDLE_MIN back to 3 to
// take drivers without notifications offline sooner.
export const DRIVER_IDLE_MIN = 30
export const DRIVER_BACKGROUND_MIN = 30
export const TRIP_TYPES = ['standard', 'xl', 'premium']
// Which driver vehicle classes can take each trip type (same rule as open_ride_requests).
const CLASSES_FOR = { standard: ['standard', 'xl', 'premium'], xl: ['xl'], premium: ['premium'] }
export const driverCanTake = (driverVehicleType, tripType) =>
  (CLASSES_FOR[tripType] || CLASSES_FOR.standard).includes(driverVehicleType || 'standard')
// A driver with a ride in one of these states is busy (offered and confirming, or on the way, or driving).
export const BUSY_STATUSES = ['pending_driver_response', 'accepted', 'driver_arrived', 'in_progress']
// Pickup estimates: roads are ~1.35× the straight line at ~18 mph in Nassau (as in src/lib/eta.js), plus a
// minute to set off, and two more when the driver first has to open RideUp from a notification.
const ROAD_FACTOR = 1.35
const AVERAGE_MPH = 18
const SET_OFF_MIN = 1
const BACKGROUND_EXTRA_MIN = 2
const ETA_STEPS = [5, 10, 15, 20, 30]

export function milesBetween(aLat, aLng, bLat, bLng) {
  const rad = (d) => (d * Math.PI) / 180
  const a = Math.sin(rad(bLat - aLat) / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2
  return 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(a)))
}

// Everyone who could take a trip right now, loaded once per check: online drivers seen in the last
// DRIVER_BACKGROUND_MIN, which of the ones in the background we can still notify, and the rides keeping drivers
// busy. Throws if the drivers can't be loaded; if only the busy rides can't, requests still go out.
export async function loadDriverPool(now = Date.now()) {
  const since = new Date(now - DRIVER_BACKGROUND_MIN * 60_000).toISOString()
  const onlineDrivers = (columns) => admin.from('drivers')
    .select(columns)
    .eq('status', 'online')
    .eq('approved', true)
    .is('deleted_at', null)
    .gte('last_seen_at', since)
    .limit(200)
  const [drivers, busy] = await Promise.all([
    // accept_cash comes with migration 019; before it has run, the list loads without it.
    onlineDrivers(`${POOL_COLUMNS}, accept_cash`).then((r) => (r.error ? onlineDrivers(POOL_COLUMNS) : r)),
    admin.from('rides')
      .select('driver_id, drivers:driver_id(vehicle_type)')
      .in('status', BUSY_STATUSES)
      .not('driver_id', 'is', null)
      .limit(500),
  ])
  if (drivers.error) throw drivers.error
  if (busy.error) console.error('Busy drivers lookup failed:', busy.error.message)
  const activeSince = now - DRIVER_IDLE_MIN * 60_000
  const inBackground = (drivers.data || []).filter((d) => Date.parse(d.last_seen_at) < activeSince)
  return {
    drivers: drivers.data || [],
    reachable: await usersWithPush(inBackground.map((d) => d.auth_user_id)),
    busy: (busy.data || []).map((r) => ({ driver_id: r.driver_id, vehicle_type: r.drivers?.vehicle_type || 'standard' })),
  }
}

// The drivers who can take a trip of this type from this pickup, nearest first: right vehicle, not busy,
// within MAX_PICKUP_MILES, and either using the app now or in the background with notifications we can deliver.
// A cash trip only goes to drivers who take cash.
export function eligibleDrivers(pool, { lat, lng, vehicleType, cash = false, skip = [], now = Date.now() }) {
  const classes = CLASSES_FOR[vehicleType] || CLASSES_FOR.standard
  const busy = new Set(pool.busy.map((r) => r.driver_id))
  const skipped = new Set(skip)
  const activeSince = now - DRIVER_IDLE_MIN * 60_000
  const backgroundSince = now - DRIVER_BACKGROUND_MIN * 60_000
  return pool.drivers
    .filter((d) => classes.includes(d.vehicle_type || 'standard') && !busy.has(d.id) && !skipped.has(d.id))
    .filter((d) => !cash || d.accept_cash !== false)
    .filter((d) => Date.parse(d.last_seen_at) >= backgroundSince)
    .map((d) => ({ ...d, inBackground: Date.parse(d.last_seen_at) < activeSince }))
    .filter((d) => !d.inBackground || pool.reachable.has(d.auth_user_id))
    .map((d) => ({ ...d, miles: d.last_lat == null || lat == null ? null : milesBetween(d.last_lat, d.last_lng, lat, lng) }))
    .filter((d) => d.miles == null || d.miles <= MAX_PICKUP_MILES)
    .sort((a, b) => (a.miles ?? 99) - (b.miles ?? 99))
}

// Minutes for a driver to reach the pickup. The driver's position is first snapped to a ~1 km grid, so even
// many estimates from different pickups can't pinpoint where a driver is.
export function pickupMinutes(driver, { lat, lng }) {
  if (driver.last_lat == null || driver.last_lng == null || lat == null || lng == null) return null
  const snap = (v) => Math.round(v * 100) / 100
  const miles = milesBetween(snap(driver.last_lat), snap(driver.last_lng), lat, lng)
  return Math.ceil(((miles * ROAD_FACTOR) / AVERAGE_MPH) * 60) + SET_OFF_MIN + (driver.inBackground ? BACKGROUND_EXTRA_MIN : 0)
}

// Pickup estimates are shown in 5-minute steps: "5 min", "5–10 min" … "30+ min" (45).
export function etaStep(minutes) {
  if (minutes == null) return null
  return ETA_STEPS.find((step) => minutes <= step) ?? 45
}

// What the booking screen shows for each trip type (like Uber's "No cars available"): 'available' with the
// nearest driver's pickup estimate (signed-in riders only), 'busy' (everyone who could take it is on a trip),
// 'no_cash' (paying cash, and the free drivers don't take cash) or 'none'. Never includes who or where a driver is.
export function availabilitySummary(pool, { lat, lng, withEta = true, cash = false, now = Date.now() }) {
  const out = {}
  for (const type of TRIP_TYPES) {
    const [nearest] = eligibleDrivers(pool, { lat, lng, vehicleType: type, cash, now })
    if (nearest) {
      out[type] = withEta ? { state: 'available', eta_max: etaStep(pickupMinutes(nearest, { lat, lng })) } : { state: 'available' }
    } else if (cash && eligibleDrivers(pool, { lat, lng, vehicleType: type, now }).length) {
      out[type] = { state: 'no_cash' }
    } else {
      const classes = CLASSES_FOR[type]
      out[type] = { state: pool.busy.some((r) => classes.includes(r.vehicle_type)) ? 'busy' : 'none' }
    }
  }
  return out
}

// Push a new request to the closest drivers who can take it. Like Uber, the alert shows distance and earnings
// only; the exact pickup is revealed after accepting. Returns how many drivers can take it (0: nobody), or null
// when the ride is no longer waiting for a driver or the check failed. Never throws.
export async function notifyNearbyDrivers(rideId, { exclude = [] } = {}) {
  try {
    const { data: ride } = await admin
      .from('rides')
      .select('*')
      .eq('id', rideId)
      .maybeSingle()
    if (!ride || ride.status !== 'requested') return null

    const pool = await loadDriverPool()
    const nearby = eligibleDrivers(pool, {
      lat: ride.pickup_lat,
      lng: ride.pickup_lng,
      vehicleType: ride.vehicle_type,
      cash: ride.payment_method === 'cash',
      skip: [...(ride.declined_by || []), ...exclude],
    }).slice(0, MAX_DRIVERS)

    const payout = driverPayout(ride)
    const cash = ride.payment_method === 'cash' ? ` · Cash: collect ${formatFare(chargeOf(ride))}` : ''
    await Promise.all(nearby.map((d) => pushToUser(d.auth_user_id, {
      title: ride.payment_method === 'cash' ? 'New cash trip request' : 'New trip request',
      body: `${d.miles != null ? `${d.miles.toFixed(1)} mi away · ` : ''}Earn about $${(payout / 100).toFixed(2)}${cash}`,
      url: '/driver/dashboard',
      tag: 'ride-request',
    })))
    return nearby.length
  } catch (err) {
    console.error('Notify drivers failed:', err.message)
    return null
  }
}
