// How the booking screen describes /api/availability answers. Kept free of app imports so it is unit-tested.
// An entry is { state: 'available' | 'busy' | 'none', eta_max? } for one trip type; null means unknown
// (still checking, or the check failed), and an unknown answer never blocks booking.

const STEP_BEFORE = { 10: 5, 15: 10, 20: 15, 30: 20 }

// Pickup estimate in 5-minute steps, as the server rounds it: "5 min", "5–10 min" … "30+ min".
export function etaLabel(etaMax) {
  if (!etaMax) return ''
  if (etaMax <= 5) return '5 min'
  if (etaMax > 30) return '30+ min'
  return STEP_BEFORE[etaMax] ? `${STEP_BEFORE[etaMax]}–${etaMax} min` : `${etaMax} min`
}

export function availabilityFor(result, type) {
  return result?.types?.[type] || null
}

export function canBook(entry) {
  return !entry || entry.state === 'available'
}

// The note shown above the booking button when a car can't come right now.
export function unavailableNotice(entry) {
  if (canBook(entry)) return null
  if (entry.state === 'busy') {
    return {
      title: 'All drivers are on trips right now',
      body: 'This is usually just a few minutes. We’re checking again every 30 seconds, and you can book as soon as one is free.',
    }
  }
  return {
    title: 'No cars available right now',
    body: 'We’re checking again every 30 seconds, and you can book as soon as a driver is nearby.',
  }
}

// What each ride option shows on its right: the pickup estimate, "Unavailable", or nothing when unknown.
export function optionStatus(entry) {
  if (!entry) return ''
  if (entry.state !== 'available') return 'Unavailable'
  return entry.eta_max ? `${etaLabel(entry.eta_max)} away` : ''
}
