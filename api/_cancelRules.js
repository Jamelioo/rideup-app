// Cancellation rules, kept pure so they can be tested. Cancelling never costs anything: every trip is paid in cash
// at drop-off, so there is nothing to charge. Instead, like a cash trip on Uber, a rider who keeps not showing up
// loses the ability to book: two late cancellations or no-shows within 30 days pause booking on the account
// (the database counts them: cash_strike, migration 019).
//  * Rider cancels before a driver accepts, or within the grace period after: not counted.
//  * Rider cancels after the grace period: counted as a late cancellation.
//  * Driver arrives and waits; after the free wait the driver may cancel as a rider no-show: counted.
//  * Driver or admin cancellations never count against the rider.

// The database counts a rider's cancellation as late after 2 minutes; keep CANCEL_GRACE_SECONDS at 120 to match.
export function isLateCancel({ status, acceptedAt, graceSeconds, now = Date.now() }) {
  if (!['accepted', 'driver_arrived'].includes(status) || !acceptedAt) return false
  return now - new Date(acceptedAt).getTime() > graceSeconds * 1000
}

export function noShowAllowed({ status, arrivedAt, waitSeconds, now = Date.now() }) {
  return status === 'driver_arrived' && !!arrivedAt && now - new Date(arrivedAt).getTime() >= waitSeconds * 1000
}
