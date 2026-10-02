<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GoogleMap from '../../components/GoogleMap.vue'
import HarborBackdrop from '../../components/HarborBackdrop.vue'
import RideTracker from '../../components/RideTracker.vue'
import RideChat from '../../components/RideChat.vue'
import SafetyToolkit from '../../components/SafetyToolkit.vue'
import { supabase } from '../../lib/supabase'
import { DEMO_MODE } from '../../lib/demoMode'
import { apiPost } from '../../lib/api'
import { formatFare } from '../../lib/pricing'
import { etaMinutes as estimateEta } from '../../lib/eta'
import { loadSettings } from '../../lib/settings'
import { enablePushNotifications } from '../../lib/push'
import { useAuth } from '../../lib/useAuth'

const route = useRoute()
const router = useRouter()
const { user } = useAuth()
const rideId = route.params.rideId

// Ride + driver
const ride = ref(null)
const rideStatus = ref('driver_enroute')
const driverName = ref(route.query.driverName || 'Your driver')
const driverRating = ref(route.query.rating ? parseFloat(route.query.rating) : null)
const driverPhone = ref('')
const driverPhoto = ref(null)
const vehicle = ref(route.query.vehicle || '')
const plate = ref(route.query.plate || '')
const pin = ref('')
const fallbackEta = ref(route.query.eta ? parseInt(route.query.eta) : null)

const pickup = ref(route.query.pickupLat ? { lat: parseFloat(route.query.pickupLat), lng: parseFloat(route.query.pickupLng) } : null)
const dropoff = ref(route.query.dropoffLat ? { lat: parseFloat(route.query.dropoffLat), lng: parseFloat(route.query.dropoffLng) } : null)
const driverLocation = ref(null)
const mapFailed = ref(DEMO_MODE)

// UI state
const chatOpen = ref(false)
const unread = ref(0)
const safetyOpen = ref(false)
const confirmingCancel = ref(false)
const cancelFeeCents = ref(0)
const cancelling = ref(false)
const cancelError = ref('')
const endedBy = ref(null) // set when the ride is cancelled by the driver/system → modal

let locationChannel = null
let statusChannel = null
let pollTimer = null
let demoTimers = []

function toTrackerStatus(dbStatus) {
  switch (dbStatus) {
    case 'driver_arrived': return 'driver_arrived'
    case 'in_progress': return 'on_trip'
    case 'completed': return 'completed'
    default: return 'driver_enroute'
  }
}

const statusBarText = computed(() => ({
  driver_arrived: 'Your driver is here',
  on_trip: 'Heading to your destination',
  completed: 'You’ve arrived',
}[rideStatus.value] || 'Your driver is on the way'))

// Live ETA from the driver's position (to pickup while en route, to drop-off on the trip).
const liveEta = computed(() => {
  const target = rideStatus.value === 'on_trip' ? dropoff.value : pickup.value
  const fromDriver = estimateEta(driverLocation.value, target)
  if (fromDriver != null) return fromDriver
  return rideStatus.value === 'driver_enroute' ? fallbackEta.value : null
})

const shareRide = computed(() => ({
  id: rideId,
  driverName: driverName.value,
  vehicleInfo: vehicle.value,
  plate: plate.value,
  pickup: ride.value?.pickup_address,
  dropoff: ride.value?.dropoff_address,
}))

let rematchChecks = 0

function applyRide(row) {
  if (!row) return
  ride.value = { ...(ride.value || {}), ...row }
  if (row.pickup_lat != null) pickup.value = { lat: row.pickup_lat, lng: row.pickup_lng }
  if (row.dropoff_lat != null) dropoff.value = { lat: row.dropoff_lat, lng: row.dropoff_lng }
  if (row.driver_lat != null && row.driver_lng != null) driverLocation.value = { lat: row.driver_lat, lng: row.driver_lng }

  if (row.status === 'cancelled') {
    stopLive()
    if (cancelling.value) return
    if (row.replaced_by_ride_id) {
      // The driver cancelled and the server already booked a new request: go back to searching.
      try { sessionStorage.setItem('rideup_notice', 'Your driver had to cancel. We’re finding you another driver. You weren’t charged.') } catch { /* private mode */ }
      router.replace({ name: 'book' })
      return
    }
    if (row.cancel_reason === 'driver_cancelled' && rematchChecks < 3) {
      // The automatic re-match is written a moment after the cancellation.
      rematchChecks++
      setTimeout(refreshRide, 2000)
      return
    }
    endedBy.value = { reason: row.cancel_reason, fee: row.cancel_fee_cents || 0 }
    return
  }
  if (row.status === 'requested' || row.status === 'pending_driver_response') {
    router.replace({ name: 'book' }) // still searching: RiderFlow shows the search screen
    return
  }
  rideStatus.value = toTrackerStatus(row.status)
  if (row.status === 'completed') {
    stopLive()
    setTimeout(() => router.replace({ name: 'rate-ride', params: { rideId } }), 1500)
  }
}

