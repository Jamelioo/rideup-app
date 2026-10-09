<script setup>
import { ref, watch } from 'vue'
import { toE164, tidyPhone, PHONE_HINT } from '../lib/phone'

// "Add your mobile number", for accounts made before sign-up asked for one: before their first booking, and once
// as a reminder on the booking screen. Emits the number in E.164; the page saves it.
const props = defineProps({
  show: { type: Boolean, default: false },
  // 'book': part of requesting a ride, so saving carries on to the request. 'remind': the one-off reminder.
  mode: { type: String, default: 'book' },
})
const emit = defineEmits(['submit', 'close'])

const phone = ref('')
const error = ref('')
const submitting = ref(false)

watch(() => props.show, (open) => {
  if (!open) return
  phone.value = ''
  error.value = ''
  submitting.value = false
})

function handleSubmit() {
  if (submitting.value) return
  const e164 = toE164(phone.value)
  if (!e164) {
    error.value = PHONE_HINT
    return
  }
  error.value = ''
  submitting.value = true
  emit('submit', e164)
}

function setError(message) {
  submitting.value = false
  error.value = message
}

defineExpose({ setError })
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="fixed inset-0 bg-[var(--color-overlay)] z-[9998]" @click="emit('close')" />
    </Transition>

    <Transition name="sheet">
      <div v-if="show" v-modal="() => emit('close')" aria-labelledby="phone-sheet-title" class="fixed inset-x-0 bottom-0 z-[9999] bg-[var(--color-surface)] text-[var(--color-text-primary)] rounded-t-[28px] shadow-[0_-4px_40px_rgba(0,0,0,0.15)]" style="padding-bottom: env(safe-area-inset-bottom, 0px);">
        <div class="flex justify-center pt-3 pb-1">
          <div class="w-10 h-1 rounded-full bg-[var(--color-text-muted)]/30"></div>
        </div>

        <form class="px-6 pb-6" novalidate @submit.prevent="handleSubmit">
          <div class="flex items-center justify-between mb-1">
            <h2 id="phone-sheet-title" class="text-[18px] font-bold">Add your mobile number</h2>
            <button type="button" @click="emit('close')" class="w-11 h-11 rounded-full hover:bg-[var(--color-surface-secondary)] flex items-center justify-center text-[var(--color-text-muted)]" aria-label="Close">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <p class="text-[13px] text-[var(--color-text-muted)] mb-5">Your driver calls or texts this number at pickup.</p>

          <label for="phone-sheet-input" class="text-[12px] font-medium text-[var(--color-text-muted)] mb-1 block">Mobile number</label>
          <input id="phone-sheet-input" v-model="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(242) 555-0100"
                 :autofocus="mode === 'book'" :aria-invalid="error ? 'true' : undefined" :aria-describedby="error ? 'phone-sheet-error' : undefined"
                 @blur="phone = tidyPhone(phone)"
                 class="w-full bg-[var(--color-surface-secondary)] rounded-xl px-4 py-3 text-[16px] font-medium outline-none focus:ring-2 focus:ring-[#2b8659] transition-all min-h-[48px] placeholder:text-[var(--color-text-muted)] placeholder:font-normal" />
          <p v-if="error" id="phone-sheet-error" role="alert" class="text-[var(--color-danger)] text-[13px] mt-2">{{ error }}</p>

          <button type="submit" :disabled="submitting"
                  class="mt-5 w-full py-4 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px] transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(43,134,89,0.3)] disabled:opacity-60">
            {{ submitting ? 'Saving…' : mode === 'book' ? 'Save & continue' : 'Save' }}
          </button>
          <button v-if="mode === 'remind'" type="button" @click="emit('close')" class="w-full min-h-[44px] mt-1 text-[14px] font-semibold text-[var(--color-text-muted)]">Not now</button>
        </form>
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
