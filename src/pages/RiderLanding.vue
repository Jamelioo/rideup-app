<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../lib/useAuth'

const router = useRouter()
const { user } = useAuth()

const isLoggedIn = computed(() => !!user.value)
const displayName = computed(() => user.value?.user_metadata?.name || 'Rider')

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

// Google Maps Static API URL — styled map of New Providence with labeled pins
const mapUrl = computed(() => {
  const center = '25.0443,-77.3504'
  const zoom = '12'
  const size = '800x600'
  const scale = '2'
  const style = [
    'feature:all|element:geometry|color:0xe8e8e8',
    'feature:water|element:geometry|color:0xc9e4f4',
    'feature:road|element:geometry|color:0xffffff',
    'feature:road|element:labels|visibility:off',
    'feature:poi|visibility:off',
    'feature:transit|visibility:off',
    'feature:administrative|element:labels.text.fill|color:0x999999',
  ].map(s => `style=${s}`).join('&')

  const markers = [
    `markers=color:0x58cc02|label:P|25.0862,-77.3231`,
    `markers=color:0x58cc02|label:C|25.0780,-77.4180`,
    `markers=color:0x58cc02|label:D|25.0783,-77.3387`,
    `markers=color:0x58cc02|label:A|25.0390,-77.4662`,
  ].join('&')

  const path = `path=color:0x58cc02ff|weight:3|enc:_{g~Cn_dpMgBcKmJwNsLaC`

  return `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=${size}&scale=${scale}&maptype=roadmap&${style}&${markers}&${path}&key=${apiKey}`
})

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

    <!-- ==================== HERO ==================== -->
    <section class="relative overflow-hidden min-h-[600px] md:min-h-[650px]">
      <!-- Map background -->
      <div class="absolute inset-0">
        <img :src="mapUrl" alt="Map of Nassau, New Providence" class="w-full h-full object-cover" />
      </div>
      <!-- Mobile gradient overlay: white from bottom -->
      <div class="absolute inset-0 md:hidden" style="background: linear-gradient(to top, white 50%, rgba(255,255,255,0.3) 80%, transparent 100%);"></div>
      <!-- Desktop gradient overlay: white from left -->
      <div class="absolute inset-0 hidden md:block" style="background: linear-gradient(to right, rgba(255,255,255,0.97) 45%, rgba(255,255,255,0.8) 60%, transparent 80%);"></div>

      <div class="relative max-w-6xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28 flex flex-col justify-end md:justify-center min-h-[600px] md:min-h-[650px]">
        <div class="max-w-lg">
          <h1 class="font-serif text-[36px] sm:text-[48px] lg:text-[56px] leading-[1.08] font-medium tracking-tight mb-5 text-[#1a1a1a]">
            Request a ride,<br>hop in, and go.
          </h1>
          <p class="text-[#1a1a1a]/50 text-[16px] leading-relaxed max-w-md mb-8">
            Flat upfront pricing across New Providence. Verified drivers. Available 24/7.
          </p>

          <!-- Booking widget -->
          <div class="bg-white rounded-2xl p-5 shadow-xl shadow-black/10 max-w-md">
            <div class="space-y-2.5 mb-4">
              <button @click="goToBooking" class="w-full flex items-center gap-3 bg-[#1a1a1a]/[0.04] rounded-xl px-4 py-3.5 text-left">
                <div class="w-2.5 h-2.5 rounded-full bg-[#58cc02] shrink-0"></div>
                <span class="text-[14px] text-[#1a1a1a]/50">Pickup location</span>
              </button>
              <button @click="goToBooking" class="w-full flex items-center gap-3 bg-[#1a1a1a]/[0.04] rounded-xl px-4 py-3.5 text-left">
                <div class="w-2.5 h-2.5 rounded-sm bg-[#1a1a1a]/30 shrink-0"></div>
                <span class="text-[14px] text-[#1a1a1a]/50">Where to?</span>
              </button>
            </div>
            <button @click="goToBooking"
                    class="w-full py-3.5 bg-[#58cc02] text-white font-bold rounded-xl text-[14px] hover:bg-[#4ab300] transition-colors active:scale-[0.99]">
              See prices
            </button>
          </div>
        </div>
      </div>

      <!-- Location label (desktop only) -->
      <div class="absolute bottom-6 right-8 hidden md:block">
        <span class="text-[13px] text-[#1a1a1a]/40 font-medium">New Providence, Bahamas</span>
      </div>
    </section>

    <!-- ==================== STATS BANNER ==================== -->
    <section class="bg-[#1a1a1a]">
      <div class="max-w-4xl mx-auto px-6 py-8 flex items-center justify-center gap-0">
        <!-- Stat 1: Rides -->
        <div class="flex-1 text-center">
          <div class="font-serif text-[28px] sm:text-[32px] font-semibold text-[#58cc02]">5k+</div>
          <div class="text-white/40 text-[12px] mt-1">Rides completed</div>
        </div>
        <!-- Divider -->
        <div class="w-px h-12 bg-white/10"></div>
        <!-- Stat 2: Rating -->
        <div class="flex-1 text-center">
          <div class="font-serif text-[28px] sm:text-[32px] font-semibold text-white">4.9<span class="text-[#58cc02]">&#9733;</span></div>
          <div class="text-white/40 text-[12px] mt-1">Rider rating</div>
        </div>
        <!-- Divider -->
        <div class="w-px h-12 bg-white/10"></div>
        <!-- Stat 3: Pickup -->
        <div class="flex-1 text-center">
          <div class="font-serif text-[28px] sm:text-[32px] font-semibold text-white">&lt;5m</div>
          <div class="text-white/40 text-[12px] mt-1">Avg. pickup</div>
        </div>
      </div>
    </section>

    <!-- ==================== VALUE PROPS ==================== -->
    <section>
      <!-- Block 1: Know your fare -->
      <div class="max-w-6xl mx-auto px-6 py-16 md:py-20">
        <img src="/images/fare-photo.jpg" alt="Fare pricing" class="w-full rounded-2xl object-cover mb-8 max-h-[400px]" />
        <h2 class="font-serif text-[28px] sm:text-[36px] font-medium mb-3">Know your fare before you ride</h2>
        <p class="text-[#1a1a1a]/50 text-[16px] leading-relaxed max-w-lg">See the exact price upfront when you book. No surge pricing, no hidden fees, no surprises at the end of your trip.</p>
      </div>

      <div class="max-w-6xl mx-auto px-6"><div class="border-t border-[#f0f0f0]"></div></div>

      <!-- Block 2: Safety -->
      <div class="max-w-6xl mx-auto px-6 py-16 md:py-20">
        <div class="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10">
          <div class="w-16 h-16 rounded-full bg-[#58cc02] flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h2 class="font-serif text-[28px] sm:text-[36px] font-medium mb-3">Safety first, always</h2>
            <p class="text-[#1a1a1a]/50 text-[16px] leading-relaxed max-w-lg">Every driver is verified, background-checked, and vehicle-inspected. Track your trip in real-time and share your ride with friends and family.</p>
          </div>
        </div>
      </div>

      <div class="max-w-6xl mx-auto px-6"><div class="border-t border-[#f0f0f0]"></div></div>

      <!-- Block 3: Anywhere across Nassau -->
      <div class="bg-[#f8f8f8]">
        <div class="max-w-6xl mx-auto px-6 py-16 md:py-20">
          <div class="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10">
            <!-- Route graphic -->
            <div class="shrink-0">
              <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
                <circle cx="20" cy="40" r="10" fill="#58cc02" />
                <circle cx="20" cy="40" r="4" fill="white" />
                <line x1="34" y1="40" x2="82" y2="40" stroke="#1a1a1a" stroke-width="2" stroke-dasharray="5 4" />
                <rect x="90" y="30" width="20" height="20" rx="3" fill="#1a1a1a" />
              </svg>
            </div>
            <div>
              <h2 class="font-serif text-[28px] sm:text-[36px] font-medium mb-3">Anywhere across Nassau</h2>
              <p class="text-[#1a1a1a]/50 text-[16px] leading-relaxed max-w-lg">From Cable Beach to Paradise Island, LPIA to the Fish Fry. Drivers across New Providence, available around the clock.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ==================== POPULAR ROUTES ==================== -->
    <section class="bg-[#f8f8f8]">
      <div class="max-w-6xl mx-auto px-6 py-16 md:py-20">
        <h2 class="font-serif text-[28px] sm:text-[36px] font-medium mb-2">Go anywhere in Nassau</h2>
        <p class="text-[#1a1a1a]/50 text-[15px] mb-10">Flat fares. No surge pricing.</p>

        <div class="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div
            v-for="(route, index) in routes"
            :key="route.from + route.to"
            class="flex items-center justify-between px-6 py-5 cursor-pointer hover:bg-[#f8f8f8]/50 transition-colors"
            :class="{ 'border-t border-[#f0f0f0]': index > 0 }"
            @click="goToBooking"
          >
            <div class="flex items-center gap-4">
              <div class="w-3 h-3 rounded-full bg-[#58cc02] shrink-0"></div>
              <div>
                <span class="text-[15px] font-semibold">{{ route.from }} &rarr; {{ route.to }}</span>
                <span class="text-[13px] text-[#1a1a1a]/40 ml-3">{{ route.time }}</span>
              </div>
            </div>
            <span class="text-[18px] font-bold font-serif">{{ route.price }}</span>
          </div>
        </div>

        <div class="mt-6 text-center">
          <button @click="goToBooking" class="px-8 py-3.5 bg-[#1a1a1a] text-white font-bold rounded-xl text-[14px] hover:bg-[#1a1a1a]/90 transition-colors active:scale-[0.98]">
            See all prices
          </button>
        </div>
      </div>
    </section>

    <!-- ==================== DRIVER RECRUITMENT ==================== -->
    <section class="max-w-6xl mx-auto px-6 py-16 md:py-20">
      <div class="rounded-2xl overflow-hidden">
        <!-- Photo top -->
        <div class="relative h-[240px] md:h-[300px]">
          <img src="/images/driver-photo.jpg" alt="Drive with RideUp" class="w-full h-full object-cover" />
          <div class="absolute inset-0" style="background: linear-gradient(to bottom, transparent 40%, rgba(26,26,26,0.8) 100%);"></div>
        </div>
        <!-- Content bottom -->
        <div class="bg-[#1a1a1a] px-8 py-10 md:px-12 md:py-12">
          <h2 class="font-serif text-white text-[28px] sm:text-[36px] font-medium mb-3">Earn on your schedule</h2>
          <p class="text-white/50 text-[16px] leading-relaxed max-w-lg mb-8">Drive with RideUp and keep 80% of every fare. No shifts, no minimums.</p>
          <button @click="goToDriverApply" class="px-8 py-3.5 bg-[#58cc02] text-white font-bold rounded-xl text-[15px] hover:bg-[#4ab300] transition-colors active:scale-[0.98]">
            Apply to drive
          </button>
        </div>
      </div>
    </section>

    <!-- ==================== FINAL CTA ==================== -->
    <section class="max-w-6xl mx-auto px-6 py-16 md:py-24 text-center">
      <h2 class="font-serif text-[28px] sm:text-[36px] font-medium mb-3">Ready to ride?</h2>
      <p class="text-[#1a1a1a]/50 text-[16px] mb-8">Book in seconds. No app download needed.</p>
      <button @click="goToBooking" class="px-10 py-4 bg-[#58cc02] text-white font-bold rounded-xl text-[15px] hover:bg-[#4ab300] transition-colors active:scale-[0.98] shadow-lg shadow-[#58cc02]/20">
        Book a ride now
      </button>
    </section>

    <!-- ==================== FOOTER ==================== -->
    <footer class="bg-[#1a1a1a] text-white">
      <div class="max-w-6xl mx-auto px-6 py-14">
        <!-- Logo -->
        <div class="font-serif text-xl font-semibold mb-10">Ride<span class="text-[#58cc02]">Up</span></div>

        <!-- Link grid -->
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-8 text-[14px] text-white/50 mb-10">
          <router-link to="/" class="hover:text-white transition-colors">Ride</router-link>
          <router-link to="/driver/apply" class="hover:text-white transition-colors">Drive</router-link>
          <router-link to="/support" class="hover:text-white transition-colors">Support</router-link>
          <router-link to="/about" class="hover:text-white transition-colors">About</router-link>
          <router-link to="/privacy" class="hover:text-white transition-colors">Privacy</router-link>
          <router-link to="/terms" class="hover:text-white transition-colors">Terms</router-link>
        </div>

        <!-- Social icons -->
        <div class="flex items-center gap-3 mb-10">
          <a href="https://instagram.com/rideupnassau" target="_blank" rel="noopener" class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
            </svg>
          </a>
          <a href="https://wa.me/12424529911" target="_blank" rel="noopener" class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </a>
        </div>

        <!-- Divider + copyright -->
        <div class="border-t border-white/10 pt-6 text-white/25 text-[12px]">
          &copy; 2026 RideUp Nassau. All rights reserved.
        </div>
      </div>
    </footer>

  </div>
</template>
