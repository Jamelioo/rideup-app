<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { useAuth, friendlyAuthError, MIN_PASSWORD } from '../lib/useAuth'
import { useDriver } from '../lib/useDriver'
import { DEMO_MODE } from '../lib/demoMode'

const route = useRoute()
const router = useRouter()
const { sendPasswordReset, clearPasswordRecovery } = useAuth()

// /reset-password: opened from a "forgot password" email.
// /set-password: a guest finishing their account after confirming their email address.
const isSetup = computed(() => route.name === 'set-password')

// An expired or reused link comes back with an error in the URL. Read it before anything tidies the URL.
const linkError = (() => {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)
  return hash.get('error_code') || query.get('error_code') || hash.get('error_description') || query.get('error_description') || ''
})()

const invalidTitle = computed(() => {
  if (linkError) return 'This link has expired'
  return isSetup.value ? 'Confirm your email first' : 'Reset your password'
})

const state = ref('checking') // checking | form | invalid | done
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const error = ref('')
const saving = ref(false)
const resendEmail = ref('')
const resending = ref(false)
const resent = ref(false)

const strength = computed(() => {
  const p = password.value
  if (!p) return ''
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length
  if (p.length < MIN_PASSWORD) return 'Too short'
  if (kinds >= 3 && p.length >= 10) return 'Strong'
  if (kinds >= 2) return 'Good'
  return 'Weak'
})

onMounted(async () => {
  if (DEMO_MODE || !supabaseConfigured) {
    state.value = 'form'
    return
  }
  // getSession waits for supabase-js to finish reading the link's tokens from the URL.
  const { data: { session } } = await supabase.auth.getSession()
  const u = session?.user
  if (u && !u.is_anonymous) {
    email.value = u.email || ''
    state.value = 'form'
  } else {
    state.value = 'invalid'
  }
})

async function submit() {
  error.value = ''
  if (password.value.length < MIN_PASSWORD) {
    error.value = `Use at least ${MIN_PASSWORD} characters.`
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = 'The two passwords don’t match.'
    return
  }
  saving.value = true
  if (!DEMO_MODE) {
    const { data, error: err } = await supabase.auth.updateUser({ password: password.value, data: { needs_password: null } })
    if (err) {
      saving.value = false
      if (/session|jwt|expired/i.test(err.message || '')) {
        state.value = 'invalid'
        return
      }
      error.value = friendlyAuthError(err)
      return
    }
    if (isSetup.value && data?.user) {
      // The rider row stops counting as a guest. Not fatal if it fails: the account itself is saved.
      await supabase.from('riders').update({ is_guest: false, email: data.user.email }).eq('auth_user_id', data.user.id)
    }
  }
  clearPasswordRecovery()
  saving.value = false
  state.value = 'done'
}

async function continueToApp() {
  if (DEMO_MODE || !supabaseConfigured) return router.replace('/book')
  const { data: { user } } = await supabase.auth.getUser()
  const { driver, fetchDriver } = useDriver()
  if (user) await fetchDriver(user.id)
  router.replace(driver.value ? '/driver/dashboard' : '/book')
}

async function resend() {
  error.value = ''
  const value = resendEmail.value.trim()
  if (!value) {
    error.value = 'Enter the email address on your account.'
    return
  }
  resending.value = true
  const { error: err } = await sendPasswordReset(value)
  resending.value = false
  if (err) {
    error.value = friendlyAuthError(err)
    return
  }
  resent.value = true
}

const inputClass = 'w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border border-[var(--color-border)] text-[15px] outline-none focus:border-[#2b8659] transition-colors placeholder:text-[var(--color-text-muted)]'
</script>

