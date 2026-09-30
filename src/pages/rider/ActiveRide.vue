<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GoogleMap from '../../components/GoogleMap.vue'
import RideTracker from '../../components/RideTracker.vue'
import { supabase } from '../../lib/supabase'
import { DEMO_MODE } from '../../lib/demoMode'
import { apiPost } from '../../lib/api'
import { formatFare } from '../../lib/pricing'

const route = useRoute()
const router = useRouter()
const rideId = route.params.rideId

// Ride data
const rideStatus = ref('driver_enroute')
const driverName = ref('Your Driver')
const driverRating = ref(null)
const driverPhone = ref('')
const vehicle = ref('')
const plate = ref('')
const etaMinutes = ref(0)

// Map locations (Nassau defaults)
const pickup = ref({ lat: 25.0443, lng: -77.3504 })
const dropoff = ref({ lat: 25.0781, lng: -77.3383 })
const driverLocation = ref({ lat: 25.0380, lng: -77.3550 })

const showChat = ref(false)
const messages = ref([])
const draft = ref('')

// Driver location tracking
let locationChannel = null
let statusChannel = null
let statusTimers = []
const cancelled = ref(false)

// Database statuses -> the tracker's vocabulary
function toTrackerStatus(dbStatus) {
  switch (dbStatus) {
    case 'driver_arrived': return 'driver_arrived'
    case 'in_progress': return 'on_trip'
    case 'completed': return 'completed'
    default: return 'driver_enroute' // accepted / pending_driver_response
  }
}

const statusBarText = computed(() => {
  switch (rideStatus.value) {
    case 'driver_arrived': return 'Your driver has arrived'
    case 'on_trip': return 'Heading to your destination'
    case 'completed': return 'You have arrived'
    default: return 'Your driver is on the way'
  }
})

onMounted(async () => {
  // Load ride data from route query (passed from SearchingForDriver)
  const q = route.query
  if (q.driverName) driverName.value = q.driverName
  if (q.rating) driverRating.value = parseFloat(q.rating)
  if (q.vehicle) vehicle.value = q.vehicle
  if (q.plate) plate.value = q.plate
  if (q.eta) etaMinutes.value = parseInt(q.eta)
  if (q.pickupLat) pickup.value = { lat: parseFloat(q.pickupLat), lng: parseFloat(q.pickupLng) }
  if (q.dropoffLat) dropoff.value = { lat: parseFloat(q.dropoffLat), lng: parseFloat(q.dropoffLng) }

  if (DEMO_MODE) {
    startDemoSimulation()
    return
  }

  // Real mode: load ride data and subscribe to updates
  const { data } = await supabase.from('rides').select('*').eq('id', rideId).single()
  if (data) {
    if (data.status === 'cancelled') { cancelled.value = true }
    rideStatus.value = toTrackerStatus(data.status)
    if (data.pickup_lat && data.pickup_lng) {
      pickup.value = { lat: data.pickup_lat, lng: data.pickup_lng }
    }
    if (data.dropoff_lat && data.dropoff_lng) {
      dropoff.value = { lat: data.dropoff_lat, lng: data.dropoff_lng }
    }
    if (data.driver_lat && data.driver_lng) {
      driverLocation.value = { lat: data.driver_lat, lng: data.driver_lng }
    }
    if (data.driver_id) {
      // Drivers' rows are private; riders read them via an RPC limited to their own ride.
      const { data: rpc } = await supabase.rpc('get_ride_driver', { p_ride_id: rideId })
      const driverData = Array.isArray(rpc) ? rpc[0] : rpc
      if (driverData) {
        driverName.value = driverData.name || driverName.value
        driverRating.value = driverData.rating || driverRating.value
        vehicle.value = [driverData.vehicle_color, driverData.vehicle_make, driverData.vehicle_model].filter(Boolean).join(' ') || vehicle.value
        plate.value = driverData.license_plate || plate.value
        driverPhone.value = driverData.phone || driverPhone.value
      }
    }
  }

  // Subscribe to real-time driver location broadcasts
  locationChannel = supabase.channel(`ride-location-${rideId}`)
  locationChannel.on('broadcast', { event: 'driver-location' }, ({ payload }) => {
    if (payload?.lat && payload?.lng) {
      driverLocation.value = { lat: payload.lat, lng: payload.lng }
    }
  }).subscribe()

  // Subscribe to ride status changes
  statusChannel = supabase.channel(`ride-status-${rideId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${rideId}` }, (payload) => {
      if (payload.new?.status) {
        if (payload.new.status === 'cancelled') { cancelled.value = true; return }
        rideStatus.value = toTrackerStatus(payload.new.status)
        if (payload.new.status === 'completed') {
          setTimeout(() => {
            router.push({ name: 'rate-ride', params: { rideId } })
          }, 2000)
        }
      }
    }).subscribe()
})

