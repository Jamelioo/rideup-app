<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../lib/useAuth'

const router = useRouter()
const route = useRoute()
const { user } = useAuth()

const loading = ref(false)
const error = ref(null)
const cardAdded = ref(route.query.card === 'added')

async function addCard() {
  loading.value = true
  error.value = null

  try {
    const res = await fetch('/api/create-setup-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.value?.email }),
    })
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
      return
    }
    error.value = data.error || 'Could not open card setup. Try again.'
  } catch (err) {
    error.value = 'Could not connect. Check your internet and try again.'
  }
  loading.value = false
}

onMounted(() => {
  if (cardAdded.value) {
    setTimeout(() => { cardAdded.value = false }, 4000)
  }
})
</script>

<template>
  <div class="min-h-screen bg-white text-[#191f1c]">

    <!-- Top bar -->
    <div class="sticky top-0 z-40 bg-white border-b border-[#191f1c]/8">
      <div class="flex items-center px-4 py-3.5">
        <button
          @click="router.back()"
          class="w-9 h-9 flex items-center justify-center rounded-full active:bg-[#191f1c]/5 transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#191f1c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 class="flex-1 text-center text-[17px] font-bold">Payments</h1>
        <div class="w-9"></div>
      </div>
    </div>

    <div class="px-5 pt-6 pb-10 max-w-lg mx-auto">

      <!-- Success banner -->
      <div v-if="cardAdded" class="mb-4 bg-[#2b8659]/10 text-[#2b8659] text-[14px] font-medium rounded-xl px-4 py-3 flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Card added successfully
      </div>

      <!-- Error -->
      <div v-if="error" class="mb-4 bg-red-50 text-red-600 text-[14px] rounded-xl px-4 py-3">
        {{ error }}
      </div>

      <!-- Payment methods section -->
      <section>
        <h2 class="text-[13px] font-semibold text-[#191f1c]/50 uppercase tracking-wide mb-3">Payment method</h2>

        <div class="bg-white rounded-2xl border border-[#191f1c]/8 overflow-hidden">

          <!-- Stripe Checkout — default -->
          <div class="flex items-center gap-4 px-5 py-4">
            <div class="w-10 h-10 rounded-full bg-[#2b8659]/10 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2b8659" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            </div>
            <div class="flex-1">
              <span class="text-[15px] font-medium text-[#191f1c]">Debit/Credit Card</span>
              <p class="text-[13px] text-[#191f1c]/45 mt-0.5">Pay securely when you confirm your ride</p>
            </div>
            <div class="w-6 h-6 rounded-full bg-[#2b8659] flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>

          <!-- Divider -->
          <div class="mx-5 border-t border-[#191f1c]/8"></div>

          <!-- Add a card -->
          <button @click="addCard" :disabled="loading" class="w-full flex items-center gap-4 px-5 py-4 active:bg-[#191f1c]/3 transition-colors disabled:opacity-50">
            <div class="w-10 h-10 rounded-full bg-[#191f1c]/5 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#191f1c" stroke-opacity="0.4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <span class="flex-1 text-left text-[15px] font-medium text-[#191f1c]/50">
              {{ loading ? 'Opening...' : 'Add a card' }}
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#191f1c" stroke-opacity="0.3" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          <!-- Divider -->
          <div class="mx-5 border-t border-[#191f1c]/8"></div>

          <!-- Cash option -->
          <div class="flex items-center gap-4 px-5 py-4 opacity-40">
            <div class="w-10 h-10 rounded-full bg-[#191f1c]/5 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#191f1c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            </div>
            <div class="flex-1">
              <span class="text-[15px] font-medium text-[#191f1c]">Cash</span>
              <p class="text-[13px] text-[#191f1c]/45 mt-0.5">Coming soon</p>
            </div>
          </div>

        </div>
      </section>

      <!-- How it works -->
      <section class="mt-8">
        <div class="bg-[#f5f5f5] rounded-2xl px-5 py-5">
          <div class="flex gap-3.5">
            <div class="shrink-0 mt-0.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#191f1c" stroke-opacity="0.35" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <div>
              <p class="text-[14px] font-semibold text-[#191f1c] leading-snug">How payment works</p>
              <p class="text-[13px] text-[#191f1c]/55 mt-1.5 leading-relaxed">
                When you confirm a ride, you'll be taken to a secure Stripe checkout page to enter your card details. You see the exact fare before paying. All payments are processed in BSD (Bahamian Dollar).
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Powered by Stripe -->
      <div class="mt-6 flex items-center justify-center gap-2 text-[13px] text-[#191f1c]/35">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
        <span>Secured by Stripe</span>
      </div>

    </div>
  </div>
</template>
