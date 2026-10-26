<script setup>
import BrandLogo from '../components/BrandLogo.vue'
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../lib/useAuth'
import { applyLandingOffer, landingPill as pill, landingPillReady as pillReady, landingOfferCents as offerCents } from '../lib/landingOffer'
import { trackStep } from '../lib/funnel'
import { placeById, tripLink } from '../lib/places'
import { CANCEL_GRACE_SECONDS, DRIVER_CANCEL_CREDIT_CENTS } from '../lib/policy'
import { calculateFare, formatFare, formatAmount, RATES, AIRPORT_FEE_CENTS, BOOKING_FEE_CENTS } from '../lib/pricing'

// Booking first, sign-up second. The offer, the promise and the answers only say what the app really does.
const router = useRouter()
const route = useRoute()
const accountDeleted = computed(() => route.query.deleted === '1')
const { user } = useAuth()
const isLoggedIn = computed(() => !!user.value)
const firstName = computed(() => (user.value?.user_metadata?.name || '').trim().split(/\s+/)[0] || 'Account')
// Guests book with a temporary account, so they still see the free-account section.
const showAccountPitch = computed(() => !user.value || user.value.is_anonymous)
const year = new Date().getFullYear()

// The first-ride offer (Admin › Promos), applied for them. The pill keeps its space while it loads.
applyLandingOffer()

onMounted(() => trackStep('landing'))

// Like Uber: tapping a field opens booking with that field ready to type in.
function goToBooking(field) {
  router.push(field ? { path: '/book', query: { focus: field } } : '/book')
}

const graceLabel = CANCEL_GRACE_SECONDS % 60 === 0 ? `${CANCEL_GRACE_SECONDS / 60} minutes` : `${CANCEL_GRACE_SECONDS} seconds`

// The RideUp guarantee (api/_credit.js): a re-match at the same price, plus credit when the credit is switched on.
const credit = DRIVER_CANCEL_CREDIT_CENTS > 0 ? formatAmount(DRIVER_CANCEL_CREDIT_CENTS) : ''
const guaranteeLine = credit
  ? `If your driver cancels, we find you another driver at the same price and add ${credit} credit to your account.`
  : 'If your driver cancels, we find you another driver at the same price, automatically.'

// What every ride comes with, all of it true in the app today.
const PROMISE = [
  { icon: 'lock', title: 'Price lock', text: 'Your price is set when you book. Traffic or a longer route won’t change it.' },
  { icon: 'cash', title: 'Pay when you arrive', text: 'No card and no app. Pay your driver the price you saw, in cash, at drop-off.' },
  { icon: 'clock', title: 'Free cancellation', text: 'Cancelling never costs a cent. Cancel early if your plans change, so your driver isn’t left waiting.' },
  { icon: 'shield', title: 'Approved drivers', text: 'See your driver’s name, photo, car and plate before pickup, and share your trip live with family.' },
]

// Typical RideUp Go prices with the real rates (src/lib/pricing.js), normal traffic. Each opens booking with the
// trip filled in and priced for right now (src/lib/places.js).
const POPULAR_TRIPS = [
  { from: 'airport', to: 'cable-beach', miles: 6, minutes: 13 },
  { from: 'airport', to: 'downtown', miles: 10.5, minutes: 24 },
  { from: 'cable-beach', to: 'downtown', miles: 6.3, minutes: 18 },
  { from: 'cruise-port', to: 'paradise-island', miles: 3.5, minutes: 12 },
]
const popularTrips = POPULAR_TRIPS.map((t) => {
  const from = placeById(t.from)
  const to = placeById(t.to)
  const cents = calculateFare(t.miles, t.minutes, 'standard', { pickup: from })
  return { ...t, key: `${t.from}-${t.to}`, fromLabel: from.label, toLabel: to.label, cents, fare: formatFare(cents), link: tripLink(t.from, t.to) }
})

const steps = computed(() => [
  { title: 'Enter where you’re going', text: 'Your exact price shows straight away, before you commit to anything.' },
  { title: 'Request your ride', text: 'No account needed. A nearby approved driver accepts, and you see their name, car and plate.' },
  { title: 'Ride and pay cash', text: 'Follow your car on the map, then pay your driver in cash at drop-off. Exact change helps.' },
])

