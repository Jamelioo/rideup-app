<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDriver } from '../../lib/useDriver'
import { DEMO_MODE } from '../../lib/demoMode'
import { formatFare } from '../../lib/pricing'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import GoogleMap from '../../components/GoogleMap.vue'
import HarborBackdrop from '../../components/HarborBackdrop.vue'

const router = useRouter()
const { currentRide, updateRideStatus, completeRide } = useDriver()

const slideProgress = ref(0)
const isDragging = ref(false)
const slideComplete = ref(false)
let slideContainer = null

const phase = computed(() => {
  if (!currentRide.value) return 'none'
  return currentRide.value.status
})

const phaseLabel = computed(() => ({
  accepted: 'Navigate to pickup',
  driver_arrived: 'Waiting for rider',
  in_progress: 'Trip in progress',
  completed: 'Trip complete',
}[phase.value] || ''))

const phaseAction = computed(() => ({
  accepted: "I've Arrived",
  driver_arrived: 'Start Trip',
  in_progress: null,
}[phase.value] || ''))

const phaseSteps = computed(() => {
  const steps = ['accepted', 'driver_arrived', 'in_progress', 'completed']
  const currentIdx = steps.indexOf(phase.value)
  return steps.map((step, idx) => ({
    key: step,
    label: { accepted: 'Pickup', driver_arrived: 'Arrived', in_progress: 'Trip', completed: 'Done' }[step],
    done: idx < currentIdx,
    active: idx === currentIdx,
  }))
})

function getNavUrl() {
  if (!currentRide.value) return '#'
  const lat = phase.value === 'in_progress' ? currentRide.value.dropoff_lat : currentRide.value.pickup_lat
  const lng = phase.value === 'in_progress' ? currentRide.value.dropoff_lng : currentRide.value.pickup_lng
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

async function advancePhase() {
  if (phase.value === 'accepted') await updateRideStatus('driver_arrived')
  else if (phase.value === 'driver_arrived') await updateRideStatus('in_progress')
}

async function handleSlideComplete() {
  if (slideComplete.value) return
  slideComplete.value = true
  await updateRideStatus('completed')
}

function onSlideStart(e) {
  if (phase.value !== 'in_progress') return
  isDragging.value = true
  slideContainer = e.currentTarget.parentElement
}

function onSlideMove(e) {
  if (!isDragging.value || !slideContainer) return
  const touch = e.touches ? e.touches[0] : e
  const rect = slideContainer.getBoundingClientRect()
  const thumbWidth = 56
  const maxTravel = rect.width - thumbWidth - 8
  const x = Math.max(0, Math.min(touch.clientX - rect.left - thumbWidth / 2 - 4, maxTravel))
  slideProgress.value = x / maxTravel
  if (slideProgress.value >= 0.9) {
    isDragging.value = false
    slideProgress.value = 1
    handleSlideComplete()
  }
}

function onSlideEnd() {
  if (!isDragging.value) return
  isDragging.value = false
  if (slideProgress.value < 0.9) {
    slideProgress.value = 0
  }
}

function finish() {
  const rideId = currentRide.value?.id || 'demo'
  completeRide()
  router.push({ name: 'rate-rider', params: { rideId } })
}

// --- Real-time GPS broadcasting ---
let gpsWatchId = null
let locationChannel = null

onMounted(() => {
  if (DEMO_MODE || !supabaseConfigured || !currentRide.value) return

  // Subscribe to a Supabase Realtime channel for this ride
  locationChannel = supabase.channel(`ride-location-${currentRide.value.id}`)
  locationChannel.subscribe()

  // Watch driver's GPS and broadcast every update
  if (navigator.geolocation) {
    gpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        if (locationChannel) {
          locationChannel.send({
            type: 'broadcast',
            event: 'driver-location',
            payload: { lat: latitude, lng: longitude },
          })
        }
        // Also update the ride record periodically
        supabase.from('rides').update({
          driver_lat: latitude,
          driver_lng: longitude,
        }).eq('id', currentRide.value.id).then(() => {})
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )
  }
})

onUnmounted(() => {
  if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId)
  if (locationChannel) supabase.removeChannel(locationChannel)
})

