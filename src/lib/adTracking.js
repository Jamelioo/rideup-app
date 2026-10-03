import { supabase, supabaseConfigured } from './supabase'

// Ad measurement for rider campaigns:
//  * Meta Pixel (Instagram / Facebook ads): VITE_META_PIXEL_ID
//  * Google tag (Google Ads, and GA4 if wanted): VITE_GOOGLE_TAG_ID, comma-separated (e.g. "AW-123456789,G-ABC123")
//  * Google Ads conversion for a booked ride: VITE_GOOGLE_ADS_BOOKING_SEND_TO (e.g. "AW-123456789/AbCdEf")
// Nothing loads without the IDs, and nothing loads in the store apps.
// Also remembers which ad or link first brought someone (utm_*, gclid, fbclid) and saves it on their rider
// profile once they sign up, so Admin › Money can show signups and first rides per campaign.

const META_ID = import.meta.env.VITE_META_PIXEL_ID
const GOOGLE_IDS = String(import.meta.env.VITE_GOOGLE_TAG_ID || '').split(',').map((s) => s.trim()).filter(Boolean)
const GOOGLE_BOOKING = import.meta.env.VITE_GOOGLE_ADS_BOOKING_SEND_TO
const ATTR_KEY = 'rideup_attribution'
const ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid']

const isNative = () => window.Capacitor?.isNativePlatform?.() === true
let started = false

function loadScript(src) {
  const s = document.createElement('script')
  s.async = true
  s.src = src
  document.head.appendChild(s)
}

export function initAdTracking(router) {
  if (started || isNative()) return
  started = true
  captureAttribution(location.href)

  if (META_ID) {
    // Meta's standard loader, written out so it needs no inline script.
    const fbq = function (...args) { fbq.callMethod ? fbq.callMethod(...args) : fbq.queue.push(args) }
    fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = []
    window.fbq = window.fbq || fbq
    window._fbq = window._fbq || window.fbq
    loadScript('https://connect.facebook.net/en_US/fbevents.js')
    window.fbq('init', META_ID)
  }
  if (GOOGLE_IDS.length) {
    window.dataLayer = window.dataLayer || []
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments) } // gtag needs `arguments`
    window.gtag('js', new Date())
    for (const id of GOOGLE_IDS) window.gtag('config', id, { send_page_view: false })
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GOOGLE_IDS[0])}`)
  }
  // Single-page app: report each screen as a page view.
  router.afterEach((to) => {
    window.fbq?.('track', 'PageView')
    window.gtag?.('event', 'page_view', { page_path: to.path, page_title: document.title })
  })
}

// Conversions the ad platforms optimise for.
export function trackSignUp() {
  window.fbq?.('track', 'CompleteRegistration')
  window.gtag?.('event', 'sign_up')
}
export function trackRideBooked(ride) {
  const value = Math.round(ride?.fare_cents || 0) / 100
  const params = { value, currency: 'USD' }
  window.fbq?.('track', 'Purchase', params, ride?.id ? { eventID: `ride-${ride.id}` } : undefined)
  window.gtag?.('event', 'purchase', { ...params, transaction_id: ride?.id })
  if (GOOGLE_BOOKING) window.gtag?.('event', 'conversion', { send_to: GOOGLE_BOOKING, ...params, transaction_id: ride?.id })
}

// First touch wins: the ad that brought someone the first time gets the credit.
export function captureAttribution(href) {
  try {
    const url = new URL(href)
    const found = Object.fromEntries(ATTR_KEYS.map((k) => [k, url.searchParams.get(k)]).filter(([, v]) => v))
    if (!Object.keys(found).length) return
    if (localStorage.getItem(ATTR_KEY)) return
    localStorage.setItem(ATTR_KEY, JSON.stringify({ ...found, landing: url.pathname, at: new Date().toISOString() }))
  } catch { /* private mode */ }
}

// Saved on the rider profile once (the server keeps the first value and ignores later ones).
export async function saveAttribution() {
  if (!supabaseConfigured) return
  let attr = null
  try { attr = JSON.parse(localStorage.getItem(ATTR_KEY) || 'null') } catch { return }
  if (!attr) return
  const { error } = await supabase.rpc('set_acquisition', { p: attr })
  if (!error || /already|not found|sign in/i.test(error.message || '')) {
    try { localStorage.removeItem(ATTR_KEY) } catch { /* ignore */ }
  }
}
