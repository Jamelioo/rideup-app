<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth, friendlyAuthError } from '../lib/useAuth'
import { useDriver } from '../lib/useDriver'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { safeRedirect } from '../lib/safeRedirect'

const router = useRouter()
const route = useRoute()
const { signIn, sendPasswordReset, resendConfirmation } = useAuth()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const error = ref('')
const notice = ref('')
const submitting = ref(false)
const needsConfirmation = ref(false)

function goBack() {
  router.push('/welcome')
}

async function forgotPassword() {
  notice.value = ''
  if (!email.value.trim()) {
    error.value = 'Enter your email address above, then tap “Forgot password?”'
    return
  }
  error.value = ''
  submitting.value = true
  const { error: resetError } = await sendPasswordReset(email.value.trim())
  submitting.value = false
  if (resetError) {
    error.value = friendlyAuthError(resetError)
    return
  }
  notice.value = `If there’s a RideUp account for ${email.value.trim()}, we’ve emailed a link to set a new password. It expires in an hour.`
}

async function resend() {
  error.value = ''
  submitting.value = true
  const { error: err } = await resendConfirmation(email.value.trim())
  submitting.value = false
  if (err) {
    error.value = friendlyAuthError(err)
    return
  }
  needsConfirmation.value = false
  notice.value = `We sent a new confirmation link to ${email.value.trim()}.`
}

async function handleLogin() {
  error.value = ''
  notice.value = ''
  needsConfirmation.value = false
  if (!email.value.trim() || !password.value) {
    error.value = 'Please enter your email and password.'
    return
  }
  submitting.value = true
  const { error: authError } = await signIn(email.value.trim(), password.value)
  if (authError) {
    submitting.value = false
    needsConfirmation.value = authError.code === 'email_not_confirmed' || /not confirmed/i.test(authError.message || '')
    error.value = friendlyAuthError(authError)
    return
  }

  // Drivers land on their dashboard, riders on booking, unless they were sent here from a specific page.
  let fallback = '/book'
  if (supabaseConfigured) {
    const { data: { user } } = await supabase.auth.getUser()
    const { driver, fetchDriver } = useDriver()
    if (user) await fetchDriver(user.id)
    if (driver.value) fallback = driver.value.approved ? '/driver/dashboard' : '/driver/pending'
  }
  submitting.value = false
  router.push(safeRedirect(route.query.redirect, fallback))
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

    <form class="flex-1 px-6 pt-4 w-full max-w-md mx-auto" @submit.prevent="handleLogin" novalidate>
      <h1 class="text-[28px] font-bold leading-tight mb-2">Welcome back</h1>
      <p class="text-[var(--color-text-muted)] text-[14px] mb-8">Log in with your email and password</p>

      <div class="space-y-3 mb-3">
        <label class="block">
          <span class="sr-only">Email address</span>
          <input v-model="email" type="email" placeholder="Email address" autocomplete="email" inputmode="email" :class="inputClass" />
        </label>
        <label class="block relative">
          <span class="sr-only">Password</span>
          <input v-model="password" :type="showPassword ? 'text' : 'password'" placeholder="Password" autocomplete="current-password" :class="inputClass" class="pr-16" />
          <button type="button" @click="showPassword = !showPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[var(--color-brand)] px-1 py-1"
                  :aria-pressed="showPassword" :aria-label="showPassword ? 'Hide password' : 'Show password'">{{ showPassword ? 'Hide' : 'Show' }}</button>
        </label>
      </div>

      <div class="text-right mb-4">
        <button type="button" @click="forgotPassword" :disabled="submitting" class="text-[13px] text-[var(--color-brand)] font-medium py-1">Forgot password?</button>
      </div>

      <p v-if="notice" class="text-[var(--color-brand)] text-[13px] font-medium mb-4" role="status">{{ notice }}</p>
      <div v-if="error" class="mb-4" role="alert">
        <p class="text-[var(--color-danger)] text-[13px]">{{ error }}</p>
        <button v-if="needsConfirmation" type="button" @click="resend" :disabled="submitting" class="mt-1 text-[13px] font-semibold text-[var(--color-brand)] underline">Resend confirmation email</button>
      </div>

      <button type="submit" :disabled="submitting"
              class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-xl text-[15px] active:bg-[#236e49] transition-colors disabled:opacity-50">
        {{ submitting ? 'Please wait…' : 'Log in' }}
      </button>

      <div class="text-center mt-6 text-[14px] text-[var(--color-text-muted)]">
        Don't have an account?
        <router-link :to="{ path: '/signup', query: route.query.redirect ? { redirect: route.query.redirect } : {} }" class="text-[var(--color-brand)] font-semibold">Sign up</router-link>
      </div>

      <button type="button" @click="router.push('/book')" class="w-full py-3 mt-4 text-[14px] font-semibold text-[var(--color-text-muted)] active:text-[var(--color-text-secondary)] transition-colors">
        Continue as guest
      </button>
    </form>

    <div class="px-6 py-6">
      <p class="text-[12px] text-[var(--color-text-muted)] text-center leading-relaxed">
        By continuing, you agree to our <router-link to="/terms" class="underline">Terms of Service</router-link> and <router-link to="/privacy" class="underline">Privacy Policy</router-link>.
      </p>
    </div>
  </div>
</template>
