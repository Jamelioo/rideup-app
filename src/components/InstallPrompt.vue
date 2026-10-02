<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

// "Add RideUp to your Home Screen". Android/Chrome gets the real install button; iPhone gets the two taps
// (Apple doesn't allow a button). On iPhone, trip alerts (push) only work from the Home Screen app.
const route = useRoute()
const DISMISS_KEY = 'rideup_install_dismissed_at'
const SNOOZE_DAYS = 14

const deferred = ref(null)
const visible = ref(false)
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent)
// Already installed: Home Screen app, or the App Store / Play Store app (Capacitor).
const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true ||
  window.Capacitor?.isNativePlatform?.() === true || /RideUpApp/.test(navigator.userAgent)
const isDriver = computed(() => route.path.startsWith('/driver'))
const onShownScreen = computed(() => route.path === '/book' || route.path === '/driver/dashboard')

function snoozed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0)
    return Date.now() - at < SNOOZE_DAYS * 86_400_000
  } catch { return false }
}

function onBeforeInstall(e) {
  e.preventDefault()
  deferred.value = e
  if (!snoozed()) visible.value = true
}

onMounted(() => {
  if (standalone || window.innerWidth >= 768) return
  window.addEventListener('beforeinstallprompt', onBeforeInstall)
  // iPhone Safari has no install event: show the instructions after a short delay.
  if (isIos && !snoozed()) setTimeout(() => { visible.value = true }, 4000)
})
onUnmounted(() => window.removeEventListener('beforeinstallprompt', onBeforeInstall))

async function install() {
  if (!deferred.value) return
  deferred.value.prompt()
  await deferred.value.userChoice.catch(() => null)
  deferred.value = null
  visible.value = false
}

function dismiss() {
  visible.value = false
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* private mode */ }
}
</script>

<template>
  <div v-if="visible && onShownScreen" role="dialog" aria-label="Add RideUp to your Home Screen"
       class="fixed left-3 right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[150] rounded-2xl bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)] shadow-xl p-4">
    <div class="flex items-start gap-3">
      <img src="/icon-192.png" alt="" class="w-11 h-11 rounded-xl flex-shrink-0" />
      <div class="flex-1 min-w-0">
        <p class="font-bold text-[15px]">Add RideUp to your Home Screen</p>
        <p class="text-[13px] text-[var(--color-text-secondary)] mt-0.5">
          {{ isDriver ? 'Opens like an app and lets you get trip requests as alerts.' : 'Opens like an app and lets you get “driver arrived” alerts.' }}
        </p>
        <p v-if="isIos" class="text-[13px] mt-2">
          Tap <span class="inline-flex items-center align-middle px-1" aria-label="the Share button">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M5 12v7a1 1 0 001 1h12a1 1 0 001-1v-7" /></svg>
          </span> Share, then <strong>Add to Home Screen</strong>.
        </p>
        <div class="flex gap-3 mt-3">
          <button v-if="deferred" @click="install" class="px-4 py-2 rounded-xl bg-[#2b8659] text-white font-semibold text-[14px]">Install</button>
          <button @click="dismiss" class="px-2 py-2 text-[14px] font-semibold text-[var(--color-text-muted)]">{{ deferred ? 'Not now' : 'Got it' }}</button>
        </div>
      </div>
      <button @click="dismiss" class="w-8 h-8 -mr-1 -mt-1 flex items-center justify-center text-[var(--color-text-muted)]" aria-label="Close">✕</button>
    </div>
  </div>
</template>
