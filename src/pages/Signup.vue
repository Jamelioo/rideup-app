<script setup>
import { ref, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth, friendlyAuthError, MIN_PASSWORD } from '../lib/useAuth'
import { safeRedirect } from '../lib/safeRedirect'
import AccountConversionCard from '../components/AccountConversionCard.vue'
import { getPendingReferral, setPendingReferral } from '../lib/rewards'
import { trackSignUp } from '../lib/adTracking'
import { toE164, tidyPhone, PHONE_HINT } from '../lib/phone'

const router = useRouter()
const route = useRoute()
const { signUp, resendConfirmation, isGuest } = useAuth()

const name = ref('')
const email = ref('')
// Asked up front, like Uber: the driver calls or texts it at pickup, and the team can reach new riders.
const phone = ref('')
const password = ref('')
const showPassword = ref(false)
const error = ref('')
// One message per field, shown under it (and the cursor moved there), instead of one line at the bottom.
const fieldErrors = ref({ name: '', email: '', phone: '', password: '' })
const notice = ref('')
const submitting = ref(false)
const confirmationSent = ref(false)
// A friend's referral code ($5 off the first ride). Prefilled from a /r/CODE link; applied after sign-up.
const referral = ref(getPendingReferral() || '')
// Most people don't have one: keep the form short and show the field only when asked for (or already filled in).
const showReferral = ref(!!referral.value)
function openReferral() {
  showReferral.value = true
  nextTick(() => document.getElementById('su-referral')?.focus())
}

const redirect = () => safeRedirect(route.query.redirect, '/book')

// Back to wherever they came from (booking, the landing page…), or home if they opened this page directly.
function goBack() {
  if (window.history.state?.back) router.back()
  else router.push('/')
}

async function handleSignup() {
  error.value = ''
  const mobile = toE164(phone.value)
  fieldErrors.value = {
    name: name.value.trim() ? '' : 'Please enter your name.',
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) ? '' : 'Please enter a valid email address.',
    phone: mobile ? '' : PHONE_HINT,
    password: password.value.length >= MIN_PASSWORD ? '' : `Password must be at least ${MIN_PASSWORD} characters.`,
  }
  const firstProblem = ['name', 'email', 'phone', 'password'].find((f) => fieldErrors.value[f])
  if (firstProblem) {
    nextTick(() => document.getElementById(`su-${firstProblem}`)?.focus())
    return
  }

  setPendingReferral(referral.value.trim() || null)
  submitting.value = true
  // The database copies the number onto the rider profile as the account is created (migration 017).
  const result = await signUp(email.value.trim(), password.value, name.value.trim(), { redirectPath: redirect(), data: { phone: mobile } })
  submitting.value = false

  if (result.error) {
    error.value = friendlyAuthError(result.error)
    return
  }
  trackSignUp()
  if (result.session) {
    router.push(redirect())
    return
  }
  confirmationSent.value = true
}

async function resend() {
  notice.value = ''
  error.value = ''
  submitting.value = true
  const { error: err } = await resendConfirmation(email.value.trim(), redirect())
  submitting.value = false
  if (err) {
    error.value = friendlyAuthError(err)
    return
  }
  notice.value = 'Sent again. It can take a minute; check your spam folder too.'
}

const errorRing = '!border-[var(--color-danger)]'
const inputClass = 'w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border border-[var(--color-border)] text-[15px] outline-none focus:border-[#2b8659] transition-colors placeholder:text-[var(--color-text-muted)]'
</script>

