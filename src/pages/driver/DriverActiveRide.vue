<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDriver } from '../../lib/useDriver'
import { useAuth } from '../../lib/useAuth'
import { DEMO_MODE } from '../../lib/demoMode'
import { formatFare, driverPayout } from '../../lib/pricing'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { apiPost } from '../../lib/api'
import { FREE_WAIT_SECONDS } from '../../lib/policy'
import { formatClock } from '../../lib/eta'
import GoogleMap from '../../components/GoogleMap.vue'
import HarborBackdrop from '../../components/HarborBackdrop.vue'
import RideChat from '../../components/RideChat.vue'
import SafetyToolkit from '../../components/SafetyToolkit.vue'

const router = useRouter()
const { user } = useAuth()
const { currentRide, updateRideStatus, startTrip, pinRequired, cancelCurrentRide, completeRide, refreshCurrentRide } = useDriver()

const phase = computed(() => currentRide.value?.status || 'none')
const earnings = computed(() => driverPayout(currentRide.value))
const busy = ref(false)
const actionError = ref('')
const mapFailed = ref(DEMO_MODE)

// Rider contact (phone only while the trip is active)
const riderName = ref(currentRide.value?.rider_name?.split(' ')[0] || 'Rider')
const riderRating = ref(null)
const riderPhone = ref('')
async function loadRider() {
  if (DEMO_MODE || !currentRide.value?.id) return
  const { data } = await supabase.rpc('get_ride_rider', { p_ride_id: currentRide.value.id })
  const r = Array.isArray(data) ? data[0] : data
  if (r) {
    riderName.value = r.first_name || riderName.value
    riderRating.value = r.rating != null ? Number(r.rating) : null
    riderPhone.value = r.phone || ''
  }
}

const phaseLabel = computed(() => ({
  accepted: 'Head to pickup',
  driver_arrived: 'Waiting for rider',
  in_progress: 'Trip in progress',
  completed: 'Trip complete',
}[phase.value] || ''))

const steps = ['accepted', 'driver_arrived', 'in_progress', 'completed']
const stepIndex = computed(() => steps.indexOf(phase.value))

const target = computed(() => {
  const r = currentRide.value
  if (!r) return null
  return phase.value === 'in_progress'
    ? { lat: r.dropoff_lat, lng: r.dropoff_lng, label: r.dropoff_address }
    : { lat: r.pickup_lat, lng: r.pickup_lng, label: r.pickup_address }
})
const navUrl = computed(() => target.value?.lat != null
  ? `https://www.google.com/maps/dir/?api=1&destination=${target.value.lat},${target.value.lng}&travelmode=driving`
  : '#')

// ── Wait timer + no-show (Uber: after 5 minutes at pickup the driver can cancel and the rider pays a fee) ──
const now = ref(Date.now())
let ticker = null
const waitedSeconds = computed(() => {
  if (phase.value !== 'driver_arrived' || !currentRide.value?.arrived_at) return 0
  return Math.max(0, Math.floor((now.value - new Date(currentRide.value.arrived_at).getTime()) / 1000))
})
const noShowAvailable = computed(() => phase.value === 'driver_arrived' && waitedSeconds.value >= FREE_WAIT_SECONDS)

// ── Primary action ──
const showPinEntry = ref(false)
const pinInput = ref('')

async function primaryAction() {
  actionError.value = ''
  if (phase.value === 'accepted') {
    busy.value = true
    const res = await updateRideStatus('driver_arrived')
    busy.value = false
    if (!res.ok) actionError.value = res.error || 'Try again.'
  } else if (phase.value === 'driver_arrived') {
    if (await pinRequired()) { pinInput.value = ''; showPinEntry.value = true; return }
    await doStart()
  }
}

async function doStart(pin) {
  busy.value = true
  const res = await startTrip(pin)
  busy.value = false
  if (!res.ok) { actionError.value = res.error || 'Try again.'; return }
  showPinEntry.value = false
}

