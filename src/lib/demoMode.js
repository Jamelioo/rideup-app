// Demo mode lets the app run and be clicked through end-to-end with
// zero setup — no Supabase project, no Google Maps key needed.
// It turns on when there is no backend configured at all (no Supabase URL),
// or explicitly with VITE_DEMO_MODE=true. A missing Google Maps key on its own
// does NOT switch a real deployment into fake-data mode: maps just fail loudly.

export const DEMO_MODE =
  import.meta.env.VITE_DEMO_MODE === 'true' || !import.meta.env.VITE_SUPABASE_URL

if (!DEMO_MODE && !import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
  console.error('VITE_GOOGLE_MAPS_API_KEY is missing: maps and address search will not work.')
}

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
