<script setup>
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'

// "Everything OK?" banner for an automatic trip check-in (the trip stopped moving or is running very long).
// "I'm OK" answers it; "Get help" opens the safety toolkit (emergency call, share trip, report).
const props = defineProps({ ride: { type: Object, default: null } })
const emit = defineEmits(['help'])
const answered = ref(false)
const busy = ref(false)

const show = computed(() => !answered.value && props.ride?.status === 'in_progress' &&
  props.ride?.safety_checkin_at && !props.ride?.safety_checkin_ok_at)
const message = computed(() => props.ride?.safety_checkin_reason === 'stopped'
  ? 'Your trip seems to have stopped for a while.'
  : 'This trip is taking much longer than expected.')

async function ok() {
  busy.value = true
  const { error } = await supabase.rpc('ride_checkin_ok', { p_ride_id: props.ride.id })
  busy.value = false
  if (!error) answered.value = true
}
</script>

<template>
  <div v-if="show" role="alertdialog" aria-labelledby="checkin-title" aria-describedby="checkin-text"
       class="absolute left-3 right-3 top-[max(4.5rem,calc(env(safe-area-inset-top)+4rem))] z-40 rounded-2xl bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)] shadow-xl p-4">
    <p id="checkin-title" class="text-[16px] font-bold">Everything OK?</p>
    <p id="checkin-text" class="text-[13px] text-[var(--color-text-secondary)] mt-0.5 mb-3">{{ message }} If you need help, RideUp support and emergency services are one tap away.</p>
    <div class="flex gap-2">
      <button @click="ok" :disabled="busy" class="flex-1 py-3 rounded-xl bg-[#2b8659] text-white font-bold text-[14px] disabled:opacity-60">I’m OK</button>
      <button @click="emit('help')" class="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold text-[14px]">Get help</button>
    </div>
  </div>
</template>
