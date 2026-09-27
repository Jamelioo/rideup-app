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

</script>

<template>
  <div class="min-h-screen bg-white text-[#1a1a1a] font-sans">

    <!-- NAV -->
    <nav class="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#1a1a1a]/8">
      <div class="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between">
        <router-link to="/" class="text-[20px] font-bold">Ride<span class="text-[#58cc02]">Up</span></router-link>
        <div class="hidden md:flex items-center gap-8 text-[16px] font-medium text-[#1a1a1a]/60">
          <router-link to="/" class="text-[#1a1a1a] font-bold">Ride</router-link>
          <router-link to="/driver/apply" class="hover:text-[#1a1a1a] transition-colors">Drive</router-link>
        </div>
        <div class="flex items-center gap-3">
          <template v-if="isLoggedIn">
            <router-link to="/profile" class="text-[16px] font-medium text-[#1a1a1a]/70 hover:text-[#1a1a1a] transition-colors">{{ displayName }}</router-link>
          </template>
          <template v-else>
            <router-link to="/login" class="text-[16px] font-medium text-[#1a1a1a]/70 hover:text-[#1a1a1a] transition-colors hidden sm:block">Log in</router-link>
            <router-link to="/signup" class="text-[16px] font-bold bg-[#1a1a1a] text-white px-5 py-2.5 rounded-full hover:bg-[#1a1a1a]/90 transition-colors">Sign up</router-link>
          </template>
        </div>
      </div>
    </nav>

    <!-- HERO -->
    <section class="bg-[#f0fae4]">
      <div class="max-w-6xl mx-auto px-5 pt-10 pb-0 md:pt-14 md:grid md:grid-cols-2 md:gap-8 md:items-end">
        <div class="pb-10 md:pb-16">
          <h1 class="text-[35px] sm:text-[48px] lg:text-[60px] leading-[1.0] font-bold tracking-tight mb-5">
            Get anywhere in Nassau in 5 minutes.
          </h1>
          <p class="text-[#1a1a1a]/50 text-[16px] leading-[1.5] max-w-md mb-8">
            Book a ride in 10 seconds. See the exact fare upfront — no surge, no surprises.
          </p>

          <!-- Booking widget -->
          <div class="bg-white rounded-2xl p-4 shadow-lg shadow-[#58cc02]/8 max-w-sm">
            <div class="space-y-2 mb-3">
              <button @click="goToBooking" aria-label="Enter pickup location" class="w-full flex items-center gap-3 bg-[#f5f5f5] rounded-xl px-4 py-3 text-left hover:bg-[#eee] transition-colors">
                <div class="w-2.5 h-2.5 rounded-full bg-[#58cc02] shrink-0"></div>
                <span class="text-[14px] text-[#1a1a1a]/40">Pickup location</span>
              </button>
              <button @click="goToBooking" aria-label="Enter destination" class="w-full flex items-center gap-3 bg-[#f5f5f5] rounded-xl px-4 py-3 text-left hover:bg-[#eee] transition-colors">
                <div class="w-2.5 h-2.5 rounded-sm bg-[#1a1a1a]/25 shrink-0"></div>
                <span class="text-[14px] text-[#1a1a1a]/40">Where to?</span>
              </button>
            </div>
            <button @click="goToBooking" class="w-full py-3 bg-[#58cc02] text-white font-bold rounded-xl text-[16px] hover:bg-[#4ab300] transition-colors active:scale-[0.99]">
              See prices
            </button>
          </div>
        </div>

        <!-- Phone mockup -->
        <div class="flex justify-center md:justify-end">
          <div class="w-[240px] sm:w-[270px] translate-y-4">
            <div class="bg-[#1a1a1a] rounded-t-[34px] pt-2.5 px-2.5 shadow-2xl shadow-black/20">
              <div class="bg-white rounded-t-[24px] overflow-hidden">
                <div class="bg-[#1a1a1a] text-white px-4 pt-2.5 pb-3">
                  <div class="flex justify-between text-[9px] mb-2 opacity-60">
                    <span>9:41</span>
                    <div class="flex gap-1">
                      <div class="w-3.5 h-1.5 border border-white/60 rounded-sm"><div class="w-2.5 h-0.5 bg-white/60 rounded-sm m-px"></div></div>
                    </div>
                  </div>
                  <div class="text-[13px] font-bold">Ride<span class="text-[#58cc02]">Up</span></div>
                </div>
                <div class="p-3.5 bg-white">
                  <div class="text-[11px] font-bold text-[#1a1a1a] mb-2.5">Where are you going?</div>
                  <div class="space-y-1.5 mb-3">
                    <div class="flex items-center gap-2 bg-[#f5f5f5] rounded-lg px-3 py-2">
                      <div class="w-1.5 h-1.5 rounded-full bg-[#58cc02]"></div>
                      <span class="text-[10px] text-[#1a1a1a]/40">Cable Beach</span>
                    </div>
                    <div class="flex items-center gap-2 bg-[#f5f5f5] rounded-lg px-3 py-2">
                      <div class="w-1.5 h-1.5 rounded-sm bg-[#1a1a1a]/25"></div>
                      <span class="text-[10px] text-[#1a1a1a]/40">Downtown Nassau</span>
                    </div>
                  </div>
                  <div class="rounded-xl bg-[#e8f5d6] h-20 flex items-center justify-center mb-2.5 relative">
                    <svg width="70" height="40" viewBox="0 0 70 40" fill="none" aria-hidden="true">
                      <path d="M10 32 Q10 16 35 16 Q60 16 60 6" stroke="#58cc02" stroke-width="2" stroke-dasharray="4 3"/>
                      <circle cx="10" cy="32" r="3.5" fill="#58cc02"/>
                      <rect x="56" y="2" width="7" height="7" rx="1.5" fill="#1a1a1a"/>
                    </svg>
                  </div>
                  <div class="space-y-1">
                    <div class="flex items-center justify-between bg-[#58cc02]/10 rounded-lg px-2.5 py-1.5 border border-[#58cc02]/20">
                      <div class="flex items-center gap-1.5">
                        <svg class="w-4 h-3 text-[#1a1a1a]" viewBox="0 0 24 16" fill="currentColor"><path d="M3 11l1.5-5h13l1.5 5H3zm2.5 3a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm13 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg>
                        <span class="text-[9px] font-semibold">Standard</span>
                      </div>
                      <span class="text-[10px] font-bold">$8.00</span>
                    </div>
                    <div class="flex items-center justify-between bg-[#f5f5f5] rounded-lg px-2.5 py-1.5">
                      <div class="flex items-center gap-1.5">
                        <svg class="w-4 h-3 text-[#1a1a1a]/40" viewBox="0 0 24 16" fill="currentColor"><path d="M3 11l1.5-5h13l1.5 5H3zm2.5 3a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm13 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg>
                        <span class="text-[9px] font-medium text-[#1a1a1a]/50">Comfort</span>
                      </div>
                      <span class="text-[10px] font-bold text-[#1a1a1a]/50">$12.00</span>
                    </div>
                  </div>
                </div>
                <div class="px-3.5 pb-3.5">
                  <div class="bg-[#58cc02] text-white text-[11px] font-bold text-center py-2 rounded-xl">Confirm ride</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- VALUE PROPS -->
    <section class="bg-white">
      <div class="max-w-3xl mx-auto px-5 py-12 md:py-14">

        <!-- Prop 1: Upfront pricing -->
        <div class="flex items-start gap-4 mb-10 pb-10 border-b border-[#f0f0f0]">
          <div class="w-12 h-12 rounded-xl bg-[#f0fae4] flex items-center justify-center shrink-0 mt-0.5">
            <svg class="w-5 h-5 text-[#58cc02]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 class="text-[20px] font-bold mb-1.5 leading-[1.3]">Know your fare before you ride</h3>
            <p class="text-[#1a1a1a]/50 text-[16px] leading-[1.5]">The price you see is the price you pay. Flat rates across all of Nassau — no surge pricing, no hidden fees, ever.</p>
          </div>
        </div>

        <!-- Prop 2: Verified drivers -->
        <div class="flex items-start gap-4 mb-10 pb-10 border-b border-[#f0f0f0]">
          <div class="w-12 h-12 rounded-xl bg-[#eef6ff] flex items-center justify-center shrink-0 mt-0.5">
            <svg class="w-5 h-5 text-[#2196f3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h3 class="text-[20px] font-bold mb-1.5 leading-[1.3]">Every driver verified</h3>
            <p class="text-[#1a1a1a]/50 text-[16px] leading-[1.5]">Background-checked drivers, inspected vehicles. Track your ride live and share your trip with family — all built in.</p>
          </div>
        </div>

        <!-- Prop 3: Island coverage -->
        <div class="flex items-start gap-4">
          <div class="w-12 h-12 rounded-xl bg-[#fff8e6] flex items-center justify-center shrink-0 mt-0.5">
            <svg class="w-5 h-5 text-[#ff9800]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h3 class="text-[20px] font-bold mb-1.5 leading-[1.3]">Anywhere across Nassau</h3>
            <p class="text-[#1a1a1a]/50 text-[16px] leading-[1.5]">LPIA Airport, Cable Beach, Paradise Island, Downtown — drivers across the whole island, available 24/7.</p>
          </div>
        </div>

      </div>
    </section>

    <!-- DRIVER RECRUITMENT -->
    <section class="bg-[#1a1a1a]">
      <div class="max-w-6xl mx-auto px-5 py-12 md:py-14 md:grid md:grid-cols-2 md:gap-10 md:items-center">
        <div class="mb-6 md:mb-0">
          <img src="/images/driver-photo.jpg" alt="Driver behind the wheel" class="w-full h-[220px] md:h-[300px] object-cover rounded-2xl" loading="lazy" />
        </div>
        <div>
          <div class="inline-block bg-[#58cc02]/20 text-[#58cc02] text-[12px] font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-wide">Drive with us</div>
          <h2 class="text-[28px] sm:text-[35px] font-bold leading-[1.14] text-white mb-3">Keep 80% of every fare</h2>
          <p class="text-white/50 text-[16px] leading-[1.5] mb-5">Drive with RideUp on your own schedule. No shifts, no minimums. Sign up today and start earning this week.</p>
          <div class="flex flex-wrap gap-x-5 gap-y-2 mb-6 text-[14px] text-white/60">
            <span class="flex items-center gap-1.5">
              <svg class="w-4 h-4 text-[#58cc02]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              Flexible hours
            </span>
            <span class="flex items-center gap-1.5">
              <svg class="w-4 h-4 text-[#58cc02]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              Weekly payouts
            </span>
            <span class="flex items-center gap-1.5">
              <svg class="w-4 h-4 text-[#58cc02]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              No minimums
            </span>
          </div>
          <button @click="goToDriverApply" class="px-8 py-3.5 bg-[#58cc02] text-white font-bold rounded-xl text-[16px] hover:bg-[#4ab300] transition-colors active:scale-[0.99]">
            Apply to drive
          </button>
        </div>
      </div>
    </section>

    <!-- FINAL CTA -->
    <section class="bg-[#f0fae4] py-12 md:py-14 text-center px-5">
      <h2 class="text-[28px] sm:text-[35px] font-bold leading-[1.14] mb-3">Ready to ride?</h2>
      <p class="text-[#1a1a1a]/50 text-[16px] leading-[1.5] mb-6">Book in seconds. No app download needed.</p>
      <button @click="goToBooking" class="px-10 py-3.5 bg-[#58cc02] text-white font-bold rounded-xl text-[16px] hover:bg-[#4ab300] transition-colors active:scale-[0.98] shadow-lg shadow-[#58cc02]/20">
        Book a ride now
      </button>
    </section>

    <!-- FOOTER -->
    <footer class="bg-[#1a1a1a] text-white">
      <div class="max-w-4xl mx-auto px-5 py-10">
        <div class="text-[20px] font-bold mb-5">Ride<span class="text-[#58cc02]">Up</span></div>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-2 mb-7">
          <router-link to="/" class="text-[14px] text-white/50 hover:text-white transition-colors">Ride</router-link>
          <router-link to="/driver/apply" class="text-[14px] text-white/50 hover:text-white transition-colors">Drive</router-link>
          <router-link to="/support" class="text-[14px] text-white/50 hover:text-white transition-colors">Support</router-link>
          <router-link to="/about" class="text-[14px] text-white/50 hover:text-white transition-colors">About</router-link>
          <router-link to="/privacy" class="text-[14px] text-white/50 hover:text-white transition-colors">Privacy</router-link>
          <router-link to="/terms" class="text-[14px] text-white/50 hover:text-white transition-colors">Terms</router-link>
        </div>

        <div class="flex gap-3 mb-7">
          <a href="https://instagram.com/rideupnassau" target="_blank" rel="noopener" class="w-9 h-9 rounded-full bg-white/[0.08] flex items-center justify-center hover:bg-white/15 transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
            </svg>
          </a>
          <a href="https://wa.me/12424529911" target="_blank" rel="noopener" class="w-9 h-9 rounded-full bg-white/[0.08] flex items-center justify-center hover:bg-white/15 transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </a>
        </div>

        <div class="h-px bg-white/[0.08] mb-4"></div>
        <div class="text-[12px] text-white/25">&copy; 2026 RideUp Nassau. All rights reserved.</div>
      </div>
    </footer>

  </div>
</template>