async function cancelRide() {
  if (!DEMO_MODE && currentRide.value) {
    await supabase.from('rides').update({ status: 'cancelled' }).eq('id', currentRide.value.id)
    await supabase.from('drivers').update({ status: 'online' }).eq('id', driver.value.id)
  }
  completeRide()
  router.push('/driver/dashboard')
}

const slideThumbStyle = computed(() => {
  if (!slideContainer) return {}
  return {
    transform: `translateX(${slideProgress.value * 100}%)`,
  }
})
</script>

<template>
  <div class="relative h-screen bg-[var(--color-surface)] text-[var(--color-text-primary)] overflow-hidden"
       @mousemove="onSlideMove" @mouseup="onSlideEnd"
       @touchmove.passive="onSlideMove" @touchend="onSlideEnd">
    <!-- Map -->
    <div class="absolute inset-0 md:left-[400px]">
      <GoogleMap v-if="!DEMO_MODE" class="absolute inset-0"
                 :pickup="currentRide ? { lat: currentRide.pickup_lat, lng: currentRide.pickup_lng } : null"
                 :dropoff="phase === 'in_progress' || phase === 'completed' ? { lat: currentRide.dropoff_lat, lng: currentRide.dropoff_lng } : null" />
      <HarborBackdrop v-else show-route />
    </div>

    <!-- MOBILE: Navigate button floating top-right -->
    <div v-if="currentRide && phase !== 'completed'" class="md:hidden absolute top-0 right-0 z-10 pr-5 pt-[max(2rem,env(safe-area-inset-top))]">
      <a :href="getNavUrl()" target="_blank" rel="noopener"
         class="flex items-center gap-2 bg-[var(--color-surface)] shadow-[0_2px_12px_rgba(0,0,0,0.12)] rounded-full px-4 py-2.5 active:scale-95 transition-transform">
        <svg class="w-5 h-5 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <span class="text-[13px] font-semibold text-[var(--color-text-primary)]">Navigate</span>
      </a>
    </div>

    <!-- MOBILE bottom sheet -->
    <div class="md:hidden absolute bottom-0 left-0 right-0 z-10 bg-[var(--color-surface)] rounded-t-[28px] shadow-[0_-4px_40px_rgba(0,0,0,0.1)]" style="padding-bottom: env(safe-area-inset-bottom, 0px);">
      <div class="flex justify-center pt-3 pb-2">
        <div class="w-9 h-[5px] rounded-full bg-[var(--color-border)]"></div>
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
          <div class="text-[13px] text-[var(--color-text-muted)]">{{ currentRide?.distance_miles?.toFixed(1) }} mi · {{ Math.round(currentRide?.duration_minutes || 0) }} min</div>
          <button @click="finish"
                  class="w-full py-4 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px] mt-6 transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(88,204,2,0.3)]">
            Done
          </button>
        </div>

        <!-- Active ride phases -->
        <template v-else-if="currentRide">
          <!-- Status progress bar -->
          <div class="flex items-center gap-1 mb-4">
            <template v-for="(step, idx) in phaseSteps" :key="step.key">
              <div class="flex-1 h-1 rounded-full" :class="step.done || step.active ? 'bg-[#2b8659]' : 'bg-[var(--color-border)]'"></div>
            </template>
          </div>

          <div class="flex items-center gap-2 mb-3">
            <span class="w-2.5 h-2.5 rounded-full bg-[#2b8659] animate-pulse"></span>
            <span class="text-[13px] font-semibold text-[#2b8659]">{{ phaseLabel }}</span>
          </div>

          <!-- Rider info card -->
          <div class="bg-[var(--color-surface-secondary)] rounded-2xl p-4 mb-4">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-10 h-10 rounded-full bg-[#2b8659]/15 flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <div class="flex-1">
                <div class="text-[15px] font-bold">{{ currentRide.rider_name || 'Rider' }}</div>
              </div>
              <div class="text-[15px] font-bold text-[#2b8659]">{{ formatFare(currentRide.fare_cents) }}</div>
            </div>

            <!-- Pickup -->
            <div class="flex gap-3">
              <div class="flex flex-col items-center pt-[6px]">
                <div class="w-[10px] h-[10px] rounded-full border-[2.5px] border-[#2b8659] bg-[var(--color-surface)] flex-shrink-0"></div>
                <div class="w-[2px] flex-1 my-1 bg-[var(--color-border)] rounded-full min-h-[12px]"></div>
                <div class="w-[10px] h-[10px] rounded-[2px] bg-[var(--color-text-primary)] flex-shrink-0"></div>
              </div>
              <div class="flex-1 space-y-2">
                <div>
                  <div class="text-[11px] text-[var(--color-text-muted)] font-medium">PICKUP</div>
                  <div class="text-[13px] font-semibold">{{ currentRide.pickup_address }}</div>
                </div>
                <div>
                  <div class="text-[11px] text-[var(--color-text-muted)] font-medium">DROPOFF</div>
                  <div class="text-[13px] font-semibold">{{ currentRide.dropoff_address }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Slide to complete (in_progress only) -->
          <div v-if="phase === 'in_progress'" class="relative h-[56px] bg-[#191f1c] rounded-2xl overflow-hidden select-none mb-3">
            <!-- Track fill -->
            <div class="absolute inset-y-0 left-0 bg-[#2b8659] rounded-2xl transition-all"
                 :style="{ width: slideComplete ? '100%' : (slideProgress * 100) + '%' }"></div>
            <!-- Label -->
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span class="text-white/60 text-[14px] font-semibold" :class="{ 'opacity-0': slideProgress > 0.3 }">Slide to complete trip</span>
              <span v-if="slideComplete" class="text-white text-[14px] font-semibold">Completed</span>
            </div>
            <!-- Thumb -->
            <div v-if="!slideComplete"
                 class="absolute top-[4px] left-[4px] w-[48px] h-[48px] bg-[var(--color-surface)] rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing shadow-sm"
                 :style="{ transform: `translateX(${slideProgress * (slideContainer ? slideContainer.offsetWidth - 56 : 200)}px)` }"
                 @mousedown.prevent="onSlideStart"
                 @touchstart.prevent="onSlideStart">
              <svg class="w-5 h-5 text-[var(--color-text-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </div>

          <!-- Regular action button (not in_progress) -->
          <button v-if="phaseAction" @click="advancePhase"
                  class="w-full py-4 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px] transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(88,204,2,0.3)]">
            {{ phaseAction }}
          </button>

          <!-- Navigate button -->
          <a v-if="phase !== 'completed'" :href="getNavUrl()" target="_blank" rel="noopener"
             class="w-full py-3 mt-2 border-2 border-[var(--color-border)] font-semibold text-[14px] rounded-2xl flex items-center justify-center gap-2 active:bg-[var(--color-surface-secondary)] transition-colors">
            <svg class="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Open in Google Maps
          </a>

          <button v-if="phase === 'accepted'" @click="cancelRide"
                  class="w-full py-3 mt-2 text-[var(--color-text-muted)] font-semibold text-[13px]">
            Cancel Ride
          </button>
        </template>
      </div>
    </div>

    <!-- DESKTOP: Side panel -->
    <div class="hidden md:flex absolute inset-y-0 left-0 z-10 w-[400px] bg-[var(--color-surface)] shadow-[4px_0_24px_rgba(0,0,0,0.08)] flex-col">
      <div class="px-6 pt-8 pb-4">
        <div class="text-[22px] font-bold tracking-tight">Ride<span class="text-[#2b8659]">Up</span> <span class="text-[12px] font-sans font-normal text-[var(--color-text-muted)] ml-0.5">Driver</span></div>
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
          <div class="text-[13px] text-[var(--color-text-muted)] mb-6">{{ currentRide?.distance_miles?.toFixed(1) }} mi · {{ Math.round(currentRide?.duration_minutes || 0) }} min</div>
          <button @click="finish"
                  class="w-full py-4 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px] hover:bg-[#236e49] shadow-[0_4px_16px_rgba(88,204,2,0.3)]">
            Done
          </button>
        </div>

        <template v-else-if="currentRide">
          <!-- Status progress bar -->
          <div class="flex items-center gap-1 mb-5">
            <template v-for="(step, idx) in phaseSteps" :key="step.key">
              <div class="flex-1">
                <div class="h-1 rounded-full" :class="step.done || step.active ? 'bg-[#2b8659]' : 'bg-[var(--color-border)]'"></div>
                <div class="text-[10px] text-center mt-1" :class="step.active ? 'text-[#2b8659] font-semibold' : 'text-[var(--color-text-muted)]'">{{ step.label }}</div>
              </div>
            </template>
          </div>

          <div class="flex items-center gap-2 mb-5">
            <span class="w-2.5 h-2.5 rounded-full bg-[#2b8659] animate-pulse"></span>
            <span class="text-[14px] font-semibold text-[#2b8659]">{{ phaseLabel }}</span>
          </div>

          <!-- Rider info card -->
          <div class="bg-[var(--color-surface-secondary)] rounded-2xl p-5 mb-5">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-11 h-11 rounded-full bg-[#2b8659]/15 flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <div class="flex-1">
                <div class="text-[16px] font-bold">{{ currentRide.rider_name || 'Rider' }}</div>
              </div>
              <div class="text-[17px] font-bold text-[#2b8659]">{{ formatFare(currentRide.fare_cents) }}</div>
            </div>

            <!-- Route -->
            <div class="flex gap-3">
              <div class="flex flex-col items-center pt-[6px]">
                <div class="w-[10px] h-[10px] rounded-full border-[2.5px] border-[#2b8659] bg-[var(--color-surface)] flex-shrink-0"></div>
                <div class="w-[2px] flex-1 my-1 bg-[var(--color-border)] rounded-full min-h-[16px]"></div>
                <div class="w-[10px] h-[10px] rounded-[2px] bg-[var(--color-text-primary)] flex-shrink-0"></div>
              </div>
              <div class="flex-1 space-y-3">
                <div>
                  <div class="text-[11px] text-[var(--color-text-muted)] font-medium">PICKUP</div>
                  <div class="text-[15px] font-semibold">{{ currentRide.pickup_address }}</div>
                </div>
                <div>
                  <div class="text-[11px] text-[var(--color-text-muted)] font-medium">DROPOFF</div>
                  <div class="text-[15px] font-semibold">{{ currentRide.dropoff_address }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Navigate button -->
          <a :href="getNavUrl()" target="_blank" rel="noopener"
             class="w-full py-3 mb-3 border-2 border-[var(--color-border)] font-semibold text-[14px] rounded-2xl flex items-center justify-center gap-2 hover:bg-[var(--color-surface-secondary)] transition-colors">
            <svg class="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Open in Google Maps
          </a>

          <!-- Slide to complete (in_progress only) -->
          <div v-if="phase === 'in_progress'" class="relative h-[56px] bg-[#191f1c] rounded-2xl overflow-hidden select-none mb-3">
            <div class="absolute inset-y-0 left-0 bg-[#2b8659] rounded-2xl transition-all"
                 :style="{ width: slideComplete ? '100%' : (slideProgress * 100) + '%' }"></div>
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span class="text-white/60 text-[14px] font-semibold" :class="{ 'opacity-0': slideProgress > 0.3 }">Slide to complete trip</span>
              <span v-if="slideComplete" class="text-white text-[14px] font-semibold">Completed</span>
            </div>
            <div v-if="!slideComplete"
                 class="absolute top-[4px] left-[4px] w-[48px] h-[48px] bg-[var(--color-surface)] rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing shadow-sm"
                 :style="{ transform: `translateX(${slideProgress * (340 - 56)}px)` }"
                 @mousedown.prevent="onSlideStart"
                 @touchstart.prevent="onSlideStart">
              <svg class="w-5 h-5 text-[var(--color-text-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </div>

          <!-- Regular action button -->
          <button v-if="phaseAction" @click="advancePhase"
                  class="w-full py-4 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px] hover:bg-[#236e49] shadow-[0_4px_16px_rgba(88,204,2,0.3)]">
            {{ phaseAction }}
          </button>
          <button v-if="phase === 'accepted'" @click="cancelRide"
                  class="w-full py-3 mt-2 text-[var(--color-text-muted)] font-semibold text-[13px] hover:text-[var(--color-text-secondary)]">
            Cancel Ride
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
