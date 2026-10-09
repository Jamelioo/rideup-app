<script setup>
import { ref, onMounted } from 'vue'
import { apiPost } from '../lib/api'
import { pushStatus, enablePushNotifications } from '../lib/push'
import { DEMO_MODE } from '../lib/demoMode'

// "Ride alerts" for the signed-in team member: a notification and an email for every ride request, and when
// one goes unanswered (so someone can call the rider back). Shown on Admin › Live and Admin › Team.
const me = ref(null) // the staff row: { ride_alerts, ... }
const device = ref('') // 'on' | 'off' | 'blocked' | 'unavailable'
const busy = ref(false)
const error = ref('')

onMounted(async () => {
  if (DEMO_MODE) { me.value = { ride_alerts: true }; device.value = 'off'; return }
  device.value = await pushStatus().catch(() => 'unavailable')
  try {
    const res = await apiPost('/api/admin-team', { action: 'me' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || 'failed')
    me.value = body.me
  } catch {
    error.value = 'Ride alerts need database update 016.'
  }
})

async function toggle() {
  busy.value = true
  error.value = ''
  try {
    const res = await apiPost('/api/admin-team', { action: 'alerts', on: !me.value.ride_alerts })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || 'Couldn’t change alerts.')
    me.value = body.me
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

async function enableDevice() {
  busy.value = true
  await enablePushNotifications()
  device.value = await pushStatus().catch(() => 'unavailable')
  busy.value = false
}
</script>

<template>
  <section class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2 class="font-semibold">Ride alerts</h2>
        <p class="text-[var(--color-text-secondary)] mt-0.5">A notification and an email for every ride request, and when one goes unanswered so you can call the rider back.</p>
      </div>
      <button v-if="me" @click="toggle" :disabled="busy" role="switch" :aria-checked="String(me.ride_alerts)" aria-label="Ride alerts"
              :class="['relative shrink-0 w-12 h-7 rounded-full transition-colors', me.ride_alerts ? 'bg-[#2b8659]' : 'bg-[var(--color-text-muted)]']">
        <span :class="['absolute top-1 w-5 h-5 rounded-full bg-white transition-all', me.ride_alerts ? 'left-6' : 'left-1']"></span>
      </button>
    </div>
    <div v-if="me?.ride_alerts" class="mt-3">
      <p v-if="device === 'on'" class="text-[var(--color-brand)] font-medium">✓ Notifications are on for this device.</p>
      <template v-else-if="device === 'off'">
        <button @click="enableDevice" :disabled="busy" class="h-9 px-3 rounded-lg bg-[#2b8659] text-white font-semibold disabled:opacity-50">Get notifications on this device</button>
        <p class="mt-1 text-xs text-[var(--color-text-muted)]">Emails come either way.</p>
      </template>
      <p v-else-if="device === 'blocked'" class="text-[var(--color-text-secondary)]">Notifications are blocked for RideUp in this browser’s settings. Emails still come.</p>
      <p v-else class="text-[var(--color-text-secondary)]">This browser can’t show notifications (on iPhone, add RideUp to the Home Screen). Emails still come.</p>
      <p class="mt-2 text-xs text-[var(--color-text-muted)]">One browser gets notifications for one account. If you also drive, turn these on in a different browser or device from the one you drive with, or your driver alerts move here.</p>
    </div>
    <p v-if="error" class="mt-2 text-[var(--color-danger)]" role="alert">{{ error }}</p>
  </section>
</template>
