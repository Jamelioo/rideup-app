<script setup>
import { ref } from 'vue'
import { apiPost } from '../lib/api'
import { formatFare } from '../lib/pricing'
import { DEMO_MODE } from '../lib/demoMode'

// Driver app: "Rider didn't pay" on a cash trip, up to 24 hours after drop-off. Asks first, then reports it:
// RideUp follows up with the rider and turns cash off for them, and the driver owes RideUp nothing for the trip.
const props = defineProps({
  rideId: { type: String, required: true },
  riderName: { type: String, default: 'The rider' },
  amountCents: { type: Number, default: 0 },
  buttonClass: { type: String, default: '' },
})
const emit = defineEmits(['reported'])
const open = ref(false)
const busy = ref(false)
const error = ref('')

function ask() {
  error.value = ''
  open.value = true
}

async function report() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    if (!DEMO_MODE) {
      const res = await apiPost('/api/cash-unpaid', { rideId: props.rideId })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Couldn’t send the report. Please try again.')
    }
    open.value = false
    emit('reported')
  } catch (err) {
    error.value = err.message || 'Couldn’t send the report. Please try again.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button type="button" @click="ask" :class="buttonClass"><slot>Rider didn’t pay?</slot></button>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center px-4 pb-6" @click.self="open = false">
      <div v-modal="() => (open = false)" role="alertdialog" aria-modal="true" aria-labelledby="unpaid-title" aria-describedby="unpaid-body"
           class="bg-[var(--color-surface)] text-[var(--color-text-primary)] rounded-3xl p-6 max-w-sm w-full text-center">
        <h2 id="unpaid-title" class="text-xl font-bold mb-2">Report an unpaid fare?</h2>
        <p id="unpaid-body" class="text-[13px] text-[var(--color-text-secondary)] mb-5">
          Only if {{ riderName }} didn’t pay the {{ formatFare(amountCents) }}. RideUp will follow up with them and turn cash off on their account. You won’t owe RideUp anything for this trip.
        </p>
        <p v-if="error" class="text-[13px] text-[var(--color-danger)] mb-3" role="alert">{{ error }}</p>
        <button type="button" @click="report" :disabled="busy" class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-2xl disabled:opacity-50">
          {{ busy ? 'Sending…' : 'Yes, they didn’t pay' }}
        </button>
        <button type="button" @click="open = false" class="w-full py-3 mt-1 text-[14px] text-[var(--color-text-secondary)]">Back</button>
      </div>
    </div>
  </Teleport>
</template>