// ── Complete (slide, keyboard or tap) ──
const slideTrack = ref(null)
const slideProgress = ref(0)
const isDragging = ref(false)
const slideComplete = ref(false)

function onSlideStart() {
  if (phase.value !== 'in_progress' || busy.value) return
  isDragging.value = true
}
function onSlideMove(e) {
  if (!isDragging.value || !slideTrack.value) return
  const point = e.touches ? e.touches[0] : e
  const rect = slideTrack.value.getBoundingClientRect()
  const maxTravel = rect.width - 56
  slideProgress.value = Math.max(0, Math.min(point.clientX - rect.left - 28, maxTravel)) / maxTravel
  if (slideProgress.value >= 0.9) {
    isDragging.value = false
    slideProgress.value = 1
    completeTrip()
  }
}
function onSlideEnd() {
  if (!isDragging.value) return
  isDragging.value = false
  if (slideProgress.value < 0.9) slideProgress.value = 0
}

async function completeTrip() {
  if (slideComplete.value || busy.value) return
  slideComplete.value = true
  busy.value = true
  actionError.value = ''
  const res = await updateRideStatus('completed')
  busy.value = false
  if (!res.ok) {
    slideComplete.value = false
    slideProgress.value = 0
    actionError.value = res.error || 'Couldn’t complete the trip. Try again.'
    return
  }
  // Charge the held fare (receipt goes to the rider).
  if (!DEMO_MODE && currentRide.value?.id) {
    apiPost('/api/capture-payment', { rideId: currentRide.value.id }).catch((err) => console.error('Capture failed:', err))
  }
}

function finish() {
  const rideId = currentRide.value?.id || 'demo'
  completeRide()
  router.push({ name: 'rate-rider', params: { rideId } })
}

// ── Cancel / no-show ──
const confirm = ref(null) // 'cancel' | 'noshow'
const endedNotice = ref('')
async function doCancel(noShow) {
  busy.value = true
  actionError.value = ''
  const res = await cancelCurrentRide({ noShow })
  busy.value = false
  if (!res.ok) { actionError.value = res.error; confirm.value = null; return }
  confirm.value = null
  router.replace('/driver/dashboard')
}

// ── Live location + ride updates ──
let gpsWatchId = null
let locationChannel = null
let statusChannel = null
let pollTimer = null
let lastDbWrite = 0

function startLive() {
  if (DEMO_MODE || !supabaseConfigured || !currentRide.value) return
  const id = currentRide.value.id
  locationChannel = supabase.channel(`ride-location-${id}`, { config: { private: true } })
  locationChannel.subscribe()

  if (navigator.geolocation) {
    gpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        locationChannel?.send({ type: 'broadcast', event: 'driver-location', payload: { lat: latitude, lng: longitude } })
        if (Date.now() - lastDbWrite >= 10_000 && currentRide.value) {
          lastDbWrite = Date.now()
          supabase.from('rides').update({ driver_lat: latitude, driver_lng: longitude }).eq('id', currentRide.value.id).then(() => {})
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )
  }

  statusChannel = supabase.channel(`driver-ride-status-${id}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${id}` }, (payload) => {
      handleRemoteUpdate(payload.new)
    })
    .subscribe()

  // Realtime can drop on mobile networks: re-read the ride every 10s.
  pollTimer = setInterval(async () => {
    const before = currentRide.value
    if (!before) return
    const row = await refreshCurrentRide()
    if (row) handleRemoteUpdate(row)
  }, 10_000)
}

function handleRemoteUpdate(row) {
  if (!row || !currentRide.value || row.id !== currentRide.value.id) return
  if (row.status === 'cancelled') {
    if (busy.value && row.cancelled_by === 'driver') return // our own cancel; doCancel navigates
    const fee = row.cancel_fee_cents > 0 ? ` You’ll receive ${formatFare(row.driver_payout_cents || 0)} for your time.` : ''
    endedNotice.value = row.cancelled_by === 'rider' ? `The rider cancelled this trip.${fee}`
      : row.cancelled_by === 'admin' ? 'RideUp support cancelled this trip.'
      : 'This trip was cancelled.'
    stopLive()
    return
  }
  if (row.status !== 'cancelled') currentRide.value = { ...currentRide.value, ...row }
}

