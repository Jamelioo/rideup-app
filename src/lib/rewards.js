import { ref } from 'vue'
import { supabase, supabaseConfigured } from './supabase'
import { apiPost } from './api'

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

// { code, amount_cents, description } saved for the next ride. One shared copy, so a code checked anywhere (an
// ad link checked as the app opens, or a code typed on another page) shows on the booking screen at once.
const savedPromo = ref(read(PROMO_KEY))
export const useSavedPromo = () => savedPromo
export const getSavedPromo = () => savedPromo.value
export function savePromo(promo) {
  savedPromo.value = promo || null
  write(PROMO_KEY, promo || null)
}
export const clearSavedPromo = () => savePromo(null)

// A friend's referral code picked up from a /r/CODE link, applied once the rider has an account.
export const getPendingReferral = () => read(REF_KEY)
export const setPendingReferral = (code) => write(REF_KEY, code ? String(code).toUpperCase() : null)

// A promo code from an ad or flyer link (?promo=WELCOME5), until it has been checked and saved for the next ride.
// Shared too, so a landing page's "Code … comes off" goes away if the code turns out not to be valid.
const PENDING_PROMO_KEY = 'rideup_pending_promo'
const pendingPromoCode = ref(read(PENDING_PROMO_KEY))
export const usePendingPromoCode = () => pendingPromoCode
export const getPendingPromoCode = () => pendingPromoCode.value
export function setPendingPromoCode(code) {
  pendingPromoCode.value = code ? String(code).trim().toUpperCase().slice(0, 20) : null
  write(PENDING_PROMO_KEY, pendingPromoCode.value)
}

const friendly = (error, fallback) => (error?.hint === 'promo' || error?.hint === 'referral' ? error.message : fallback)
const COULD_NOT_CHECK = 'Couldn’t check that code. Try again.'

// Signed-in riders: every rule, including their own (first ride, already used). Visitors without an account yet,
// guests about to book included: the code's own rules, and the database checks theirs when the ride is booked.
// { ok, promo } or { ok: false, message, retry } (retry: the check itself failed, so the code may still be fine).
export async function checkPromo(code) {
  const { data: { session } } = supabaseConfigured ? await supabase.auth.getSession() : { data: { session: null } }
  if (session) {
    const { data, error } = await supabase.rpc('check_promo', { p_code: code })
    if (error) return { ok: false, message: friendly(error, COULD_NOT_CHECK), retry: !error.hint }
    const promo = Array.isArray(data) ? data[0] : data
    if (promo?.code) return { ok: true, promo }
    // migration 012: reasons come back as data. "Sign in…" means there's no rider profile yet: check the code alone.
    if (!/sign in/i.test(promo?.error || '')) return { ok: false, message: promo?.error || 'That promo code isn’t valid.' }
  }
  try {
    const res = await apiPost('/api/promo-preview', { code }, { timeoutMs: 8000 })
    const body = await res.json().catch(() => ({}))
    if (res.status === 429) return { ok: false, message: body.error || 'Too many tries. Please wait a minute and try again.', retry: true }
    if (!res.ok) return { ok: false, message: COULD_NOT_CHECK, retry: true }
    return body.ok ? { ok: true, promo: body.promo } : { ok: false, message: body.error || 'That promo code isn’t valid.' }
  } catch {
    return { ok: false, message: COULD_NOT_CHECK, retry: true }
  }
}

// An ad link's code, checked as the app opens and again when the booking screen opens, until a check gets an
// answer (no signal or too many tries: it stays waiting). A valid code is saved for the next ride.
let pendingCheck = null
export function checkPendingPromo() {
  if (!getPendingPromoCode()) return Promise.resolve()
  pendingCheck ??= (async () => {
    const res = await checkPromo(getPendingPromoCode())
    if (res.ok) savePromo(res.promo)
    if (!res.retry) setPendingPromoCode(null)
  })().finally(() => { pendingCheck = null })
  return pendingCheck
}

export async function redeemReferral(code) {
  const { data, error } = await supabase.rpc('redeem_referral', { p_code: code })
  if (error) return { ok: false, message: friendly(error, 'Couldn’t apply that code. Try again.') }
  return { ok: true, friendName: data }
}

// Uses a friend's referral code from a /r/CODE link once this person has a rider profile. Kept for later only
// while there's no profile yet (e.g. a guest who hasn't booked).
export async function redeemPendingReferral() {
  const code = getPendingReferral()
  if (!code) return
  const res = await redeemReferral(code)
  if (res.ok || !/sign in first/i.test(res.message || '')) setPendingReferral(null)
}

// { referral_code, credit_cents, referral_discount_pending, friends_joined, friends_rewarded } or null.
export async function loadRewards() {
  if (!supabaseConfigured) return null
  const { data, error } = await supabase.rpc('my_rewards')
  if (error) return null
  return (Array.isArray(data) ? data[0] : data) || null
}