<template>
  <div class="min-h-dvh bg-[var(--color-surface)] text-[var(--color-text-primary)] flex flex-col">
    <!-- Top bar -->
    <div class="flex items-center px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4">
      <button @click="goBack" class="w-11 h-11 flex items-center justify-center rounded-full active:bg-[var(--color-surface-secondary)]" aria-label="Back">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </div>

    <div class="flex-1 px-6 pt-4 w-full max-w-md mx-auto">
      <!-- A guest saves the account they already booked with, so their trips come along. -->
      <template v-if="isGuest">
        <h1 class="text-[28px] font-bold leading-tight mb-2">Save your account</h1>
        <p class="text-[var(--color-text-muted)] text-[14px] mb-6">You’re booking as a guest. Add your email to keep your trips and receipts and log in on any device.</p>
        <AccountConversionCard :show-skip="false" title="Your email" subtitle="We’ll send a link to confirm it, then you’ll choose a password." @converted="router.push(redirect())" />
        <div class="text-center mt-6 text-[14px] text-[var(--color-text-muted)]">
          Already have an account?
          <router-link to="/login" class="text-[var(--color-brand)] font-semibold">Log in</router-link>
        </div>
      </template>

      <!-- Confirmation email sent -->
      <div v-else-if="confirmationSent" class="pt-4">
        <div class="w-14 h-14 rounded-full bg-[#2b8659] flex items-center justify-center mb-4" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 class="text-[26px] font-bold leading-tight mb-2" aria-live="polite">Check your email</h1>
        <p class="text-[14px] text-[var(--color-text-secondary)] mb-6">We sent a link to <strong class="text-[var(--color-text-primary)]">{{ email }}</strong>. Tap it to activate your account; you’ll be logged in automatically.</p>
        <p v-if="notice" class="text-[13px] text-[var(--color-brand)] mb-3" role="status">{{ notice }}</p>
        <p v-if="error" class="text-[13px] text-[var(--color-danger)] mb-3" role="alert">{{ error }}</p>
        <button @click="resend" :disabled="submitting" class="w-full py-3.5 rounded-xl border border-[var(--color-border)] font-semibold text-[15px] disabled:opacity-50">{{ submitting ? 'Sending…' : 'Resend email' }}</button>
        <button @click="confirmationSent = false" class="w-full py-3 mt-2 text-[14px] font-semibold text-[var(--color-text-muted)]">Wrong email? Go back</button>
        <button @click="router.push('/login')" class="w-full py-3 text-[14px] font-semibold text-[var(--color-brand)]">Go to log in</button>
      </div>

      <!-- Form -->
      <form v-else @submit.prevent="handleSignup" novalidate>
        <h1 class="text-[28px] font-bold leading-tight mb-2">Create your account</h1>
        <p class="text-[var(--color-text-muted)] text-[14px] mb-8">Takes about a minute. Your details are saved for faster booking.</p>

        <div class="space-y-4 mb-4">
          <div>
            <label for="su-name" class="block text-[14px] font-medium text-[var(--color-text-secondary)] mb-1.5">Full name</label>
            <input id="su-name" v-model="name" type="text" autocomplete="name" autocapitalize="words" enterkeyhint="next" :class="[inputClass, fieldErrors.name && errorRing]"
                   :aria-invalid="fieldErrors.name ? 'true' : undefined" :aria-describedby="fieldErrors.name ? 'su-name-error' : undefined" @input="fieldErrors.name = ''" />
            <p v-if="fieldErrors.name" id="su-name-error" class="text-[var(--color-danger)] text-[13px] mt-1.5 px-1">{{ fieldErrors.name }}</p>
          </div>
          <div>
            <label for="su-email" class="block text-[14px] font-medium text-[var(--color-text-secondary)] mb-1.5">Email address</label>
            <input id="su-email" v-model="email" type="email" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" enterkeyhint="next" :class="[inputClass, fieldErrors.email && errorRing]"
                   :aria-invalid="fieldErrors.email ? 'true' : undefined" :aria-describedby="fieldErrors.email ? 'su-email-error' : undefined" @input="fieldErrors.email = ''" />
            <p v-if="fieldErrors.email" id="su-email-error" class="text-[var(--color-danger)] text-[13px] mt-1.5 px-1">{{ fieldErrors.email }}</p>
          </div>
          <div>
            <label for="su-phone" class="block text-[14px] font-medium text-[var(--color-text-secondary)] mb-1.5">Mobile number</label>
            <input id="su-phone" v-model="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(242) 555-0100" enterkeyhint="next" :aria-describedby="fieldErrors.phone ? 'su-phone-error' : 'su-phone-hint'"
                   :aria-invalid="fieldErrors.phone ? 'true' : undefined" :class="[inputClass, fieldErrors.phone && errorRing]" @blur="phone = tidyPhone(phone)" @input="fieldErrors.phone = ''" />
            <p v-if="fieldErrors.phone" id="su-phone-error" class="text-[var(--color-danger)] text-[13px] mt-1.5 px-1">{{ fieldErrors.phone }}</p>
            <p v-else id="su-phone-hint" class="text-[12px] text-[var(--color-text-muted)] mt-1.5 px-1">Your driver calls or texts this number at pickup</p>
          </div>
          <div>
            <label for="su-password" class="block text-[14px] font-medium text-[var(--color-text-secondary)] mb-1.5">Password</label>
            <div class="relative">
              <input id="su-password" v-model="password" :type="showPassword ? 'text' : 'password'" :aria-describedby="fieldErrors.password ? 'su-password-error' : 'su-password-hint'" autocomplete="new-password" enterkeyhint="go"
                     :aria-invalid="fieldErrors.password ? 'true' : undefined" :class="[inputClass, fieldErrors.password && errorRing]" class="pr-16" @input="fieldErrors.password = ''" />
              <button type="button" @click="showPassword = !showPassword" class="absolute right-1 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[var(--color-brand)] min-w-[48px] min-h-[44px] px-2"
                      :aria-pressed="showPassword" :aria-label="showPassword ? 'Hide password' : 'Show password'">{{ showPassword ? 'Hide' : 'Show' }}</button>
            </div>
            <p v-if="fieldErrors.password" id="su-password-error" class="text-[var(--color-danger)] text-[13px] mt-1.5 px-1">{{ fieldErrors.password }}</p>
            <p v-else id="su-password-hint" class="text-[12px] text-[var(--color-text-muted)] mt-1.5 px-1">At least {{ MIN_PASSWORD }} characters</p>
          </div>
          <button v-if="!showReferral" type="button" @click="openReferral"
                  class="text-[14px] font-semibold text-[var(--color-brand)] min-h-[44px] px-1">Have a friend’s referral code?</button>
          <div v-else>
            <label for="su-referral" class="block text-[14px] font-medium text-[var(--color-text-secondary)] mb-1.5">Friend’s referral code <span class="font-normal text-[var(--color-text-muted)]">(optional)</span></label>
            <input id="su-referral" v-model="referral" type="text" autocapitalize="characters" autocomplete="off" :class="inputClass" class="uppercase" />
          </div>
          <p v-if="referral" class="text-[12px] text-[var(--color-brand)] px-1">You’ll get $5 off your first ride.</p>
        </div>

        <p v-if="error" class="text-[var(--color-danger)] text-[13px] mb-4" role="alert">{{ error }}</p>

        <button type="submit" :disabled="submitting"
                class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-xl text-[15px] active:bg-[#236e49] transition-colors disabled:opacity-50">
          {{ submitting ? 'Creating account…' : 'Sign up' }}
        </button>

        <div class="text-center mt-6 text-[14px] text-[var(--color-text-muted)]">
          Already have an account?
          <router-link :to="{ path: '/login', query: route.query.redirect ? { redirect: route.query.redirect } : {} }" class="text-[var(--color-brand)] font-semibold">Log in</router-link>
        </div>
        <!-- Riding doesn't need an account: never make sign-up the only way forward. -->
        <router-link to="/book" class="block w-full py-3 mt-3 text-center text-[14px] font-semibold text-[var(--color-text-muted)]">Just need a ride? Book without an account</router-link>
      </form>
    </div>

    <div class="px-6 py-6">
      <p class="text-[12px] text-[var(--color-text-muted)] text-center leading-relaxed">
        By continuing, you agree to our <router-link to="/terms" class="underline">Terms of Service</router-link> and <router-link to="/privacy" class="underline">Privacy Policy</router-link>.
      </p>
    </div>
  </div>
</template>
