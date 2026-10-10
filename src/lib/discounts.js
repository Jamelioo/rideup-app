// Discount math shared by the app and the API (no imports, so the server and tests can load it).
// Must match guard_rides_insert (migration 009).

export const REFERRAL_DISCOUNT_CENTS = 500
export const MIN_CHARGE_CENTS = 100 // a rider always pays at least $1

// Same order as guard_rides_insert: promo code (or the referral first-ride discount), then ride credit.
export function previewDiscounts(fareCents, { promo = null, referralPending = false, creditCents = 0 } = {}) {
  if (!fareCents) return { discount: 0, credit: 0, charge: 0, label: '' }
  let discount = promo ? promo.amount_cents : referralPending ? REFERRAL_DISCOUNT_CENTS : 0
  discount = Math.max(0, Math.min(discount, fareCents - MIN_CHARGE_CENTS))
  const credit = Math.max(0, Math.min(creditCents || 0, fareCents - discount - MIN_CHARGE_CENTS))
  const label = discount ? (promo ? `Promo ${promo.code}` : 'Friend referral') : ''
  return { discount, credit, charge: fareCents - discount - credit, label }
}

// What the rider pays for a ride row: charged to their card, or paid to the driver in cash (tips are separate).
export function chargeOf(ride) {
  return Math.max(0, (ride?.fare_cents || 0) - (ride?.promo_discount_cents || 0) - (ride?.credit_applied_cents || 0))
}

// Split fare: everyone pays an equal share; the rider who booked covers any leftover cent.
// Stripe can't charge less than $0.50, so very cheap trips aren't split.
export const MAX_SPLIT_FRIENDS = 3
export const MIN_SPLIT_SHARE_CENTS = 50
export function splitShares(totalCents, friends) {
  const n = Math.max(0, Math.min(friends || 0, MAX_SPLIT_FRIENDS))
  const share = n ? Math.floor((totalCents || 0) / (n + 1)) : 0
  if (!n || share < MIN_SPLIT_SHARE_CENTS) return { friendShare: 0, ownerShare: totalCents || 0, friends: 0 }
  return { friendShare: share, ownerShare: totalCents - share * n, friends: n }
}
