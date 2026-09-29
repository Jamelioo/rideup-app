<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

const router = useRouter()
const { user } = useAuth()

const loading = ref(true)
const copied = ref(false)
const referrals = ref([])
const totalCredits = ref(0)

const referralCode = computed(() => {
  if (!user.value?.id) return 'RIDEUP-XXXX'
  const hash = user.value.id.replace(/-/g, '').slice(0, 6).toUpperCase()
  return `RIDEUP-${hash}`
})

const shareMessage = computed(() =>
  `Get $5 off your first RideUp ride in Nassau! Use my code ${referralCode.value} when you sign up. Download RideUp today.`
)

const whatsappUrl = computed(() =>
  `https://wa.me/?text=${encodeURIComponent(shareMessage.value)}`
)

const smsUrl = computed(() =>
  `sms:?body=${encodeURIComponent(shareMessage.value)}`
)

onMounted(() => {
  loadReferrals()
})

function loadReferrals() {
  const meta = user.value?.user_metadata
  referrals.value = Array.isArray(meta?.referral_history) ? [...meta.referral_history] : []
  totalCredits.value = meta?.referral_credits || 0
  loading.value = false
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(referralCode.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // Fallback for older browsers
    const el = document.createElement('textarea')
    el.value = referralCode.value
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const steps = [
  { number: '1', title: 'Share your code', description: 'Send your unique referral code to friends' },
  { number: '2', title: 'Friend signs up', description: 'They create an account using your code' },
  { number: '3', title: 'Both get $5', description: 'You and your friend each earn $5 credit' },
]
</script>

<template>
  <div class="min-h-screen bg-[var(--color-surface)] font-[var(--font-sans)] text-[var(--color-text-primary)] flex flex-col">
    <!-- Top Bar -->
    <div class="flex items-center gap-3 px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4 max-w-lg mx-auto w-full">
      <button @click="router.back()" class="w-10 h-10 flex items-center justify-center">
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
        <h2 class="text-2xl font-bold mb-2">Invite friends, earn $5</h2>
        <p class="text-[14px] text-[var(--color-text-muted)]">Share your code and you both get $5 credit toward your next ride</p>
      </div>

      <!-- Referral Code -->
      <div class="mb-6">
        <h2 class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Your referral code</h2>
        <div class="border-2 border-dashed border-[#2b8659]/30 rounded-xl p-4 flex items-center justify-between bg-[var(--color-surface-secondary)]/50">
          <span class="text-xl font-bold tracking-[0.15em] text-[#2b8659]">{{ referralCode }}</span>
          <button
            @click="copyCode"
            class="flex items-center gap-1.5 px-4 py-2 bg-[#2b8659] text-white text-[13px] font-bold rounded-lg active:scale-[0.97] transition-all"
          >
            <svg v-if="!copied" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {{ copied ? 'Copied' : 'Copy' }}
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
            class="flex items-center justify-center gap-2 py-3.5 bg-[var(--color-text-primary)] text-white font-bold text-[14px] rounded-xl active:scale-[0.97] transition-all"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            SMS
          </a>
        </div>
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

      <!-- Credits Balance -->
      <div class="mb-6">
        <div class="bg-[var(--color-text-primary)] rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p class="text-white/50 text-[12px] uppercase tracking-wider font-semibold">Total credits earned</p>
            <p class="text-white text-3xl font-bold mt-1">${{ totalCredits.toFixed(2) }}</p>
          </div>
          <div class="w-12 h-12 bg-[var(--color-surface)]/10 rounded-full flex items-center justify-center">
            <svg class="w-6 h-6 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Referral History -->
      <div class="mb-8">
        <h2 class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Referral history</h2>

        <div v-if="loading" class="py-12 text-center">
          <svg class="w-6 h-6 animate-spin text-[#2b8659] mx-auto" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4 31.4" stroke-linecap="round" />
          </svg>
        </div>

        <div v-else-if="referrals.length === 0" class="py-10 text-center border border-[var(--color-border)] rounded-xl">
          <svg class="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p class="text-[14px] text-[var(--color-text-muted)]">No referrals yet</p>
          <p class="text-[13px] text-[var(--color-text-muted)] mt-1">Share your code to start earning</p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="ref in referrals"
            :key="ref.email"
            class="border border-[var(--color-border)] rounded-xl p-4 flex items-center justify-between"
          >
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-[var(--color-surface-secondary)] flex items-center justify-center">
                <span class="text-[#2b8659] text-[13px] font-bold">{{ ref.name?.charAt(0)?.toUpperCase() || '?' }}</span>
              </div>
              <div>
                <p class="text-[14px] font-bold">{{ ref.name || 'Friend' }}</p>
                <p class="text-[12px] text-[var(--color-text-muted)]">{{ formatDate(ref.date) }}</p>
              </div>
            </div>
            <span class="text-[#2b8659] text-[14px] font-bold">+$5.00</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom padding -->
    <div class="h-8"></div>
  </div>
</template>
