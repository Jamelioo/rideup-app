import { admin } from './_auth.js'
import { pushToUser } from './_push.js'

const MAX_PICKUP_MILES = 10
const MAX_DRIVERS = 10
// Which driver vehicle classes can take each trip type (same rule as open_ride_requests).
const CLASSES_FOR = { standard: ['standard', 'xl', 'premium'], xl: ['xl'], premium: ['premium'] }

export function milesBetween(aLat, aLng, bLat, bLng) {
  const rad = (d) => (d * Math.PI) / 180
  const a = Math.sin(rad(bLat - aLat) / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2
  return 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(a)))
}

// Push a new request to the closest online drivers whose vehicle can take it. Like Uber, the alert shows
// distance and earnings only; the exact pickup is revealed after accepting. Best effort; never throws.
export async function notifyNearbyDrivers(rideId, { exclude = [] } = {}) {
  try {
    const { data: ride } = await admin
      .from('rides')
      .select('id, status, pickup_lat, pickup_lng, vehicle_type, fare_cents, driver_payout_cents, declined_by')
      .eq('id', rideId)
      .maybeSingle()
    if (!ride || ride.status !== 'requested') return 0

    const recent = new Date(Date.now() - 3 * 60_000).toISOString()
    const { data: drivers } = await admin
      .from('drivers')
      .select('id, auth_user_id, last_lat, last_lng')
      .eq('status', 'online')
      .eq('approved', true)
      .in('vehicle_type', CLASSES_FOR[ride.vehicle_type] || CLASSES_FOR.standard)
      .gte('last_seen_at', recent)
      .limit(200)

    const skip = new Set([...(ride.declined_by || []), ...exclude])
    const payout = ride.driver_payout_cents ?? Math.round((ride.fare_cents || 0) * 0.8)
    const nearby = (drivers || [])
      .filter((d) => !skip.has(d.id))
      .map((d) => ({ ...d, miles: d.last_lat == null ? null : milesBetween(d.last_lat, d.last_lng, ride.pickup_lat, ride.pickup_lng) }))
      .filter((d) => d.miles == null || d.miles <= MAX_PICKUP_MILES)
      .sort((a, b) => (a.miles ?? 99) - (b.miles ?? 99))
      .slice(0, MAX_DRIVERS)

    await Promise.all(nearby.map((d) => pushToUser(d.auth_user_id, {
      title: 'New trip request',
      body: `${d.miles != null ? `${d.miles.toFixed(1)} mi away · ` : ''}Earn about $${(payout / 100).toFixed(2)}`,
      url: '/driver/dashboard',
      tag: 'ride-request',
    })))
    return nearby.length
  } catch (err) {
    console.error('Notify drivers failed:', err.message)
    return 0
  }
}
