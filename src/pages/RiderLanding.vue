<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../lib/useAuth'

const router = useRouter()
const { user } = useAuth()

const isLoggedIn = computed(() => !!user.value)
const displayName = computed(() => user.value?.user_metadata?.name || 'Rider')

function goToBooking() {
  router.push('/book')
}

function goToDriverApply() {
  router.push('/driver/apply')
}

const routes = [
  { from: 'Cable Beach', to: 'Downtown', price: '$8', time: '~12 min' },
  { from: 'LPIA Airport', to: 'Bahamar', price: '$12', time: '~18 min' },
  { from: 'Paradise Island', to: 'Bay St', price: '$10', time: '~15 min' },
  { from: 'Carmichael Rd', to: 'Downtown', price: '$7', time: '~10 min' },
]
</script>

<template>
  <div class="min-h-screen bg-white text-[#1a1a1a] font-[var(--font-sans)]">

    <!-- ==================== NAV BAR ==================== -->
    <nav class="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#1a1a1a]/8">
      <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <router-link to="/" class="font-serif text-xl font-semibold">Ride<span class="text-[#58cc02]">Up</span></router-link>
        <div class="hidden md:flex items-center gap-8 text-[14px] font-medium text-[#1a1a1a]/60">
          <router-link to="/" class="text-[#1a1a1a] font-semibold">Ride</router-link>
          <router-link to="/driver/apply" class="hover:text-[#1a1a1a] transition-colors">Drive</router-link>
        </div>
        <div class="flex items-center gap-3">
          <template v-if="isLoggedIn">
            <router-link to="/profile" class="text-[14px] font-medium text-[#1a1a1a]/70 hover:text-[#1a1a1a] transition-colors">{{ displayName }}</router-link>
          </template>
          <template v-else>
            <router-link to="/login" class="text-[14px] font-medium text-[#1a1a1a]/70 hover:text-[#1a1a1a] transition-colors hidden sm:block">Log in</router-link>
            <router-link to="/signup" class="text-[14px] font-bold bg-[#1a1a1a] text-white px-5 py-2.5 rounded-full hover:bg-[#1a1a1a]/90 transition-colors">Sign up</router-link>
          </template>
        </div>
      </div>
    </nav>

    <!-- ==================== HERO — Hormozi: Dream Outcome + Timeline ==================== -->
    <section class="bg-white">
      <div class="max-w-6xl mx-auto px-6 pt-12 pb-16 md:pt-20 md:pb-24 md:grid md:grid-cols-2 md:gap-12 md:items-center">
        <!-- Left: Outcome-focused copy -->
        <div>
          <h1 class="font-serif text-[36px] sm:text-[48px] lg:text-[56px] leading-[1.08] font-medium tracking-tight mb-5 text-[#1a1a1a]">
            Get anywhere in Nassau in 5 minutes.
          </h1>
          <p class="text-[#1a1a1a]/50 text-[16px] leading-relaxed max-w-md mb-8">
            Book a ride in 10 seconds. See the exact fare upfront — no surge, no surprises. Drivers available 24/7 across New Providence.
          </p>

          <!-- Booking widget (Hormozi: Low Effort — make it dead simple) -->
          <div class="bg-white rounded-2xl p-5 shadow-xl shadow-black/8 border border-[#1a1a1a]/[0.06] max-w-md">
            <div class="space-y-2.5 mb-4">
              <button @click="goToBooking" aria-label="Enter pickup location" class="w-full flex items-center gap-3 bg-[#f5f5f5] rounded-xl px-4 py-3.5 text-left hover:bg-[#f0f0f0] transition-colors">
                <div class="w-2.5 h-2.5 rounded-full bg-[#58cc02] shrink-0"></div>
                <span class="text-[14px] text-[#1a1a1a]/40">Pickup location</span>
              </button>
              <button @click="goToBooking" aria-label="Enter destination" class="w-full flex items-center gap-3 bg-[#f5f5f5] rounded-xl px-4 py-3.5 text-left hover:bg-[#f0f0f0] transition-colors">
                <div class="w-2.5 h-2.5 rounded-sm bg-[#1a1a1a]/25 shrink-0"></div>
                <span class="text-[14px] text-[#1a1a1a]/40">Where to?</span>
              </button>
            </div>
            <button @click="goToBooking"
                    class="w-full py-3.5 bg-[#58cc02] text-white font-bold rounded-xl text-[14px] hover:bg-[#4ab300] transition-colors active:scale-[0.99]">
              See prices
            </button>
          </div>
        </div>

        <!-- Right: Photo (desktop) -->
        <div class="hidden md:block">
          <img src="/images/fare-photo.jpg" alt="Streets of Nassau" class="w-full h-[420px] object-cover rounded-2xl" />
        </div>
      </div>
    </section>

    <!-- ==================== SOCIAL PROOF BANNER — Hormozi: Social Proof ==================== -->
    <section class="bg-[#1a1a1a]">
      <div class="max-w-4xl mx-auto px-6 py-8 flex items-center justify-center gap-0">
        <div class="flex-1 text-center">
          <div class="font-serif text-[28px] sm:text-[32px] font-semibold text-[#58cc02]">5,000+</div>
          <div class="text-white/40 text-[12px] mt-1">Rides completed</div>
        </div>
        <div class="w-px h-12 bg-white/10"></div>
        <div class="flex-1 text-center">
          <div class="font-serif text-[28px] sm:text-[32px] font-semibold text-white">4.9<span class="text-[#58cc02]">&#9733;</span></div>
          <div class="text-white/40 text-[12px] mt-1">Average rating</div>
        </div>
        <div class="w-px h-12 bg-white/10"></div>
        <div class="flex-1 text-center">
          <div class="font-serif text-[28px] sm:text-[32px] font-semibold text-white">&lt;5 min</div>
          <div class="text-white/40 text-[12px] mt-1">Avg. pickup time</div>
        </div>
      </div>
    </section>

    <!-- ==================== VALUE PROPS — Hormozi: Remove Risk + Show Effort ==================== -->
    <section>
      <!-- Block 1: Upfront pricing = remove risk -->
      <div class="max-w-6xl mx-auto px-6 py-16 md:py-20">
        <div class="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10">
          <div class="w-16 h-16 rounded-full bg-[#58cc02]/10 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-[#58cc02]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 class="font-serif text-[26px] sm:text-[32px] font-medium mb-2">The price you see is the price you pay</h2>
            <p class="text-[#1a1a1a]/50 text-[15px] leading-relaxed max-w-lg">No surge pricing. No hidden fees. No surprises at the end of your trip. You see the exact fare before you book — every single time.</p>
          </div>
        </div>
      </div>

      <div class="max-w-6xl mx-auto px-6"><div class="border-t border-[#f0f0f0]"></div></div>

      <!-- Block 2: Safety = build trust -->
      <div class="max-w-6xl mx-auto px-6 py-16 md:py-20">
        <div class="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10">
          <div class="w-16 h-16 rounded-full bg-[#58cc02]/10 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-[#58cc02]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h2 class="font-serif text-[26px] sm:text-[32px] font-medium mb-2">Every driver verified and background-checked</h2>
            <p class="text-[#1a1a1a]/50 text-[15px] leading-relaxed max-w-lg">Real-time GPS tracking on every trip. Share your ride status with family. Every driver passes background checks and vehicle inspections before their first ride.</p>
          </div>
        </div>
      </div>

      <div class="max-w-6xl mx-auto px-6"><div class="border-t border-[#f0f0f0]"></div></div>

      <!-- Block 3: Coverage = dream outcome -->
      <div class="max-w-6xl mx-auto px-6 py-16 md:py-20">
        <div class="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10">
          <div class="w-16 h-16 rounded-full bg-[#58cc02]/10 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-[#58cc02]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h2 class="font-serif text-[26px] sm:text-[32px] font-medium mb-2">From LPIA to Paradise Island and everywhere in between</h2>
            <p class="text-[#1a1a1a]/50 text-[15px] leading-relaxed max-w-lg">Cable Beach, Downtown, Carmichael Road, the Fish Fry — drivers across every corner of New Providence, available 24 hours a day, 7 days a week.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ==================== POPULAR ROUTES — Hormozi: Show Specific Value ==================== -->
    <section class="bg-[#f8f8f8]">
      <div class="max-w-3xl mx-auto px-6 py-16 md:py-20">
        <h2 class="font-serif text-[26px] sm:text-[32px] font-medium mb-2">See exactly what you'll pay</h2>
        <p class="text-[#1a1a1a]/50 text-[14px] mb-8">Flat fares. No surge pricing. No surprises.</p>

        <div class="bg-white rounded-2xl overflow-hidden border border-[#f0f0f0]">
          <button
            v-for="(route, index) in routes"
            :key="route.from + route.to"
            class="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-[#f8f8f8]/50 transition-colors text-left"
            :class="{ 'border-t border-[#f0f0f0]': index > 0 }"
            @click="goToBooking"
          >
            <div class="flex items-center gap-3">
              <div class="w-2.5 h-2.5 rounded-full bg-[#58cc02] shrink-0"></div>
              <div>
                <span class="text-[15px] font-semibold">{{ route.from }} &rarr; {{ route.to }}</span>
                <span class="text-[13px] text-[#1a1a1a]/40 ml-2">{{ route.time }}</span>
              </div>
            </div>
            <span class="text-[17px] font-bold font-serif">{{ route.price }}</span>
          </button>
        </div>

        <button @click="goToBooking" class="w-full mt-4 py-3.5 bg-[#1a1a1a] text-white font-bold rounded-xl text-[14px] hover:bg-[#333] transition-colors active:scale-[0.99]">
          See all prices
        </button>
      </div>
    </section>

    <!-- ==================== DRIVER RECRUITMENT ==================== -->
    <section class="max-w-3xl mx-auto px-6 py-16 md:py-20">
      <div class="rounded-2xl overflow-hidden">
        <div class="relative h-[220px] sm:h-[280px]">
          <img src="/images/driver-photo.jpg" alt="Driver behind the wheel" class="w-full h-full object-cover" />
          <div class="absolute inset-0" style="background: linear-gradient(to bottom, transparent 30%, rgba(26,26,26,0.8) 100%);"></div>
        </div>
        <div class="bg-[#1a1a1a] px-6 py-8 sm:px-8">
          <h2 class="font-serif text-[24px] sm:text-[28px] font-medium text-white mb-2">Keep 80% of every fare</h2>
          <p class="text-white/50 text-[14px] leading-relaxed mb-6">Drive with RideUp on your own schedule. No shifts, no minimums. Start earning this week.</p>
          <button @click="goToDriverApply" class="px-8 py-3.5 bg-[#58cc02] text-white font-bold rounded-xl text-[14px] hover:bg-[#4ab300] transition-colors active:scale-[0.99]">
            Apply to drive
          </button>
        </div>
      </div>
    </section>

    <!-- ==================== FINAL CTA — Hormozi: One Clear Action ==================== -->
    <section class="py-16 text-center">
      <h2 class="font-serif text-[26px] sm:text-[32px] font-medium mb-2">Ready to ride?</h2>
      <p class="text-[#1a1a1a]/50 text-[14px] mb-6">Book in seconds. No app download needed.</p>
      <button @click="goToBooking" class="px-10 py-4 bg-[#58cc02] text-white font-bold rounded-xl text-[15px] hover:bg-[#4ab300] transition-colors active:scale-[0.98]">
        Book a ride now
      </button>
    </section>

    <!-- ==================== FOOTER ==================== -->
    <footer class="bg-[#1a1a1a] text-white">
      <div class="max-w-4xl mx-auto px-6 py-12">
        <div class="font-serif text-xl font-semibold mb-6">Ride<span class="text-[#58cc02]">Up</span></div>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-2 mb-8">
          <router-link to="/" class="text-[14px] text-white/50 hover:text-white transition-colors">Ride</router-link>
          <router-link to="/driver/apply" class="text-[14px] text-white/50 hover:text-white transition-colors">Drive</router-link>
          <router-link to="/support" class="text-[14px] text-white/50 hover:text-white transition-colors">Support</router-link>
          <router-link to="/about" class="text-[14px] text-white/50 hover:text-white transition-colors">About</router-link>
          <router-link to="/privacy" class="text-[14px] text-white/50 hover:text-white transition-colors">Privacy</router-link>
          <router-link to="/terms" class="text-[14px] text-white/50 hover:text-white transition-colors">Terms</router-link>
        </div>

        <div class="flex gap-4 mb-8">
          <a href="https://instagram.com/rideupnassau" target="_blank" rel="noopener" class="w-9 h-9 rounded-full bg-white/[0.08] flex items-center justify-center hover:bg-white/15 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
            </svg>
          </a>
          <a href="https://wa.me/12424529911" target="_blank" rel="noopener" class="w-9 h-9 rounded-full bg-white/[0.08] flex items-center justify-center hover:bg-white/15 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </a>
        </div>

        <div class="h-px bg-white/[0.08] mb-5"></div>
        <div class="text-[12px] text-white/25">&copy; 2026 RideUp Nassau. All rights reserved.</div>
      </div>
    </footer>

  </div>
</template>
