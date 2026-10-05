<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { calculateFare, formatFare, AIRPORT, AIRPORT_FEE_CENTS, BOOKING_FEE_CENTS } from '../lib/pricing'
import { getPendingPromoCode } from '../lib/rewards'
import { SCHEDULING_ENABLED } from '../lib/features'

// Landing page for "Nassau airport taxi / ride" searches and airport ads. Example fares use the real pricing
// (normal traffic, RideUp Go, airport fee and booking fee included); the app shows the exact price first.
const router = useRouter()
const promo = getPendingPromoCode()
const pickup = { lat: AIRPORT.lat, lng: AIRPORT.lng }
const DESTINATIONS = [
  { name: 'Cable Beach & Baha Mar', miles: 6, minutes: 13 },
  { name: 'Love Beach & Old Fort Bay', miles: 5, minutes: 10 },
  { name: 'Downtown Nassau & cruise port', miles: 10.5, minutes: 24 },
  { name: 'Paradise Island & Atlantis', miles: 13, minutes: 30 },
]
const fares = computed(() => DESTINATIONS.map((d) => ({ ...d, fare: calculateFare(d.miles, d.minutes, 'standard', { pickup }) })))

let previousDescription = ''
onMounted(() => {
  const meta = document.querySelector('meta[name="description"]')
  previousDescription = meta?.getAttribute('content') || ''
  meta?.setAttribute('content', 'Rides from Lynden Pindling International Airport (NAS) to Cable Beach, Baha Mar, downtown Nassau and Paradise Island. Upfront price before you ride, pay by card, track your driver.')
})
onUnmounted(() => document.querySelector('meta[name="description"]')?.setAttribute('content', previousDescription))
</script>

<template>
  <div class="min-h-dvh bg-[var(--color-surface)] text-[var(--color-text-primary)]">
    <nav class="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
      <router-link to="/" class="text-[20px] font-bold">Ride<span class="text-[var(--color-brand)]">Up</span></router-link>
      <router-link to="/book" class="text-[14px] font-semibold text-[var(--color-brand)]">Book a ride</router-link>
    </nav>

    <header class="max-w-5xl mx-auto px-5 pt-6 pb-10">
      <p v-if="promo" class="inline-block mb-4 rounded-full bg-[#2b8659]/12 px-3 py-1 text-[13px] font-semibold text-[var(--color-brand)]">Code {{ promo }} comes off your first ride</p>
      <h1 class="text-[34px] md:text-[48px] leading-[1.05] font-bold tracking-tight max-w-2xl">Nassau airport rides with the price up front</h1>
      <p class="mt-4 text-[17px] text-[var(--color-text-secondary)] max-w-xl">Landed at Lynden Pindling (NAS)? Book a RideUp from the arrivals area, see your fare before you ride, pay by card and follow your driver on the map.</p>
      <div class="mt-6 flex flex-wrap gap-3">
        <button @click="router.push('/book')" class="px-6 py-4 rounded-2xl bg-[#2b8659] text-white font-bold text-[16px] shadow-[0_4px_16px_rgba(43,134,89,0.3)]">Book from the airport</button>
        <button v-if="SCHEDULING_ENABLED" @click="router.push('/book')" class="px-6 py-4 rounded-2xl border-2 border-[var(--color-border)] font-semibold text-[16px]">Schedule a pickup</button>
      </div>
    </header>

    <section class="max-w-5xl mx-auto px-5 pb-10" aria-labelledby="fares-title">
      <h2 id="fares-title" class="text-[22px] font-bold mb-1">Typical fares from the airport</h2>
      <p class="text-[13px] text-[var(--color-text-muted)] mb-4">RideUp Go, normal traffic, including the {{ formatFare(AIRPORT_FEE_CENTS) }} airport pickup fee and {{ formatFare(BOOKING_FEE_CENTS) }} booking fee. Your exact price is shown before you book and doesn’t change during the trip.</p>
      <div class="rounded-2xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
        <div v-for="f in fares" :key="f.name" class="flex items-center justify-between px-5 py-4">
          <div>
            <p class="font-semibold text-[15px]">{{ f.name }}</p>
            <p class="text-[13px] text-[var(--color-text-muted)]">about {{ f.minutes }} min</p>
          </div>
          <p class="text-[18px] font-bold whitespace-nowrap ml-3">about {{ formatFare(f.fare) }}</p>
        </div>
      </div>
    </section>

    <section class="max-w-5xl mx-auto px-5 pb-14 grid md:grid-cols-3 gap-4" aria-label="How it works">
      <div class="rounded-2xl bg-[var(--color-surface-secondary)] p-5"><p class="font-bold mb-1">1. Book</p><p class="text-[14px] text-[var(--color-text-secondary)]">Enter where you’re going and see the price. No account? Book as a guest with your name, phone and card.</p></div>
      <div class="rounded-2xl bg-[var(--color-surface-secondary)] p-5"><p class="font-bold mb-1">2. Meet your driver</p><p class="text-[14px] text-[var(--color-text-secondary)]">See your driver’s name, photo, car and plate. Message or call them in the app, and use your PIN to start the trip.</p></div>
      <div class="rounded-2xl bg-[var(--color-surface-secondary)] p-5"><p class="font-bold mb-1">3. Ride and go</p><p class="text-[14px] text-[var(--color-text-secondary)]">Share your trip with family, pay by card automatically, and get your receipt by email.</p></div>
    </section>
  </div>
</template>
