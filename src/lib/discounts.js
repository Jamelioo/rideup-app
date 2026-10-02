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

// What the rider's card is charged for a ride row (tips are charged separately).
export function chargeOf(ride) {
  return Math.max(0, (ride?.fare_cents || 0) - (ride?.promo_discount_cents || 0) - (ride?.credit_applied_cents || 0))
}
