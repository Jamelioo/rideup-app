// Cancellation rules, kept pure so they can be tested. Uber-style:
//  * Rider cancels after the free grace period once a driver has accepted → flat fee.
//  * Driver arrives and waits; after the free wait the driver may cancel as a rider no-show → same flat fee.
//  * Driver or admin cancellations otherwise never cost the rider anything.
// The fee never exceeds the fare and is taken from the existing card hold.

export function cancellationFeeCents({ role, status, paymentStatus, acceptedAt, fareCents, feeCents, graceSeconds, now = Date.now() }) {
  if (!feeCents || feeCents <= 0) return 0
  if (role !== 'rider') return 0
  if (!['accepted', 'driver_arrived'].includes(status)) return 0
  if (paymentStatus !== 'authorized') return 0
  if (!acceptedAt || now - new Date(acceptedAt).getTime() <= graceSeconds * 1000) return 0
  return Math.min(feeCents, fareCents || 0)
}

// When may the driver cancel as a no-show? Returns 0 if not (yet) allowed.
export function noShowFeeCents({ status, paymentStatus, arrivedAt, fareCents, feeCents, waitSeconds, now = Date.now() }) {
  if (!feeCents || feeCents <= 0) return 0
  if (status !== 'driver_arrived' || paymentStatus !== 'authorized') return 0
  if (!arrivedAt || now - new Date(arrivedAt).getTime() < waitSeconds * 1000) return 0
  return Math.min(feeCents, fareCents || 0)
}

export function noShowAllowed({ status, arrivedAt, waitSeconds, now = Date.now() }) {
  return status === 'driver_arrived' && !!arrivedAt && now - new Date(arrivedAt).getTime() >= waitSeconds * 1000
}

// Driver keeps 80% of any fee, like a fare.
export function splitFee(cents) {
  const platform = Math.round(cents * 0.2)
  return { platform_fee_cents: platform, driver_payout_cents: cents - platform }
}
