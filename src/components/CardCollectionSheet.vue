<script setup>
import { ref, watch, nextTick } from 'vue'
import { getStripe } from '../lib/stripe'

const props = defineProps({
  show: { type: Boolean, default: false },
})

const emit = defineEmits(['submit', 'close'])

const submitting = ref(false)
const error = ref(null)
const cardError = ref(null)
const stripeLoading = ref(false)

let stripe = null
let elements = null
let cardElement = null
const cardMountRef = ref(null)
const cardComplete = ref(false)

async function mountCardElement() {
  if (cardElement) return // already mounted
  if (!stripe) {
    stripeLoading.value = true
    stripe = await getStripe()
    stripeLoading.value = false
  }
  if (!stripe) {
    error.value = 'Payment system unavailable. Please try again later.'
    return
  }
  // Wait for the DOM to render the card mount div (Teleport + Transition)
  await nextTick()
  // Additional frame wait for Transition to complete
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  if (!cardMountRef.value) return

  elements = stripe.elements()
  cardElement = elements.create('card', {
    style: {
      base: {
        color: 'var(--color-text-primary, #fff)',
        fontFamily: 'inherit',
        fontSize: '14px',
        '::placeholder': { color: 'var(--color-text-muted, #888)' },
      },
      invalid: { color: '#ef4444' },
    },
  })
  cardElement.mount(cardMountRef.value)
  cardElement.on('change', (event) => {
    cardComplete.value = event.complete
    cardError.value = event.error ? event.error.message : null
  })
}

watch(() => props.show, async (open) => {
  if (open) {
    await mountCardElement()
  }
})

function handleSubmit() {
  if (!cardComplete.value || submitting.value) return
  error.value = null
  cardError.value = null
  submitting.value = true
  emit('submit', { cardElement, stripe })
}

function reset() {
  submitting.value = false
  error.value = null
  cardError.value = null
}

defineExpose({ reset })
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="fixed inset-0 bg-[var(--color-overlay)] z-[9998]" @click="emit('close')" />
    </Transition>

    <Transition name="sheet">
      <div v-if="show" class="fixed inset-x-0 bottom-0 z-[9999] bg-[var(--color-surface)] rounded-t-[28px] shadow-[0_-4px_40px_rgba(0,0,0,0.15)]" style="padding-bottom: env(safe-area-inset-bottom, 0px);">
        <div class="flex justify-center pt-3 pb-1">
          <div class="w-10 h-1 rounded-full bg-[var(--color-text-muted)]/30"></div>
        </div>

        <div class="px-6 pb-6">
          <div class="flex items-center justify-between mb-1">
            <h2 class="text-[18px] font-bold">Add payment method</h2>
            <button @click="emit('close')" class="w-8 h-8 rounded-full hover:bg-[var(--color-surface-secondary)] flex items-center justify-center text-[var(--color-text-muted)]" aria-label="Close">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <p class="text-[13px] text-[var(--color-text-muted)] mb-5">A card is required to request a ride. You'll only be charged after your trip.</p>

          <div v-if="error" class="bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] px-4 py-2.5 rounded-xl mb-4">{{ error }}</div>

          <label class="block mb-5">
            <span class="text-[12px] font-medium text-[var(--color-text-muted)] mb-1 block">Card details</span>
            <div ref="cardMountRef"
                 class="bg-[var(--color-surface-secondary)] rounded-xl px-4 py-3.5 min-h-[44px]">
              <span v-if="stripeLoading" class="text-[13px] text-[var(--color-text-muted)]">Loading payment...</span>
            </div>
            <p v-if="cardError" class="text-red-400 text-[12px] mt-1">{{ cardError }}</p>
          </label>

          <button @click="handleSubmit" :disabled="!cardComplete || submitting"
                  class="w-full py-4 bg-[#2b8659] disabled:bg-[var(--color-surface-secondary)] disabled:text-[var(--color-text-muted)] text-white font-bold rounded-2xl text-[15px] transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(43,134,89,0.3)] disabled:shadow-none">
            {{ submitting ? 'Saving...' : 'Save & Request Ride' }}
          </button>

          <p class="text-[11px] text-[var(--color-text-muted)] text-center mt-3 flex items-center justify-center gap-1">
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            Secured by Stripe
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.sheet-enter-active, .sheet-leave-active { transition: transform 0.35s cubic-bezier(0.25, 1, 0.5, 1); }
.sheet-enter-from, .sheet-leave-to { transform: translateY(100%); }
</style>
