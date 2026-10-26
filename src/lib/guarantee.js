// The RideUp guarantee: if a driver cancels on you, we find you another driver at the same price and add
// RideUp credit to your next ride. Shared by the server (which gives the credit) and the pages that explain it.
export const DRIVER_CANCEL_CREDIT_CENTS_DEFAULT = 500
// Kept on the ride_refunds row, so receipts can name the credit and the server can count recent ones.
export const GUARANTEE_REASON = 'Driver cancelled: RideUp guarantee'
// At most one guarantee credit per rider in this many hours, so a cancel loop can't farm credit.
export const GUARANTEE_COOLDOWN_HOURS = 24

export const isGuaranteeCredit = (refund) => refund?.reason === GUARANTEE_REASON

// Only a driver's own cancellation after accepting counts: not a no-show, not a cancel by support.
export function guaranteeApplies({ actor, noShow, status }) {
  return actor === 'driver' && !noShow && ['accepted', 'driver_arrived'].includes(status)
}
