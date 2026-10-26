import { formatAmount } from './pricing.js'

// The first-ride offer every new visitor gets, applied automatically. Admin › Promos picks the code ("Show on
// landing page"), stored as app_settings.landing_promo. Shared by the server (api/_routes/landing-offer.js) and
// the app (src/lib/landingOffer.js). The database still checks each rider's own rules (first ride, same phone)
// when they book.

export const DEFAULT_LANDING_PROMO = 'WELCOME5'

// The app_settings.landing_promo row → the featured code: WELCOME5 until an admin picks another, '' for
// "No landing offer".
export function featuredCode(row) {
  if (!row) return DEFAULT_LANDING_PROMO
  return typeof row.value === 'string' ? row.value.trim().toUpperCase() : ''
}

// What to do with the featured offer for this visitor, or null to leave things as they are:
//   'apply': save it for their next ride (once per browser: a rider who removes it isn't given it again);
//   'drop':  it's saved, but it's a first-ride offer and they've ridden, so it would only fail at booking.
// An ad link's code (pending or saved) always wins over the featured one.
//   offer: { code, first_ride_only, … } or null; saved: the code saved for the next ride; pending: an ad link's
//   code still being checked; applied: the featured code this browser was given before; hasRides: signed in with
//   at least one trip.
export function offerStep({ offer, saved, pending, applied, hasRides }) {
  if (!offer?.code || pending) return null
  const isSaved = saved?.code === offer.code
  if (hasRides) return isSaved && offer.first_ride_only ? 'drop' : null
  if (saved?.code || applied === offer.code) return null
  return 'apply'
}

// "Oct 31" when an offer ends within 30 days, so the date is real urgency; otherwise null.
export function endsLabel(expiresAt, now = Date.now()) {
  const t = expiresAt ? new Date(expiresAt).getTime() : NaN
  if (!(t > now) || t - now > 30 * 86_400_000) return null
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Nassau' })
}

// The hero's offer pill, or null: { title, note, ends? }. The featured offer says what it is; an ad link's own
// code is named.
export function offerPill({ offer, saved, pending, hasRides }, now = Date.now()) {
  if (pending) return { title: `Code ${pending}`, note: 'comes off when you book' }
  if (!saved?.code) return null
  const off = `${formatAmount(saved.amount_cents)} off`
  if (saved.code !== offer?.code) return { title: `${off} with ${saved.code}`, note: 'applied automatically' }
  if (hasRides && offer.first_ride_only) return null
  return {
    title: offer.first_ride_only ? `First ride ${off}` : `${off} your next ride`,
    note: 'no code needed',
    ends: endsLabel(offer.expires_at, now),
  }
}