<template>
  <div class="min-h-dvh bg-[var(--color-surface)] text-[var(--color-text-primary)] flex flex-col">
    <div class="flex items-center px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4">
      <button @click="router.push(isSetup ? '/book' : '/login')" class="w-10 h-10 flex items-center justify-center rounded-full active:bg-[var(--color-surface-secondary)]" aria-label="Back">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </div>

    <div class="flex-1 px-6 pt-4 w-full max-w-md mx-auto">
      <p v-if="state === 'checking'" class="text-[var(--color-text-secondary)]" role="status">Checking your link…</p>

      <!-- New password -->
      <form v-else-if="state === 'form'" @submit.prevent="submit" novalidate>
        <h1 class="text-[28px] font-bold leading-tight mb-2">{{ isSetup ? 'Choose a password' : 'Set a new password' }}</h1>
        <p class="text-[var(--color-text-muted)] text-[14px] mb-8">
          <template v-if="isSetup">Your email is confirmed. Choose a password so you can log in on any device<span v-if="email"> with <strong class="text-[var(--color-text-primary)]">{{ email }}</strong></span>.</template>
          <template v-else>Choose a new password<span v-if="email"> for <strong class="text-[var(--color-text-primary)]">{{ email }}</strong></span>. You’ll stay logged in on this device.</template>
        </p>

        <input type="email" :value="email" autocomplete="username" class="hidden" tabindex="-1" aria-hidden="true" readonly />
        <div class="space-y-3 mb-2">
          <label class="block">
            <span class="block text-[13px] font-semibold mb-1.5">New password</span>
            <div class="relative">
              <input v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" :minlength="MIN_PASSWORD" required
                     :placeholder="`At least ${MIN_PASSWORD} characters`" :class="inputClass" class="pr-16" />
              <button type="button" @click="showPassword = !showPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[var(--color-brand)] px-1 py-1"
                      :aria-pressed="showPassword">{{ showPassword ? 'Hide' : 'Show' }}</button>
            </div>
          </label>
          <p v-if="strength" class="text-[12px]" :class="strength === 'Strong' || strength === 'Good' ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-muted)]'" aria-live="polite">Strength: {{ strength }}</p>
          <label class="block">
            <span class="block text-[13px] font-semibold mb-1.5">Confirm password</span>
            <input v-model="confirmPassword" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" required :class="inputClass" />
          </label>
        </div>

        <p v-if="error" class="text-[var(--color-danger)] text-[13px] my-3" role="alert">{{ error }}</p>

        <button type="submit" :disabled="saving"
                class="w-full mt-4 py-3.5 bg-[#2b8659] text-white font-bold rounded-xl text-[15px] active:bg-[#236e49] transition-colors disabled:opacity-50">
          {{ saving ? 'Saving…' : (isSetup ? 'Save password' : 'Update password') }}
        </button>
      </form>

      <!-- Done -->
      <div v-else-if="state === 'done'" class="pt-8 text-center">
        <div class="w-16 h-16 rounded-full bg-[#2b8659] flex items-center justify-center mx-auto mb-4" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold mb-2" role="status">{{ isSetup ? 'Your account is saved' : 'Password updated' }}</h1>
        <p class="text-[14px] text-[var(--color-text-muted)] mb-8">
          {{ isSetup ? 'Your trips and receipts are kept with your account. Log in with your email and password next time.' : 'Use your new password the next time you log in.' }}
        </p>
        <button @click="continueToApp" class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-xl text-[15px] active:bg-[#236e49]">Continue</button>
      </div>

      <!-- Expired, reused or opened without a link -->
      <div v-else>
        <h1 class="text-[26px] font-bold leading-tight mb-2">{{ invalidTitle }}</h1>
        <p class="text-[var(--color-text-muted)] text-[14px] mb-6">
          <template v-if="isSetup">Tap the link in the newest email from RideUp to confirm your address. Links work once and expire after an hour; to get a new one, go to your profile and enter your email again.</template>
          <template v-else-if="linkError">Password reset links work once and expire after an hour. Enter your email and we’ll send a new one.</template>
          <template v-else>Enter the email on your account and we’ll send you a link to set a new password.</template>
        </p>

        <template v-if="!isSetup">
          <div v-if="resent" class="rounded-xl bg-[#2b8659]/10 p-4 text-[14px]" role="status">
            If there’s a RideUp account for <strong>{{ resendEmail }}</strong>, a new link is on its way. It can take a minute; check your spam folder too.
          </div>
          <form v-else @submit.prevent="resend" novalidate>
            <label class="block mb-3">
              <span class="sr-only">Email address</span>
              <input v-model="resendEmail" type="email" autocomplete="email" placeholder="Email address" :class="inputClass" />
            </label>
            <p v-if="error" class="text-[var(--color-danger)] text-[13px] mb-3" role="alert">{{ error }}</p>
            <button type="submit" :disabled="resending" class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-xl text-[15px] disabled:opacity-50">
              {{ resending ? 'Sending…' : 'Send a new link' }}
            </button>
          </form>
          <button @click="router.push('/login')" class="w-full py-3 mt-3 text-[14px] font-semibold text-[var(--color-text-muted)]">Back to log in</button>
        </template>
        <button v-else @click="router.push('/profile')" class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-xl text-[15px]">Go to profile</button>
      </div>
    </div>
  </div>
</template>
