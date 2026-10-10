// Paying cash, as the rider app explains it. The database has the final say (guard_rides_insert in migration 019):
// cash needs an account (not a guest) with a mobile number, isn't for rides booked for someone else, and is turned
// off for riders who don't pay or keep missing pickups. Kept free of Vue and Vite imports so it is unit-tested.

const CHOICE_KEY = 'rideup_payment_method'
const SIGN_UP = { label: 'Sign up', to: '/signup?redirect=/book' }

// Whether this rider can choose cash right now, and if not, why (and what would fix it).
export function cashOption({ signedIn, guest = false, blocked = false, forSomeoneElse = false }) {
  if (!signedIn) return { ok: false, reason: 'Log in or sign up to pay with cash.', action: SIGN_UP }
  if (guest) return { ok: false, reason: 'Create an account to pay with cash. It takes a minute and keeps cash trips safe for drivers.', action: { ...SIGN_UP, label: 'Create account' } }
  if (blocked) return { ok: false, reason: 'Cash isn’t available on your account. Please pay by card.' }
  if (forSomeoneElse) return { ok: false, reason: 'Cash is for your own rides. When you book for someone else, pay by card.' }
  return { ok: true, reason: '' }
}

// The last way this rider chose to pay on this device ('card' unless they picked cash).
export function savedPaymentChoice() {
  try { return localStorage.getItem(CHOICE_KEY) === 'cash' ? 'cash' : 'card' } catch { return 'card' }
}
export function savePaymentChoice(method) {
  try { localStorage.setItem(CHOICE_KEY, method === 'cash' ? 'cash' : 'card') } catch { /* private mode */ }
}

export const isCashRide = (ride) => ride?.payment_method === 'cash'
