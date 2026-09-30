<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'
import PromoInput from '../components/PromoInput.vue'

const router = useRouter()
const { user } = useAuth()

const promos = ref([])
const loading = ref(true)
const successBanner = ref('')

// Sample valid promo codes for demonstration
const validCodes = {
  RIDEUP10: { discount: '$10 off', amount: 10, type: 'fixed', expiry: '2027-01-31' },
  NASSAU5: { discount: '$5 off', amount: 5, type: 'fixed', expiry: '2027-03-31' },
  FIRST20: { discount: '20% off', amount: 20, type: 'percent', expiry: '2027-06-30' },
  WELCOME: { discount: '$3 off', amount: 3, type: 'fixed', expiry: '2027-12-31' },
}

onMounted(() => {
  loadPromos()
})

function loadPromos() {
  const meta = user.value?.user_metadata
  promos.value = Array.isArray(meta?.promo_codes) ? [...meta.promo_codes] : []
  loading.value = false
}

async function handleApplyCode(code) {
  // Check if already applied
  if (promos.value.some((p) => p.code === code)) {
    return { success: false, message: 'This code has already been applied' }
  }

  // Validate code
  const promo = validCodes[code]
  if (!promo) {
    return { success: false, message: 'Invalid promo code. Check the code and try again.' }
  }

  // Check expiry
  if (new Date(promo.expiry) < new Date()) {
    return { success: false, message: 'This promo code has expired' }
  }

  const newPromo = {
    code,
    discount: promo.discount,
    amount: promo.amount,
    type: promo.type,
    expiry: promo.expiry,
    appliedAt: new Date().toISOString(),
  }

  const updated = [...promos.value, newPromo]

  try {
    const { error } = await supabase.auth.updateUser({
      data: { promo_codes: updated },
    })

    if (error) {
      return { success: false, message: 'Failed to save promo code. Try again.' }
    }

    promos.value = updated
    successBanner.value = `${promo.discount} applied to your account`
    setTimeout(() => { successBanner.value = '' }, 4000)
    return { success: true, message: `${promo.discount} — added to your account` }
  } catch {
    return { success: false, message: 'Something went wrong. Try again.' }
  }
}

async function removePromo(code) {
  const updated = promos.value.filter((p) => p.code !== code)
  try {
    const { error } = await supabase.auth.updateUser({
      data: { promo_codes: updated },
    })
    if (!error) {
      promos.value = updated
    }
  } catch {
    // silent
  }
}

function formatExpiry(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <div class="min-h-dvh bg-[var(--color-surface)] font-[var(--font-sans)] text-[var(--color-text-primary)] flex flex-col">
    <!-- Top Bar -->
    <div class="flex items-center gap-3 px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4 max-w-lg mx-auto w-full">
      <button @click="router.back()" class="w-10 h-10 flex items-center justify-center" aria-label="Back">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-xl font-bold">Promotions</h1>
    </div>

    <!-- Success Banner -->
    <Transition name="fade">
      <div v-if="successBanner" class="mx-5 mb-4 max-w-lg mx-auto w-full">
        <div class="bg-[var(--color-surface-secondary)] border border-[#2b8659]/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <svg class="w-5 h-5 text-[var(--color-brand)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-[14px] font-medium text-[var(--color-brand)]">{{ successBanner }}</span>
        </div>
      </div>
    </Transition>

    <div class="px-5 max-w-lg mx-auto w-full flex-1">
      <!-- Promo Input -->
      <div class="mb-8">
        <h2 class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Enter promo code</h2>
        <PromoInput :on-apply="handleApplyCode" />
      </div>

      <!-- Applied Promos -->
      <div>
        <h2 class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Your promotions</h2>

        <div v-if="loading" class="py-12 text-center">
          <svg class="w-6 h-6 animate-spin text-[var(--color-brand)] mx-auto" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4 31.4" stroke-linecap="round" />
          </svg>
        </div>

        <div v-else-if="promos.length === 0" class="py-12 text-center">
          <svg class="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <p class="text-[14px] text-[var(--color-text-muted)]">No promo codes applied yet</p>
          <p class="text-[13px] text-[var(--color-text-muted)] mt-1">Enter a code above to get started</p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="promo in promos"
            :key="promo.code"
            class="border border-[var(--color-border)] rounded-xl p-4 flex items-center justify-between"
          >
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[15px] font-bold tracking-wider">{{ promo.code }}</span>
                <span class="bg-[var(--color-surface-secondary)] text-[var(--color-brand)] text-[12px] font-bold px-2 py-0.5 rounded-md">{{ promo.discount }}</span>
              </div>
              <p class="text-[12px] text-[var(--color-text-muted)]">Expires {{ formatExpiry(promo.expiry) }}</p>
            </div>
            <button @click="removePromo(promo.code)" class="text-[var(--color-text-muted)] hover:text-red-500 transition-colors p-1" aria-label="Remove promo code">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom padding -->
    <div class="h-8"></div>
  </div>
</template>
