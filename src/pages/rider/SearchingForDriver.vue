<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../../lib/supabase'
import { DEMO_MODE } from '../../lib/demoMode'
import HarborBackdrop from '../../components/HarborBackdrop.vue'

const props = defineProps({ rideId: { type: String, required: true } })
const emit = defineEmits(['matched', 'cancelled'])
const router = useRouter()
const ride = ref(null)
const driverFound = ref(false)
const timedOut = ref(false)
const elapsedSeconds = ref(0)
let channel = null
let demoTimer = null
let timeoutTimer = null
let elapsedTimer = null

function navigateToActiveRide(matchData) {
  driverFound.value = true
  // Parse vehicle string like "Silver Toyota Corolla · TX 4471"
  const parts = (matchData.vehicle || '').split(' \u00b7 ')
  const vehicleName = parts[0] || 'Silver Toyota Corolla'
  const plateNum = parts[1] || 'TX 4471'

  setTimeout(() => {
    router.push({
      name: 'active-ride',
      params: { rideId: matchData.id || props.rideId },
      query: {
        driverName: matchData.driver_name || 'Marcus Rolle',
        rating: matchData.rating || 4.9,
        vehicle: vehicleName,
        plate: plateNum,
        eta: matchData.eta_minutes || 4,
      },
    })
  }, 1500) // Brief pause to show "Driver found" before navigating
}

onMounted(async () => {
  if (DEMO_MODE) {
    demoTimer = setTimeout(() => {
      const matchData = {
        id: props.rideId, status: 'accepted', driver_name: 'Marcus Rolle',
        vehicle: 'Silver Toyota Corolla \u00b7 TX 4471', rating: 4.9, eta_minutes: 4, demo: true,
      }
      emit('matched', matchData)
      navigateToActiveRide(matchData)
    }, 3500)
    return
  }
  // Start elapsed counter
  elapsedTimer = setInterval(() => {
    elapsedSeconds.value++
  }, 1000)

  // 90-second timeout
  timeoutTimer = setTimeout(() => {
    timedOut.value = true
    if (elapsedTimer) clearInterval(elapsedTimer)
  }, 90000)

  const { data } = await supabase.from('rides').select('*').eq('id', props.rideId).single()
  ride.value = data
  channel = supabase.channel(`ride-${props.rideId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${props.rideId}` }, (payload) => {
      ride.value = payload.new
      if (payload.new.status === 'accepted') {
        emit('matched', payload.new)
        navigateToActiveRide(payload.new)
      }
    }).subscribe()
})

onUnmounted(() => {
  if (channel) supabase.removeChannel(channel)
  if (demoTimer) clearTimeout(demoTimer)
  if (timeoutTimer) clearTimeout(timeoutTimer)
  if (elapsedTimer) clearInterval(elapsedTimer)
})

function retrySearch() {
  timedOut.value = false
  elapsedSeconds.value = 0
  elapsedTimer = setInterval(() => { elapsedSeconds.value++ }, 1000)
  timeoutTimer = setTimeout(() => {
    timedOut.value = true
    if (elapsedTimer) clearInterval(elapsedTimer)
  }, 90000)
}

async function cancelRequest() {
  if (demoTimer) clearTimeout(demoTimer)
  if (!DEMO_MODE) await supabase.from('rides').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', props.rideId)
  emit('cancelled')
}
</script>

<template>
  <div class="relative min-h-screen bg-[var(--color-surface)] text-[var(--color-text-primary)] flex flex-col overflow-hidden">
    <HarborBackdrop />
    <div class="relative px-6 pt-8 pb-4 flex items-center gap-3">
      <button @click="cancelRequest" class="w-10 h-10 rounded-full bg-[#191f1c]/5 border border-[var(--color-border)] flex items-center justify-center text-base" aria-label="Cancel">←</button>
      <div class="text-lg font-semibold">Ride<span class="text-[#2b8659]">Up</span></div>
    </div>
    <div class="relative flex-1 flex flex-col items-center justify-center gap-6 px-6">
      <template v-if="!timedOut">
        <div class="relative w-28 h-28 rounded-full border border-[#2b8659]/35 flex items-center justify-center">
          <div class="absolute -inset-4 rounded-full border border-[#2b8659]/20"></div>
          <div class="absolute -inset-8 rounded-full border border-[#2b8659]/10"></div>
          <div class="w-12 h-12 bg-[#2b8659] rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(88,204,2,0.35)] animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 17h.01M16 17h.01M3 11l1.5-5A2 2 0 016.4 4h11.2a2 2 0 011.9 1.38L21 11M3 11v5a1 1 0 001 1h1m16-6v5a1 1 0 01-1 1h-1M3 11h18" />
            </svg>
          </div>
        </div>
        <div class="text-center">
          <div class="text-xl font-medium mb-1.5">{{ driverFound ? 'Driver found' : 'Looking for a driver' }}</div>
          <div class="text-[#191f1c]/45 text-[13px]">{{ driverFound ? 'Connecting you now...' : (DEMO_MODE ? 'Connecting you with a nearby driver...' : 'Connecting you with a nearby driver') }}</div>
          <p v-if="!timedOut && elapsedSeconds > 10" class="text-[var(--color-text-muted)] text-xs mt-2">
            Searching... {{ elapsedSeconds }}s
          </p>
        </div>
        <button @click="cancelRequest" class="text-[#191f1c]/55 text-[13px] underline underline-offset-2 mt-2 py-2 px-4">Cancel request</button>
      </template>
      <div v-if="timedOut" class="text-center px-6">
        <div class="w-16 h-16 rounded-full bg-[var(--color-surface-secondary)] flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 class="text-xl font-bold text-[var(--color-text-primary)] mb-2">No drivers available</h2>
        <p class="text-[var(--color-text-muted)] text-sm mb-6">All drivers are currently busy. Please try again in a moment.</p>
        <button @click="retrySearch" class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px] mb-3">
          Try again
        </button>
        <button @click="emit('cancelled')" class="w-full py-3 text-[var(--color-text-muted)] text-[14px] font-medium">
          Cancel ride
        </button>
      </div>
    </div>
  </div>
</template>
