import { watch, onUnmounted } from 'vue'

// Keeps the phone's screen on while `active` is true (driver online or on a trip), like Uber's driver app.
// If the screen sleeps, the app stops checking in and the every-minute job takes the driver offline after
// 30 minutes. Browsers drop the lock when the app goes to the background, so it is taken again on return.
export function useWakeLock(active) {
  let lock = null
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator

  async function acquire() {
    if (!supported || lock || document.visibilityState !== 'visible') return
    try {
      lock = await navigator.wakeLock.request('screen')
      lock.addEventListener('release', () => { lock = null })
    } catch { /* low battery mode or not allowed: nothing to do */ }
  }
  function release() {
    lock?.release().catch(() => {})
    lock = null
  }
  function onVisible() {
    if (active.value && document.visibilityState === 'visible') acquire()
  }

  watch(active, (on) => (on ? acquire() : release()), { immediate: true })
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)
  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisible)
    release()
  })
  return { supported }
}
