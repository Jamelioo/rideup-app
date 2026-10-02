<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDriver } from '../../lib/useDriver'
import { formatFare, driverPayout } from '../../lib/pricing'

// Uber-style trip offer: what the driver earns, how far the pickup is, and how long the trip runs.
const props = defineProps({
  request: { type: Object, required: true },
})

const emit = defineEmits(['accepted', 'failed'])
const { acceptRide, declineRide } = useDriver()

const OFFER_SECONDS = 15
const timeLeft = ref(OFFER_SECONDS)
const progress = ref(100)
const accepting = ref(false)
let timer = null
let animFrame = null

const earnings = computed(() => driverPayout(props.request))
const pickupMiles = computed(() => props.request.pickup_distance_miles != null ? Number(props.request.pickup_distance_miles) : null)
// ~18 mph average with road detours, same estimate as the rider's ETA
const pickupMinutes = computed(() => pickupMiles.value == null ? null : Math.max(1, Math.round((pickupMiles.value * 1.35 / 18) * 60)))
const tripMiles = computed(() => props.request.distance_miles != null ? Number(props.request.distance_miles).toFixed(1) : '?')
const tripMinutes = computed(() => props.request.duration_minutes != null ? Math.round(Number(props.request.duration_minutes)) : '?')
const riderName = computed(() => props.request.rider_first_name || props.request.rider_name?.split(' ')[0] || 'Rider')
const riderRating = computed(() => props.request.rider_rating != null ? Number(props.request.rider_rating).toFixed(1) : 'New')

onMounted(() => {
  if (navigator.vibrate) navigator.vibrate([200, 100, 200])
  timer = setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0) {
      clearInterval(timer)
      if (!accepting.value) handleDecline()
    }
  }, 1000)
  const start = Date.now()
  const total = OFFER_SECONDS * 1000
  const update = () => {
    const elapsed = Date.now() - start
    progress.value = Math.max(0, 100 - (elapsed / total) * 100)
    if (elapsed < total) animFrame = requestAnimationFrame(update)
  }
  animFrame = requestAnimationFrame(update)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  if (animFrame) cancelAnimationFrame(animFrame)
})

async function handleAccept() {
  if (accepting.value) return
  accepting.value = true
  if (timer) clearInterval(timer)
  const ok = await acceptRide(props.request)
  accepting.value = false
  emit(ok ? 'accepted' : 'failed')
}

function handleDecline() {
  if (timer) clearInterval(timer)
  declineRide(props.request)
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-[var(--color-surface)] text-[var(--color-text-primary)] flex flex-col" role="dialog" aria-modal="true" aria-label="New trip request">
    <div class="flex-shrink-0 pt-[max(2.5rem,env(safe-area-inset-top))] pb-3 flex flex-col items-center">
      <div class="relative w-20 h-20">
        <svg class="w-20 h-20 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" class="text-[var(--color-border)]" stroke-width="6" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="#2b8659" stroke-width="6" stroke-linecap="round"
                  :stroke-dasharray="276.46" :stroke-dashoffset="276.46 * (1 - progress / 100)" />
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-[24px] font-bold" :aria-label="`${timeLeft} seconds to respond`">{{ timeLeft }}</span>
        </div>
      </div>
      <p class="text-[13px] text-[var(--color-text-secondary)] mt-2">New trip request</p>
    </div>

    <div class="flex-1 px-6 flex flex-col overflow-y-auto">
      <div class="max-w-md mx-auto w-full flex-1 flex flex-col">
        <!-- Earnings first, like Uber -->
        <div class="text-center mb-4">
          <div class="text-[40px] leading-none font-extrabold text-[var(--color-text-primary)]">{{ formatFare(earnings) }}</div>
          <div class="text-[13px] text-[var(--color-text-secondary)] mt-1.5">
            Your earnings · {{ formatFare(request.fare_cents) }} fare
            <span v-if="request.vehicle_type && request.vehicle_type !== 'standard'" class="ml-1 px-1.5 py-0.5 rounded bg-[var(--color-surface-secondary)] text-[11px] font-bold uppercase">{{ request.vehicle_type }}</span>
          </div>
        </div>

        <div class="bg-[var(--color-surface-secondary)] rounded-2xl p-5 mb-4">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 rounded-full bg-[#2b8659]/15 flex items-center justify-center text-[var(--color-brand)] font-bold" aria-hidden="true">
                {{ riderName.charAt(0).toUpperCase() }}
              </div>
              <div>
                <div class="text-[16px] font-bold">{{ riderName }}</div>
                <div class="text-[13px] text-[var(--color-text-secondary)]"><span class="text-amber-500" aria-hidden="true">&#9733;</span> {{ riderRating }}</div>
              </div>
            </div>
            <div v-if="pickupMiles != null" class="text-right">
              <div class="text-[15px] font-bold">{{ pickupMinutes }} min away</div>
              <div class="text-[12px] text-[var(--color-text-secondary)]">{{ pickupMiles.toFixed(1) }} mi to pickup</div>
            </div>
          </div>

          <div class="flex gap-3">
            <div class="flex flex-col items-center pt-[6px]" aria-hidden="true">
              <div class="w-[10px] h-[10px] rounded-full border-[2.5px] border-[#2b8659] bg-[var(--color-surface)] flex-shrink-0"></div>
              <div class="w-[2px] flex-1 my-1 bg-[var(--color-border)] rounded-full min-h-[16px]"></div>
              <div class="w-[10px] h-[10px] rounded-[2px] bg-[var(--color-text-primary)] flex-shrink-0"></div>
            </div>
            <div class="flex-1 space-y-3">
              <div>
                <div class="text-[11px] text-[var(--color-text-muted)] font-semibold uppercase tracking-wide">Pickup</div>
                <div class="text-[14px] font-semibold">{{ request.pickup_address }}</div>
              </div>
              <div>
                <div class="text-[11px] text-[var(--color-text-muted)] font-semibold uppercase tracking-wide">Drop-off</div>
                <div class="text-[14px] font-semibold">{{ request.dropoff_address }}</div>
              </div>
            </div>
          </div>

          <div class="flex gap-4 mt-4 pt-4 border-t border-[var(--color-border)] text-[13px] font-semibold text-[var(--color-text-secondary)]">
            <span>Trip: {{ tripMiles }} mi</span>
            <span>~{{ tripMinutes }} min</span>
          </div>
        </div>

        <div class="mt-auto max-w-md mx-auto w-full" style="padding-bottom: max(1.5rem, env(safe-area-inset-bottom));">
          <button @click="handleAccept" :disabled="accepting"
                  class="w-full py-4 bg-[#2b8659] text-white font-bold rounded-2xl text-[16px] active:scale-[0.98] shadow-[0_4px_16px_rgba(43,134,89,0.3)] disabled:opacity-70">
            {{ accepting ? 'Confirming the rider’s payment…' : 'Accept' }}
          </button>
          <button @click="handleDecline" :disabled="accepting"
                  class="w-full py-3 mt-2 text-[var(--color-text-secondary)] font-semibold text-[14px] rounded-2xl disabled:opacity-50">
            Decline
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
