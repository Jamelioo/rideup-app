<script setup>
import { ref, watch } from 'vue'
import { toE164, tidyPhone, PHONE_HINT } from '../lib/phone'
import { formatFare } from '../lib/pricing'

// Booking without an account: a name for the driver to greet and a mobile number they can call or text at pickup.
// The trip is paid in cash to the driver at drop-off, so nothing else is needed. Emits { name, phone } with the
// number in E.164; the page books the ride and calls reset() or setError() if that fails.
const props = defineProps({
  show: { type: Boolean, default: false },
  chargeCents: { type: Number, default: null }, // what the rider will pay, after any promo
})
const emit = defineEmits(['submit', 'close'])

const name = ref('')
const phone = ref('')
const error = ref('')
const nameError = ref('')
const phoneError = ref('')
const submitting = ref(false)

watch(() => props.show, (open) => {
  if (!open) return
  error.value = ''
  nameError.value = ''
  phoneError.value = ''
  submitting.value = false
})

function handleSubmit() {
  if (submitting.value) return
  const cleanName = name.value.trim().replace(/\s+/g, ' ')
  const e164 = toE164(phone.value)
  nameError.value = cleanName.length >= 2 ? '' : 'Enter your name so your driver knows who to look for.'
  phoneError.value = e164 ? '' : PHONE_HINT
  if (nameError.value || phoneError.value) return
  error.value = ''
  submitting.value = true
  emit('submit', { name: cleanName.slice(0, 80), phone: e164 })
}

function reset() {
  submitting.value = false
}

function setError(message) {
  submitting.value = false
  error.value = message
}

defineExpose({ reset, setError })
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="fixed inset-0 bg-[var(--color-overlay)] z-[9998]" @click="emit('close')" />
    </Transition>

    <Transition name="sheet">
      <div v-if="show" v-modal="() => emit('close')" aria-labelledby="guest-sheet-title" class="fixed inset-x-0 bottom-0 z-[9999] bg-[var(--color-surface)] text-[var(--color-text-primary)] rounded-t-[28px] shadow-[0_-4px_40px_rgba(0,0,0,0.15)]" style="padding-bottom: env(safe-area-inset-bottom, 0px);">
        <div class="flex justify-center pt-3 pb-1">
          <div class="w-10 h-1 rounded-full bg-[var(--color-text-muted)]/30"></div>
        </div>

        <form class="px-6 pb-6" novalidate @submit.prevent="handleSubmit">
          <div class="flex items-center justify-between mb-1">
            <h2 id="guest-sheet-title" class="text-[18px] font-bold">Who’s riding?</h2>
            <button type="button" @click="emit('close')" class="w-11 h-11 rounded-full hover:bg-[var(--color-surface-secondary)] flex items-center justify-center text-[var(--color-text-muted)]" aria-label="Close">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <p class="text-[13px] text-[var(--color-text-muted)] mb-5">No account needed. Your driver uses these to find you at pickup.</p>

          <div v-if="error" role="alert" class="bg-red-500/10 border border-red-500/20 text-[var(--color-danger)] text-[13px] px-4 py-2.5 rounded-xl mb-4">{{ error }}</div>

          <label for="guest-name" class="text-[12px] font-medium text-[var(--color-text-muted)] mb-1 block">Your name</label>
          <input id="guest-name" v-model="name" type="text" autocomplete="name" autocapitalize="words" maxlength="80" placeholder="e.g. Marcus"
                 :aria-invalid="nameError ? 'true' : undefined" :aria-describedby="nameError ? 'guest-name-error' : undefined"
                 class="w-full bg-[var(--color-surface-secondary)] rounded-xl px-4 py-3 text-[16px] font-medium outline-none focus:ring-2 focus:ring-[#2b8659] transition-all min-h-[48px] placeholder:text-[var(--color-text-muted)] placeholder:font-normal" />
          <p v-if="nameError" id="guest-name-error" role="alert" class="text-[var(--color-danger)] text-[13px] mt-1">{{ nameError }}</p>

          <label for="guest-phone" class="text-[12px] font-medium text-[var(--color-text-muted)] mb-1 mt-3 block">Mobile number</label>
          <input id="guest-phone" v-model="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(242) 555-0100"
                 :aria-invalid="phoneError ? 'true' : undefined" :aria-describedby="phoneError ? 'guest-phone-error' : undefined"
                 @blur="phone = tidyPhone(phone)"
                 class="w-full bg-[var(--color-surface-secondary)] rounded-xl px-4 py-3 text-[16px] font-medium outline-none focus:ring-2 focus:ring-[#2b8659] transition-all min-h-[48px] placeholder:text-[var(--color-text-muted)] placeholder:font-normal" />
          <p v-if="phoneError" id="guest-phone-error" role="alert" class="text-[var(--color-danger)] text-[13px] mt-1">{{ phoneError }}</p>

          <p class="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)] mt-4">
            <svg class="w-4 h-4 text-[var(--color-brand)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>
            <span>Pay {{ chargeCents ? formatFare(chargeCents) : 'the fare' }} in cash to your driver at drop-off.</span>
          </p>

          <button type="submit" :disabled="submitting"
                  class="mt-5 w-full py-4 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px] transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(43,134,89,0.3)] disabled:opacity-60">
            {{ submitting ? 'Requesting…' : 'Request ride' }}
          </button>

          <p class="text-[11px] text-[var(--color-text-muted)] text-center mt-3">
            By requesting you agree to the <router-link to="/terms" class="underline">Terms</router-link> and <router-link to="/privacy" class="underline">Privacy Policy</router-link>.
            Have an account? <router-link to="/login?redirect=/book" class="text-[var(--color-brand)] font-semibold">Log in</router-link>
          </p>
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