function startDemoSimulation() {
  // Simulate driver arriving after ETA
  const arriveTimer = setTimeout(() => {
    rideStatus.value = 'driver_arrived'
  }, etaMinutes.value * 1000) // Accelerated: 1 sec per minute

  // Simulate trip starting after arrival
  const tripTimer = setTimeout(() => {
    rideStatus.value = 'on_trip'
  }, (etaMinutes.value + 3) * 1000)

  // Simulate trip completing
  const completeTimer = setTimeout(() => {
    rideStatus.value = 'completed'
    setTimeout(() => {
      router.push({ name: 'rate-ride', params: { rideId: rideId || 'demo' } })
    }, 2000)
  }, (etaMinutes.value + 8) * 1000)

  statusTimers = [arriveTimer, tripTimer, completeTimer]
}

const cancelFeeCents = ref(0)
const confirmingCancel = ref(false)

// Ask the server whether cancelling now costs anything; only then do we cancel (or ask the rider to confirm).
async function cancelRide() {
  if (!DEMO_MODE) {
    try {
      const res = await apiPost('/api/cancel-payment', { rideId, preview: true })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.fee_cents > 0) {
        cancelFeeCents.value = data.fee_cents
        confirmingCancel.value = true
        return
      }
    } catch { /* fall through: cancel without a fee preview */ }
  }
  await doCancel()
}

async function doCancel() {
  confirmingCancel.value = false
  statusTimers.forEach(clearTimeout)
  if (!DEMO_MODE) {
    // Release the card hold first (it's refused once the trip has started), then cancel the ride.
    await apiPost('/api/cancel-payment', { rideId }).catch(() => {})
    await supabase.from('rides')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: 'cancelled_by_rider' })
      .eq('id', rideId)
  }
  router.push({ name: 'book' })
}

function openChat() {
  showChat.value = true
}

function closeChat() {
  showChat.value = false
}

function sendMessage() {
  if (!draft.value.trim()) return
  messages.value.push({ from: 'me', text: draft.value.trim() })
  draft.value = ''
}

onUnmounted(() => {
  statusTimers.forEach(clearTimeout)
  if (locationChannel) supabase.removeChannel(locationChannel)
  if (statusChannel) supabase.removeChannel(statusChannel)
})
</script>

