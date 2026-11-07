<script setup>
import RiderQuotes from '../components/RiderQuotes.vue'
import { goBack as backOr } from '../lib/goBack'
import { useRouter } from 'vue-router'
import { formatAmount } from '../lib/pricing'
import { DRIVER_CANCEL_CREDIT_CENTS } from '../lib/policy'

const router = useRouter()
const credit = DRIVER_CANCEL_CREDIT_CENTS > 0 ? formatAmount(DRIVER_CANCEL_CREDIT_CENTS) : ''
// What RideUp promises, all of it true in the app today.
const promises = [
  { title: 'Your price, locked', text: 'You see the exact fare before you book. Traffic or a longer route won’t change it.' },
  { title: 'Pay your driver cash', text: 'No card and no app to download. Pay the price you saw at drop-off.' },
  { title: 'Approved local drivers', text: 'Every driver is approved by RideUp. You see their name, photo, car and plate before pickup.' },
]

function goBack() {
  backOr(router, '/')
}

const menuItems = [
  {
    label: 'Follow us on social media',
    icon: 'share',
    hasChevron: true,
    href: 'https://instagram.com/rideupnassau',
  },
  {
    label: 'Careers at RideUp',
    icon: 'people',
    hasChevron: true,
    href: 'mailto:careers@rideupnassau.com?subject=Career%20Inquiry',
  },
  {
    label: 'Legal',
    icon: 'document',
    hasChevron: true,
    route: '/terms',
  },
]

function handleMenuClick(item) {
  if (item.route) {
    router.push(item.route)
  } else if (item.href) {
    window.open(item.href, '_blank')
  }
}
</script>

<template>
  <div class="min-h-dvh bg-[var(--color-surface)] text-[var(--color-text-primary)] flex flex-col">
    <!-- Top Bar -->
    <div class="flex items-center justify-between px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4">
      <button @click="goBack" class="w-11 h-11 flex items-center justify-center text-[var(--color-text-primary)]" aria-label="Back">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="w-10 h-10"></div>
    </div>

    <!-- Title and what RideUp stands for -->
    <div class="px-5 mb-8 max-w-2xl">
      <h1 class="text-3xl font-bold mb-3">About RideUp</h1>
      <p class="text-[16px] leading-[1.6] text-[var(--color-text-secondary)]">RideUp is a ride service made in Nassau for New Providence. Book in your browser, know the fare before you ride, and pay your driver in cash. A local team answers when you call.</p>
    </div>

    <div class="px-5 max-w-2xl space-y-3 mb-6">
      <div v-for="item in promises" :key="item.title" class="rounded-2xl bg-[var(--color-surface-secondary)] p-4">
        <h2 class="text-[16px] font-bold mb-0.5">{{ item.title }}</h2>
        <p class="text-[14px] leading-[1.5] text-[var(--color-text-secondary)]">{{ item.text }}</p>
      </div>
      <div class="rounded-2xl bg-[#0F3D2A] text-white p-4">
        <h2 class="text-[16px] font-bold mb-0.5">The RideUp Guarantee</h2>
        <p class="text-[14px] leading-[1.5] text-white/90">If your driver cancels, we find you another driver at the same price{{ credit ? ` and add ${credit} credit to your account` : '' }}. If no driver accepts, you pay nothing.</p>
      </div>
    </div>

    <RiderQuotes class="px-5 max-w-2xl mb-8" />

    <div class="px-5 max-w-2xl flex flex-wrap gap-3 mb-10">
      <router-link to="/book" class="inline-flex items-center justify-center min-h-[48px] px-6 rounded-xl bg-[#2b8659] text-white font-bold text-[16px]">See my price</router-link>
      <router-link to="/drive" class="inline-flex items-center justify-center min-h-[48px] px-6 rounded-xl border-2 border-[var(--color-text-primary)] font-bold text-[16px]">Drive with RideUp</router-link>
    </div>

    <div class="px-5 max-w-2xl mb-2">
      <h2 class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Contact</h2>
      <p class="text-[15px] mt-2 leading-[1.8]">
        <a href="tel:+12424529911" class="font-semibold text-[var(--color-brand)] inline-block py-1">(242) 452-9911</a> · call or WhatsApp<br />
        <a href="mailto:support@rideupnassau.com" class="font-semibold text-[var(--color-brand)] inline-block py-1">support@rideupnassau.com</a>
      </p>
    </div>

    <!-- Menu Items -->
    <div class="px-5 flex-1 max-w-2xl w-full">
      <!-- Version -->
      <div class="flex items-center justify-between py-4 border-b border-[var(--color-border)]">
        <div class="flex items-center gap-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-base">Version</span>
        </div>
        <span class="text-sm text-[var(--color-text-muted)]">1.0.0</span>
      </div>

      <!-- Dynamic Menu Items -->
      <button
        v-for="(item, index) in menuItems"
        :key="index"
        class="w-full flex items-center justify-between py-4 border-b border-[var(--color-border)] transition-colors duration-150 hover:bg-[var(--color-surface-secondary)] active:bg-[var(--color-surface-secondary)] rounded-sm"
        @click="handleMenuClick(item)"
      >
        <div class="flex items-center gap-4">
          <!-- Star Icon -->
          <svg v-if="item.icon === 'star'" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>

          <!-- Share Icon -->
          <svg v-else-if="item.icon === 'share'" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>

          <!-- People Icon -->
          <svg v-else-if="item.icon === 'people'" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>

          <!-- Document Icon -->
          <svg v-else-if="item.icon === 'document'" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>

          <span class="text-base text-[var(--color-text-primary)]">{{ item.label }}</span>
        </div>

        <!-- Chevron Right -->
        <svg v-if="item.hasChevron" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <!-- Footer -->
    <div class="py-8 text-center">
      <p class="text-sm text-[var(--color-text-muted)]">RideUp Nassau</p>
    </div>

  </div>
</template>
