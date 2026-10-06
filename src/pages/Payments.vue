<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../lib/useAuth'
import { apiPost } from '../lib/api'
import { supabase, supabaseConfigured } from '../lib/supabase'

const router = useRouter()
const route = useRoute()
const { user } = useAuth()

const loading = ref(false)
const error = ref(null)
const cardAdded = ref(route.query.card === 'added')
const card = ref(null) // { brand, last4 } when a card is on file

async function loadCard() {
  if (!supabaseConfigured || !user.value) return
  const { data } = await supabase
    .from('riders')
    .select('payment_method_id, card_brand, card_last4')
    .eq('auth_user_id', user.value.id)
    .maybeSingle()
  card.value = data?.payment_method_id
    ? { brand: data.card_brand || 'Card', last4: data.card_last4 || '' }
    : null
}

const brandLabel = (b) => (b ? b.charAt(0).toUpperCase() + b.slice(1) : 'Card')

async function addCard() {
  loading.value = true
  error.value = null

  try {
    const res = await apiPost('/api/create-setup-session')
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

onMounted(async () => {
  await loadCard()
  if (cardAdded.value) {
    setTimeout(() => { cardAdded.value = false }, 4000)
    // The card is saved by Stripe's webhook a moment after redirecting back; check again shortly.
    if (!card.value) setTimeout(loadCard, 3000)
  }
})
</script>

<template>
  <div class="min-h-dvh bg-[var(--color-surface)] text-[var(--color-text-primary)]">

    <!-- Top bar -->
    <div class="sticky top-0 z-40 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
      <div class="flex items-center px-4 py-3.5">
        <button
          @click="router.back()"
          class="w-11 h-11 flex items-center justify-center rounded-full active:bg-[#191f1c]/5 transition-colors"
         aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
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
      <div v-if="cardAdded" class="mb-4 bg-[#2b8659]/10 text-[var(--color-brand)] text-[14px] font-medium rounded-xl px-4 py-3 flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Card added successfully
      </div>

      <!-- Error -->
      <div v-if="error" class="mb-4 bg-red-50 text-[var(--color-danger)] text-[14px] rounded-xl px-4 py-3">
        {{ error }}
      </div>

      <!-- Payment methods section -->
      <section>
        <h2 class="text-[13px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Payment method</h2>

        <div class="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden">

          <!-- Stripe Checkout — default -->
          <div class="flex items-center gap-4 px-5 py-4">
            <div class="w-10 h-10 rounded-full bg-[#2b8659]/10 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2b8659" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            </div>
            <div class="flex-1">
              <span class="text-[15px] font-medium text-[var(--color-text-primary)]">
                {{ card ? `${brandLabel(card.brand)}${card.last4 ? ' •••• ' + card.last4 : ''}` : 'No card on file' }}
              </span>
              <p class="text-[13px] text-[var(--color-text-muted)] mt-0.5">
                {{ card ? 'Used for your rides' : 'Add a card to request rides' }}
              </p>
            </div>
            <div v-if="card" class="w-6 h-6 rounded-full bg-[#2b8659] flex items-center justify-center shrink-0" aria-label="Default payment method">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>

          <!-- Divider -->
          <div class="mx-5 border-t border-[var(--color-border)]"></div>

          <!-- Add a card -->
          <button @click="addCard" :disabled="loading" class="w-full flex items-center gap-4 px-5 py-4 active:bg-[#191f1c]/3 transition-colors disabled:opacity-50">
            <div class="w-10 h-10 rounded-full bg-[var(--color-text-primary)]/5 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="text-[var(--color-text-muted)]" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <span class="flex-1 text-left text-[15px] font-medium text-[var(--color-text-muted)]">
              {{ loading ? 'Opening...' : (card ? 'Replace card' : 'Add a card') }}
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="text-[var(--color-text-muted)] shrink-0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>


        </div>
      </section>

      <!-- How it works -->
      <section class="mt-8">
        <div class="bg-[var(--color-surface-secondary)] rounded-2xl px-5 py-5">
          <div class="flex gap-3.5">
            <div class="shrink-0 mt-0.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="text-[var(--color-text-muted)]" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <div>
              <p class="text-[14px] font-semibold text-[var(--color-text-primary)] leading-snug">How payment works</p>
              <p class="text-[13px] text-[var(--color-text-muted)] mt-1.5 leading-relaxed">
                When a driver accepts your ride, a hold for the fare is placed on your card. You're charged the exact fare you saw when the trip ends, and the hold is released if the ride is cancelled. All payments are processed in USD.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Powered by Stripe -->
      <div class="mt-6 flex items-center justify-center gap-2 text-[13px] text-[var(--color-text-muted)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
        <span>Secured by Stripe</span>
      </div>

    </div>
  </div>
</template>
