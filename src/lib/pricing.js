// Fare calculation for on-demand rides — point-to-point, priced by
// distance + time. Airport transfer flat rates stay on the existing
// Stripe/WordPress setup separately.

export const RATES = {
  standard: { base: 200, perMile: 125, perMinute: 35, minimum: 1000 }, // small cars (Fit, March…): $2 + $1.25/mi + $0.35/min, $10 min
  xl:       { base: 450, perMile: 230, perMinute: 30, minimum: 1500 },
  premium:  { base: 700, perMile: 320, perMinute: 40, minimum: 2000 },
}

export function calculateFare(distanceMiles, durationMinutes, vehicleType = 'standard') {
  const rate = RATES[vehicleType] || RATES.standard
  const raw = rate.base + distanceMiles * rate.perMile + durationMinutes * rate.perMinute
  return Math.max(Math.round(raw), rate.minimum)
}

// What the driver keeps (fare minus the 20% platform fee). Rides created after migration 003 store it;
// older rows fall back to the same 80% split.
export function driverPayout(ride) {
  return ride?.driver_payout_cents ?? Math.round((ride?.fare_cents || 0) * 0.8)
}

export function formatFare(cents) {
  return '$' + ((cents || 0) / 100).toFixed(2)
}

export const VEHICLE_TYPES = [
  { id: 'standard', name: 'RideUp Go', capacity: 4, icon: '🚗', desc: 'Everyday rides, nearby drivers' },
  { id: 'xl', name: 'RideUp XL', capacity: 6, icon: '🚙', desc: 'More room for groups' },
  { id: 'premium', name: 'RideUp Premium', capacity: 4, icon: '🚘', desc: 'Newer vehicles, top-rated drivers' },
]
