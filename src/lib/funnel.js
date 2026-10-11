import { apiPost } from './api'
import { DEMO_MODE } from './demoMode'
import { markStep } from './funnelSteps.js'

const KEY = 'rideup_funnel'

// One more person at this step of the booking funnel (Admin › Money): at most once per browser per day, so the
// numbers are people rather than page loads. Anonymous; best effort, never blocks or slows the page.
// Not sent in demo mode or from automated browsers (tests, most bots).
export function trackStep(step) {
  if (DEMO_MODE || typeof window === 'undefined' || navigator.webdriver) return
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Nassau' })
  let seen = {}
  try { seen = JSON.parse(localStorage.getItem(KEY) || '{}') } catch { /* private mode: count anyway */ }
  const next = markStep(seen, step, today)
  if (!next.send) return
  try { localStorage.setItem(KEY, JSON.stringify(next.seen)) } catch { /* private mode */ }
  apiPost('/api/track', { step }, { timeoutMs: 8000 }).catch(() => {})
}
