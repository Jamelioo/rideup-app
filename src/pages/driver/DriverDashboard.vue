<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDriver } from '../../lib/useDriver'
import { useAuth } from '../../lib/useAuth'
import { supabase } from '../../lib/supabase'
import { DEMO_MODE } from '../../lib/demoMode'
import { formatFare, driverPayout } from '../../lib/pricing'
import { generateFakeEarnings } from '../../lib/demoDriverMode'
import GoogleMap from '../../components/GoogleMap.vue'
import HarborBackdrop from '../../components/HarborBackdrop.vue'
import SideMenu from '../../components/SideMenu.vue'
import DriverRideRequest from './DriverRideRequest.vue'
import DriverQuests from '../../components/DriverQuests.vue'

const router = useRouter()
const { user } = useAuth()
const { driver, isOnline, incomingRequest, currentRide, loading: driverLoading, acceptError, onlineError, fetchDriver, goOnline, goOffline } = useDriver()

const menuOpen = ref(false)
const todayEarnings = ref(0)
const todayTrips = ref(0)
const hoursOnline = ref(0)
const lastRide = ref(null)
const onlineStartTime = ref(null)
let hoursTimer = null

async function refreshStats() {
  if (DEMO_MODE) {
    const { today } = generateFakeEarnings()
    todayEarnings.value = today.reduce((sum, t) => sum + driverPayout(t), 0)
    todayTrips.value = today.length
    hoursOnline.value = 5.8
    lastRide.value = today[0]
    return
  }

  if (!driver.value?.id) return

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('rides')
    .select('fare_cents, driver_payout_cents, pickup_address, dropoff_address, distance_miles, completed_at')
    .eq('driver_id', driver.value.id)
    .eq('status', 'completed')
    .gte('completed_at', todayStart.toISOString())
    .order('completed_at', { ascending: false })

  if (error) {
    console.error('Error fetching today stats:', error)
    return
  }

  if (data && data.length > 0) {
    todayEarnings.value = data.reduce((sum, r) => sum + driverPayout(r), 0)
    todayTrips.value = data.length
    lastRide.value = data[0]
  } else {
    todayEarnings.value = 0
    todayTrips.value = 0
    lastRide.value = null
  }
}

function startHoursTracking() {
  if (!onlineStartTime.value) {
    onlineStartTime.value = Date.now()
  }
  hoursTimer = setInterval(() => {
    if (onlineStartTime.value) {
      const elapsed = (Date.now() - onlineStartTime.value) / 3600000
      hoursOnline.value = parseFloat((hoursOnline.value + elapsed).toFixed(1))
      onlineStartTime.value = Date.now()
    }
  }, 60000)
}

function stopHoursTracking() {
  if (hoursTimer) {
    clearInterval(hoursTimer)
    hoursTimer = null
  }
  if (onlineStartTime.value) {
    const elapsed = (Date.now() - onlineStartTime.value) / 3600000
    hoursOnline.value = parseFloat((hoursOnline.value + elapsed).toFixed(1))
    onlineStartTime.value = null
  }
}

onMounted(async () => {
  if (!DEMO_MODE && user.value) {
    await fetchDriver(user.value.id)
  }
  // A trip in progress always takes priority (e.g. after a reload or a dropped connection).
  if (currentRide.value) {
    router.replace('/driver/active-ride')
    return
  }
  await refreshStats()
  if (isOnline.value) {
    startHoursTracking()
  }
})

onUnmounted(() => {
  stopHoursTracking()
})

watch(currentRide, (newVal, oldVal) => {
  if (newVal && !oldVal) {
    // Ride was accepted — navigate to active ride
    router.push('/driver/active-ride')
  } else if (!newVal && oldVal) {
    refreshStats()
  }
})

async function toggleOnline() {
  if (isOnline.value) {
    await goOffline()
    stopHoursTracking()
  } else if (await goOnline()) {
    startHoursTracking()
  }
}

function handleRideAccepted() {
  router.push('/driver/active-ride')
}

const displayRating = computed(() => {
  if (driver.value?.rating != null) return driver.value.rating
  return 'New'
})

const initials = computed(() => {
  if (!driver.value?.name) return 'DR'
  return driver.value.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
})
</script>

