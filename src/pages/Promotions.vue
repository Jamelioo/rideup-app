<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PromoInput from '../components/PromoInput.vue'
import { formatFare } from '../lib/pricing'
import { getSavedPromo, savePromo, clearSavedPromo, checkPromo, loadRewards } from '../lib/rewards'
import { DEMO_MODE } from '../lib/demoMode'

const router = useRouter()

const loading = ref(true)
const promo = ref(getSavedPromo())
const rewards = ref(null)

onMounted(async () => {
  if (!DEMO_MODE) {
    rewards.value = await loadRewards()
    if (promo.value) {
      const res = await checkPromo(promo.value.code)
      if (!res.ok) { clearSavedPromo(); promo.value = null }
    }
  }
  loading.value = false
})

// The code is checked by the server now and again when the ride is booked; it's used up when that ride is completed.
async function handleApplyCode(code) {
  if (DEMO_MODE) return { success: false, message: 'Promo codes work once the app is connected.' }
  const res = await checkPromo(code)
  if (!res.ok) return { success: false, message: res.message }
  promo.value = res.promo
  savePromo(res.promo)
  return { success: true, message: `${formatFare(res.promo.amount_cents)} off your next ride` }
}

function removePromo() {
  promo.value = null
  clearSavedPromo()
}
</script>

<template>
  <div class="min-h-dvh bg-[var(--color-surface)] font-[var(--font-sans)] text-[var(--color-text-primary)] flex flex-col">
    <div class="flex items-center gap-3 px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4 max-w-lg mx-auto w-full">
      <button @click="router.back()" class="w-10 h-10 flex items-center justify-center" aria-label="Back">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-xl font-bold">Promotions</h1>
    </div>

    <div class="px-5 max-w-lg mx-auto w-full flex-1 space-y-8">
      <!-- Credit and referral reward -->
      <div v-if="rewards && (rewards.credit_cents > 0 || rewards.referral_discount_pending)" class="rounded-2xl bg-[#2b8659]/10 p-4 space-y-1">
        <p v-if="rewards.credit_cents > 0" class="text-[15px] font-bold">{{ formatFare(rewards.credit_cents) }} RideUp credit</p>
        <p v-if="rewards.credit_cents > 0" class="text-[13px] text-[var(--color-text-secondary)]">Used automatically on your next rides.</p>
        <p v-if="rewards.referral_discount_pending" class="text-[15px] font-bold">$5.00 off your first ride</p>
        <p v-if="rewards.referral_discount_pending" class="text-[13px] text-[var(--color-text-secondary)]">From your friend’s referral. Applied automatically when you book.</p>
      </div>

      <div>
        <h2 class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Enter promo code</h2>
        <PromoInput :on-apply="handleApplyCode" />
        <p class="text-[12px] text-[var(--color-text-muted)] mt-2">One promo per ride. It’s used when that ride is completed; if the ride is cancelled you keep it.</p>
      </div>

      <div>
        <h2 class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Next ride</h2>
        <p v-if="loading" class="text-[14px] text-[var(--color-text-muted)]" role="status">Loading…</p>
        <div v-else-if="promo" class="border border-[var(--color-border)] rounded-xl p-4 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-[15px] font-bold tracking-wider">{{ promo.code }}</span>
              <span class="bg-[var(--color-surface-secondary)] text-[var(--color-brand)] text-[12px] font-bold px-2 py-0.5 rounded-md">{{ formatFare(promo.amount_cents) }} off</span>
            </div>
            <p v-if="promo.description" class="text-[12px] text-[var(--color-text-muted)] truncate">{{ promo.description }}</p>
          </div>
          <button @click="removePromo" class="text-[13px] text-[var(--color-text-muted)] px-2 py-1" aria-label="Remove promo code">Remove</button>
        </div>
        <p v-else class="text-[14px] text-[var(--color-text-muted)]">No promo code added.</p>
      </div>

      <button @click="router.push('/referrals')" class="w-full text-left rounded-2xl border border-[var(--color-border)] p-4">
        <p class="text-[15px] font-bold">Invite friends, get $5</p>
        <p class="text-[13px] text-[var(--color-text-secondary)]">They get $5 off their first ride, you get $5 credit when they finish it.</p>
      </button>
    </div>

    <div class="h-8"></div>
  </div>
</template>
