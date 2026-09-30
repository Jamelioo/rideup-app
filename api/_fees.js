// Cancellation fee rule, kept pure so it can be tested.
// Fee applies only when: a rider cancels, a driver has already accepted (and is on the way), the card hold
// exists, and the free grace period after acceptance has passed. It never exceeds the fare.
export function cancellationFeeCents({ role, status, paymentStatus, acceptedAt, fareCents, feeCents, graceSeconds, now = Date.now() }) {
  if (!feeCents || feeCents <= 0) return 0
  if (role !== 'rider') return 0
  if (!['accepted', 'driver_arrived'].includes(status)) return 0
  if (paymentStatus !== 'authorized') return 0
  if (!acceptedAt || now - new Date(acceptedAt).getTime() <= graceSeconds * 1000) return 0
  return Math.min(feeCents, fareCents || 0)
}