function stopLive() {
  if (gpsWatchId !== null) { navigator.geolocation.clearWatch(gpsWatchId); gpsWatchId = null }
  if (locationChannel) { supabase.removeChannel(locationChannel); locationChannel = null }
  if (statusChannel) { supabase.removeChannel(statusChannel); statusChannel = null }
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

function leaveAfterCancel() {
  endedNotice.value = ''
  completeRide()
  router.replace('/driver/dashboard')
}

// ── Chat / safety ──
const chatOpen = ref(false)
const unread = ref(0)
const safetyOpen = ref(false)
const safetyRide = computed(() => ({ id: currentRide.value?.id, pickup: currentRide.value?.pickup_address, dropoff: currentRide.value?.dropoff_address }))

onMounted(() => {
  ticker = setInterval(() => { now.value = Date.now() }, 1000)
  loadRider()
  startLive()
})
watch(phase, (p, old) => { if (p !== old && p !== 'completed') loadRider() })
onUnmounted(() => {
  clearInterval(ticker)
  stopLive()
})
</script>

<template>
  <div class="relative h-dvh bg-[var(--color-surface)] text-[var(--color-text-primary)] overflow-hidden"
       @mousemove="onSlideMove" @mouseup="onSlideEnd" @touchmove.passive="onSlideMove" @touchend="onSlideEnd">
    <!-- Map -->
    <div class="absolute inset-0 md:left-[400px]">
      <GoogleMap v-if="!mapFailed" class="absolute inset-0"
                 :pickup="currentRide?.pickup_lat != null ? { lat: currentRide.pickup_lat, lng: currentRide.pickup_lng } : null"
                 :dropoff="['in_progress', 'completed'].includes(phase) && currentRide?.dropoff_lat != null ? { lat: currentRide.dropoff_lat, lng: currentRide.dropoff_lng } : null"
                 @error="mapFailed = true" />
      <HarborBackdrop v-else show-route />
    </div>

    <!-- Floating top actions -->
    <div v-if="currentRide && phase !== 'completed'" class="absolute top-0 right-0 z-20 pr-4 pt-[max(1rem,env(safe-area-inset-top))] flex gap-2">
      <button @click="safetyOpen = true" class="flex items-center gap-1.5 bg-[var(--color-surface)] shadow-[0_2px_12px_rgba(0,0,0,0.12)] rounded-full px-4 h-11 text-[13px] font-semibold" aria-label="Safety toolkit">
        <svg class="w-5 h-5 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
        Safety
      </button>
      <a :href="navUrl" target="_blank" rel="noopener" class="flex items-center gap-2 bg-[var(--color-surface)] shadow-[0_2px_12px_rgba(0,0,0,0.12)] rounded-full px-4 h-11 text-[13px] font-semibold">
        <svg class="w-5 h-5 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
        Navigate
      </a>
    </div>

    <!-- Trip panel: bottom sheet on phones, left column on desktop -->
    <div class="absolute bottom-0 left-0 right-0 z-10 max-h-[78dvh] overflow-y-auto md:top-0 md:bottom-0 md:right-auto md:w-[400px] md:max-h-none bg-[var(--color-surface)] rounded-t-[28px] md:rounded-none shadow-[0_-4px_40px_rgba(0,0,0,0.1)] md:border-r md:border-[var(--color-border)]"
         style="padding-bottom: env(safe-area-inset-bottom, 0px)">
      <div class="flex justify-center pt-3 pb-2 md:hidden" aria-hidden="true">
        <div class="w-9 h-[5px] rounded-full bg-[var(--color-border)]"></div>
      </div>

      <div class="px-5 pb-6 md:pt-8">
        <div class="hidden md:block text-[22px] font-bold mb-6">Ride<span class="text-[var(--color-brand)]">Up</span> <span class="text-[13px] font-medium text-[var(--color-text-muted)]">Driver</span></div>

        <!-- Completed -->
        <div v-if="phase === 'completed'" class="text-center py-4">
          <div class="w-16 h-16 rounded-full bg-[#2b8659] flex items-center justify-center mx-auto mb-3" aria-hidden="true">
            <svg class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 class="text-2xl font-bold mb-1">Trip complete</h2>
          <div class="text-[34px] font-extrabold text-[var(--color-brand)] mt-3">+{{ formatFare(earnings) }}</div>
          <div class="text-[13px] text-[var(--color-text-secondary)] mt-1">Your 80% of the {{ formatFare(currentRide?.fare_cents) }} fare</div>
          <div class="text-[13px] text-[var(--color-text-muted)] mt-2">
            {{ currentRide?.distance_miles != null ? Number(currentRide.distance_miles).toFixed(1) : '0.0' }} mi · {{ Math.round(currentRide?.duration_minutes || 0) }} min
          </div>
          <button @click="finish" class="w-full py-4 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px] mt-6 active:scale-[0.98]">Rate {{ riderName }}</button>
        </div>

        <template v-else-if="currentRide">
          <div class="flex items-center gap-1 mb-4" aria-hidden="true">
            <div v-for="(s, idx) in steps" :key="s" class="flex-1 h-1 rounded-full" :class="idx <= stepIndex ? 'bg-[#2b8659]' : 'bg-[var(--color-border)]'"></div>
          </div>
          <div class="flex items-center gap-2 mb-3" role="status" aria-live="polite">
            <span class="w-2.5 h-2.5 rounded-full bg-[#2b8659] animate-pulse" aria-hidden="true"></span>
            <span class="text-[14px] font-semibold text-[var(--color-brand)]">{{ phaseLabel }}</span>
          </div>

          <!-- Rider card with contact -->
          <div class="bg-[var(--color-surface-secondary)] rounded-2xl p-4 mb-4">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-11 h-11 rounded-full bg-[#2b8659]/15 flex items-center justify-center text-[var(--color-brand)] font-bold" aria-hidden="true">{{ riderName.charAt(0).toUpperCase() }}</div>
              <div class="flex-1 min-w-0">
                <div class="text-[16px] font-bold truncate">{{ riderName }}</div>
                <div class="text-[13px] text-[var(--color-text-secondary)]"><span class="text-amber-500" aria-hidden="true">&#9733;</span> {{ riderRating != null ? riderRating.toFixed(1) : 'New' }}</div>
              </div>
              <div class="text-right">
                <div class="text-[17px] font-bold text-[var(--color-brand)]">{{ formatFare(earnings) }}</div>
                <div class="text-[11px] text-[var(--color-text-muted)]">your earnings</div>
              </div>
            </div>

            <div class="flex gap-2 mb-3">
              <a v-if="riderPhone" :href="`tel:${riderPhone}`" class="flex-1 flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[14px] font-semibold">
                <svg class="w-4 h-4 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                Call
              </a>
              <button @click="chatOpen = true" class="relative flex-1 flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[14px] font-semibold"
                      :aria-label="unread ? `Message rider, ${unread} unread` : 'Message rider'">
                <svg class="w-4 h-4 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                Message
                <span v-if="unread" class="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-red-500 text-white text-[12px] font-bold flex items-center justify-center" aria-hidden="true">{{ unread }}</span>
              </button>
            </div>

            <div class="flex gap-3">
              <div class="flex flex-col items-center pt-[6px]" aria-hidden="true">
                <div class="w-[10px] h-[10px] rounded-full border-[2.5px] border-[#2b8659] bg-[var(--color-surface)]"></div>
                <div class="w-[2px] flex-1 my-1 bg-[var(--color-border)] rounded-full min-h-[12px]"></div>
                <div class="w-[10px] h-[10px] rounded-[2px] bg-[var(--color-text-primary)]"></div>
              </div>
              <div class="flex-1 space-y-2">
                <div :class="phase === 'in_progress' && 'opacity-60'">
                  <div class="text-[11px] text-[var(--color-text-muted)] font-semibold uppercase tracking-wide">Pickup</div>
                  <div class="text-[14px] font-semibold">{{ currentRide.pickup_address }}</div>
                </div>
                <div :class="phase !== 'in_progress' && 'opacity-60'">
                  <div class="text-[11px] text-[var(--color-text-muted)] font-semibold uppercase tracking-wide">Drop-off</div>
                  <div class="text-[14px] font-semibold">{{ currentRide.dropoff_address }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Wait timer -->
          <div v-if="phase === 'driver_arrived'" class="mb-4 rounded-xl px-4 py-3 text-[14px]"
               :class="noShowAvailable ? 'bg-amber-500/15' : 'bg-[#2b8659]/10'">
            Waiting <strong>{{ formatClock(waitedSeconds) }}</strong>
            <span v-if="!noShowAvailable" class="text-[var(--color-text-secondary)]"> · no-show available in {{ formatClock(FREE_WAIT_SECONDS - waitedSeconds) }}</span>
            <span v-else class="text-[var(--color-text-secondary)]"> · free wait time is over</span>
          </div>

          <p v-if="actionError" class="mb-3 text-[13px] text-red-500" role="alert">{{ actionError }}</p>

          <!-- Slide to complete -->
          <template v-if="phase === 'in_progress'">
            <div ref="slideTrack" class="relative h-[56px] bg-[#191f1c] rounded-2xl overflow-hidden select-none mb-2">
              <div class="absolute inset-y-0 left-0 bg-[#2b8659] rounded-2xl transition-all" :style="{ width: slideComplete ? '100%' : (slideProgress * 100) + '%' }"></div>
              <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span v-if="!slideComplete" class="text-white/80 text-[14px] font-semibold" :class="{ 'opacity-0': slideProgress > 0.3 }">Slide to complete trip</span>
                <span v-else class="text-white text-[14px] font-semibold">Completing…</span>
              </div>
              <div v-if="!slideComplete"
                   class="absolute top-[4px] left-[4px] w-[48px] h-[48px] bg-white rounded-xl flex items-center justify-center cursor-grab shadow-sm"
                   :style="{ transform: `translateX(${slideProgress * ((slideTrack?.offsetWidth || 340) - 56)}px)` }"
                   role="button" tabindex="0" aria-label="Complete trip"
                   @keydown.enter.prevent="completeTrip" @keydown.space.prevent="completeTrip"
                   @mousedown.prevent="onSlideStart" @touchstart.prevent="onSlideStart">
                <svg class="w-5 h-5 text-[#191f1c]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </div>
            </div>
            <button v-if="!slideComplete" @click="completeTrip" class="w-full mb-3 py-2 text-[13px] font-medium text-[var(--color-text-secondary)] underline underline-offset-2">Can’t slide? Tap to complete trip</button>
          </template>

          <button v-else @click="primaryAction" :disabled="busy"
                  class="w-full py-4 bg-[#2b8659] text-white font-bold rounded-2xl text-[16px] active:scale-[0.98] disabled:opacity-60">
            {{ busy ? 'One moment…' : phase === 'accepted' ? 'I’ve arrived' : 'Start trip' }}
          </button>

          <a :href="navUrl" target="_blank" rel="noopener" class="mt-3 w-full flex items-center justify-center gap-2 py-3 border border-[var(--color-border)] rounded-2xl text-[14px] font-semibold">
            Open in Google Maps
          </a>

          <button v-if="noShowAvailable" @click="confirm = 'noshow'" class="w-full mt-3 py-3 rounded-2xl bg-amber-500/15 text-[14px] font-semibold">
            Rider didn’t show up
          </button>
          <button v-if="['accepted', 'driver_arrived'].includes(phase)" @click="confirm = 'cancel'" class="w-full py-3 mt-1 text-[13px] text-[var(--color-text-secondary)] font-semibold">
            Cancel trip
          </button>
        </template>
      </div>
    </div>

    <RideChat v-if="!DEMO_MODE && user && currentRide?.id" v-model:open="chatOpen" :ride-id="currentRide.id" :current-user-id="user.id"
              :other-user-name="riderName" partner-role="rider"
              :quick-replies="['I’m here', 'On my way', 'Running a few minutes late', 'Where are you?', 'I’m outside']"
              @unread="unread = $event" />
    <SafetyToolkit :is-open="safetyOpen" :ride="safetyRide" role="driver" @close="safetyOpen = false" />

    <!-- PIN entry -->
    <div v-if="showPinEntry" role="dialog" aria-modal="true" aria-labelledby="pin-title" class="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center px-4 pb-6">
      <form @submit.prevent="doStart(pinInput)" class="bg-[var(--color-surface)] rounded-3xl p-6 max-w-sm w-full text-center">
        <h2 id="pin-title" class="text-xl font-bold mb-2">Enter the rider’s PIN</h2>
        <p class="text-[13px] text-[var(--color-text-secondary)] mb-4">Ask {{ riderName }} for the 4-digit PIN shown in their app. It confirms you picked up the right person.</p>
        <input v-model="pinInput" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="one-time-code" aria-label="4-digit PIN"
               class="w-full text-center text-[32px] tracking-[0.5em] font-bold bg-[var(--color-surface-secondary)] rounded-2xl py-3 mb-3 outline-none" />
        <p v-if="actionError" class="text-[13px] text-red-500 mb-3" role="alert">{{ actionError }}</p>
        <button type="submit" :disabled="pinInput.length !== 4 || busy" class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-2xl disabled:opacity-50">{{ busy ? 'Checking…' : 'Start trip' }}</button>
        <button type="button" @click="showPinEntry = false" class="w-full py-3 mt-1 text-[14px] text-[var(--color-text-secondary)]">Back</button>
      </form>
    </div>

    <!-- Cancel / no-show confirmation -->
    <div v-if="confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" class="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center px-4 pb-6">
      <div class="bg-[var(--color-surface)] rounded-3xl p-6 max-w-sm w-full text-center">
        <h2 id="confirm-title" class="text-xl font-bold mb-2">{{ confirm === 'noshow' ? 'Mark as no-show?' : 'Cancel this trip?' }}</h2>
        <p class="text-[13px] text-[var(--color-text-secondary)] mb-5">
          <template v-if="confirm === 'noshow'">You waited {{ formatClock(waitedSeconds) }}. The rider is charged a no-show fee and you receive your share of it.</template>
          <template v-else>The rider won’t be charged and will be matched with another driver. Frequent cancellations can affect your account.</template>
        </p>
        <p v-if="actionError" class="text-[13px] text-red-500 mb-3" role="alert">{{ actionError }}</p>
        <button @click="doCancel(confirm === 'noshow')" :disabled="busy" class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-2xl disabled:opacity-50">
          {{ busy ? 'One moment…' : confirm === 'noshow' ? 'Yes, rider didn’t show' : 'Yes, cancel trip' }}
        </button>
        <button @click="confirm = null" class="w-full py-3 mt-1 text-[14px] text-[var(--color-text-secondary)]">Keep trip</button>
      </div>
    </div>

    <!-- Rider cancelled -->
    <div v-if="endedNotice" role="alertdialog" aria-modal="true" aria-labelledby="ended-title" class="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center px-6">
      <div class="bg-[var(--color-surface)] rounded-3xl p-6 max-w-sm w-full text-center">
        <h2 id="ended-title" class="text-xl font-bold mb-2">Trip cancelled</h2>
        <p class="text-[13px] text-[var(--color-text-secondary)] mb-5">{{ endedNotice }}</p>
        <button @click="leaveAfterCancel" class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-2xl">Back to dashboard</button>
      </div>
    </div>
  </div>
</template>