<template>
  <div class="relative h-dvh bg-[var(--color-surface)] text-[var(--color-text-primary)] overflow-hidden">
    <SideMenu :is-open="menuOpen" @close="menuOpen = false" />

    <!-- Incoming ride request overlay -->
    <DriverRideRequest
      v-if="incomingRequest"
      :request="incomingRequest"
      @accepted="handleRideAccepted"
    />

    <div v-if="acceptError || onlineError" role="alert" class="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 right-4 z-50 bg-red-600 text-white text-[14px] font-medium rounded-xl px-4 py-3 shadow-lg flex items-start gap-3">
      <span class="flex-1">{{ acceptError || onlineError }}</span>
      <button @click="acceptError = ''; onlineError = ''" class="font-bold min-w-[32px] min-h-[32px]" aria-label="Dismiss">✕</button>
    </div>

    <!-- Map fills right side on desktop, top on mobile -->
    <div class="absolute inset-0 md:left-[400px]">
      <GoogleMap v-if="!DEMO_MODE" class="absolute inset-0 z-0" />
      <HarborBackdrop v-else />
    </div>

    <!-- MOBILE: Top bar -->
    <div class="md:hidden absolute top-0 left-0 right-0 z-10 px-5 pt-[max(2rem,env(safe-area-inset-top))] flex items-center justify-between pointer-events-none">
      <button @click="menuOpen = true" class="pointer-events-auto w-11 h-11 rounded-full bg-[var(--color-surface)] shadow-[0_2px_12px_rgba(0,0,0,0.1)] flex items-center justify-center active:scale-95 transition-transform" aria-label="Open menu">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect y="3" width="18" height="1.5" rx="0.75" fill="currentColor"/><rect y="8.25" width="18" height="1.5" rx="0.75" fill="currentColor"/><rect y="13.5" width="18" height="1.5" rx="0.75" fill="currentColor"/></svg>
      </button>
      <div class="pointer-events-auto bg-[var(--color-surface)] shadow-[0_2px_12px_rgba(0,0,0,0.1)] rounded-full px-5 py-2 text-[17px] font-bold tracking-tight">Ride<span class="text-[var(--color-brand)]">Up</span> <span class="text-[11px] font-sans font-normal text-[var(--color-text-muted)] ml-0.5">Driver</span></div>
      <button @click="router.push('/driver/profile')" class="pointer-events-auto w-11 h-11 rounded-full bg-[#2b8659] shadow-[0_2px_12px_rgba(0,0,0,0.1)] flex items-center justify-center text-white text-[13px] font-bold">
        {{ initials }}
      </button>
    </div>

    <!-- MOBILE: Bottom sheet -->
    <div class="md:hidden absolute bottom-0 left-0 right-0 z-10 bg-[var(--color-surface)] rounded-t-[28px] shadow-[0_-4px_40px_rgba(0,0,0,0.1)]" style="padding-bottom: env(safe-area-inset-bottom, 0px);">
      <div class="flex justify-center pt-3 pb-2">
        <div class="w-9 h-[5px] rounded-full bg-[var(--color-text-muted)]"></div>
      </div>
      <div class="px-5 pb-6">
        <div v-if="driverLoading" class="py-8 text-center text-[13px] text-[var(--color-text-muted)]">Loading...</div>
        <template v-else>

        <!-- Online/Offline Toggle -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <span v-if="isOnline" class="w-2.5 h-2.5 rounded-full bg-[#2b8659] animate-pulse"></span>
            <span v-else class="w-2.5 h-2.5 rounded-full bg-[var(--color-text-muted)]"></span>
            <span class="text-[15px] font-bold" :class="isOnline ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-muted)]'">
              {{ isOnline ? "You're Online" : "You're Offline" }}
            </span>
          </div>
          <button @click="toggleOnline"
                  class="relative w-[52px] h-[30px] rounded-full transition-colors duration-200 flex-shrink-0"
                  :class="isOnline ? 'bg-[#2b8659]' : 'bg-[var(--color-text-muted)]'" role="switch" :aria-checked="String(isOnline)" aria-label="Go online">
            <span class="absolute top-[3px] w-6 h-6 rounded-full bg-[var(--color-surface)] shadow-sm transition-transform duration-200"
                  :class="isOnline ? 'left-[25px]' : 'left-[3px]'"></span>
          </button>
        </div>

        <!-- Offline message -->
        <div v-if="!isOnline && !lastRide" class="bg-[var(--color-surface-secondary)] rounded-2xl p-5 mb-4 text-center">
          <p class="text-[14px] text-[var(--color-text-muted)]">Go online to start receiving ride requests</p>
        </div>

        <!-- Online waiting message -->
        <div v-if="isOnline && !currentRide && !incomingRequest" class="bg-[var(--color-surface-secondary)] rounded-2xl p-4 mb-4 flex items-center gap-3">
          <span class="w-3 h-3 rounded-full bg-[#2b8659] animate-pulse flex-shrink-0"></span>
          <p class="text-[14px] text-[var(--color-brand)] font-medium">Waiting for rides...</p>
        </div>

        <DriverQuests />

        <!-- Today's summary -->
        <div class="grid grid-cols-3 gap-2 mb-4">
          <div class="bg-[var(--color-surface-secondary)] rounded-2xl p-3 text-center">
            <div class="text-[11px] text-[var(--color-text-muted)] font-medium">Rides</div>
            <div class="text-[20px] font-bold mt-0.5">{{ todayTrips }}</div>
          </div>
          <div class="bg-[var(--color-surface-secondary)] rounded-2xl p-3 text-center">
            <div class="text-[11px] text-[var(--color-text-muted)] font-medium">Earnings</div>
            <div class="text-[20px] font-bold mt-0.5">{{ formatFare(todayEarnings) }}</div>
          </div>
          <div class="bg-[var(--color-surface-secondary)] rounded-2xl p-3 text-center">
            <div class="text-[11px] text-[var(--color-text-muted)] font-medium">Online</div>
            <div class="text-[20px] font-bold mt-0.5">{{ hoursOnline }}h</div>
          </div>
        </div>

        <!-- Rating -->
        <button @click="router.push('/driver/earnings')" class="w-full bg-[var(--color-surface-secondary)] rounded-2xl p-4 text-left active:bg-[var(--color-surface-secondary)] transition-colors mb-4 flex items-center justify-between">
          <div>
            <div class="text-[11px] text-[var(--color-text-muted)] font-medium">Rating</div>
            <div class="text-[18px] font-bold mt-0.5">{{ displayRating }} <span class="text-[14px]">&#9733;</span></div>
          </div>
          <div class="text-[11px] text-[var(--color-text-muted)]">{{ driver?.total_trips || 0 }} total trips</div>
        </button>

        <!-- Last ride -->
        <div v-if="lastRide" class="bg-[var(--color-surface-secondary)] rounded-2xl p-4">
          <div class="text-[11px] text-[var(--color-text-muted)] font-medium mb-2">Last ride</div>
          <div class="flex justify-between items-center">
            <div>
              <div class="text-[14px] font-semibold">{{ lastRide.rider_name || 'Rider' }}</div>
              <div class="text-[11px] text-[var(--color-text-muted)] mt-0.5">{{ lastRide.distance_miles != null ? lastRide.distance_miles.toFixed(1) : '0.0' }} mi</div>
            </div>
            <div class="text-[15px] font-bold text-[var(--color-brand)]">+{{ formatFare(driverPayout(lastRide)) }}</div>
          </div>
        </div>
        </template>
      </div>
    </div>

    <!-- DESKTOP: Side panel -->
    <div class="hidden md:flex absolute inset-y-0 left-0 z-10 w-[400px] bg-[var(--color-surface)] shadow-[4px_0_24px_rgba(0,0,0,0.08)] flex-col">
      <div class="px-6 pt-8 pb-4 flex items-center justify-between">
        <div class="text-[22px] font-bold tracking-tight">Ride<span class="text-[var(--color-brand)]">Up</span> <span class="text-[12px] font-sans font-normal text-[var(--color-text-muted)] ml-0.5">Driver</span></div>
        <div class="flex items-center gap-2">
          <button @click="menuOpen = true" class="w-10 h-10 rounded-full hover:bg-[var(--color-surface-secondary)] flex items-center justify-center transition-colors" aria-label="Open menu">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect y="3" width="18" height="1.5" rx="0.75" fill="currentColor"/><rect y="8.25" width="18" height="1.5" rx="0.75" fill="currentColor"/><rect y="13.5" width="18" height="1.5" rx="0.75" fill="currentColor"/></svg>
          </button>
          <button @click="router.push('/driver/profile')" class="w-10 h-10 rounded-full bg-[#2b8659] flex items-center justify-center text-white text-[13px] font-bold">
            {{ initials }}
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto px-6 pb-8">
        <div v-if="driverLoading" class="py-8 text-center text-[13px] text-[var(--color-text-muted)]">Loading...</div>
        <template v-else>

        <!-- Online/Offline Toggle -->
        <div class="flex items-center justify-between mb-5 bg-[var(--color-surface-secondary)] rounded-2xl p-4">
          <div class="flex items-center gap-3">
            <span v-if="isOnline" class="w-3 h-3 rounded-full bg-[#2b8659] animate-pulse"></span>
            <span v-else class="w-3 h-3 rounded-full bg-[var(--color-text-muted)]"></span>
            <span class="text-[16px] font-bold" :class="isOnline ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-muted)]'">
              {{ isOnline ? "You're Online" : "You're Offline" }}
            </span>
          </div>
          <button @click="toggleOnline"
                  class="relative w-[56px] h-[32px] rounded-full transition-colors duration-200 flex-shrink-0"
                  :class="isOnline ? 'bg-[#2b8659]' : 'bg-[var(--color-text-muted)]'" role="switch" :aria-checked="String(isOnline)" aria-label="Go online">
            <span class="absolute top-[3px] w-[26px] h-[26px] rounded-full bg-[var(--color-surface)] shadow-sm transition-transform duration-200"
                  :class="isOnline ? 'left-[27px]' : 'left-[3px]'"></span>
          </button>
        </div>

        <!-- Offline message -->
        <div v-if="!isOnline && !lastRide" class="bg-[var(--color-surface-secondary)] rounded-2xl p-6 mb-5 text-center">
          <p class="text-[14px] text-[var(--color-text-muted)]">Go online to start receiving ride requests</p>
        </div>

        <!-- Online waiting message -->
        <div v-if="isOnline && !currentRide && !incomingRequest" class="bg-[var(--color-surface-secondary)] rounded-2xl p-4 mb-5 flex items-center gap-3">
          <span class="w-3 h-3 rounded-full bg-[#2b8659] animate-pulse flex-shrink-0"></span>
          <p class="text-[14px] text-[var(--color-brand)] font-medium">Waiting for rides...</p>
        </div>

        <DriverQuests />

        <!-- Today's summary -->
        <div class="grid grid-cols-3 gap-3 mb-5">
          <div class="bg-[var(--color-surface-secondary)] rounded-2xl p-4 text-center">
            <div class="text-[11px] text-[var(--color-text-muted)] font-medium">Rides</div>
            <div class="text-[22px] font-bold mt-0.5">{{ todayTrips }}</div>
          </div>
          <div class="bg-[var(--color-surface-secondary)] rounded-2xl p-4 text-center">
            <div class="text-[11px] text-[var(--color-text-muted)] font-medium">Earnings</div>
            <div class="text-[22px] font-bold mt-0.5">{{ formatFare(todayEarnings) }}</div>
          </div>
          <div class="bg-[var(--color-surface-secondary)] rounded-2xl p-4 text-center">
            <div class="text-[11px] text-[var(--color-text-muted)] font-medium">Online</div>
            <div class="text-[22px] font-bold mt-0.5">{{ hoursOnline }}h</div>
          </div>
        </div>

        <!-- Rating -->
        <button @click="router.push('/driver/earnings')" class="w-full bg-[var(--color-surface-secondary)] rounded-2xl p-4 text-left hover:bg-[var(--color-surface-secondary)] transition-colors mb-5 flex items-center justify-between">
          <div>
            <div class="text-[11px] text-[var(--color-text-muted)] font-medium">Rating</div>
            <div class="text-[22px] font-bold mt-0.5">{{ displayRating }} <span class="text-[16px]">&#9733;</span></div>
          </div>
          <div class="text-[11px] text-[var(--color-text-muted)]">{{ driver?.total_trips || 0 }} total trips</div>
        </button>

        <!-- Last ride -->
        <div v-if="lastRide" class="bg-[var(--color-surface-secondary)] rounded-2xl p-4">
          <div class="text-[11px] text-[var(--color-text-muted)] font-medium mb-2">Last ride</div>
          <div class="flex justify-between items-center">
            <div>
              <div class="text-[14px] font-semibold">{{ lastRide.rider_name || 'Rider' }}</div>
              <div class="text-[11px] text-[var(--color-text-muted)] mt-0.5">{{ lastRide.distance_miles != null ? lastRide.distance_miles.toFixed(1) : '0.0' }} mi</div>
            </div>
            <div class="text-[15px] font-bold text-[var(--color-brand)]">+{{ formatFare(driverPayout(lastRide)) }}</div>
          </div>
        </div>
        <div v-else-if="isOnline" class="text-center text-[13px] text-[var(--color-text-muted)] py-4">
          No rides yet today
        </div>
        </template>
      </div>
    </div>
  </div>
</template>
