<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { loadRewards, redeemReferral } from '../lib/rewards'
import { formatFare } from '../lib/pricing'
import { DEMO_MODE } from '../lib/demoMode'

const router = useRouter()

const copied = ref(false)
const rewards = ref(DEMO_MODE ? { referral_code: 'RIDE7K2QF', credit_cents: 500, referral_discount_pending: false, friends_joined: 2, friends_rewarded: 1 } : null)
const loading = ref(!DEMO_MODE)

onMounted(async () => {
  if (!DEMO_MODE) rewards.value = await loadRewards()
  loading.value = false
})

const referralCode = computed(() => rewards.value?.referral_code || '')
const shareLink = computed(() => (referralCode.value ? `https://rideupnassau.com/r/${referralCode.value}` : 'https://rideupnassau.com'))
const shareMessage = computed(() =>
  `I ride with RideUp around Nassau. Use my link and get $5 off your first ride: ${shareLink.value}`
)
const whatsappUrl = computed(() => `https://wa.me/?text=${encodeURIComponent(shareMessage.value)}`)
const smsUrl = computed(() => `sms:?&body=${encodeURIComponent(shareMessage.value)}`)

async function copyLink() {
  try {
    if (navigator.share) {
      await navigator.share({ title: 'RideUp', text: shareMessage.value })
      return
    }
    await navigator.clipboard.writeText(shareMessage.value)
  } catch {
    return
  }
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

// New riders can enter a friend's code before their first trip.
const friendCode = ref('')
const friendMsg = ref('')
const friendOk = ref(false)
const friendBusy = ref(false)
async function applyFriendCode() {
  const code = friendCode.value.trim().toUpperCase()
  if (!code) return
  friendBusy.value = true
  friendMsg.value = ''
  const res = await redeemReferral(code)
  friendBusy.value = false
  friendOk.value = res.ok
  friendMsg.value = res.ok ? `Done! You’ll get $5 off your first ride, thanks to ${res.friendName}.` : res.message
  if (res.ok) {
    friendCode.value = ''
    rewards.value = await loadRewards()
  }
}

const steps = [
  { number: '1', title: 'Share your link', description: 'Send it to friends and family in Nassau' },
  { number: '2', title: 'They get $5 off', description: 'Their first RideUp ride is $5 cheaper' },
  { number: '3', title: 'You get $5 credit', description: 'Added once they finish that first ride, used on your next trip' },
]
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
      <h1 class="text-xl font-bold">Invite Friends</h1>
    </div>

    <div class="px-5 max-w-lg mx-auto w-full flex-1">
      <!-- Hero Section -->
      <div class="bg-[var(--color-surface-secondary)] rounded-2xl p-6 mb-6 text-center">
        <div class="w-14 h-14 bg-[#2b8659] rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
          </svg>
        </div>
        <h2 class="text-2xl font-bold mb-2">Invite friends</h2>
        <p class="text-[14px] text-[var(--color-text-muted)]">Give friends $5 off their first ride. Get $5 credit when they finish it.</p>
        <p v-if="rewards" class="text-[13px] text-[var(--color-text-secondary)] mt-3">
          {{ rewards.friends_joined }} friend{{ rewards.friends_joined === 1 ? '' : 's' }} joined · {{ rewards.friends_rewarded }} rode · Your credit: <strong>{{ formatFare(rewards.credit_cents) }}</strong>
        </p>
      </div>

      <!-- Referral Code -->
      <div class="mb-6">
        <h2 class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Your referral code</h2>
        <div class="border-2 border-dashed border-[#2b8659]/30 rounded-xl p-4 flex items-center justify-between bg-[var(--color-surface-secondary)]/50">
          <span class="text-xl font-bold tracking-[0.15em] text-[var(--color-brand)]">{{ loading ? '…' : referralCode || 'Book a ride to get your code' }}</span>
          <button
            @click="copyLink"
            :disabled="!referralCode"
            class="flex items-center gap-1.5 px-4 py-2 bg-[#2b8659] text-white text-[13px] font-bold rounded-lg active:scale-[0.97] transition-all"
          >
            <svg v-if="!copied" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {{ copied ? 'Copied' : 'Share' }}
          </button>
        </div>
      </div>

      <!-- Share Buttons -->
      <div class="mb-8">
        <h2 class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Share via</h2>
        <div class="grid grid-cols-2 gap-3">
          <a
            :href="whatsappUrl"
            target="_blank"
            class="flex items-center justify-center gap-2 py-3.5 bg-[#25D366] text-white font-bold text-[14px] rounded-xl active:scale-[0.97] transition-all"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </a>
          <a
            :href="smsUrl"
            class="flex items-center justify-center gap-2 py-3.5 bg-[#191f1c] text-white font-bold text-[14px] rounded-xl active:scale-[0.97] transition-all"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            SMS
          </a>
        </div>
      </div>

      <!-- Enter a friend's code (new riders) -->
      <div v-if="!DEMO_MODE && rewards && !rewards.referral_discount_pending" class="mb-8">
        <h2 class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Have a friend’s code?</h2>
        <form @submit.prevent="applyFriendCode" class="flex gap-2">
          <label class="sr-only" for="friend-code">Friend’s referral code</label>
          <input id="friend-code" v-model="friendCode" autocapitalize="characters" autocomplete="off" placeholder="RIDE…"
                 class="flex-1 min-w-0 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] uppercase" />
          <button type="submit" :disabled="friendBusy" class="px-5 rounded-xl bg-[#2b8659] text-white font-bold disabled:opacity-50">{{ friendBusy ? '…' : 'Apply' }}</button>
        </form>
        <p v-if="friendMsg" class="text-[13px] mt-2" :class="friendOk ? 'text-[var(--color-brand)]' : 'text-[var(--color-danger)]'" role="status">{{ friendMsg }}</p>
        <p class="text-[12px] text-[var(--color-text-muted)] mt-1">For new riders, before their first trip.</p>
      </div>

      <!-- How It Works -->
      <div class="mb-8">
        <h2 class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">How it works</h2>
        <div class="space-y-4">
          <div v-for="step in steps" :key="step.number" class="flex items-start gap-4">
            <div class="w-8 h-8 rounded-full bg-[#2b8659] flex items-center justify-center shrink-0">
              <span class="text-white text-[13px] font-bold">{{ step.number }}</span>
            </div>
            <div>
              <p class="text-[15px] font-bold">{{ step.title }}</p>
              <p class="text-[13px] text-[var(--color-text-muted)]">{{ step.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom padding -->
    <div class="h-8"></div>
  </div>
</template>