const go = RATES.standard
const faqs = computed(() => [
  { q: 'How much does a ride cost?', a: `You see the exact price before you book. RideUp Go is ${formatAmount(go.base)} plus ${formatAmount(go.perMile)} a mile and ${formatAmount(go.perMinute)} a minute (${formatAmount(go.minimum)} minimum), plus a ${formatAmount(BOOKING_FEE_CENTS)} booking fee. Airport pickups add ${formatAmount(AIRPORT_FEE_CENTS)}. At busy times it can cost more, and you see that before you book too.` },
  { q: 'Do I need an account or the app?', a: 'No. Book right here in your browser as a guest with just your name and mobile number. A free account saves your details and trips for next time.' },
  { q: 'How do I pay?', a: 'In cash, to your driver at drop-off: the price you saw when you booked, less any promo or credit. No card needed. Exact change helps, and you get a receipt once your driver confirms it.' },
  { q: 'What if no driver accepts?', a: 'Nothing happens and you owe nothing. Your request simply ends, and you can try again whenever you like.' },
  { q: 'Is RideUp safe?', a: 'Every driver is approved by RideUp before their first trip. You see their name, photo, car and plate before pickup, you can share your trip live with family, and you can call for help from the trip screen.' },
  { q: 'Can I cancel?', a: `Yes, and it’s always free. Please cancel early: after a driver has been on the way for ${graceLabel}, it counts as a late cancellation, and two late cancellations or missed pickups in 30 days pause booking on your account. ` },
  { q: 'What if my driver cancels?', a: `${guaranteeLine} You don’t need to do anything: you’ll see the new driver on your screen.${credit ? ' The credit is given once every 24 hours and comes off your next booking automatically.' : ''}` },
  { q: 'Can I book for someone else, or from the airport?', a: `Yes. Tap “Someone else?” when you book and we’ll text them the driver’s details. At the airport, book from arrivals; airport pickups add ${formatAmount(AIRPORT_FEE_CENTS)}.` },
])

// The offer stack at the end of the page: everything the first ride includes, the discount first when there is one.
const firstRideStack = computed(() => [
  ...(pill.value ? [`${pill.value.title}, ${pill.value.note.toLowerCase()}`] : []),
  'Your price locked when you book',
  'Pay cash at drop-off: no card, no app',
  credit ? `The RideUp Guarantee: same price and ${credit} credit if your driver cancels` : 'The RideUp Guarantee: a new driver at the same price if yours cancels',
  'Free cancellation',
])

const accountPerks = computed(() => [
  { title: 'Book faster', text: 'Your name, number and saved places are ready for next time.' },
  { title: '$5 for every friend', text: 'Friends get $5 off their first ride with your code, and you get $5 credit when they ride.' },
  { title: 'Trips and receipts', text: 'Every trip and receipt in one place.' },
])

// Phones: a "See my price" bar once the booking box has scrolled away, until the final call to action.
const heroCard = ref(null)
const finalCta = ref(null)
const heroInView = ref(true)
const finalReached = ref(false)
let observer = null
onMounted(() => {
  if (!('IntersectionObserver' in window) || !heroCard.value || !finalCta.value) return
  observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.target === heroCard.value) heroInView.value = e.isIntersecting
      // On screen, or already scrolled past (above the screen): the bar isn't needed either way.
      else finalReached.value = e.isIntersecting || e.boundingClientRect.top < 0
    }
  })
  observer.observe(heroCard.value)
  observer.observe(finalCta.value)
})
onBeforeUnmount(() => observer?.disconnect())
const showStickyCta = computed(() => !heroInView.value && !finalReached.value)
</script>

