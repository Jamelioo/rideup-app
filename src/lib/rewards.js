import { supabase, supabaseConfigured } from './supabase'

// Promo codes and referrals. The database (migration 009) decides the real discount when a ride is booked;
// this file only previews it with the same rules, and remembers a code the rider entered for their next ride.

export { REFERRAL_DISCOUNT_CENTS, MIN_CHARGE_CENTS, previewDiscounts, chargeOf } from './discounts.js'

const PROMO_KEY = 'rideup_promo'
const REF_KEY = 'rideup_ref'

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
}
function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch { /* private mode */ }
}

// { code, amount_cents, description } saved for the next ride.
export const getSavedPromo = () => read(PROMO_KEY)
export const savePromo = (promo) => write(PROMO_KEY, promo)
export const clearSavedPromo = () => write(PROMO_KEY, null)

// A friend's referral code picked up from a /r/CODE link, applied once the rider has an account.
export const getPendingReferral = () => read(REF_KEY)
export const setPendingReferral = (code) => write(REF_KEY, code ? String(code).toUpperCase() : null)

// A promo code from an ad or flyer link (?promo=WELCOME5), applied once the visitor has an account.
const PENDING_PROMO_KEY = 'rideup_pending_promo'
export const getPendingPromoCode = () => read(PENDING_PROMO_KEY)
export const setPendingPromoCode = (code) => write(PENDING_PROMO_KEY, code ? String(code).trim().toUpperCase().slice(0, 20) : null)

const friendly = (error, fallback) => (error?.hint === 'promo' || error?.hint === 'referral' ? error.message : fallback)

export async function checkPromo(code) {
  const { data, error } = await supabase.rpc('check_promo', { p_code: code })
  if (error) return { ok: false, message: friendly(error, 'Couldn’t check that code. Try again.') }
  const promo = Array.isArray(data) ? data[0] : data
  if (promo?.error) return { ok: false, message: promo.error } // migration 012: reasons come back as data
  if (!promo?.code) return { ok: false, message: 'That promo code isn’t valid.' }
  return { ok: true, promo }
}

export async function redeemReferral(code) {
  const { data, error } = await supabase.rpc('redeem_referral', { p_code: code })
  if (error) return { ok: false, message: friendly(error, 'Couldn’t apply that code. Try again.') }
  return { ok: true, friendName: data }
}

// { referral_code, credit_cents, referral_discount_pending, friends_joined, friends_rewarded } or null.
export async function loadRewards() {
  if (!supabaseConfigured) return null
  const { data, error } = await supabase.rpc('my_rewards')
  if (error) return null
  return (Array.isArray(data) ? data[0] : data) || null
}

