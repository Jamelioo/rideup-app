import { AIRPORT } from './pricing.js'

// Places a link can open booking with (/book?from=airport&to=cable-beach), so a popular trip on the landing
// pages shows its real price in one tap. Only these ids are accepted; anything else in a link is ignored.
// `area`: a neighbourhood (its usual centre) rather than a pickup spot, so the booking screen asks for the exact
// pickup. The booking screen prices the real route either way.
export const PLACES = {
  airport: { label: 'Airport', address: 'Lynden Pindling International Airport (NAS)', lat: AIRPORT.lat, lng: AIRPORT.lng },
  'cruise-port': { label: 'Cruise port', address: 'Nassau Cruise Port, Prince George Wharf', lat: 25.0793, lng: -77.3441 },
  'cable-beach': { label: 'Cable Beach', address: 'Cable Beach, Nassau', lat: 25.0757, lng: -77.4085, area: true },
  downtown: { label: 'Downtown', address: 'Downtown Nassau, Bay Street', lat: 25.0776, lng: -77.3420, area: true },
  'paradise-island': { label: 'Paradise Island', address: 'Paradise Island, Nassau', lat: 25.0857, lng: -77.3228, area: true },
}

// { id, label, address, lat, lng, area? } for a known id, else null.
export function placeById(id) {
  const key = typeof id === 'string' ? id : ''
  return Object.prototype.hasOwnProperty.call(PLACES, key) ? { id: key, ...PLACES[key] } : null
}

// The booking link for a trip between two known places.
export const tripLink = (from, to) => ({ path: '/book', query: { from, to } })
