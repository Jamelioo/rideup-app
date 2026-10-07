<script setup>
import BrandLogo from '../components/BrandLogo.vue'
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../lib/useAuth'
import { getPendingPromoCode } from '../lib/rewards'
import { calculateFare, formatFare, AIRPORT, AIRPORT_FEE_CENTS, BOOKING_FEE_CENTS } from '../lib/pricing'

const router = useRouter()
const route = useRoute()
const accountDeleted = computed(() => route.query.deleted === '1')
// From an ad link like rideupnassau.com/?promo=WELCOME5 (applied automatically after sign-up).
const adPromo = getPendingPromoCode()
const { user } = useAuth()

const isLoggedIn = computed(() => !!user.value)
const firstName = computed(() => (user.value?.user_metadata?.name || '').trim().split(/\s+/)[0] || 'Account')
const year = new Date().getFullYear()

// Like Uber: tapping a field opens booking with that field ready to type in.
function goToBooking(field) {
  router.push(field ? { path: '/book', query: { focus: field } } : '/book')
}

// Typical RideUp Go prices with the real rates (src/lib/pricing.js), normal traffic. Same airport trips as /airport.
const POPULAR_TRIPS = [
  { from: 'Airport', to: 'Cable Beach', miles: 6, minutes: 13, airport: true },
  { from: 'Airport', to: 'Downtown', miles: 10.5, minutes: 24, airport: true },
  { from: 'Cable Beach', to: 'Downtown', miles: 6.3, minutes: 18 },
  { from: 'Downtown', to: 'Paradise Island', miles: 3.5, minutes: 12 },
]
const popularTrips = POPULAR_TRIPS.map((t) => ({
  ...t,
  fare: formatFare(calculateFare(t.miles, t.minutes, 'standard', t.airport ? { pickup: AIRPORT } : {})),
}))
</script>

