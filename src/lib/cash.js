// Every trip is paid in cash to the driver at drop-off. Kept free of Vue and Vite imports so it is unit-tested.

// Same words as guard_rides_insert (migration 021), so the rider reads one message wherever they see it.
export const BOOKING_PAUSED = 'Booking is paused on your account because of missed pickups or an unpaid fare. Contact RideUp support to sort it out.'

// Every ride is a cash ride except old ones charged to a card before RideUp went cash-only.
export const isCashRide = (ride) => !!ride && ride.payment_method !== 'card'
