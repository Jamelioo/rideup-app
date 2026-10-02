// Fare calculation for on-demand rides — point-to-point, priced by
// distance + time. Airport transfer flat rates stay on the existing
// Stripe/WordPress setup separately.

export const RATES = {
  standard: { base: 200, perMile: 125, perMinute: 35, minimum: 1000 }, // small cars (Fit, March…): $2 + $1.25/mi + $0.35/min, $10 min
  xl:       { base: 450, perMile: 230, perMinute: 30, minimum: 1500 },
  premium:  { base: 700, perMile: 320, perMinute: 40, minimum: 2000 },
}

// $1.00 per trip kept by RideUp (covers card processing and maps); drivers keep 80% of everything else.
export const BOOKING_FEE_CENTS = 100
// Never price a trip faster than 30 mph average (2 min per mile), whatever trip time the app sends.
export const MIN_MINUTES_PER_MILE = 2

// Upfront price: max(base + distance + time, minimum) + booking fee. Must match guard_rides_insert (migration 008).
export function calculateFare(distanceMiles, durationMinutes, vehicleType = 'standard') {
  const rate = RATES[vehicleType] || RATES.standard
  const minutes = Math.max(durationMinutes || 0, (distanceMiles || 0) * MIN_MINUTES_PER_MILE)
  const trip = rate.base + distanceMiles * rate.perMile + minutes * rate.perMinute
  return Math.max(Math.round(trip), rate.minimum) + BOOKING_FEE_CENTS
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
