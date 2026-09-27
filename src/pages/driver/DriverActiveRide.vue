<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDriver } from '../../lib/useDriver'
import { DEMO_MODE } from '../../lib/demoMode'
import { formatFare } from '../../lib/pricing'
import GoogleMap from '../../components/GoogleMap.vue'
import HarborBackdrop from '../../components/HarborBackdrop.vue'

const router = useRouter()
const { currentRide, updateRideStatus, completeRide } = useDriver()

const phase = computed(() => {
  if (!currentRide.value) return 'none'
  return currentRide.value.status
})

const phaseLabel = computed(() => ({
  accepted: 'Navigating to pickup',
  driver_arrived: 'Waiting for rider',
  in_progress: 'Trip in progress',
  completed: 'Trip complete',
}[phase.value] || ''))

const phaseAction = computed(() => ({
  accepted: "I've Arrived",
  driver_arrived: 'Start Trip',
  in_progress: 'Complete Trip',
}[phase.value] || ''))

async function advancePhase() {
  if (phase.value === 'accepted') await updateRideStatus('driver_arrived')
  else if (phase.value === 'driver_arrived') await updateRideStatus('in_progress')
  else if (phase.value === 'in_progress') await updateRideStatus('completed')
}

function finish() {
  completeRide()
  router.push('/driver/dashboard')
}

function cancelRide() {
  completeRide()
  router.push('/driver/dashboard')
}
</script>

