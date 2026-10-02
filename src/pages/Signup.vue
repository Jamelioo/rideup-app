<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth, friendlyAuthError, MIN_PASSWORD } from '../lib/useAuth'
import { safeRedirect } from '../lib/safeRedirect'
import AccountConversionCard from '../components/AccountConversionCard.vue'

const router = useRouter()
const route = useRoute()
const { signUp, resendConfirmation, isGuest } = useAuth()

const name = ref('')
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const error = ref('')
const notice = ref('')
const submitting = ref(false)
const confirmationSent = ref(false)

const redirect = () => safeRedirect(route.query.redirect, '/book')

function goBack() {
  router.push('/welcome')
}

async function handleSignup() {
  error.value = ''
  if (!name.value.trim()) {
    error.value = 'Please enter your name.'
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    error.value = 'Please enter a valid email address.'
    return
  }
  if (password.value.length < MIN_PASSWORD) {
    error.value = `Password must be at least ${MIN_PASSWORD} characters.`
    return
  }

  submitting.value = true
  const result = await signUp(email.value.trim(), password.value, name.value.trim(), { redirectPath: redirect() })
  submitting.value = false

  if (result.error) {
    error.value = friendlyAuthError(result.error)
    return
  }
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

const inputClass = 'w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border border-[var(--color-border)] text-[15px] outline-none focus:border-[#2b8659] transition-colors placeholder:text-[var(--color-text-muted)]'
</script>

<template>
  <div class="min-h-dvh bg-[var(--color-surface)] text-[var(--color-text-primary)] flex flex-col">
    <!-- Top bar -->
    <div class="flex items-center px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4">
      <button @click="goBack" class="w-10 h-10 flex items-center justify-center rounded-full active:bg-[var(--color-surface-secondary)]" aria-label="Back">
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
        <p class="text-[var(--color-text-muted)] text-[14px] mb-8">Enter your details to get started</p>

        <div class="space-y-3 mb-4">
          <label class="block">
            <span class="sr-only">Full name</span>
            <input v-model="name" type="text" placeholder="Full name" autocomplete="name" :class="inputClass" />
          </label>
          <label class="block">
            <span class="sr-only">Email address</span>
            <input v-model="email" type="email" placeholder="Email address" autocomplete="email" inputmode="email" :class="inputClass" />
          </label>
          <label class="block relative">
            <span class="sr-only">Password</span>
            <input v-model="password" :type="showPassword ? 'text' : 'password'" :placeholder="`Password (at least ${MIN_PASSWORD} characters)`" autocomplete="new-password" :class="inputClass" class="pr-16" />
            <button type="button" @click="showPassword = !showPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[var(--color-brand)] px-1 py-1"
                    :aria-pressed="showPassword" :aria-label="showPassword ? 'Hide password' : 'Show password'">{{ showPassword ? 'Hide' : 'Show' }}</button>
          </label>
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
      </form>
    </div>

    <div class="px-6 py-6">
      <p class="text-[12px] text-[var(--color-text-muted)] text-center leading-relaxed">
        By continuing, you agree to our <router-link to="/terms" class="underline">Terms of Service</router-link> and <router-link to="/privacy" class="underline">Privacy Policy</router-link>.
      </p>
    </div>
  </div>
</template>
