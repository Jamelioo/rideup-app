<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import DriverInfoCard from './DriverInfoCard.vue'

const props = defineProps({
  rideStatus: { type: String, default: 'driver_enroute' }, // driver_enroute | driver_arrived | on_trip
  driverName: { type: String, default: 'Marcus Rolle' },
  driverRating: { type: Number, default: 4.9 },
  driverPhone: { type: String, default: '+12424529911' },
  driverPhoto: { type: String, default: null },
  vehicle: { type: String, default: 'White Toyota Camry' },
  plate: { type: String, default: 'AB-1234' },
  initialEta: { type: Number, default: 4 },
})

const emit = defineEmits(['cancel', 'message'])

const etaSeconds = ref(props.initialEta * 60)
let countdownInterval = null

const etaDisplay = computed(() => {
  const mins = Math.ceil(etaSeconds.value / 60)
  if (mins <= 0) return 'Arriving now'
  return `${mins} min${mins === 1 ? '' : 's'}`
})

const statusText = computed(() => {
  switch (props.rideStatus) {
    case 'driver_arrived': return 'Driver has arrived'
    case 'on_trip': return 'On trip'
    default: return 'Driver is on the way'
  }
})

const statusColor = computed(() => {
  switch (props.rideStatus) {
    case 'driver_arrived': return 'bg-[#2b8659]'
    case 'on_trip': return 'bg-[var(--color-text-primary)]'
    default: return 'bg-[#2b8659]/80'
  }
})

const showCancel = computed(() => props.rideStatus === 'driver_enroute')

onMounted(() => {
  countdownInterval = setInterval(() => {
    if (etaSeconds.value > 0) {
      etaSeconds.value -= 1
    }
  }, 1000)
})

onUnmounted(() => {
  if (countdownInterval) clearInterval(countdownInterval)
})
</script>

<template>
  <div class="absolute bottom-0 left-0 right-0 z-20">
    <!-- Status pill at top of card -->
    <div class="flex justify-center mb-3">
      <div :class="statusColor" class="px-4 py-1.5 rounded-full text-white text-[13px] font-semibold shadow-lg">
        {{ statusText }}
      </div>
    </div>

    <!-- Main driver card -->
    <div class="bg-[var(--color-surface)] rounded-t-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.12)] px-6 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <!-- Handle bar -->
      <div class="flex justify-center mb-4">
        <div class="w-10 h-1 rounded-full bg-[var(--color-surface-secondary)]"></div>
      </div>

      <!-- ETA display -->
      <div class="text-center mb-5" v-if="rideStatus !== 'on_trip'">
        <div class="text-4xl font-bold text-[var(--color-text-primary)] tracking-tight">{{ etaDisplay }}</div>
        <div class="text-[13px] text-[var(--color-text-secondary)] mt-1">Estimated arrival</div>
      </div>

      <!-- Driver info -->
      <DriverInfoCard
        :name="driverName"
        :rating="driverRating"
        :vehicle="vehicle"
        :plate="plate"
        :photo="driverPhoto"
      />

      <!-- Action buttons -->
      <div class="flex gap-2.5 mt-5">
        <a
          :href="'tel:' + driverPhone"
          class="flex-1 flex items-center justify-center gap-2 py-3 bg-[#2b8659] text-white font-bold rounded-xl text-[13px] active:opacity-80 transition-opacity"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          Call
        </a>
        <button
          @click="emit('message')"
          class="flex-1 flex items-center justify-center gap-2 py-3 bg-[#2b8659]/10 text-[#236e49] font-bold rounded-xl text-[13px] active:opacity-80 transition-opacity"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Message
        </button>
      </div>

      <!-- Cancel button (only before pickup) -->
      <button
        v-if="showCancel"
        @click="emit('cancel')"
        class="w-full mt-4 py-3 text-[13px] text-[var(--color-text-secondary)] underline underline-offset-2 transition-opacity active:opacity-60 min-h-[44px]"
      >
        Cancel ride
      </button>
    </div>
  </div>
</template>