<template>
  <!-- In-app chat overlay -->
  <div v-if="showChat" class="fixed inset-0 z-50 bg-[var(--color-surface)] text-[var(--color-text-primary)] flex flex-col">
    <div class="bg-[#2b8659] px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-5 flex items-center gap-3">
      <button @click="closeChat" class="w-10 h-10 rounded-full bg-[var(--color-surface)]/20 flex items-center justify-center text-base text-white" aria-label="Back">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="w-9 h-9 rounded-full bg-[var(--color-surface)]/25 flex items-center justify-center text-white text-xs font-bold">
        {{ driverName.split(' ').filter(Boolean).map(w => w[0]).join('') || 'DR' }}
      </div>
      <div class="text-white font-bold text-[15px]">{{ driverName }}</div>
    </div>

    <div class="flex-1 px-5 py-5 space-y-3 overflow-y-auto">
      <div v-for="(m, i) in messages" :key="i" class="flex" :class="m.from === 'me' ? 'justify-end' : 'justify-start'">
        <div class="max-w-[75%] px-4 py-2.5 rounded-2xl text-[13px]"
             :class="m.from === 'me' ? 'bg-[#2b8659] text-white rounded-br-sm' : 'bg-[var(--color-text-primary)]/6 text-[var(--color-text-primary)] rounded-bl-sm'">
          {{ m.text }}
        </div>
      </div>
    </div>

    <div class="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 border-t border-[var(--color-border)] flex items-center gap-2">
      <input v-model="draft" @keyup.enter="sendMessage" type="text" placeholder="Type a message..."
             class="flex-1 bg-[var(--color-surface-secondary)] rounded-full px-4 py-3 text-[13px] outline-none placeholder:text-[var(--color-text-muted)] min-h-[44px]" />
      <button @click="sendMessage" class="w-11 h-11 rounded-full bg-[#2b8659] text-white flex items-center justify-center" aria-label="Send message">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
        </svg>
      </button>
    </div>
  </div>

  <!-- Main ride tracking view -->
  <div v-else class="fixed inset-0 bg-[var(--color-surface)] text-[var(--color-text-primary)]">
    <!-- Top status bar -->
    <div class="absolute top-0 left-0 right-0 z-30 bg-[var(--color-surface)]/95 backdrop-blur-sm border-b border-[var(--color-border)]">
      <div class="px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-3 flex items-center gap-3">
        <button @click="cancelRide" class="w-10 h-10 rounded-full bg-[var(--color-surface-secondary)] border border-[var(--color-border)] flex items-center justify-center" aria-label="Back">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[var(--color-text-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div class="flex-1">
          <div class="text-[15px] font-semibold">{{ statusBarText }}</div>
        </div>
        <div class="text-lg font-semibold">Ride<span class="text-[var(--color-brand)]">Up</span></div>
      </div>
    </div>

    <!-- Full-screen map -->
    <GoogleMap :pickup="pickup" :dropoff="dropoff" :driver-location="driverLocation" />

    <!-- Ride cancelled (by the driver or the system) -->
    <div v-if="cancelled" role="alertdialog" aria-modal="true" aria-labelledby="ride-cancelled-title"
         class="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center px-6">
      <div class="bg-[var(--color-surface)] text-[var(--color-text-primary)] rounded-3xl p-6 max-w-sm w-full text-center">
        <h2 id="ride-cancelled-title" class="text-xl font-bold mb-2">Ride cancelled</h2>
        <p class="text-[var(--color-text-secondary)] text-sm mb-6">This ride was cancelled. Any hold on your card has been released.</p>
        <button @click="router.push({ name: 'book' })" class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px]">Book another ride</button>
      </div>
    </div>

    <!-- Cancellation fee confirmation -->
    <div v-if="confirmingCancel" role="alertdialog" aria-modal="true" aria-labelledby="cancel-fee-title"
         class="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center px-4 pb-6">
      <div class="bg-[var(--color-surface)] text-[var(--color-text-primary)] rounded-3xl p-6 max-w-sm w-full text-center">
        <h2 id="cancel-fee-title" class="text-xl font-bold mb-2">Cancel this ride?</h2>
        <p class="text-[var(--color-text-secondary)] text-sm mb-6">
          Your driver has already accepted, so a {{ formatFare(cancelFeeCents) }} cancellation fee applies.
        </p>
        <button @click="confirmingCancel = false" class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px] mb-2">Keep my ride</button>
        <button @click="doCancel" class="w-full py-3 text-[var(--color-text-secondary)] font-semibold text-[14px]">Cancel and pay {{ formatFare(cancelFeeCents) }}</button>
      </div>
    </div>

    <!-- Ride tracker overlay -->
    <RideTracker
      :ride-status="rideStatus"
      :driver-name="driverName"
      :driver-rating="driverRating"
      :driver-phone="driverPhone"
      :vehicle="vehicle"
      :plate="plate"
      :initial-eta="etaMinutes"
      @cancel="cancelRide"
      @message="openChat"
    />
  </div>
</template>
