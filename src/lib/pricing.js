// Fare calculation for on-demand rides — point-to-point, priced by
// distance + time. Airport transfer flat rates stay on the existing
// Stripe/WordPress setup separately.

const RATES = {
  standard: { base: 250, perMile: 165, perMinute: 20, minimum: 600 },
  xl:       { base: 450, perMile: 230, perMinute: 30, minimum: 1000 },
  premium:  { base: 700, perMile: 320, perMinute: 40, minimum: 1500 },
}

export function calculateFare(distanceMiles, durationMinutes, vehicleType = 'standard') {
  const rate = RATES[vehicleType] || RATES.standard
  const raw = rate.base + distanceMiles * rate.perMile + durationMinutes * rate.perMinute
  return Math.max(Math.round(raw), rate.minimum)
}

export function formatFare(cents) {
  return '$' + ((cents || 0) / 100).toFixed(2)
}

export const VEHICLE_TYPES = [
  { id: 'standard', name: 'RideUp Go', capacity: 4, icon: '🚗', desc: 'Everyday rides, nearby drivers' },
  { id: 'xl', name: 'RideUp XL', capacity: 6, icon: '🚙', desc: 'More room for groups' },
  { id: 'premium', name: 'RideUp Premium', capacity: 4, icon: '🚘', desc: 'Newer vehicles, top-rated drivers' },
]
