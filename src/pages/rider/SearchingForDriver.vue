<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { supabase } from '../../lib/supabase'
import { DEMO_MODE } from '../../lib/demoMode'
import HarborBackdrop from '../../components/HarborBackdrop.vue'

const props = defineProps({ rideId: { type: String, required: true } })
const emit = defineEmits(['matched', 'cancelled'])
const ride = ref(null)
let channel = null
let demoTimer = null

onMounted(async () => {
  if (DEMO_MODE) {
    demoTimer = setTimeout(() => {
      emit('matched', {
        id: props.rideId, status: 'accepted', driver_name: 'Marcus Rolle',
        vehicle: 'Silver Toyota Corolla · TX 4471', rating: 4.9, eta_minutes: 4, demo: true,
      })
    }, 3500)
    return
  }
  const { data } = await supabase.from('rides').select('*').eq('id', props.rideId).single()
  ride.value = data
  channel = supabase.channel(`ride-${props.rideId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${props.rideId}` }, (payload) => {
      ride.value = payload.new
      if (payload.new.status === 'accepted') emit('matched', payload.new)
    }).subscribe()
})

onUnmounted(() => { if (channel) supabase.removeChannel(channel); if (demoTimer) clearTimeout(demoTimer) })

async function cancelRequest() {
  if (demoTimer) clearTimeout(demoTimer)
  if (!DEMO_MODE) await supabase.from('rides').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', props.rideId)
  emit('cancelled')
}
</script>

<template>
  <div class="relative min-h-screen bg-white text-[#191f1c] flex flex-col overflow-hidden">
    <HarborBackdrop />
    <div class="relative px-6 pt-8 pb-4 flex items-center gap-3">
      <button @click="cancelRequest" class="w-10 h-10 rounded-full bg-[#191f1c]/5 border border-[#191f1c]/8 flex items-center justify-center text-base" aria-label="Cancel">←</button>
      <div class="text-lg font-semibold">Ride<span class="text-[#2b8659]">Up</span></div>
    </div>
    <div class="relative flex-1 flex flex-col items-center justify-center gap-6 px-6">
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
        <div class="text-xl font-medium mb-1.5">Looking for a driver</div>
        <div class="text-[#191f1c]/45 text-[13px]">{{ DEMO_MODE ? 'Connecting you with a nearby driver...' : 'Connecting you with a nearby driver' }}</div>
      </div>
      <button @click="cancelRequest" class="text-[#191f1c]/55 text-[13px] underline underline-offset-2 mt-2 py-2 px-4">Cancel request</button>
    </div>
  </div>
</template>
