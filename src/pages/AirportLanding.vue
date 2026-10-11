<script setup>
import BrandLogo from '../components/BrandLogo.vue'
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { calculateFare, formatFare, AIRPORT, AIRPORT_FEE_CENTS, BOOKING_FEE_CENTS } from '../lib/pricing'
import { applyLandingOffer, landingPill as pill, landingPillReady as pillReady } from '../lib/landingOffer'
import { useSettings } from '../lib/settings'
import { trackStep } from '../lib/funnel'
import { tripLink } from '../lib/places'
import { SCHEDULING_ENABLED } from '../lib/features'

// Landing page for "Nassau airport taxi / ride" searches and airport ads. Example fares use the real pricing
// (normal traffic, RideUp Go, airport fee and booking fee included); the app shows the exact price first.
const router = useRouter()
// The first-ride offer (Admin › Promos) or an ad link's code, applied for them; the pill keeps its space while it loads.
applyLandingOffer()
const settings = useSettings()
const pickup = { lat: AIRPORT.lat, lng: AIRPORT.lng }
// Each opens booking from the airport with the destination filled in and priced (src/lib/places.js).
const DESTINATIONS = [
  { name: 'Cable Beach & Baha Mar', miles: 6, minutes: 13, to: 'cable-beach' },
  { name: 'Love Beach & Old Fort Bay', miles: 5, minutes: 10 },
  { name: 'Downtown Nassau & cruise port', miles: 10.5, minutes: 24, to: 'downtown' },
  { name: 'Paradise Island & Atlantis', miles: 13, minutes: 30, to: 'paradise-island' },
]
const fromAirport = { path: '/book', query: { from: 'airport' } }
const fares = computed(() => DESTINATIONS.map((d) => ({
  ...d,
  fare: calculateFare(d.miles, d.minutes, 'standard', { pickup }),
  link: d.to ? tripLink('airport', d.to) : fromAirport,
})))

let previousDescription = ''
onMounted(() => {
  const meta = document.querySelector('meta[name="description"]')
  previousDescription = meta?.getAttribute('content') || ''
  meta?.setAttribute('content', 'Rides from Lynden Pindling International Airport (NAS) to Cable Beach, Baha Mar, downtown Nassau and Paradise Island. See your price before you ride.')
  trackStep('landing')
})
onUnmounted(() => document.querySelector('meta[name="description"]')?.setAttribute('content', previousDescription))
</script>

<template>
  <div class="min-h-dvh bg-[var(--color-surface)] text-[var(--color-text-primary)]">
    <nav class="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
      <router-link to="/" class="text-[20px] font-bold"><BrandLogo /></router-link>
      <router-link to="/book" class="inline-flex items-center min-h-[44px] px-2 -mr-2 text-[14px] font-semibold text-[var(--color-brand)]">Book a ride</router-link>
    </nav>

    <header class="max-w-5xl mx-auto px-5 pt-6 pb-10">
      <!-- One line tall whatever it says, so nothing moves when the offer arrives -->
      <div class="min-h-[30px] mb-4">
        <p v-if="pillReady && pill" class="inline-flex flex-wrap items-center gap-x-1.5 rounded-full bg-[#2b8659]/8 px-3 py-1.5 text-[13px] leading-[18px] text-[var(--color-brand)]">
          <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M3 11.6V4a1 1 0 011-1h7.6a1 1 0 01.7.3l8.4 8.4a1 1 0 010 1.4l-7.6 7.6a1 1 0 01-1.4 0L3.3 12.3a1 1 0 01-.3-.7z"/></svg>
          <strong class="font-bold">{{ pill.title }}</strong>
          <span class="text-[var(--color-text-secondary)]">· {{ pill.note }}</span>
          <span v-if="pill.ends" class="text-[var(--color-text-secondary)]">· ends {{ pill.ends }}</span>
        </p>
      </div>
      <h1 class="text-[34px] md:text-[48px] leading-[1.05] font-bold tracking-tight max-w-2xl">Nassau airport rides with the price up front</h1>
      <p class="mt-4 text-[17px] text-[var(--color-text-secondary)] max-w-xl">Landed at Lynden Pindling (NAS)? Book a RideUp from the arrivals area, see your price before you ride and follow your driver on the map.</p>
      <div class="mt-6 flex flex-wrap gap-3">
        <button @click="router.push(fromAirport)" class="px-6 py-4 rounded-2xl bg-[#2b8659] text-white font-bold text-[16px] shadow-[0_4px_16px_rgba(43,134,89,0.3)]">Book from the airport</button>
        <button v-if="SCHEDULING_ENABLED" @click="router.push(fromAirport)" class="px-6 py-4 rounded-2xl border-2 border-[var(--color-border)] font-semibold text-[16px]">Schedule a pickup</button>
      </div>
    </header>

    <section class="max-w-5xl mx-auto px-5 pb-10" aria-labelledby="fares-title">
      <h2 id="fares-title" class="text-[22px] font-bold mb-1">Typical fares from the airport</h2>
      <p class="text-[13px] text-[var(--color-text-muted)] mb-4">RideUp Go, normal traffic, including the {{ formatFare(AIRPORT_FEE_CENTS) }} airport pickup fee and {{ formatFare(BOOKING_FEE_CENTS) }} booking fee. Tap a trip to see its exact price now; it doesn’t change during the trip.</p>
      <ul class="rounded-2xl border border-[var(--color-border)] divide-y divide-[var(--color-border)] overflow-hidden">
        <li v-for="f in fares" :key="f.name">
          <router-link :to="f.link" class="flex items-center justify-between gap-3 px-5 py-4 hover:bg-[var(--color-surface-secondary)] transition-colors">
            <span>
              <span class="block font-semibold text-[15px]">{{ f.name }}</span>
              <span class="block text-[13px] text-[var(--color-text-muted)]">about {{ f.minutes }} min</span>
            </span>
            <span class="flex items-center gap-2 ml-3">
              <span class="text-[18px] font-bold whitespace-nowrap">about {{ formatFare(f.fare) }}</span>
              <svg class="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
            </span>
          </router-link>
        </li>
      </ul>
    </section>

    <section class="max-w-5xl mx-auto px-5 pb-14 grid md:grid-cols-3 gap-4" aria-label="How it works">
      <div class="rounded-2xl bg-[var(--color-surface-secondary)] p-5"><p class="font-bold mb-1">1. Book</p><p class="text-[14px] text-[var(--color-text-secondary)]">Enter where you’re going and see the price. No account? Book as a guest with your name, phone and card.</p></div>
      <div class="rounded-2xl bg-[var(--color-surface-secondary)] p-5"><p class="font-bold mb-1">2. Meet your driver</p><p class="text-[14px] text-[var(--color-text-secondary)]">See your driver’s name, photo, car and plate. Message or call them in the app{{ settings.require_pickup_pin ? ', and use your PIN to start the trip' : '' }}.</p></div>
      <div class="rounded-2xl bg-[var(--color-surface-secondary)] p-5"><p class="font-bold mb-1">3. Ride and go</p><p class="text-[14px] text-[var(--color-text-secondary)]">{{ settings.accept_cash ? 'Share your trip with family. Pay by card, or in cash with a free account, and get your receipt by email.' : 'Share your trip with family, pay by card automatically, and get your receipt by email.' }}</p></div>
    </section>
  </div>
</template>
