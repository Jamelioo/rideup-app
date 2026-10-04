import { ref, watch, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue'
import { apiPost } from './api'
import { DEMO_MODE } from './demoMode'

const REFRESH_MS = 30_000
// A failed check keeps the last answer this long, then shows nothing rather than guessing (never blocks).
const KEEP_LAST_MS = 2 * 60_000

// Demo only: /book?cars=none or ?cars=busy previews those screens.
function demoAvailability() {
  const mode = new URLSearchParams(window.location.search).get('cars')
  const forced = mode === 'none' || mode === 'busy' ? { state: mode } : null
  return {
    checkedAt: Date.now(),
    types: {
      standard: forced || { state: 'available', eta_max: 5 },
      xl: forced || { state: 'available', eta_max: 10 },
      premium: forced || { state: 'available', eta_max: 10 },
    },
  }
}

// Live "can a car come to this pickup?" for the booking screen. `pickup` is a ref to { lat, lng }.
// Checks when the pickup changes and every 30 seconds while the screen is showing.
export function useAvailability(pickup) {
  const availability = ref(null) // { types, checkedAt }, or null while unknown
  let seq = 0
  let timer = null

  async function refresh({ timeoutMs = 8000 } = {}) {
    const mine = ++seq
    if (DEMO_MODE) {
      availability.value = demoAvailability()
      return availability.value
    }
    const p = pickup.value
    if (!p || p.lat == null || p.lng == null) {
      availability.value = null
      return null
    }
    try {
      const res = await apiPost('/api/availability', { lat: p.lat, lng: p.lng }, { timeoutMs })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.types) throw new Error(body.error || `Availability check failed (${res.status})`)
      if (mine === seq) availability.value = { types: body.types, checkedAt: Date.now() }
    } catch {
      if (mine === seq && availability.value && Date.now() - availability.value.checkedAt > KEEP_LAST_MS) availability.value = null
    }
    return availability.value
  }

  const onVisibility = () => { if (document.visibilityState === 'visible') refresh() }
  function start() {
    stop()
    timer = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, REFRESH_MS)
    document.addEventListener('visibilitychange', onVisibility)
  }
  function stop() {
    if (timer) clearInterval(timer)
    timer = null
    document.removeEventListener('visibilitychange', onVisibility)
  }

  watch(() => (pickup.value ? `${pickup.value.lat},${pickup.value.lng}` : ''), () => {
    availability.value = null // the old answer was for a different pickup
    refresh()
  }, { immediate: true })
  onMounted(start)
  onUnmounted(stop)
  // The booking page stays cached when the rider opens another page; don't keep checking while it's hidden.
  // (onActivated also runs on the first mount, which has already started checking.)
  let firstActivation = true
  onActivated(() => {
    if (firstActivation) { firstActivation = false; return }
    start()
    refresh()
  })
  onDeactivated(stop)

  return { availability, refresh }
}
