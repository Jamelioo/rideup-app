// Fare calculation for on-demand rides — point-to-point, priced by
// distance + time. Airport transfer flat rates stay on the existing
// Stripe/WordPress setup separately.

export const RATES = {
  standard: { base: 200, perMile: 125, perMinute: 35, minimum: 1000 }, // small cars (Fit, March…): $2 + $1.25/mi + $0.35/min, $10 min
  xl:       { base: 450, perMile: 230, perMinute: 30, minimum: 1500 },
  premium:  { base: 700, perMile: 320, perMinute: 40, minimum: 2000 },
}

// $2.50 per trip kept by RideUp (covers card processing and maps); drivers keep 80% of everything else.
export const BOOKING_FEE_CENTS = 250
// Never price a trip faster than 30 mph average (2 min per mile), whatever trip time the app sends.
export const MIN_MINUTES_PER_MILE = 2

// $3.00 for pickups at Lynden Pindling International Airport (about 1 mile around the terminals).
// Part of the fare, so the driver keeps 80% of it. Must match is_airport_pickup() (migration 009).
export const AIRPORT = { lat: 25.039, lng: -77.4662, radiusMiles: 1 }
export const AIRPORT_FEE_CENTS = 300

export function isAirportPickup(point) {
  if (point?.lat == null || point?.lng == null) return false
  const rad = (d) => (d * Math.PI) / 180
  const a = Math.sin(rad(point.lat - AIRPORT.lat) / 2) ** 2 +
    Math.cos(rad(AIRPORT.lat)) * Math.cos(rad(point.lat)) * Math.sin(rad(point.lng - AIRPORT.lng) / 2) ** 2
  return 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(a))) <= AIRPORT.radiusMiles
}

// One extra stop on the way: priced on the whole route, plus a few minutes for the stop itself.
export const STOP_MINUTES = 3

// Busy-time pricing: when ride requests near the pickup outnumber free drivers, the trip part of the fare
// (not the airport or booking fee) goes up, never more than 1.5×. Set by the database (surge_multiplier_at).
export const MAX_SURGE = 1.5
export const normalizeSurge = (m) => Math.min(MAX_SURGE, Math.max(1, Math.round((Number(m) || 1) * 100) / 100))

// Upfront price: max(base + distance + time, minimum) × busy-time multiplier + airport fee + booking fee.
// Must match guard_rides_insert (migration 010). Pass { pickup } so airport pickups are priced right,
// { surge } for busy times and { stop: true } when the trip has an extra stop.
export function calculateFare(distanceMiles, durationMinutes, vehicleType = 'standard', { pickup = null, surge = 1, stop = false } = {}) {
  const rate = RATES[vehicleType] || RATES.standard
  const minutes = Math.max(durationMinutes || 0, (distanceMiles || 0) * MIN_MINUTES_PER_MILE + (stop ? STOP_MINUTES : 0))
  const trip = rate.base + distanceMiles * rate.perMile + minutes * rate.perMinute
  const airport = isAirportPickup(pickup) ? AIRPORT_FEE_CENTS : 0
  return Math.round(Math.max(Math.round(trip), rate.minimum) * normalizeSurge(surge)) + airport + BOOKING_FEE_CENTS
}

// What the driver keeps: 80% of the fare excluding the booking fee. Rides store it; older rows fall back
// to the same rule.
export function driverPayout(ride) {
  if (ride?.driver_payout_cents != null) return ride.driver_payout_cents
  const fare = ride?.fare_cents || 0
  return Math.round((fare - (ride?.booking_fee_cents || 0)) * 0.8)
}

export function formatFare(cents) {
  return '$' + ((cents || 0) / 100).toFixed(2)
}

export const VEHICLE_TYPES = [
  { id: 'standard', name: 'RideUp Go', capacity: 4, icon: '🚗', desc: 'Everyday rides, nearby drivers' },
  { id: 'xl', name: 'RideUp XL', capacity: 6, icon: '🚙', desc: 'More room for groups' },
  { id: 'premium', name: 'RideUp Premium', capacity: 4, icon: '🚘', desc: 'Newer vehicles, top-rated drivers' },
]
