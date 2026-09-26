<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../lib/useAuth'

const router = useRouter()
const { signUp } = useAuth()

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const submitting = ref(false)
const confirmed = ref(false)

function goBack() {
  window.history.length > 1 ? router.back() : router.push('/welcome')
}

async function handleSignup() {
  error.value = ''

  if (!name.value.trim()) {
    error.value = 'Please enter your name.'
    return
  }
  if (!email.value.trim()) {
    error.value = 'Please enter your email address.'
    return
  }
  if (password.value.length < 6) {
    error.value = 'Password must be at least 6 characters.'
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.'
    return
  }

  submitting.value = true
  const { error: authError } = await signUp(email.value.trim(), password.value, name.value.trim())
  submitting.value = false

  if (authError) {
    error.value = authError.message
    return
  }

  confirmed.value = true
  setTimeout(() => router.push('/login'), 3000)
}
</script>

<template>
  <div class="min-h-screen bg-white text-[#1a1a1a] flex flex-col">
    <!-- Top bar -->
    <div class="flex items-center px-4 pt-12 pb-4">
      <button @click="goBack" class="w-10 h-10 flex items-center justify-center rounded-full active:bg-[#1a1a1a]/5">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </div>

    <div class="flex-1 px-6 pt-4 w-full max-w-md mx-auto">
      <h1 class="font-serif text-[28px] font-bold leading-tight mb-2">Create your account</h1>
      <p class="text-[#1a1a1a]/50 text-[14px] mb-8">Enter your details to get started</p>

      <!-- Success state -->
      <div v-if="confirmed" class="bg-[#58cc02]/10 rounded-xl p-5 text-center">
        <div class="w-12 h-12 rounded-full bg-[#58cc02] flex items-center justify-center mx-auto mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p class="text-[16px] font-bold mb-1">Check your email</p>
        <p class="text-[14px] text-[#1a1a1a]/50">We sent a confirmation link to <strong>{{ email }}</strong>. Click it to activate your account.</p>
        <p class="text-[13px] text-[#1a1a1a]/35 mt-3">Redirecting to login...</p>
      </div>

      <!-- Form -->
      <template v-else>
        <div class="space-y-3 mb-4">
          <label class="block">
            <span class="sr-only">Full name</span>
            <input
              v-model="name"
              type="text"
              placeholder="Full name"
              autocomplete="name"
              class="w-full px-4 py-3.5 bg-[#1a1a1a]/[0.04] rounded-xl border border-[#1a1a1a]/8 text-[14px] outline-none focus:border-[#58cc02] transition-colors placeholder:text-[#1a1a1a]/50"
            />
          </label>
          <label class="block">
            <span class="sr-only">Email address</span>
            <input
              v-model="email"
              type="email"
              placeholder="Email address"
              autocomplete="email"
              class="w-full px-4 py-3.5 bg-[#1a1a1a]/[0.04] rounded-xl border border-[#1a1a1a]/8 text-[14px] outline-none focus:border-[#58cc02] transition-colors placeholder:text-[#1a1a1a]/50"
            />
          </label>
          <label class="block">
            <span class="sr-only">Password</span>
            <input
              v-model="password"
              type="password"
              placeholder="Password (min 6 characters)"
              autocomplete="new-password"
              class="w-full px-4 py-3.5 bg-[#1a1a1a]/[0.04] rounded-xl border border-[#1a1a1a]/8 text-[14px] outline-none focus:border-[#58cc02] transition-colors placeholder:text-[#1a1a1a]/50"
            />
          </label>
          <label class="block">
            <span class="sr-only">Confirm password</span>
            <input
              v-model="confirmPassword"
              type="password"
              placeholder="Confirm password"
              autocomplete="new-password"
              @keyup.enter="handleSignup"
              class="w-full px-4 py-3.5 bg-[#1a1a1a]/[0.04] rounded-xl border border-[#1a1a1a]/8 text-[14px] outline-none focus:border-[#58cc02] transition-colors placeholder:text-[#1a1a1a]/50"
            />
          </label>
        </div>

        <p v-if="error" class="text-red-500 text-[13px] mb-4">{{ error }}</p>

        <button
          @click="handleSignup"
          :disabled="submitting"
          class="w-full py-3.5 bg-[#58cc02] text-white font-bold rounded-xl text-[14px] active:bg-[#4ab300] transition-colors disabled:opacity-50"
        >
          {{ submitting ? 'Creating account...' : 'Sign up' }}
        </button>

        <div class="text-center mt-6 text-[14px] text-[#1a1a1a]/50">
          Already have an account?
          <router-link to="/login" class="text-[#58cc02] font-semibold">Log in</router-link>
        </div>
      </template>
    </div>

    <div class="px-6 py-6">
      <p class="text-[12px] text-[#1a1a1a]/35 text-center leading-relaxed">
        By continuing, you agree to our <router-link to="/terms" class="underline">Terms of Service</router-link> and <router-link to="/privacy" class="underline">Privacy Policy</router-link>.
      </p>
    </div>
  </div>
</template>
