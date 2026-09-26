<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDriver } from '../../lib/useDriver'
import { useAuth } from '../../lib/useAuth'
import { DEMO_MODE } from '../../lib/demoMode'
import { formatFare } from '../../lib/pricing'
import { generateFakeEarnings } from '../../lib/demoDriverMode'
import GoogleMap from '../../components/GoogleMap.vue'
import HarborBackdrop from '../../components/HarborBackdrop.vue'
import SideMenu from '../../components/SideMenu.vue'
import DriverRideRequest from './DriverRideRequest.vue'

const router = useRouter()
const { user } = useAuth()
const { driver, isOnline, incomingRequest, currentRide, fetchDriver, goOnline, goOffline } = useDriver()

const menuOpen = ref(false)
const todayEarnings = ref(0)
const todayTrips = ref(0)
const lastRide = ref(null)

onMounted(async () => {
  if (!DEMO_MODE && user.value) {
    await fetchDriver(user.value.id)
  }
  if (DEMO_MODE) {
    const { today } = generateFakeEarnings()
    todayEarnings.value = today.reduce((sum, t) => sum + t.fare_cents, 0)
    todayTrips.value = today.length
    lastRide.value = today[0]
  }
})

async function toggleOnline() {
  if (isOnline.value) {
    await goOffline()
  } else {
    await goOnline()
  }
}

function handleRideAccepted() {
  router.push('/driver/active-ride')
}

const initials = computed(() => {
  if (!driver.value?.name) return 'DR'
  return driver.value.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
})
</script>

