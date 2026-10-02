<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { friendlyAuthError } from '../lib/useAuth'
import { toE164, formatPhone } from '../lib/phone'
import { safeRedirect } from '../lib/safeRedirect'
import { DEMO_MODE } from '../lib/demoMode'

// Confirms the rider's phone number with an SMS code, the way Uber does before a first trip.
// Supabase sends the code (Authentication → Phone needs an SMS provider such as Twilio).
const route = useRoute()
const router = useRouter()
const next = computed(() => safeRedirect(route.query.redirect, '/profile'))

const step = ref('loading') // loading | phone | code | done
const phone = ref('')
const e164 = ref('')
const code = ref('')
const error = ref('')
const notice = ref('')
const busy = ref(false)
const resendIn = ref(0)
let timer = null

onMounted(async () => {
  if (DEMO_MODE || !supabaseConfigured) {
    step.value = 'phone'
    return
  }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    step.value = 'phone'
    return
  }
  if (user.phone && user.phone_confirmed_at) {
    e164.value = `+${user.phone.replace(/^\+/, '')}`
    step.value = 'done'
    return
  }
  const { data: rider } = await supabase.from('riders').select('phone').eq('auth_user_id', user.id).maybeSingle()
  phone.value = formatPhone(rider?.phone || user.phone || '')
  step.value = 'phone'
})
onUnmounted(() => clearInterval(timer))

function startResendTimer() {
  resendIn.value = 30
  clearInterval(timer)
  timer = setInterval(() => {
    resendIn.value -= 1
    if (resendIn.value <= 0) clearInterval(timer)
  }, 1000)
}

function smsError(err) {
  const msg = err?.message || ''
  if (/provider|sms|twilio|unsupported/i.test(msg) && !/rate/i.test(msg)) return 'Text-message codes aren’t available right now. Please try again later or contact support.'
  if (err?.code === 'phone_exists' || /already.*registered|already exists/i.test(msg)) return 'That number is already on another RideUp account. Use a different number or contact support.'
  if (/invalid.*phone|phone.*invalid/i.test(msg)) return 'That doesn’t look like a valid mobile number.'
  return friendlyAuthError(err)
}

async function sendCode() {
  error.value = ''
  notice.value = ''
  const value = toE164(phone.value)
  if (!value) {
    error.value = 'Enter your mobile number, for example 242 555 0100.'
    return
  }
  busy.value = true
  if (!DEMO_MODE) {
    const { error: err } = await supabase.auth.updateUser({ phone: value })
    if (err) {
      busy.value = false
      error.value = smsError(err)
      return
    }
  }
  busy.value = false
  e164.value = value
  code.value = ''
  step.value = 'code'
  startResendTimer()
}

async function resend() {
  error.value = ''
  notice.value = ''
  busy.value = true
  const { error: err } = DEMO_MODE ? { error: null } : await supabase.auth.resend({ type: 'phone_change', phone: e164.value })
  busy.value = false
  if (err) {
    error.value = smsError(err)
    return
  }
  notice.value = 'New code sent.'
  startResendTimer()
}

async function verify() {
  error.value = ''
  const token = code.value.replace(/\D/g, '')
  if (token.length !== 6) {
    error.value = 'Enter the 6-digit code from the text message.'
    return
  }
  busy.value = true
  if (!DEMO_MODE) {
    const { data, error: err } = await supabase.auth.verifyOtp({ phone: e164.value, token, type: 'phone_change' })
    if (err) {
      busy.value = false
      error.value = /expired|invalid/i.test(err.message || '') ? 'That code is wrong or has expired. Check it, or send a new one.' : smsError(err)
      return
    }
    const uid = data?.user?.id
    if (uid) await supabase.from('riders').update({ phone: e164.value }).eq('auth_user_id', uid)
  }
  busy.value = false
  step.value = 'done'
}

const inputClass = 'w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border border-[var(--color-border)] text-[17px] outline-none focus:border-[#2b8659] transition-colors placeholder:text-[var(--color-text-muted)]'
</script>

<template>
  <div class="min-h-dvh bg-[var(--color-surface)] text-[var(--color-text-primary)] flex flex-col">
    <div class="flex items-center px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4">
      <button @click="step === 'code' ? (step = 'phone') : router.back()" class="w-10 h-10 flex items-center justify-center rounded-full active:bg-[var(--color-surface-secondary)]" aria-label="Back">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </div>

    <div class="flex-1 px-6 pt-4 w-full max-w-md mx-auto">
      <p v-if="step === 'loading'" class="text-[var(--color-text-secondary)]" role="status">Loading…</p>

      <form v-else-if="step === 'phone'" @submit.prevent="sendCode" novalidate>
        <h1 class="text-[28px] font-bold leading-tight mb-2">Verify your phone</h1>
        <p class="text-[var(--color-text-muted)] text-[14px] mb-8">Your driver uses this number to reach you at pickup. We’ll text you a 6-digit code.</p>
        <label class="block mb-4">
          <span class="block text-[13px] font-semibold mb-1.5">Mobile number</span>
          <input v-model="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(242) 555-0100" :class="inputClass" />
        </label>
        <p v-if="error" class="text-[var(--color-danger)] text-[13px] mb-4" role="alert">{{ error }}</p>
        <button type="submit" :disabled="busy" class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-xl text-[15px] disabled:opacity-50">{{ busy ? 'Sending…' : 'Send code' }}</button>
        <p class="text-[12px] text-[var(--color-text-muted)] mt-4">Message and data rates may apply.</p>
      </form>

      <form v-else-if="step === 'code'" @submit.prevent="verify" novalidate>
        <h1 class="text-[28px] font-bold leading-tight mb-2">Enter the code</h1>
        <p class="text-[var(--color-text-muted)] text-[14px] mb-8">Sent to <strong class="text-[var(--color-text-primary)]">{{ formatPhone(e164) }}</strong>. <button type="button" class="text-[var(--color-brand)] font-semibold" @click="step = 'phone'">Change</button></p>
        <label class="block mb-4">
          <span class="sr-only">6-digit code</span>
          <input v-model="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"
                 :class="inputClass" class="tracking-[0.5em] text-center text-[24px] font-bold" />
        </label>
        <p v-if="notice" class="text-[var(--color-brand)] text-[13px] mb-3" role="status">{{ notice }}</p>
        <p v-if="error" class="text-[var(--color-danger)] text-[13px] mb-4" role="alert">{{ error }}</p>
        <button type="submit" :disabled="busy" class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-xl text-[15px] disabled:opacity-50">{{ busy ? 'Checking…' : 'Verify' }}</button>
        <button type="button" @click="resend" :disabled="busy || resendIn > 0" class="w-full py-3 mt-2 text-[14px] font-semibold text-[var(--color-brand)] disabled:text-[var(--color-text-muted)]">
          {{ resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code' }}
        </button>
      </form>

      <div v-else class="pt-8 text-center">
        <div class="w-16 h-16 rounded-full bg-[#2b8659] flex items-center justify-center mx-auto mb-4" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold mb-2" aria-live="polite">Phone verified</h1>
        <p class="text-[14px] text-[var(--color-text-muted)] mb-8">{{ formatPhone(e164) }} is confirmed.</p>
        <button @click="router.replace(next)" class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-xl text-[15px]">Continue</button>
      </div>
    </div>
  </div>
</template>
