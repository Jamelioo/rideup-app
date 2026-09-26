<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useDriver } from '../../lib/useDriver'
import { formatFare } from '../../lib/pricing'

const props = defineProps({
  request: { type: Object, required: true },
})

const emit = defineEmits(['accepted'])
const { acceptRide, declineRide } = useDriver()

const timeLeft = ref(15)
const progress = ref(100)
let timer = null

onMounted(() => {
  // Countdown timer
  timer = setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0) {
      clearInterval(timer)
      handleDecline()
    }
  }, 1000)

  // Progress animation
  const start = Date.now()
  const total = 15000
  function update() {
    const elapsed = Date.now() - start
    progress.value = Math.max(0, 100 - (elapsed / total) * 100)
    if (elapsed < total) requestAnimationFrame(update)
  }
  requestAnimationFrame(update)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

async function handleAccept() {
  if (timer) clearInterval(timer)
  await acceptRide(props.request)
  emit('accepted')
}

function handleDecline() {
  if (timer) clearInterval(timer)
  declineRide(props.request)
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-white flex flex-col">
    <!-- Countdown -->
    <div class="flex-shrink-0 pt-[max(3rem,env(safe-area-inset-top))] pb-4 flex flex-col items-center">
      <div class="relative w-24 h-24">
        <svg class="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#f5f5f5" stroke-width="6" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="#58cc02" stroke-width="6"
                  stroke-linecap="round"
                  :stroke-dasharray="276.46"
                  :stroke-dashoffset="276.46 * (1 - progress / 100)" />
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-[28px] font-bold font-serif">{{ timeLeft }}</span>
        </div>
      </div>
      <p class="text-[13px] text-[#1a1a1a]/50 mt-2">New ride request</p>
    </div>

    <!-- Ride details -->
    <div class="flex-1 px-6 flex flex-col">
      <div class="max-w-md mx-auto w-full flex-1 flex flex-col">
        <!-- Rider info -->
        <div class="bg-[#f5f5f5] rounded-2xl p-5 mb-4">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-full bg-[#58cc02]/15 flex items-center justify-center text-xl">👤</div>
              <div>
                <div class="text-[16px] font-bold">{{ request.rider_name }}</div>
                <div class="text-[13px] text-[#1a1a1a]/50">★ {{ request.rider_rating }}</div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-[22px] font-bold font-serif text-[#58cc02]">{{ formatFare(request.fare_cents) }}</div>
              <div class="text-[11px] text-[#1a1a1a]/40">est. fare</div>
            </div>
          </div>

          <!-- Route -->
          <div class="flex gap-3">
            <div class="flex flex-col items-center pt-[6px]">
              <div class="w-[10px] h-[10px] rounded-full border-[2.5px] border-[#58cc02] bg-white flex-shrink-0"></div>
              <div class="w-[2px] flex-1 my-1 bg-[#1a1a1a]/10 rounded-full min-h-[16px]"></div>
              <div class="w-[10px] h-[10px] rounded-[2px] bg-[#1a1a1a] flex-shrink-0"></div>
            </div>
            <div class="flex-1 space-y-3">
              <div>
                <div class="text-[11px] text-[#1a1a1a]/40 font-medium">PICKUP</div>
                <div class="text-[14px] font-semibold">{{ request.pickup_address }}</div>
              </div>
              <div>
                <div class="text-[11px] text-[#1a1a1a]/40 font-medium">DROPOFF</div>
                <div class="text-[14px] font-semibold">{{ request.dropoff_address }}</div>
              </div>
            </div>
          </div>

          <!-- Distance / time -->
          <div class="flex gap-4 mt-4 pt-4 border-t border-[#1a1a1a]/8">
            <div class="flex items-center gap-1.5">
              <svg class="w-4 h-4 text-[#1a1a1a]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
              <span class="text-[13px] font-semibold text-[#1a1a1a]/60">{{ request.distance_miles?.toFixed(1) }} mi</span>
            </div>
            <div class="flex items-center gap-1.5">
              <svg class="w-4 h-4 text-[#1a1a1a]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span class="text-[13px] font-semibold text-[#1a1a1a]/60">~{{ Math.round(request.duration_minutes) }} min</span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="mt-auto pb-6 max-w-md mx-auto w-full" style="padding-bottom: max(1.5rem, env(safe-area-inset-bottom));">
          <button @click="handleAccept"
                  class="w-full py-4 bg-[#58cc02] text-white font-bold rounded-2xl text-[16px] transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(88,204,2,0.3)]">
            Accept Ride
          </button>
          <button @click="handleDecline"
                  class="w-full py-3 mt-2 text-[#1a1a1a]/40 font-semibold text-[14px] active:text-[#1a1a1a]/60">
            Decline
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