<template>
  <div class="relative h-screen bg-white text-[#191f1c] overflow-hidden">
    <!-- Map -->
    <div class="absolute inset-0 md:left-[400px]">
      <GoogleMap v-if="!DEMO_MODE" class="absolute inset-0"
                 :pickup="currentRide ? { lat: currentRide.pickup_lat, lng: currentRide.pickup_lng } : null"
                 :dropoff="phase === 'in_progress' || phase === 'completed' ? { lat: currentRide.dropoff_lat, lng: currentRide.dropoff_lng } : null" />
      <HarborBackdrop v-else show-route />
    </div>

    <!-- MOBILE bottom sheet -->
    <div class="md:hidden absolute bottom-0 left-0 right-0 z-10 bg-white rounded-t-[28px] shadow-[0_-4px_40px_rgba(0,0,0,0.1)]" style="padding-bottom: env(safe-area-inset-bottom, 0px);">
      <div class="flex justify-center pt-3 pb-2">
        <div class="w-9 h-[5px] rounded-full bg-[#191f1c]/10"></div>
      </div>
      <div class="px-5 pb-6">
        <!-- Trip complete summary -->
        <div v-if="phase === 'completed'" class="text-center py-4">
          <div class="w-16 h-16 rounded-full bg-[#2b8659] flex items-center justify-center mx-auto mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 class="text-2xl font-bold mb-1">Trip Complete</h2>
          <div class="text-[28px] font-bold text-[#2b8659] my-3">+{{ formatFare(currentRide?.fare_cents) }}</div>
          <div class="text-[13px] text-[#191f1c]/50">{{ currentRide?.distance_miles?.toFixed(1) }} mi · {{ Math.round(currentRide?.duration_minutes || 0) }} min</div>
          <button @click="finish"
                  class="w-full py-4 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px] mt-6 transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(88,204,2,0.3)]">
            Done
          </button>
        </div>

        <!-- Active ride phases -->
        <template v-else-if="currentRide">
          <div class="flex items-center gap-2 mb-3">
            <span class="w-2.5 h-2.5 rounded-full bg-[#2b8659] animate-pulse"></span>
            <span class="text-[13px] font-semibold text-[#2b8659]">{{ phaseLabel }}</span>
          </div>

          <div class="bg-[#f5f5f5] rounded-2xl p-4 mb-4">
            <div v-if="phase === 'accepted' || phase === 'driver_arrived'" class="mb-1">
              <div class="text-[11px] text-[#191f1c]/40 font-medium">PICKUP</div>
              <div class="text-[14px] font-semibold">{{ currentRide.pickup_address }}</div>
            </div>
            <div v-if="phase === 'in_progress'" class="mb-1">
              <div class="text-[11px] text-[#191f1c]/40 font-medium">DROPOFF</div>
              <div class="text-[14px] font-semibold">{{ currentRide.dropoff_address }}</div>
            </div>
            <div class="flex items-center justify-between mt-3 pt-3 border-t border-[#191f1c]/8">
              <span class="text-[12px] text-[#191f1c]/40">{{ currentRide.rider_name || 'Rider' }}</span>
              <span class="text-[15px] font-bold font-serif">{{ formatFare(currentRide.fare_cents) }}</span>
            </div>
          </div>

          <button @click="advancePhase"
                  class="w-full py-4 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px] transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(88,204,2,0.3)]">
            {{ phaseAction }}
          </button>
          <button v-if="phase === 'accepted'" @click="cancelRide"
                  class="w-full py-3 mt-2 text-[#191f1c]/40 font-semibold text-[13px]">
            Cancel Ride
          </button>
        </template>
      </div>
    </div>

    <!-- DESKTOP: Side panel -->
    <div class="hidden md:flex absolute inset-y-0 left-0 z-10 w-[400px] bg-white shadow-[4px_0_24px_rgba(0,0,0,0.08)] flex-col">
      <div class="px-6 pt-8 pb-4">
        <div class="text-[22px] font-bold tracking-tight">Ride<span class="text-[#2b8659]">Up</span> <span class="text-[12px] font-sans font-normal text-[#191f1c]/40 ml-0.5">Driver</span></div>
      </div>
      <div class="flex-1 overflow-y-auto px-6 pb-8">
        <div v-if="phase === 'completed'" class="text-center py-8">
          <div class="w-16 h-16 rounded-full bg-[#2b8659] flex items-center justify-center mx-auto mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 class="text-2xl font-bold mb-1">Trip Complete</h2>
          <div class="text-[28px] font-bold text-[#2b8659] my-3">+{{ formatFare(currentRide?.fare_cents) }}</div>
          <div class="text-[13px] text-[#191f1c]/50 mb-6">{{ currentRide?.distance_miles?.toFixed(1) }} mi · {{ Math.round(currentRide?.duration_minutes || 0) }} min</div>
          <button @click="finish"
                  class="w-full py-4 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px] hover:bg-[#236e49] shadow-[0_4px_16px_rgba(88,204,2,0.3)]">
            Done
          </button>
        </div>

        <template v-else-if="currentRide">
          <div class="flex items-center gap-2 mb-5">
            <span class="w-2.5 h-2.5 rounded-full bg-[#2b8659] animate-pulse"></span>
            <span class="text-[14px] font-semibold text-[#2b8659]">{{ phaseLabel }}</span>
          </div>

          <div class="bg-[#f5f5f5] rounded-2xl p-5 mb-5">
            <div v-if="phase === 'accepted' || phase === 'driver_arrived'" class="mb-1">
              <div class="text-[11px] text-[#191f1c]/40 font-medium">PICKUP</div>
              <div class="text-[15px] font-semibold">{{ currentRide.pickup_address }}</div>
            </div>
            <div v-if="phase === 'in_progress'" class="mb-1">
              <div class="text-[11px] text-[#191f1c]/40 font-medium">DROPOFF</div>
              <div class="text-[15px] font-semibold">{{ currentRide.dropoff_address }}</div>
            </div>
            <div class="flex items-center justify-between mt-3 pt-3 border-t border-[#191f1c]/8">
              <span class="text-[13px] text-[#191f1c]/40">{{ currentRide.rider_name || 'Rider' }}</span>
              <span class="text-[17px] font-bold font-serif">{{ formatFare(currentRide.fare_cents) }}</span>
            </div>
          </div>

          <button @click="advancePhase"
                  class="w-full py-4 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px] hover:bg-[#236e49] shadow-[0_4px_16px_rgba(88,204,2,0.3)]">
            {{ phaseAction }}
          </button>
          <button v-if="phase === 'accepted'" @click="cancelRide"
                  class="w-full py-3 mt-2 text-[#191f1c]/40 font-semibold text-[13px] hover:text-[#191f1c]/60">
            Cancel Ride
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