<template>
  <div class="min-h-dvh bg-[var(--color-surface)] text-[var(--color-text-primary)] font-sans">

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
          <!-- Booking first: no account is needed to ride. On phones, sign-up is in the free-account section below. -->
          <template v-else>
            <router-link to="/login" class="flex items-center px-3 py-2 min-h-[44px] text-[16px] font-medium text-[var(--color-text-primary)] hover:opacity-70 transition-opacity">Log in</router-link>
            <router-link to="/signup" class="hidden sm:flex items-center px-3 py-2 min-h-[44px] text-[16px] font-medium text-[var(--color-text-primary)] hover:opacity-70 transition-opacity">Sign up</router-link>
            <router-link to="/book" class="text-[16px] font-bold bg-[var(--color-text-primary)] text-[var(--color-surface)] px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity whitespace-nowrap">Book a ride</router-link>
          </template>
        </div>
      </nav>
    </header>

    <!-- HERO: the offer, the promise in brief, and booking -->
    <section class="bg-[var(--color-surface-secondary)]" aria-labelledby="hero-title">
      <div class="max-w-6xl mx-auto px-5 pt-6 md:pt-14 md:pb-14 md:grid md:grid-cols-2 md:gap-8 md:items-center">
        <div class="pb-10 md:pb-16">
          <!-- One line tall whatever it says, so nothing moves when the offer arrives -->
          <div class="min-h-[30px] mb-4">
            <p v-if="pillReady && pill" class="inline-flex flex-wrap items-center gap-x-1.5 rounded-full bg-[#2b8659]/8 px-3 py-1.5 text-[13px] leading-[18px] text-[var(--color-brand)]">
              <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M3 11.6V4a1 1 0 011-1h7.6a1 1 0 01.7.3l8.4 8.4a1 1 0 010 1.4l-7.6 7.6a1 1 0 01-1.4 0L3.3 12.3a1 1 0 01-.3-.7z"/></svg>
              <strong class="font-bold">{{ pill.title }}</strong>
              <span class="text-[var(--color-text-secondary)]">· {{ pill.note }}</span>
              <span v-if="pill.ends" class="text-[var(--color-text-secondary)]">· ends {{ pill.ends }}</span>
            </p>
            <p v-else-if="pillReady" class="inline-flex items-center rounded-full bg-[var(--color-surface)] px-3 py-1.5 text-[13px] leading-[18px] font-semibold text-[var(--color-text-secondary)]">Rides across New Providence</p>
          </div>
          <h1 id="hero-title" class="text-[36px] sm:text-[48px] lg:text-[60px] leading-[1.04] font-bold tracking-tight mb-3">
            Nassau rides. Price locked. Pay cash on arrival.
          </h1>
          <p class="text-[var(--color-text-secondary)] text-[16px] sm:text-[17px] leading-[1.5] max-w-md mb-6">
            See your exact price before you book. No haggling, no card, no app. Every driver is approved by RideUp.
          </p>

          <!-- Booking widget: each field opens booking ready to type, like Uber -->
          <div ref="heroCard" class="bg-[var(--color-surface)] rounded-2xl p-4 shadow-lg shadow-black/5 max-w-sm">
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
              See my price
            </button>
          </div>
          <ul class="mt-4 grid gap-y-1.5 sm:grid-cols-2 sm:gap-x-5 max-w-lg text-[14px] text-[var(--color-text-secondary)]">
            <li class="flex gap-2"><svg class="w-4 h-4 mt-[3px] shrink-0 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>Price locked when you book</li>
            <li class="flex gap-2"><svg class="w-4 h-4 mt-[3px] shrink-0 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>No account, app or card</li>
            <li class="flex gap-2"><svg class="w-4 h-4 mt-[3px] shrink-0 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>Pay cash at drop-off</li>
            <li v-if="credit" class="flex gap-2"><svg class="w-4 h-4 mt-[3px] shrink-0 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>{{ credit }} credit if your driver cancels</li>
          </ul>
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

    <!-- THE RIDEUP PROMISE: what every rider can count on, all of it true in the app today -->
    <section class="below-fold bg-[var(--color-surface)]" aria-labelledby="promise-title">
      <div class="max-w-6xl mx-auto px-5 py-12 md:py-16">
        <!-- The guarantee first: it takes away the biggest worry about a new ride app (being left waiting) -->
        <div class="rounded-3xl bg-[#0F3D2A] text-white p-6 sm:p-8 mb-10 md:flex md:items-center md:gap-8">
          <div class="w-14 h-14 rounded-2xl bg-white/10 text-[#FFC83D] flex items-center justify-center shrink-0 mb-4 md:mb-0" aria-hidden="true">
            <svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          </div>
          <div class="flex-1">
            <h2 id="promise-title" class="text-[26px] sm:text-[32px] font-bold leading-[1.14] tracking-tight mb-2">The RideUp Guarantee</h2>
            <p class="text-[17px] leading-[1.5] text-white/90 max-w-2xl">{{ guaranteeLine }} If no driver accepts, you pay nothing.</p>
            <p class="mt-2 text-[13px] text-white/75"><template v-if="credit">Credit once every 24 hours, used automatically on your next booking. </template><router-link to="/terms" class="underline underline-offset-2 inline-block py-2 -my-2">Terms</router-link></p>
          </div>
        </div>
        <h3 class="text-[24px] sm:text-[28px] font-bold leading-[1.14] tracking-tight mb-2">On every ride</h3>
        <p class="text-[var(--color-text-secondary)] text-[16px] leading-[1.5] mb-7 max-w-xl">For every rider, first trip or fiftieth.</p>
        <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <li v-for="item in PROMISE" :key="item.title" class="rounded-2xl bg-[var(--color-surface-secondary)] p-5">
            <div class="w-10 h-10 rounded-xl bg-[#2b8659]/12 text-[var(--color-brand)] flex items-center justify-center mb-3">
              <svg v-if="item.icon === 'lock'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path stroke-linecap="round" d="M8 11V7a4 4 0 118 0v4"/></svg>
              <svg v-else-if="item.icon === 'cash'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path stroke-linecap="round" d="M6 12h.01M18 12h.01"/></svg>
              <svg v-else-if="item.icon === 'clock'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 7v5l3 2"/></svg>
              <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z"/></svg>
            </div>
            <h4 class="text-[17px] font-bold mb-1">{{ item.title }}</h4>
            <p class="text-[15px] leading-[1.5] text-[var(--color-text-secondary)]">{{ item.text }}</p>
          </li>
        </ul>
        <!-- Proof we can stand behind today: a local team you can reach, not reviews we don't have yet -->
        <p class="mt-6 flex gap-3 items-start text-[15px] leading-[1.5] text-[var(--color-text-secondary)] max-w-3xl">
          <svg class="w-5 h-5 mt-0.5 shrink-0 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.95.68l1.5 4.49a1 1 0 01-.5 1.21l-2.26 1.13a11 11 0 005.52 5.52l1.13-2.26a1 1 0 011.21-.5l4.49 1.5a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z"/></svg>
          <span>A Nassau company with real people on the line. Questions before you ride? Call or WhatsApp <a href="tel:+12424529911" class="font-semibold text-[var(--color-brand)] whitespace-nowrap">(242) 452-9911</a>.</span>
        </p>
      </div>
    </section>

    <!-- POPULAR TRIPS: real prices; each opens booking with the trip filled in and priced -->
    <section class="below-fold bg-[var(--color-surface-secondary)]" aria-labelledby="trips-title">
      <div class="max-w-6xl mx-auto px-5 py-12 md:py-16">
        <h2 id="trips-title" class="text-[28px] sm:text-[35px] font-bold leading-[1.14] tracking-tight mb-2">Popular trips</h2>
        <p class="text-[var(--color-text-secondary)] text-[16px] leading-[1.5] mb-7 max-w-xl">Typical RideUp Go prices in normal traffic, including the {{ formatFare(BOOKING_FEE_CENTS) }} booking fee (and the {{ formatFare(AIRPORT_FEE_CENTS) }} airport pickup fee from the airport). Tap a trip to see its exact price now.</p>
        <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <li v-for="trip in popularTrips" :key="trip.key">
            <router-link :to="trip.link" class="flex flex-col h-full bg-[var(--color-surface)] rounded-2xl p-5 hover:shadow-md transition-shadow">
              <span class="block text-[14px] text-[var(--color-text-secondary)]">{{ trip.fromLabel }} <span aria-hidden="true">→</span><span class="sr-only">to</span> {{ trip.toLabel }}</span>
              <span class="block text-[26px] font-bold mt-1">about {{ trip.fare }}</span>
              <span class="block text-[14px] text-[var(--color-text-secondary)] mt-1">about {{ trip.minutes }} min · {{ trip.miles }} mi</span>
              <span v-if="offerCents" class="mt-2 inline-flex self-start rounded-full bg-[#2b8659]/10 px-2.5 py-1 text-[13px] font-semibold text-[var(--color-brand)]">{{ formatFare(Math.max(0, trip.cents - offerCents)) }} {{ pill.title.startsWith('First ride') ? 'on your first ride' : 'with your code' }}</span>
              <span class="mt-auto pt-3 inline-flex items-center gap-1 text-[15px] font-semibold text-[var(--color-brand)]">See exact price <span aria-hidden="true">→</span></span>
            </router-link>
          </li>
        </ul>
        <router-link to="/airport" class="inline-flex items-center gap-1 text-[16px] font-semibold text-[var(--color-brand)] py-2">More airport prices <span aria-hidden="true">→</span></router-link>
      </div>
    </section>

    <!-- HOW IT WORKS -->
    <section class="below-fold bg-[var(--color-surface)]" aria-labelledby="how-title">
      <div class="max-w-6xl mx-auto px-5 py-12 md:py-16">
        <h2 id="how-title" class="text-[28px] sm:text-[35px] font-bold leading-[1.14] tracking-tight mb-7">How it works</h2>
        <ol class="grid gap-6 md:grid-cols-3 md:gap-10">
          <li v-for="(step, i) in steps" :key="step.title" class="flex gap-4 md:block">
            <span class="w-9 h-9 shrink-0 rounded-full bg-[#2b8659] text-white font-bold flex items-center justify-center md:mb-3" aria-hidden="true">{{ i + 1 }}</span>
            <div>
              <h3 class="text-[18px] font-bold mb-1">{{ step.title }}</h3>
              <p class="text-[15px] leading-[1.5] text-[var(--color-text-secondary)]">{{ step.text }}</p>
            </div>
          </li>
        </ol>
      </div>
    </section>

    <!-- FREE ACCOUNT: sign-up second, with real reasons -->
    <section v-if="showAccountPitch" class="below-fold bg-[var(--color-surface-secondary)]" aria-labelledby="account-title">
      <div class="max-w-6xl mx-auto px-5 py-12 md:py-16 md:grid md:grid-cols-[1fr_1.4fr] md:gap-12 md:items-start">
        <div class="mb-6 md:mb-0">
          <h2 id="account-title" class="text-[28px] sm:text-[35px] font-bold leading-[1.14] tracking-tight mb-3">Get more with a free account</h2>
          <p class="text-[var(--color-text-secondary)] text-[16px] leading-[1.5] mb-5">You can always book as a guest. An account takes a minute and makes every ride after the first easier.</p>
          <router-link to="/signup" class="inline-flex items-center justify-center min-h-[48px] px-6 rounded-xl border-2 border-[var(--color-text-primary)] font-bold text-[16px] hover:bg-[var(--color-surface)] transition-colors">Create free account</router-link>
        </div>
        <ul class="grid gap-3 sm:grid-cols-2">
          <li v-for="perk in accountPerks" :key="perk.title" class="rounded-2xl bg-[var(--color-surface)] p-5">
            <h3 class="text-[17px] font-bold mb-1 flex gap-2"><svg class="w-4 h-4 mt-[3px] shrink-0 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>{{ perk.title }}</h3>
            <p class="text-[15px] leading-[1.5] text-[var(--color-text-secondary)]">{{ perk.text }}</p>
          </li>
        </ul>
      </div>
    </section>

    <!-- FAQ: what people ask before their first ride -->
    <section class="below-fold bg-[var(--color-surface)] border-t border-[var(--color-border)]" aria-labelledby="faq-title">
      <div class="max-w-3xl mx-auto px-5 py-12 md:py-16">
        <h2 id="faq-title" class="text-[28px] sm:text-[35px] font-bold leading-[1.14] tracking-tight mb-6">Questions</h2>
        <div class="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          <details v-for="f in faqs" :key="f.q" class="group">
            <summary class="flex items-center justify-between gap-4 py-4 min-h-[56px] cursor-pointer list-none text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
              {{ f.q }}
              <svg class="w-5 h-5 shrink-0 text-[var(--color-text-muted)] transition-transform group-open:rotate-180 motion-reduce:transition-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </summary>
            <p class="pb-5 -mt-1 text-[16px] leading-[1.6] text-[var(--color-text-secondary)]">{{ f.a }}</p>
          </details>
        </div>
        <p class="mt-5 text-[15px] text-[var(--color-text-secondary)]">Something else? <router-link to="/support" class="inline-block py-3 -my-3 font-semibold text-[var(--color-brand)]">Visit Help</router-link> or call <a href="tel:+12424529911" class="inline-block py-3 -my-3 font-semibold text-[var(--color-brand)] whitespace-nowrap">(242) 452-9911</a>.</p>
      </div>
    </section>

    <!-- FINAL CTA -->
    <section ref="finalCta" class="below-fold bg-[var(--color-surface-secondary)] py-12 md:py-16 text-center px-5" aria-labelledby="cta-title">
      <h2 id="cta-title" class="text-[28px] sm:text-[35px] font-bold leading-[1.14] tracking-tight mb-3">Your first ride comes with</h2>
      <ul class="inline-grid gap-2 text-left text-[16px] mb-7">
        <li v-for="line in firstRideStack" :key="line" class="flex gap-2.5"><svg class="w-5 h-5 mt-[2px] shrink-0 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg><span>{{ line }}</span></li>
      </ul>
      <div></div>
      <button type="button" @click="goToBooking()" class="px-10 py-3.5 bg-[#2b8659] text-white font-bold rounded-xl text-[16px] hover:bg-[#236e49] transition-colors active:scale-[0.98]">
        See my price
      </button>
      <p class="mt-4 text-[14px] text-[var(--color-text-secondary)]">See your exact price in seconds. No account or app needed.</p>
    </section>

    <!-- DRIVER RECRUITMENT -->
    <section class="below-fold bg-[#191f1c]" aria-labelledby="drive-title">
      <div class="max-w-6xl mx-auto px-5 py-12 md:py-16 md:grid md:grid-cols-2 md:gap-10 md:items-center">
        <div class="mb-6 md:mb-0">
          <picture>
            <source type="image/webp" srcset="/images/driver-photo-640.webp 640w, /images/driver-photo-800.webp 800w" sizes="(min-width: 768px) 560px, 100vw" />
            <img src="/images/driver-photo.jpg" width="800" height="534" alt="A RideUp driver smiling behind the wheel" class="w-full h-[220px] md:h-[300px] object-cover rounded-2xl" loading="lazy" decoding="async" />
          </picture>
        </div>
        <div>
          <p class="inline-block bg-[#2b8659]/20 text-[#6fdca6] text-[12px] font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-wide">Drive with us</p>
          <h2 id="drive-title" class="text-[28px] sm:text-[35px] font-bold leading-[1.14] text-white mb-3">Keep 70% of every trip fare</h2>
          <p class="text-white/75 text-[16px] leading-[1.5] mb-5">Riders pay you in cash at drop-off. Drive on your own schedule: no shifts, no minimums, no lease.</p>
          <ul class="flex flex-wrap gap-x-5 gap-y-2 mb-6 text-[14px] text-white/80">
            <li class="flex items-center gap-1.5"><svg class="w-4 h-4 text-[#4cc48a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>Flexible hours</li>
            <li class="flex items-center gap-1.5"><svg class="w-4 h-4 text-[#4cc48a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>Cash every trip</li>
            <li class="flex items-center gap-1.5"><svg class="w-4 h-4 text-[#4cc48a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>No minimums</li>
          </ul>
          <div class="flex flex-wrap items-center gap-3">
            <router-link to="/driver/apply" class="px-8 py-3.5 bg-[#2b8659] text-white font-bold rounded-xl text-[16px] hover:bg-[#236e49] transition-colors">Apply to drive</router-link>
            <router-link to="/drive" class="px-4 py-3.5 text-white font-semibold text-[16px] underline underline-offset-4 decoration-white/40 hover:decoration-white">How driving works</router-link>
          </div>
        </div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="below-fold bg-[#191f1c] text-white border-t border-white/10">
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

    <!-- Phones: booking stays one tap away while reading -->
    <Transition name="sticky-cta">
      <div v-show="showStickyCta" class="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-md px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div class="flex items-center gap-3 max-w-md mx-auto">
          <p v-if="pill" class="flex-1 min-w-0 text-[13px] leading-tight">
            <span class="block font-bold truncate">{{ pill.title }}</span>
            <span class="block text-[var(--color-text-secondary)] truncate">{{ pill.note }}</span>
          </p>
          <button type="button" @click="goToBooking()" class="py-3.5 bg-[#2b8659] text-white font-bold rounded-xl text-[16px] hover:bg-[#236e49] transition-colors" :class="pill ? 'shrink-0 px-6' : 'w-full'">
            See my price
          </button>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
/* Sections below the first screen are laid out only as they come near, so the first screen shows sooner. */
.below-fold { content-visibility: auto; contain-intrinsic-size: auto 600px; }
.sticky-cta-enter-active,
.sticky-cta-leave-active { transition: transform 0.2s ease, opacity 0.2s ease; }
.sticky-cta-enter-from,
.sticky-cta-leave-to { transform: translateY(100%); opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .sticky-cta-enter-active,
  .sticky-cta-leave-active { transition: none; }
}
</style>
