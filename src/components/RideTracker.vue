<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import DriverInfoCard from './DriverInfoCard.vue'
import { FREE_WAIT_SECONDS } from '../lib/policy'
import { formatClock } from '../lib/eta'

// Rider's trip card (Uber-style): live ETA, who's coming, plate, contact, wait timer, PIN, cancel.
const props = defineProps({
  rideStatus: { type: String, default: 'driver_enroute' }, // driver_enroute | driver_arrived | on_trip | completed
  driverName: { type: String, default: 'Your driver' },
  driverRating: { type: Number, default: null },
  driverPhone: { type: String, default: '' },
  driverPhoto: { type: String, default: null },
  vehicle: { type: String, default: '' },
  plate: { type: String, default: '' },
  etaMinutes: { type: Number, default: null },  // live: to pickup while en route, to drop-off on trip
  arrivedAt: { type: String, default: null },
  pin: { type: String, default: '' },
  unread: { type: Number, default: 0 },
})

const emit = defineEmits(['cancel', 'message'])

const now = ref(Date.now())
let ticker = null
onMounted(() => { ticker = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => clearInterval(ticker))

const statusText = computed(() => ({
  driver_arrived: 'Your driver is here',
  on_trip: 'On trip',
  completed: 'You’ve arrived',
}[props.rideStatus] || 'Driver is on the way'))

const headline = computed(() => {
  if (props.rideStatus === 'driver_arrived') return 'Meet your driver'
  if (props.rideStatus === 'completed') return 'You’ve arrived'
  if (props.etaMinutes == null) return props.rideStatus === 'on_trip' ? 'On your way' : 'Arriving soon'
  if (props.etaMinutes <= 1) return props.rideStatus === 'on_trip' ? 'Arriving now' : 'Arriving now'
  return `${props.etaMinutes} min`
})

const subline = computed(() => {
  if (props.rideStatus === 'on_trip') return props.etaMinutes != null ? 'to your destination' : 'Enjoy your ride'
  if (props.rideStatus === 'driver_arrived') return 'Check the plate before you get in'
  return 'until pickup · check the plate before you get in'
})

// Free waiting time once the driver arrives (then the driver may cancel as a no-show).
const waitLeft = computed(() => {
  if (props.rideStatus !== 'driver_arrived' || !props.arrivedAt) return null
  return FREE_WAIT_SECONDS - Math.floor((now.value - new Date(props.arrivedAt).getTime()) / 1000)
})

const showCancel = computed(() => ['driver_enroute', 'driver_arrived'].includes(props.rideStatus))
const showPin = computed(() => props.pin && ['driver_enroute', 'driver_arrived'].includes(props.rideStatus))
</script>

<template>
  <div class="absolute bottom-0 left-0 right-0 z-20">
    <div class="flex justify-center mb-3">
      <div class="px-4 py-1.5 rounded-full text-white text-[13px] font-semibold shadow-lg"
           :class="rideStatus === 'on_trip' ? 'bg-[#191f1c]' : 'bg-[#2b8659]'" role="status" aria-live="polite">
        {{ statusText }}
      </div>
    </div>

    <div class="bg-[var(--color-surface)] rounded-t-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.12)] px-6 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div class="flex justify-center mb-4">
        <div class="w-10 h-1 rounded-full bg-[var(--color-border)]"></div>
      </div>

      <div class="text-center mb-4">
        <div class="text-[34px] leading-tight font-bold text-[var(--color-text-primary)] tracking-tight">{{ headline }}</div>
        <div class="text-[13px] text-[var(--color-text-secondary)] mt-1">{{ subline }}</div>
      </div>

      <!-- Wait timer -->
      <div v-if="waitLeft !== null" class="mb-4 rounded-xl px-4 py-3 text-[13px]"
           :class="waitLeft > 0 ? 'bg-[#2b8659]/10 text-[var(--color-text-primary)]' : 'bg-amber-500/15 text-[var(--color-text-primary)]'">
        <template v-if="waitLeft > 0">
          Free waiting time: <strong>{{ formatClock(waitLeft) }}</strong> left
        </template>
        <template v-else>
          Free waiting time is over. Please head to your driver now. They may cancel and a no-show fee may apply.
        </template>
      </div>

      <!-- Pickup PIN -->
      <div v-if="showPin" class="mb-4 flex items-center justify-between rounded-xl border border-[var(--color-border)] px-4 py-3">
        <div class="text-[13px] text-[var(--color-text-secondary)]">Tell your driver this PIN to start the trip</div>
        <div class="text-[22px] font-extrabold tracking-[0.3em] text-[var(--color-text-primary)]" aria-label="Pickup PIN">{{ pin }}</div>
      </div>

      <DriverInfoCard :name="driverName" :rating="driverRating" :vehicle="vehicle" :plate="plate" :photo="driverPhoto" />

      <div v-if="rideStatus !== 'completed'" class="flex gap-2.5 mt-5">
        <a
          v-if="driverPhone"
          :href="'tel:' + driverPhone"
          class="flex-1 flex items-center justify-center gap-2 py-3 min-h-[48px] bg-[#2b8659] text-white font-bold rounded-xl text-[14px] active:opacity-80"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
          Call
        </a>
        <button
          @click="emit('message')"
          class="relative flex-1 flex items-center justify-center gap-2 py-3 min-h-[48px] bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border)] font-bold rounded-xl text-[14px] active:opacity-80"
          :aria-label="unread ? `Message driver, ${unread} unread` : 'Message driver'"
        >
          <svg class="w-4 h-4 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          Message
          <span v-if="unread" class="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-red-500 text-white text-[12px] font-bold flex items-center justify-center" aria-hidden="true">{{ unread }}</span>
        </button>
      </div>

      <button
        v-if="showCancel"
        @click="emit('cancel')"
        class="w-full mt-3 py-3 min-h-[44px] text-[13px] text-[var(--color-text-secondary)] underline underline-offset-2 active:opacity-60"
      >
        Cancel ride
      </button>
    </div>
  </div>
</template>
