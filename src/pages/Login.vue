<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../lib/useAuth'

const router = useRouter()
const route = useRoute()
const { signIn } = useAuth()

const email = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

async function handleLogin() {
  error.value = ''
  if (!email.value.trim() || !password.value) {
    error.value = 'Please enter your email and password.'
    return
  }
  submitting.value = true
  const { error: authError } = await signIn(email.value.trim(), password.value)
  submitting.value = false
  if (authError) {
    error.value = authError.message
    return
  }
  const redirect = route.query.redirect || '/'
  router.push(redirect)
}
</script>

<template>
  <div class="min-h-screen bg-white text-[#1a1a1a] flex flex-col">
    <!-- Top bar -->
    <div class="flex items-center px-4 pt-12 pb-4">
      <button @click="router.push('/welcome')" class="w-10 h-10 flex items-center justify-center rounded-full active:bg-[#1a1a1a]/5">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </div>

    <div class="flex-1 px-6 pt-4 w-full max-w-md mx-auto">
      <h1 class="font-serif text-[28px] font-bold leading-tight mb-2">Welcome back</h1>
      <p class="text-[#1a1a1a]/50 text-[14px] mb-8">Log in with your email and password</p>

      <div class="space-y-3 mb-4">
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
            placeholder="Password"
            autocomplete="current-password"
            @keyup.enter="handleLogin"
            class="w-full px-4 py-3.5 bg-[#1a1a1a]/[0.04] rounded-xl border border-[#1a1a1a]/8 text-[14px] outline-none focus:border-[#58cc02] transition-colors placeholder:text-[#1a1a1a]/50"
          />
        </label>
      </div>

      <p v-if="error" class="text-red-500 text-[13px] mb-4">{{ error }}</p>

      <button
        @click="handleLogin"
        :disabled="submitting"
        class="w-full py-3.5 bg-[#58cc02] text-white font-bold rounded-xl text-[14px] active:bg-[#4ab300] transition-colors disabled:opacity-50"
      >
        {{ submitting ? 'Logging in...' : 'Log in' }}
      </button>

      <div class="text-center mt-6 text-[14px] text-[#1a1a1a]/50">
        Don't have an account?
        <router-link to="/signup" class="text-[#58cc02] font-semibold">Sign up</router-link>
      </div>
    </div>

    <div class="px-6 py-6">
      <p class="text-[12px] text-[#1a1a1a]/35 text-center leading-relaxed">
        By continuing, you agree to our <router-link to="/terms" class="underline">Terms of Service</router-link> and <router-link to="/privacy" class="underline">Privacy Policy</router-link>.
      </p>
    </div>
  </div>
</template>
