// How the booking screen describes /api/availability answers. Kept free of Vue and Vite imports so it is unit-tested.
// An entry is { state: 'available' | 'busy' | 'no_cash' | 'none', eta_max? } for one trip type; null means unknown
// (still checking, or the check failed), and an unknown answer never blocks booking.
import { REQUEST_SEARCH_MINUTES } from './dispatch.js'

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

// Whether the rider can send a request now. With no driver online ('none'), or none taking cash ('no_cash'), they
// still can: RideUp's team is alerted and the search runs longer. Only "every driver who could take it is on a
// trip" ('busy') waits.
export function canBook(entry) {
  return !entry || entry.state !== 'busy'
}

// The note shown above the booking button when no car can come straight away.
export function unavailableNotice(entry) {
  if (!entry || entry.state === 'available') return null
  if (entry.state === 'busy') {
    return {
      title: 'All drivers are on trips right now',
      body: 'This is usually just a few minutes. We’re checking again every 30 seconds, and you can book as soon as one is free.',
    }
  }
  if (entry.state === 'no_cash') {
    return {
      title: 'No drivers taking cash nearby',
      body: `Pay by card to get a driver now. Or request with cash, and we’ll alert our team and keep looking for up to ${REQUEST_SEARCH_MINUTES} minutes.`,
    }
  }
  return {
    title: 'No drivers online right now',
    body: `You can still request. We’ll alert our team and keep looking for up to ${REQUEST_SEARCH_MINUTES} minutes. You won’t be charged if nobody accepts.`,
  }
}

// What each ride option shows on its right: the pickup estimate, why it can't come now, or nothing when unknown.
export function optionStatus(entry) {
  if (!entry) return ''
  if (entry.state === 'none') return 'No drivers online'
  if (entry.state === 'no_cash') return 'Card only right now'
  if (entry.state !== 'available') return 'Unavailable'
  return entry.eta_max ? `${etaLabel(entry.eta_max)} away` : ''
}
