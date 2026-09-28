// src/lib/demoDriverMode.js
import { DEMO_LOCATIONS } from './demoMode'
import { calculateFare } from './pricing'
import { fakeRoute } from './demoMode'

export const DEMO_RIDER_NAMES = [
  'Sarah M.', 'James T.', 'Lisa K.', 'Michael B.', 'Anna P.',
  'David W.', 'Nina R.', 'Chris L.', 'Tanya S.', 'Marcus J.',
]

export const DEMO_DRIVER_PROFILE = {
  id: 'demo-driver-1',
  auth_user_id: 'demo-auth-1',
  name: 'Marcus Robinson',
  phone: '(242) 555-0123',
  email: 'marcus@example.com',
  vehicle_make: 'Toyota',
  vehicle_model: 'Camry',
  vehicle_color: 'Silver',
  license_plate: 'ABC-1234',
  vehicle_type: 'standard',
  status: 'offline',
  rating: 4.9,
  total_trips: 247,
  approved: true,
  created_at: '2026-01-15T10:00:00Z',
}

export function generateFakeRideRequest() {
  const pickupIdx = Math.floor(Math.random() * DEMO_LOCATIONS.length)
  let dropoffIdx = Math.floor(Math.random() * DEMO_LOCATIONS.length)
  while (dropoffIdx === pickupIdx) {
    dropoffIdx = Math.floor(Math.random() * DEMO_LOCATIONS.length)
  }
  const pickup = DEMO_LOCATIONS[pickupIdx]
  const dropoff = DEMO_LOCATIONS[dropoffIdx]
  const rider = DEMO_RIDER_NAMES[Math.floor(Math.random() * DEMO_RIDER_NAMES.length)]
  const riderRating = (4.2 + Math.random() * 0.8).toFixed(1)
  const { distanceMiles, durationMinutes } = fakeRoute(pickup, dropoff)
  const fare = calculateFare(distanceMiles, durationMinutes, 'standard')

  return {
    id: 'demo-ride-' + Date.now(),
    rider_name: rider,
    rider_rating: parseFloat(riderRating),
    pickup_address: pickup,
    dropoff_address: dropoff,
    pickup_lat: 25.0 + Math.random() * 0.1,
    pickup_lng: -77.3 - Math.random() * 0.1,
    dropoff_lat: 25.0 + Math.random() * 0.1,
    dropoff_lng: -77.3 - Math.random() * 0.1,
    distance_miles: distanceMiles,
    duration_minutes: durationMinutes,
    fare_cents: fare,
    vehicle_type: 'standard',
    status: 'requested',
    requested_at: new Date().toISOString(),
  }
}

export function generateFakeEarnings() {
  const today = []
  const hoursAgo = [0.2, 0.8, 1.5, 2.1, 3.0, 4.2, 5.0, 5.8]
  for (let i = 0; i < 8; i++) {
    const pickupIdx = i % DEMO_LOCATIONS.length
    const dropoffIdx = (i + 3) % DEMO_LOCATIONS.length
    const pickup = DEMO_LOCATIONS[pickupIdx]
    const dropoff = DEMO_LOCATIONS[dropoffIdx]
    const { distanceMiles, durationMinutes } = fakeRoute(pickup, dropoff)
    const fare = calculateFare(distanceMiles, durationMinutes, 'standard')
    today.push({
      id: `demo-trip-today-${i}`,
      pickup_address: pickup,
      dropoff_address: dropoff,
      distance_miles: distanceMiles,
      duration_minutes: durationMinutes,
      fare_cents: fare,
      completed_at: new Date(Date.now() - hoursAgo[i] * 3600000).toISOString(),
    })
  }

  const weeklyTotals = [8900, 10200, 7500, 14750, 12300, 6100, 0]
  const weeklyTrips = [5, 6, 4, 8, 7, 3, 0]

  return { today, weeklyTotals, weeklyTrips }
}
