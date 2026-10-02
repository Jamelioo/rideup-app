import { parseDsn, buildEnvelope } from './sentryEnvelope'

// Crash and error reports from riders' and drivers' phones, sent to Sentry when VITE_SENTRY_DSN is set.
// No personal data: only the signed-in user's id, the page and the error.
const dsn = parseDsn(import.meta.env.VITE_SENTRY_DSN)
const MAX_PER_PAGE_LOAD = 10
const IGNORE = [/ResizeObserver loop/i, /^Script error\.?$/i, /chrome-extension:|moz-extension:|safari-extension:/i, /Load failed$/i]
let sent = 0
const seen = new Set()
let userId = null

export const setMonitoringUser = (id) => { userId = id || null }

export function reportError(err, extra = {}) {
  if (!dsn || sent >= MAX_PER_PAGE_LOAD) return
  const message = String(err?.message || err)
  if (IGNORE.some((re) => re.test(message) || re.test(String(err?.stack || '')))) return
  const key = message.slice(0, 200)
  if (seen.has(key)) return
  seen.add(key)
  sent++
  try {
    const { url, body } = buildEnvelope(dsn, err, {
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_RELEASE || undefined,
      tags: { app: window.Capacitor?.isNativePlatform?.() ? 'store-app' : 'web' },
      extra,
      user: userId ? { id: userId } : undefined,
      url: location.origin + location.pathname,
    })
    const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' })
    if (!(navigator.sendBeacon && navigator.sendBeacon(url, blob))) fetch(url, { method: 'POST', body, keepalive: true }).catch(() => {})
  } catch { /* never let reporting break the app */ }
}

export function installMonitoring(app) {
  if (!dsn) return
  window.addEventListener('error', (e) => reportError(e.error || e.message, { source: 'window.onerror' }))
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason || 'Unhandled promise rejection', { source: 'unhandledrejection' }))
  const previous = app.config.errorHandler
  app.config.errorHandler = (err, instance, info) => {
    reportError(err, { source: 'vue', info, component: instance?.$options?.name })
    if (previous) previous(err, instance, info)
    else console.error(err)
  }
}
