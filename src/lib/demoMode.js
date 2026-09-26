// Demo mode lets the app run and be clicked through end-to-end with
// zero setup — no Supabase project, no Google Maps key needed.
// It auto-activates whenever either key is missing from .env, so
// there's nothing extra to configure to try it out.

export const DEMO_MODE =
  !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_GOOGLE_MAPS_API_KEY

// A few sample Nassau locations for the demo pickup/dropoff fields.
export const DEMO_LOCATIONS = [
  'Baillou Hill Rd, Nassau',
  'Cable Beach, Nassau',
  'Paradise Island, Nassau',
  'Lynden Pindling Intl Airport (LPIA)',
  'Downtown Nassau, Bay St',
  'Prince Charles Dr, Nassau',
  'Westwind Club I, Cable Beach',
  'Robinson Rd, Nassau',
]

// Deterministic-ish fake distance/duration so the fare feels real
// without calling any API.
export function fakeRoute(pickupText, dropoffText) {
  const seed = (pickupText.length + dropoffText.length) % 7
  const distanceMiles = 1.8 + seed * 0.9
  const durationMinutes = 6 + seed * 2.4
  return { distanceMiles, durationMinutes }
}