async function loadDriver() {
  const { data } = await supabase.rpc('get_ride_driver', { p_ride_id: rideId })
  const d = Array.isArray(data) ? data[0] : data
  if (!d) return
  driverName.value = d.name || driverName.value
  driverRating.value = d.rating != null ? Number(d.rating) : driverRating.value
  vehicle.value = [d.vehicle_color, d.vehicle_make, d.vehicle_model].filter(Boolean).join(' ') || vehicle.value
  plate.value = d.license_plate || plate.value
  driverPhone.value = d.phone || ''
  driverPhoto.value = d.photo_url || null
}

async function loadPin() {
  const settings = await loadSettings()
  if (!settings.require_pickup_pin) return
  const { data } = await supabase.from('ride_pins').select('pin').eq('ride_id', rideId).maybeSingle()
  pin.value = data?.pin || ''
}

async function refreshRide() {
  const { data } = await supabase.from('rides').select('*').eq('id', rideId).maybeSingle()
  if (!data) {
    router.replace({ name: 'book' })
    return
  }
  const hadDriver = ride.value?.driver_id
  applyRide(data)
  if (data.driver_id && data.driver_id !== hadDriver) loadDriver()
}

function startLive() {
  // Live position over a private channel (participants only); the ride row carries it as a fallback.
  locationChannel = supabase.channel(`ride-location-${rideId}`, { config: { private: true } })
  locationChannel.on('broadcast', { event: 'driver-location' }, ({ payload }) => {
    if (payload?.lat && payload?.lng) driverLocation.value = { lat: payload.lat, lng: payload.lng }
  }).subscribe()

  statusChannel = supabase.channel(`ride-status-${rideId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${rideId}` }, (payload) => {
      if (payload.new) applyRide(payload.new)
    })
    .subscribe()

  // Safety net if realtime drops (mobile networks): re-read the ride every 10s.
  pollTimer = setInterval(refreshRide, 10_000)
}

function stopLive() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  if (locationChannel) { supabase.removeChannel(locationChannel); locationChannel = null }
  if (statusChannel) { supabase.removeChannel(statusChannel); statusChannel = null }
}

function startDemoSimulation() {
  const eta = fallbackEta.value || 4
  driverLocation.value = null
  demoTimers = [
    setTimeout(() => { rideStatus.value = 'driver_arrived'; ride.value = { ...(ride.value || {}), arrived_at: new Date().toISOString() } }, eta * 1000),
    setTimeout(() => { rideStatus.value = 'on_trip' }, (eta + 3) * 1000),
    setTimeout(() => {
      rideStatus.value = 'completed'
      setTimeout(() => router.replace({ name: 'rate-ride', params: { rideId: rideId || 'demo' } }), 1500)
    }, (eta + 8) * 1000),
  ]
}

onMounted(async () => {
  if (DEMO_MODE) {
    ride.value = { id: rideId, pickup_address: 'Your pickup', dropoff_address: 'Your destination' }
    startDemoSimulation()
    return
  }
  await refreshRide()
  if (!ride.value || ['cancelled', 'completed'].includes(ride.value.status)) return
  loadPin()
  startLive()
  enablePushNotifications() // "Your driver has arrived" even if the app is in the background
})

onUnmounted(() => {
  demoTimers.forEach(clearTimeout)
  stopLive()
})

// ── Cancellation: always confirm; the server decides the fee and releases or charges the hold in one step ──
async function askCancel() {
  cancelError.value = ''
  cancelFeeCents.value = 0
  if (!DEMO_MODE) {
    try {
      const res = await apiPost('/api/cancel-ride', { rideId, preview: true })
      const data = await res.json().catch(() => ({}))
      if (res.ok) cancelFeeCents.value = data.fee_cents || 0
      else if (res.status === 409) { cancelError.value = data.error || 'This ride can no longer be cancelled.' }
    } catch { /* show the confirm anyway; the server re-checks */ }
  }
  confirmingCancel.value = true
}

async function doCancel() {
  if (DEMO_MODE) {
    demoTimers.forEach(clearTimeout)
    router.replace({ name: 'book' })
    return
  }
  cancelling.value = true
  cancelError.value = ''
  try {
    const res = await apiPost('/api/cancel-ride', { rideId })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Could not cancel. Please try again.')
    stopLive()
    router.replace({ name: 'book' })
  } catch (err) {
    cancelError.value = err.message
    cancelling.value = false
  }
}

