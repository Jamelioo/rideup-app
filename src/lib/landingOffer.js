import { ref, computed, watch } from 'vue'
import { supabase, supabaseConfigured } from './supabase'
import { DEMO_MODE } from './demoMode'
import { useSavedPromo, usePendingPromoCode, savePromo, clearSavedPromo, getSavedPromo, getPendingPromoCode } from './rewards'
import { offerStep, offerPill } from './landingOfferRules.js'

// The first-ride offer every new visitor gets on the landing and booking pages, saved for their next ride
// without them doing anything (rules in landingOfferRules.js). Once per browser: someone who removes it isn't
// given it again.
const APPLIED_KEY = 'rideup_offer_applied'
const DEMO_OFFER = { code: 'WELCOME5', amount_cents: 500, description: '$5 off your first ride', first_ride_only: true, expires_at: null }

const offer = ref(null)
let offerLoad = null

// The same for everyone and cached by the CDN (api/_routes/landing-offer.js): fetched once per visit.
function loadOffer() {
  offerLoad ??= (async () => {
    if (DEMO_MODE) return DEMO_OFFER
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await fetch('/api/landing-offer', { signal: controller.signal })
      return res.ok ? (await res.json()).offer || null : null
    } catch {
      return null // no signal: no offer shown this time; the next visit asks again
    } finally {
      clearTimeout(timer)
    }
  })().then((o) => (offer.value = o))
  return offerLoad
}

// Signed in (guests too) with a finished trip, so a first-ride offer isn't for them.
async function hasRides() {
  if (DEMO_MODE || !supabaseConfigured) return false
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return false
    const { data } = await supabase.from('riders').select('total_rides').eq('auth_user_id', session.user.id).maybeSingle()
    return (data?.total_rides || 0) > 0
  } catch {
    return false
  }
}

function readApplied() {
  try { return localStorage.getItem(APPLIED_KEY) } catch { return null }
}

function act(rides) {
  const o = offer.value
  const step = offerStep({ offer: o, saved: getSavedPromo(), pending: getPendingPromoCode(), applied: readApplied(), hasRides: rides })
  if (step === 'apply') {
    savePromo({ code: o.code, amount_cents: o.amount_cents, description: o.description })
    try { localStorage.setItem(APPLIED_KEY, o.code) } catch { /* private mode: they may see it again next visit */ }
  } else if (step === 'drop') {
    clearSavedPromo()
  }
}

// Booking screen: give a new visitor the offer before the saved code is checked and shown.
export async function applyLandingOffer() {
  const [, rides] = await Promise.all([loadOffer(), hasRides()])
  act(rides)
}

// Landing pages: gives the offer, and returns the hero pill ({ title, note, ends? } or null) and whether it's
// known yet, so the page can keep the pill's space while it loads instead of shifting when it arrives.
export function useLandingOffer() {
  const saved = useSavedPromo()
  const pending = usePendingPromoCode()
  const rides = ref(false)
  const ready = ref(false)
  Promise.all([loadOffer(), hasRides()]).then(([, r]) => { rides.value = r; ready.value = true })
  // Again when an ad link's code has been checked: if it wasn't valid, the featured offer takes its place.
  watch([ready, pending], () => { if (ready.value) act(rides.value) })
  const pill = computed(() => (ready.value || pending.value
    ? offerPill({ offer: offer.value, saved: saved.value, pending: pending.value, hasRides: rides.value })
    : null))
  return { pill, ready: computed(() => ready.value || !!pending.value) }
}