<template>
  <div class="relative h-screen bg-white text-[#1a1a1a] overflow-hidden">
    <SideMenu :is-open="menuOpen" @close="menuOpen = false" />

    <!-- Incoming ride request overlay -->
    <DriverRideRequest
      v-if="incomingRequest"
      :request="incomingRequest"
      @accepted="handleRideAccepted"
    />

    <!-- Map fills right side on desktop, top on mobile -->
    <div class="absolute inset-0 md:left-[400px]">
      <GoogleMap v-if="!DEMO_MODE" class="absolute inset-0 z-0" />
      <HarborBackdrop v-else />
    </div>

    <!-- MOBILE: Top bar -->
    <div class="md:hidden absolute top-0 left-0 right-0 z-10 px-5 pt-[max(2rem,env(safe-area-inset-top))] flex items-center justify-between pointer-events-none">
      <button @click="menuOpen = true" class="pointer-events-auto w-11 h-11 rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.1)] flex items-center justify-center active:scale-95 transition-transform">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect y="3" width="18" height="1.5" rx="0.75" fill="#1a1a1a"/><rect y="8.25" width="18" height="1.5" rx="0.75" fill="#1a1a1a"/><rect y="13.5" width="18" height="1.5" rx="0.75" fill="#1a1a1a"/></svg>
      </button>
      <div class="pointer-events-auto bg-white shadow-[0_2px_12px_rgba(0,0,0,0.1)] rounded-full px-5 py-2 font-serif text-[17px] font-bold tracking-tight">Ride<span class="text-[#58cc02]">Up</span> <span class="text-[11px] font-sans font-normal text-[#1a1a1a]/40 ml-0.5">Driver</span></div>
      <button @click="router.push('/driver/profile')" class="pointer-events-auto w-11 h-11 rounded-full bg-[#58cc02] shadow-[0_2px_12px_rgba(0,0,0,0.1)] flex items-center justify-center text-white text-[13px] font-bold">
        {{ initials }}
      </button>
    </div>

    <!-- MOBILE: Bottom sheet -->
    <div class="md:hidden absolute bottom-0 left-0 right-0 z-10 bg-white rounded-t-[28px] shadow-[0_-4px_40px_rgba(0,0,0,0.1)]" style="padding-bottom: env(safe-area-inset-bottom, 0px);">
      <div class="flex justify-center pt-3 pb-2">
        <div class="w-9 h-[5px] rounded-full bg-[#1a1a1a]/10"></div>
      </div>
      <div class="px-5 pb-6">
        <!-- Online status -->
        <div v-if="isOnline" class="flex items-center gap-2 mb-4">
          <span class="w-2.5 h-2.5 rounded-full bg-[#58cc02] animate-pulse"></span>
          <span class="text-[13px] font-semibold text-[#58cc02]">You're online</span>
        </div>

        <!-- Go Online / Offline button -->
        <button @click="toggleOnline"
                class="w-full py-4 font-bold rounded-2xl text-[15px] transition-all active:scale-[0.98]"
                :class="isOnline
                  ? 'bg-[#1a1a1a] text-white'
                  : 'bg-[#58cc02] text-white shadow-[0_4px_16px_rgba(88,204,2,0.3)]'">
          {{ isOnline ? 'Go Offline' : 'Go Online' }}
        </button>

        <!-- Stats -->
        <div class="grid grid-cols-2 gap-3 mt-4">
          <button @click="router.push('/driver/earnings')" class="bg-[#f5f5f5] rounded-2xl p-4 text-left active:bg-[#f0f0f0] transition-colors">
            <div class="text-[11px] text-[#1a1a1a]/40 font-medium">Today</div>
            <div class="text-[22px] font-bold font-serif mt-0.5">{{ formatFare(todayEarnings) }}</div>
            <div class="text-[11px] text-[#1a1a1a]/40 mt-0.5">{{ todayTrips }} trips</div>
          </button>
          <div class="bg-[#f5f5f5] rounded-2xl p-4 text-left">
            <div class="text-[11px] text-[#1a1a1a]/40 font-medium">Rating</div>
            <div class="text-[22px] font-bold font-serif mt-0.5">{{ driver?.rating || '5.0' }} <span class="text-[16px]">★</span></div>
            <div class="text-[11px] text-[#1a1a1a]/40 mt-0.5">{{ driver?.total_trips || 0 }} total trips</div>
          </div>
        </div>

        <!-- Last ride -->
        <div v-if="lastRide" class="mt-4 bg-[#f5f5f5] rounded-2xl p-4">
          <div class="text-[11px] text-[#1a1a1a]/40 font-medium mb-2">Last ride</div>
          <div class="flex justify-between items-center">
            <div>
              <div class="text-[14px] font-semibold">{{ lastRide.pickup_address.split(',')[0] }} → {{ lastRide.dropoff_address.split(',')[0] }}</div>
              <div class="text-[11px] text-[#1a1a1a]/40 mt-0.5">{{ lastRide.distance_miles?.toFixed(1) }} mi</div>
            </div>
            <div class="text-[15px] font-bold font-serif text-[#58cc02]">+{{ formatFare(lastRide.fare_cents) }}</div>
          </div>
        </div>
        <div v-else class="mt-4 text-center text-[13px] text-[#1a1a1a]/40 py-4">
          No rides yet — go online to start earning
        </div>
      </div>
    </div>

    <!-- DESKTOP: Side panel -->
    <div class="hidden md:flex absolute inset-y-0 left-0 z-10 w-[400px] bg-white shadow-[4px_0_24px_rgba(0,0,0,0.08)] flex-col">
      <div class="px-6 pt-8 pb-4 flex items-center justify-between">
        <div class="font-serif text-[22px] font-bold tracking-tight">Ride<span class="text-[#58cc02]">Up</span> <span class="text-[12px] font-sans font-normal text-[#1a1a1a]/40 ml-0.5">Driver</span></div>
        <div class="flex items-center gap-2">
          <button @click="menuOpen = true" class="w-10 h-10 rounded-full hover:bg-[#1a1a1a]/5 flex items-center justify-center transition-colors">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect y="3" width="18" height="1.5" rx="0.75" fill="#1a1a1a"/><rect y="8.25" width="18" height="1.5" rx="0.75" fill="#1a1a1a"/><rect y="13.5" width="18" height="1.5" rx="0.75" fill="#1a1a1a"/></svg>
          </button>
          <button @click="router.push('/driver/profile')" class="w-10 h-10 rounded-full bg-[#58cc02] flex items-center justify-center text-white text-[13px] font-bold">
            {{ initials }}
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto px-6 pb-8">
        <div v-if="isOnline" class="flex items-center gap-2 mb-5">
          <span class="w-2.5 h-2.5 rounded-full bg-[#58cc02] animate-pulse"></span>
          <span class="text-[13px] font-semibold text-[#58cc02]">You're online — waiting for rides</span>
        </div>

        <button @click="toggleOnline"
                class="w-full py-4 font-bold rounded-2xl text-[15px] transition-all"
                :class="isOnline
                  ? 'bg-[#1a1a1a] text-white hover:bg-[#333]'
                  : 'bg-[#58cc02] text-white hover:bg-[#4ab300] shadow-[0_4px_16px_rgba(88,204,2,0.3)]'">
          {{ isOnline ? 'Go Offline' : 'Go Online' }}
        </button>

        <div class="grid grid-cols-2 gap-3 mt-5">
          <button @click="router.push('/driver/earnings')" class="bg-[#f5f5f5] rounded-2xl p-4 text-left hover:bg-[#f0f0f0] transition-colors">
            <div class="text-[11px] text-[#1a1a1a]/40 font-medium">Today</div>
            <div class="text-[24px] font-bold font-serif mt-0.5">{{ formatFare(todayEarnings) }}</div>
            <div class="text-[11px] text-[#1a1a1a]/40 mt-0.5">{{ todayTrips }} trips</div>
          </button>
          <div class="bg-[#f5f5f5] rounded-2xl p-4 text-left">
            <div class="text-[11px] text-[#1a1a1a]/40 font-medium">Rating</div>
            <div class="text-[24px] font-bold font-serif mt-0.5">{{ driver?.rating || '5.0' }} <span class="text-[16px]">★</span></div>
            <div class="text-[11px] text-[#1a1a1a]/40 mt-0.5">{{ driver?.total_trips || 0 }} total trips</div>
          </div>
        </div>

        <div v-if="lastRide" class="mt-4 bg-[#f5f5f5] rounded-2xl p-4">
          <div class="text-[11px] text-[#1a1a1a]/40 font-medium mb-2">Last ride</div>
          <div class="flex justify-between items-center">
            <div>
              <div class="text-[14px] font-semibold">{{ lastRide.pickup_address.split(',')[0] }} → {{ lastRide.dropoff_address.split(',')[0] }}</div>
              <div class="text-[11px] text-[#1a1a1a]/40 mt-0.5">{{ lastRide.distance_miles?.toFixed(1) }} mi</div>
            </div>
            <div class="text-[15px] font-bold font-serif text-[#58cc02]">+{{ formatFare(lastRide.fare_cents) }}</div>
          </div>
        </div>
        <div v-else class="mt-4 text-center text-[13px] text-[#1a1a1a]/40 py-6">
          No rides yet — go online to start earning
        </div>
      </div>
    </div>
  </div>
</template>
