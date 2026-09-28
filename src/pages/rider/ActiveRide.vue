<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GoogleMap from '../../components/GoogleMap.vue'
import RideTracker from '../../components/RideTracker.vue'
import { supabase } from '../../lib/supabase'
import { DEMO_MODE } from '../../lib/demoMode'

const route = useRoute()
const router = useRouter()
const rideId = route.params.rideId

// Ride data
const rideStatus = ref('driver_enroute')
const driverName = ref('Marcus Rolle')
const driverRating = ref(4.9)
const driverPhone = ref('+12424529911')
const vehicle = ref('Silver Toyota Corolla')
const plate = ref('TX 4471')
const etaMinutes = ref(4)

// Map locations (Nassau defaults)
const pickup = ref({ lat: 25.0443, lng: -77.3504 })
const dropoff = ref({ lat: 25.0781, lng: -77.3383 })
const driverLocation = ref({ lat: 25.0380, lng: -77.3550 })

const showChat = ref(false)
const messages = ref([
  { from: 'driver', text: "I'll be there in a few mins" },
])
const draft = ref('')

// Simulated driver marker (moves toward pickup)
let driverMarkerInterval = null
let statusTimers = []

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

  // Real mode: subscribe to ride updates
  const { data } = await supabase.from('rides').select('*').eq('id', rideId).single()
  if (data) {
    rideStatus.value = data.status
  }
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

function cancelRide() {
  statusTimers.forEach(clearTimeout)
  if (driverMarkerInterval) clearInterval(driverMarkerInterval)
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
  setTimeout(() => messages.value.push({ from: 'driver', text: 'Got it, see you soon!' }), 1200)
}

onUnmounted(() => {
  statusTimers.forEach(clearTimeout)
  if (driverMarkerInterval) clearInterval(driverMarkerInterval)
})
</script>

<template>
  <!-- In-app chat overlay -->
  <div v-if="showChat" class="fixed inset-0 z-50 bg-[var(--color-surface)] text-[var(--color-text-primary)] flex flex-col">
    <div class="bg-[#2b8659] px-6 pt-8 pb-5 flex items-center gap-3">
      <button @click="closeChat" class="w-10 h-10 rounded-full bg-[var(--color-surface)]/20 flex items-center justify-center text-base text-white" aria-label="Back">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="w-9 h-9 rounded-full bg-[var(--color-surface)]/25 flex items-center justify-center text-white text-xs font-bold">
        {{ driverName.split(' ').map(w => w[0]).join('') }}
      </div>
      <div class="text-white font-bold text-[15px]">{{ driverName }}</div>
    </div>

    <div class="flex-1 px-5 py-5 space-y-3 overflow-y-auto">
      <div v-for="(m, i) in messages" :key="i" class="flex" :class="m.from === 'me' ? 'justify-end' : 'justify-start'">
        <div class="max-w-[75%] px-4 py-2.5 rounded-2xl text-[13px]"
             :class="m.from === 'me' ? 'bg-[#2b8659] text-white rounded-br-sm' : 'bg-[#191f1c]/6 text-[var(--color-text-primary)] rounded-bl-sm'">
          {{ m.text }}
        </div>
      </div>
    </div>

    <div class="px-4 pb-6 pt-3 border-t border-[var(--color-border)] flex items-center gap-2">
      <input v-model="draft" @keyup.enter="sendMessage" type="text" placeholder="Type a message..."
             class="flex-1 bg-[#191f1c]/[0.04] rounded-full px-4 py-2.5 text-[13px] outline-none placeholder:text-[#191f1c]/35" />
      <button @click="sendMessage" class="w-10 h-10 rounded-full bg-[#2b8659] text-white flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
        </svg>
      </button>
    </div>
  </div>

  <!-- Main ride tracking view -->
  <div v-else class="fixed inset-0 bg-[var(--color-surface)] text-[var(--color-text-primary)]">
    <!-- Top status bar -->
    <div class="absolute top-0 left-0 right-0 z-30 bg-[var(--color-surface)]/95 backdrop-blur-sm border-b border-[#191f1c]/5">
      <div class="px-6 pt-8 pb-3 flex items-center gap-3">
        <button @click="cancelRide" class="w-10 h-10 rounded-full bg-[#191f1c]/5 border border-[var(--color-border)] flex items-center justify-center" aria-label="Back">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[var(--color-text-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div class="flex-1">
          <div class="text-[15px] font-semibold">{{ statusBarText }}</div>
        </div>
        <div class="text-lg font-semibold">Ride<span class="text-[#2b8659]">Up</span></div>
      </div>
    </div>

    <!-- Full-screen map -->
    <GoogleMap :pickup="pickup" :dropoff="dropoff" />

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