const endedMessage = computed(() => {
  if (!endedBy.value) return ''
  if (endedBy.value.reason === 'rider_no_show') {
    return endedBy.value.fee > 0
      ? `Your driver waited at the pickup and marked the ride as a no-show. A ${formatFare(endedBy.value.fee)} no-show fee was charged.`
      : 'Your driver waited at the pickup and marked the ride as a no-show.'
  }
  if (endedBy.value.reason === 'driver_cancelled') return 'Your driver had to cancel. You weren’t charged. Request again and we’ll find you another driver.'
  return 'This ride was cancelled. Any hold on your card has been released.'
})
</script>

<template>
  <div class="fixed inset-0 bg-[var(--color-surface)] text-[var(--color-text-primary)]">
    <!-- Top bar -->
    <div class="absolute top-0 left-0 right-0 z-30 bg-[var(--color-surface)]/95 backdrop-blur-sm border-b border-[var(--color-border)]">
      <div class="px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 flex items-center gap-3">
        <div class="text-lg font-semibold">Ride<span class="text-[var(--color-brand)]">Up</span></div>
        <div class="flex-1 text-[15px] font-semibold truncate">{{ statusBarText }}</div>
        <button @click="safetyOpen = true"
                class="flex items-center gap-1.5 h-10 px-3 rounded-full bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[13px] font-semibold"
                aria-label="Safety toolkit: emergency call, share trip, report">
          <svg class="w-5 h-5 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Safety
        </button>
      </div>
    </div>

    <!-- Map (falls back to an illustrated backdrop if maps aren't available) -->
    <GoogleMap v-if="!mapFailed" :pickup="pickup" :dropoff="dropoff" :driver-location="driverLocation" @error="mapFailed = true" />
    <HarborBackdrop v-else show-route />

    <RideTracker
      :ride-status="rideStatus"
      :driver-name="driverName"
      :driver-rating="driverRating"
      :driver-phone="driverPhone"
      :driver-photo="driverPhoto"
      :vehicle="vehicle"
      :plate="plate"
      :eta-minutes="liveEta"
      :arrived-at="ride?.arrived_at || null"
      :pin="pin"
      :unread="unread"
      @cancel="askCancel"
      @message="chatOpen = true"
    />

    <RideChat
      v-if="!DEMO_MODE && user"
      v-model:open="chatOpen"
      :ride-id="rideId"
      :current-user-id="user.id"
      :other-user-name="driverName"
      partner-role="driver"
      :quick-replies="['I’m on my way', 'I’m at the pickup', 'Running 2 min late', 'Where are you?', 'Please call me']"
      @unread="unread = $event"
    />

    <SafetyToolkit :is-open="safetyOpen" :ride="shareRide" role="rider" @close="safetyOpen = false" />

    <!-- Cancel confirmation (Uber always confirms) -->
    <div v-if="confirmingCancel" role="alertdialog" aria-modal="true" aria-labelledby="cancel-title"
         class="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center px-4 pb-6">
      <div class="bg-[var(--color-surface)] text-[var(--color-text-primary)] rounded-3xl p-6 max-w-sm w-full text-center">
        <h2 id="cancel-title" class="text-xl font-bold mb-2">Cancel this ride?</h2>
        <p class="text-[var(--color-text-secondary)] text-sm mb-6">
          <template v-if="cancelFeeCents > 0">Your driver accepted more than 2 minutes ago and is on the way, so a {{ formatFare(cancelFeeCents) }} cancellation fee applies. Most of it goes to your driver.</template>
          <template v-else>You won’t be charged.</template>
        </p>
        <p v-if="cancelError" class="text-[13px] text-red-500 mb-3" role="alert">{{ cancelError }}</p>
        <button @click="confirmingCancel = false" class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px] mb-2">Keep my ride</button>
        <button @click="doCancel" :disabled="cancelling" class="w-full py-3 text-[var(--color-text-secondary)] font-semibold text-[14px] disabled:opacity-50">
          {{ cancelling ? 'Cancelling…' : cancelFeeCents > 0 ? `Cancel and pay ${formatFare(cancelFeeCents)}` : 'Yes, cancel ride' }}
        </button>
      </div>
    </div>

    <!-- Ride ended by the driver / system -->
    <div v-if="endedBy" role="alertdialog" aria-modal="true" aria-labelledby="ended-title"
         class="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center px-6">
      <div class="bg-[var(--color-surface)] text-[var(--color-text-primary)] rounded-3xl p-6 max-w-sm w-full text-center">
        <h2 id="ended-title" class="text-xl font-bold mb-2">Ride cancelled</h2>
        <p class="text-[var(--color-text-secondary)] text-sm mb-6">{{ endedMessage }}</p>
        <button @click="router.replace({ name: 'book' })" class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px]">Request a new ride</button>
        <router-link to="/support" class="block mt-3 text-[13px] text-[var(--color-text-secondary)] underline">Something wrong? Contact support</router-link>
      </div>
    </div>
  </div>
</template>