<template>
  <div class="min-h-dvh bg-[var(--color-surface)] text-[var(--color-text-primary)] font-sans">

    <p v-if="adPromo" role="status" class="bg-[#2b8659] text-white text-center text-[14px] font-semibold px-4 py-2.5">Code {{ adPromo }} will come off your first ride. Sign up or book to use it.</p>
    <p v-if="accountDeleted" role="status" class="bg-[var(--color-surface-secondary)] text-center text-[14px] px-4 py-3">Your RideUp account has been deleted.</p>

    <!-- NAV -->
    <header class="sticky top-0 z-40 bg-[var(--color-surface)]/95 backdrop-blur-md border-b border-[var(--color-border)]">
      <nav class="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between gap-3" aria-label="Main">
        <router-link to="/" class="text-[20px] font-bold inline-flex items-center min-h-[44px]" aria-label="RideUp home"><BrandLogo decorative /></router-link>
        <div class="hidden md:flex items-center gap-2 text-[16px] font-medium text-[var(--color-text-muted)]">
          <router-link to="/" aria-current="page" class="px-3 py-2 rounded-full text-[var(--color-text-primary)] font-bold">Ride</router-link>
          <router-link to="/drive" class="px-3 py-2 rounded-full hover:text-[var(--color-text-primary)] transition-colors">Drive</router-link>
          <router-link to="/airport" class="px-3 py-2 rounded-full hover:text-[var(--color-text-primary)] transition-colors">Airport</router-link>
          <router-link to="/support" class="px-3 py-2 rounded-full hover:text-[var(--color-text-primary)] transition-colors">Help</router-link>
        </div>
        <div class="flex items-center gap-1 sm:gap-2">
          <template v-if="isLoggedIn">
            <router-link to="/profile" class="hidden sm:flex items-center px-3 py-2 min-h-[44px] text-[16px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">{{ firstName }}</router-link>
            <router-link to="/book" class="text-[16px] font-bold bg-[var(--color-text-primary)] text-[var(--color-surface)] px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity">Book a ride</router-link>
          </template>
          <template v-else>
            <router-link to="/login" class="flex items-center px-3 py-2 min-h-[44px] text-[16px] font-medium text-[var(--color-text-primary)] hover:opacity-70 transition-opacity">Log in</router-link>
            <router-link to="/signup" class="text-[16px] font-bold bg-[var(--color-text-primary)] text-[var(--color-surface)] px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity">Sign up</router-link>
          </template>
        </div>
      </nav>
    </header>

    <!-- HERO -->
    <section class="bg-[var(--color-surface-secondary)]" aria-labelledby="hero-title">
      <div class="max-w-6xl mx-auto px-5 pt-10 pb-0 md:pt-14 md:pb-14 md:grid md:grid-cols-2 md:gap-8 md:items-center">
        <div class="pb-10 md:pb-16">
          <h1 id="hero-title" class="text-[38px] sm:text-[48px] lg:text-[60px] leading-[1.02] font-bold tracking-tight mb-4">
            Get anywhere in Nassau.
          </h1>
          <p class="text-[var(--color-text-secondary)] text-[17px] leading-[1.5] max-w-md mb-7">
            See your exact fare before you book. That’s the price you pay, with a driver approved by RideUp.
          </p>

          <!-- Booking widget: each field opens booking ready to type, like Uber -->
          <div class="bg-[var(--color-surface)] rounded-2xl p-4 shadow-lg shadow-black/5 max-w-sm">
            <div class="relative space-y-2 mb-3">
              <span class="absolute left-[21px] top-[22px] bottom-[22px] w-px bg-[var(--color-border)]" aria-hidden="true"></span>
              <button type="button" @click="goToBooking('pickup')" class="relative w-full flex items-center gap-3 bg-[var(--color-surface-secondary)] rounded-xl px-4 py-3.5 text-left hover:bg-[var(--color-border)] transition-colors">
                <span class="w-2.5 h-2.5 rounded-full bg-[#2b8659] shrink-0" aria-hidden="true"></span>
                <span class="text-[16px] text-[var(--color-text-muted)]">Pickup location</span>
              </button>
              <button type="button" @click="goToBooking('dropoff')" class="relative w-full flex items-center gap-3 bg-[var(--color-surface-secondary)] rounded-xl px-4 py-3.5 text-left hover:bg-[var(--color-border)] transition-colors">
                <span class="w-2.5 h-2.5 rounded-sm bg-[var(--color-text-primary)] shrink-0" aria-hidden="true"></span>
                <span class="text-[16px] text-[var(--color-text-muted)]">Where to?</span>
              </button>
            </div>
            <button type="button" @click="goToBooking()" class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-xl text-[16px] hover:bg-[#236e49] transition-colors active:scale-[0.99]">
              See prices
            </button>
          </div>
          <p v-if="!isLoggedIn" class="mt-4 text-[14px] text-[var(--color-text-secondary)]">
            <router-link to="/login" class="inline-flex items-center min-h-[44px] underline underline-offset-2 hover:text-[var(--color-text-primary)]">Log in to see your recent rides</router-link>
          </p>
        </div>

        <!-- Phone mockup — desktop only -->
        <div class="hidden md:flex justify-end" aria-hidden="true">
          <div class="w-[240px] sm:w-[270px]">
            <div class="bg-[#2a2f2c] rounded-[34px] p-2.5 shadow-2xl shadow-[#2b8659]/15 ring-1 ring-white/10">
              <div class="bg-[var(--color-surface)] rounded-[24px] overflow-hidden">
                <div class="bg-[#2a2f2c] text-white px-4 pt-2.5 pb-3">
                  <div class="flex justify-between text-[11px] mb-2 opacity-60">
                    <span>9:41</span>
                    <div class="flex gap-1">
                      <div class="w-3.5 h-1.5 border border-white/60 rounded-sm"><div class="w-2.5 h-0.5 bg-[var(--color-surface)]/60 rounded-sm m-px"></div></div>
                    </div>
                  </div>
                  <div class="text-[13px] font-bold"><BrandLogo on-dark /></div>
                </div>
                <div class="p-3.5 bg-[var(--color-surface)]">
                  <div class="text-[11px] font-bold text-[var(--color-text-primary)] mb-2.5">Where are you going?</div>
                  <div class="space-y-1.5 mb-3">
                    <div class="flex items-center gap-2 bg-[var(--color-surface-secondary)] rounded-lg px-3 py-2">
                      <div class="w-1.5 h-1.5 rounded-full bg-[#2b8659]"></div>
                      <span class="text-[11px] text-[var(--color-text-muted)]">Cable Beach</span>
                    </div>
                    <div class="flex items-center gap-2 bg-[var(--color-surface-secondary)] rounded-lg px-3 py-2">
                      <div class="w-1.5 h-1.5 rounded-sm bg-[var(--color-text-muted)]"></div>
                      <span class="text-[11px] text-[var(--color-text-muted)]">Downtown Nassau</span>
                    </div>
                  </div>
                  <div class="rounded-xl bg-[#2b8659]/15 h-20 flex items-center justify-center mb-2.5 relative">
                    <svg width="70" height="40" viewBox="0 0 70 40" fill="none" aria-hidden="true">
                      <path d="M10 32 Q10 16 35 16 Q60 16 60 6" stroke="#2b8659" stroke-width="2" stroke-dasharray="4 3"/>
                      <circle cx="10" cy="32" r="3.5" fill="#2b8659"/>
                      <rect x="56" y="2" width="7" height="7" rx="1.5" fill="currentColor" class="text-[var(--color-text-primary)]"/>
                    </svg>
                  </div>
                  <div class="space-y-1">
                    <div class="flex items-center justify-between bg-[#2b8659]/10 rounded-lg px-2.5 py-1.5 border border-[#2b8659]/20">
                      <div class="flex items-center gap-1.5">
                        <svg class="w-4 h-3 text-[var(--color-text-primary)]" viewBox="0 0 24 16" fill="currentColor"><path d="M3 11l1.5-5h13l1.5 5H3zm2.5 3a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm13 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg>
                        <span class="text-[11px] font-semibold">RideUp Go</span>
                      </div>
                      <span class="text-[11px] font-bold">$18.68</span>
                    </div>
                    <div class="flex items-center justify-between bg-[var(--color-surface-secondary)] rounded-lg px-2.5 py-1.5">
                      <div class="flex items-center gap-1.5">
                        <svg class="w-4 h-3 text-[var(--color-text-muted)]" viewBox="0 0 24 16" fill="currentColor"><path d="M3 11l1.5-5h13l1.5 5H3zm2.5 3a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm13 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg>
                        <span class="text-[11px] font-medium text-[var(--color-text-muted)]">RideUp XL</span>
                      </div>
                      <span class="text-[11px] font-bold text-[var(--color-text-muted)]">$26.89</span>
                    </div>
                  </div>
                </div>
                <div class="px-3.5 pb-3.5">
                  <div class="bg-[#2b8659] text-white text-[11px] font-bold text-center py-2 rounded-xl">Choose RideUp Go</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- WHY RIDEUP -->
    <section class="bg-[var(--color-surface)]" aria-labelledby="why-title">
      <div class="max-w-6xl mx-auto px-5 py-12 md:py-16">
        <h2 id="why-title" class="text-[28px] sm:text-[35px] font-bold leading-[1.14] tracking-tight mb-8">Why ride with RideUp</h2>
        <div class="grid gap-8 md:grid-cols-3 md:gap-10">
          <div>
            <div class="w-12 h-12 rounded-xl bg-[#2b8659]/10 flex items-center justify-center mb-4" aria-hidden="true">
              <svg class="w-6 h-6 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 class="text-[19px] font-bold mb-1.5">Know your fare first</h3>
            <p class="text-[var(--color-text-secondary)] text-[16px] leading-[1.5]">Your price is shown before you book and doesn’t change during the trip. No haggling, no hidden fees.</p>
          </div>
          <div>
            <div class="w-12 h-12 rounded-xl bg-[#2b8659]/10 flex items-center justify-center mb-4" aria-hidden="true">
              <svg class="w-6 h-6 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <h3 class="text-[19px] font-bold mb-1.5">Ride with peace of mind</h3>
            <p class="text-[var(--color-text-secondary)] text-[16px] leading-[1.5]">Every driver is approved by RideUp. See their name, car and plate, follow the trip live and share it with family.</p>
          </div>
          <div>
            <div class="w-12 h-12 rounded-xl bg-[#2b8659]/10 flex items-center justify-center mb-4" aria-hidden="true">
              <svg class="w-6 h-6 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path stroke-linecap="round" d="M2 10h20"/></svg>
            </div>
            <h3 class="text-[19px] font-bold mb-1.5">Pay by card, no cash</h3>
            <p class="text-[var(--color-text-secondary)] text-[16px] leading-[1.5]">Your card is charged when the trip ends and your receipt is emailed to you. Book as a guest, no account needed.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- POPULAR TRIPS: real prices, like Uber's price estimates -->
    <section class="bg-[var(--color-surface-secondary)]" aria-labelledby="trips-title">
      <div class="max-w-6xl mx-auto px-5 py-12 md:py-16">
        <h2 id="trips-title" class="text-[28px] sm:text-[35px] font-bold leading-[1.14] tracking-tight mb-2">Popular trips</h2>
        <p class="text-[var(--color-text-secondary)] text-[16px] leading-[1.5] mb-7 max-w-xl">Typical RideUp Go prices in normal traffic, including the {{ formatFare(BOOKING_FEE_CENTS) }} booking fee (and the {{ formatFare(AIRPORT_FEE_CENTS) }} airport pickup fee from the airport). Your exact price is shown before you book.</p>
        <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <li v-for="trip in popularTrips" :key="trip.from + trip.to">
            <button type="button" @click="goToBooking('pickup')" class="w-full h-full text-left bg-[var(--color-surface)] rounded-2xl p-5 hover:shadow-md transition-shadow">
              <span class="block text-[14px] text-[var(--color-text-secondary)]">{{ trip.from }} <span aria-hidden="true">→</span><span class="sr-only">to</span> {{ trip.to }}</span>
              <span class="block text-[26px] font-bold mt-1">about {{ trip.fare }}</span>
              <span class="block text-[14px] text-[var(--color-text-secondary)] mt-1">about {{ trip.minutes }} min · {{ trip.miles }} mi</span>
            </button>
          </li>
        </ul>
        <router-link to="/airport" class="inline-flex items-center gap-1 text-[16px] font-semibold text-[var(--color-brand)] py-2">More airport prices <span aria-hidden="true">→</span></router-link>
      </div>
    </section>

    <!-- DRIVER RECRUITMENT -->
    <section class="bg-[#191f1c]" aria-labelledby="drive-title">
      <div class="max-w-6xl mx-auto px-5 py-12 md:py-16 md:grid md:grid-cols-2 md:gap-10 md:items-center">
        <div class="mb-6 md:mb-0">
          <picture>
            <source type="image/webp" srcset="/images/driver-photo-640.webp 640w, /images/driver-photo-800.webp 800w" sizes="(min-width: 768px) 560px, 100vw" />
            <img src="/images/driver-photo.jpg" width="800" height="534" alt="A RideUp driver smiling behind the wheel" class="w-full h-[220px] md:h-[300px] object-cover rounded-2xl" loading="lazy" decoding="async" />
          </picture>
        </div>
        <div>
          <p class="inline-block bg-[#2b8659]/20 text-[#6fdca6] text-[12px] font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-wide">Drive with us</p>
          <h2 id="drive-title" class="text-[28px] sm:text-[35px] font-bold leading-[1.14] text-white mb-3">Keep 80% of every trip fare</h2>
          <p class="text-white/75 text-[16px] leading-[1.5] mb-5">Drive with RideUp on your own schedule. No shifts, no minimums. Apply today and start earning once you’re approved.</p>
          <ul class="flex flex-wrap gap-x-5 gap-y-2 mb-6 text-[14px] text-white/80">
            <li class="flex items-center gap-1.5"><svg class="w-4 h-4 text-[#4cc48a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>Flexible hours</li>
            <li class="flex items-center gap-1.5"><svg class="w-4 h-4 text-[#4cc48a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>Weekly payouts</li>
            <li class="flex items-center gap-1.5"><svg class="w-4 h-4 text-[#4cc48a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>No minimums</li>
          </ul>
          <div class="flex flex-wrap items-center gap-3">
            <router-link to="/driver/apply" class="px-8 py-3.5 bg-[#2b8659] text-white font-bold rounded-xl text-[16px] hover:bg-[#236e49] transition-colors">Apply to drive</router-link>
            <router-link to="/drive" class="px-4 py-3.5 text-white font-semibold text-[16px] underline underline-offset-4 decoration-white/40 hover:decoration-white">How driving works</router-link>
          </div>
        </div>
      </div>
    </section>

    <!-- FINAL CTA -->
    <section class="bg-[var(--color-surface)] py-12 md:py-16 text-center px-5" aria-labelledby="cta-title">
      <h2 id="cta-title" class="text-[28px] sm:text-[35px] font-bold leading-[1.14] tracking-tight mb-3">Ready to ride?</h2>
      <p class="text-[var(--color-text-secondary)] text-[16px] leading-[1.5] mb-6">Book in a few taps, right here in your browser. No app download needed.</p>
      <button type="button" @click="goToBooking()" class="px-10 py-3.5 bg-[#2b8659] text-white font-bold rounded-xl text-[16px] hover:bg-[#236e49] transition-colors active:scale-[0.98]">
        Book a ride
      </button>
    </section>

    <!-- FOOTER -->
    <footer class="bg-[#191f1c] text-white">
      <div class="max-w-6xl mx-auto px-5 py-10">
        <div class="md:flex md:justify-between md:gap-10">
          <div class="mb-6 md:mb-0">
            <router-link to="/" class="text-[20px] font-bold inline-flex items-center min-h-[44px]" aria-label="RideUp home"><BrandLogo on-dark decorative /></router-link>
            <p class="text-[14px] text-white/75 mt-2">Rides across New Providence, Bahamas.</p>
            <p class="text-[14px] text-white/75 mt-3">
              <a href="tel:+12424529911" class="hover:text-white py-1 inline-block">(242) 452-9911</a><br />
              <a href="mailto:support@rideupnassau.com" class="hover:text-white py-1 inline-block">support@rideupnassau.com</a>
            </p>
          </div>
          <nav aria-label="Footer" class="grid grid-cols-2 sm:grid-cols-3 gap-x-10 gap-y-0 mb-7 md:mb-0">
            <router-link to="/book" class="text-[14px] text-white/75 hover:text-white transition-colors min-h-[44px] flex items-center">Book a ride</router-link>
            <router-link to="/airport" class="text-[14px] text-white/75 hover:text-white transition-colors min-h-[44px] flex items-center">Airport rides</router-link>
            <router-link to="/drive" class="text-[14px] text-white/75 hover:text-white transition-colors min-h-[44px] flex items-center">Drive with RideUp</router-link>
            <router-link to="/support" class="text-[14px] text-white/75 hover:text-white transition-colors min-h-[44px] flex items-center">Help</router-link>
            <router-link to="/about" class="text-[14px] text-white/75 hover:text-white transition-colors min-h-[44px] flex items-center">About</router-link>
            <router-link to="/login" class="text-[14px] text-white/75 hover:text-white transition-colors min-h-[44px] flex items-center">Log in</router-link>
            <router-link to="/privacy" class="text-[14px] text-white/75 hover:text-white transition-colors min-h-[44px] flex items-center">Privacy</router-link>
            <router-link to="/terms" class="text-[14px] text-white/75 hover:text-white transition-colors min-h-[44px] flex items-center">Terms</router-link>
          </nav>
        </div>

        <div class="flex gap-3 my-7">
          <a href="https://instagram.com/rideupnassau" target="_blank" rel="noopener" aria-label="RideUp on Instagram" class="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="rgba(255,255,255,0.8)" aria-hidden="true">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
            </svg>
          </a>
          <a href="https://wa.me/12424529911" target="_blank" rel="noopener" aria-label="Message RideUp on WhatsApp" class="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="rgba(255,255,255,0.8)" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </a>
        </div>

        <div class="h-px bg-white/10 mb-4"></div>
        <p class="text-[12px] text-white/75">&copy; {{ year }} RideUp Nassau. All rights reserved.</p>
      </div>
    </footer>

  </div>
</template>
