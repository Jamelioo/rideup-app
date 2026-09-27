<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useLeadCapture } from '../lib/useLeadCapture'
import { useAuth } from '../lib/useAuth'

const router = useRouter()
const { phone, loading, error, success, submit } = useLeadCapture('rider')
const { user } = useAuth()

const isLoggedIn = computed(() => !!user.value)
const displayName = computed(() => user.value?.user_metadata?.name || 'Rider')

async function handleSubmit() {
  await submit()
}

function goToBooking() {
  router.push('/')
}

const routes = [
  { from: 'Cable Beach', to: 'Downtown Nassau', price: '$8', time: '12 min' },
  { from: 'LPIA Airport', to: 'Bahamar', price: '$12', time: '18 min' },
  { from: 'Paradise Island', to: 'Bay Street', price: '$10', time: '15 min' },
  { from: 'Carmichael Road', to: 'Downtown', price: '$7', time: '10 min' },
]
</script>

<template>
  <div class="min-h-screen bg-white text-[#1a1a1a] font-[var(--font-sans)]">

    <!-- Nav Bar -->
    <nav class="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#1a1a1a]/8">
      <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <router-link to="/" class="font-serif text-xl font-semibold">Ride<span class="text-[#58cc02]">Up</span></router-link>
        <div class="hidden md:flex items-center gap-8 text-[14px] font-medium text-[#1a1a1a]/60">
          <router-link to="/welcome" class="text-[#1a1a1a] font-semibold">Ride</router-link>
          <router-link to="/drive" class="hover:text-[#1a1a1a] transition-colors">Drive</router-link>
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
    <section class="relative overflow-hidden bg-[#1a1a1a]">
      <!-- Large decorative gradient blobs -->
      <div class="absolute inset-0 pointer-events-none">
        <div class="absolute -top-20 -left-20 w-[500px] h-[500px] rounded-full opacity-30" style="background: radial-gradient(circle, rgba(88,204,2,0.4), transparent 70%);"></div>
        <div class="absolute top-1/2 -right-32 w-[400px] h-[400px] rounded-full opacity-20" style="background: radial-gradient(circle, rgba(88,204,2,0.5), transparent 70%);"></div>
      </div>
      <!-- Dot grid overlay -->
      <div class="absolute inset-0 pointer-events-none opacity-[0.15]" style="background-image: radial-gradient(circle, rgba(255,255,255,0.4) 0.8px, transparent 0.8px); background-size: 28px 28px;"></div>
      <!-- Floating map pins -->
      <svg class="absolute top-16 left-[12%] opacity-[0.12] hidden md:block" width="32" height="44" viewBox="0 0 32 44" fill="none">
        <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 28 16 28s16-16 16-28C32 7.16 24.84 0 16 0z" fill="#58cc02"/>
        <circle cx="16" cy="16" r="6" fill="white"/>
      </svg>
      <svg class="absolute top-40 right-[18%] opacity-[0.08] hidden lg:block" width="24" height="33" viewBox="0 0 32 44" fill="none">
        <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 28 16 28s16-16 16-28C32 7.16 24.84 0 16 0z" fill="#58cc02"/>
        <circle cx="16" cy="16" r="6" fill="white"/>
      </svg>
      <svg class="absolute bottom-24 left-[25%] opacity-[0.06] hidden lg:block" width="20" height="28" viewBox="0 0 32 44" fill="none">
        <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 28 16 28s16-16 16-28C32 7.16 24.84 0 16 0z" fill="white"/>
        <circle cx="16" cy="16" r="6" fill="#1a1a1a"/>
      </svg>
      <!-- Decorative route line -->
      <svg class="absolute right-[6%] top-12 opacity-[0.1] hidden lg:block" width="140" height="380" viewBox="0 0 140 380" fill="none">
        <path d="M70 0 L70 60 Q70 100 110 120 L120 125 Q140 140 140 170 L140 230 Q140 270 100 290 L70 310 Q30 330 30 380" stroke="#58cc02" stroke-width="2.5" stroke-dasharray="6 5" />
        <circle cx="70" cy="0" r="5" fill="#58cc02" />
        <rect x="24" y="374" width="10" height="10" rx="2" fill="#58cc02" opacity="0.6" />
      </svg>

      <div class="relative max-w-6xl mx-auto px-6 pt-16 pb-20 md:pt-20 md:pb-28 grid md:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
        <!-- Left: copy -->
        <div>
          <h1 class="font-serif text-[40px] sm:text-[52px] lg:text-[62px] leading-[1.05] font-medium tracking-tight mb-5 text-white">
            Request a ride,<br>hop in, and go.
          </h1>
          <p class="text-white/60 text-[16px] leading-relaxed max-w-md mb-10">
            Flat upfront pricing across New Providence. Verified, background-checked drivers. Available 24/7.
          </p>
          <div class="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div>
              <div class="font-serif text-2xl font-semibold text-white">4.9<span class="text-[#58cc02]">&#9733;</span></div>
              <div class="text-white/50 text-[12px]">Rider rating</div>
            </div>
            <div class="w-px h-9 bg-[#1cb0f6]/40 hidden sm:block"></div>
            <div>
              <div class="font-serif text-2xl font-semibold text-white">5 min</div>
              <div class="text-white/50 text-[12px]">Avg. pickup</div>
            </div>
            <div class="w-px h-9 bg-[#1cb0f6]/40 hidden sm:block"></div>
            <div>
              <div class="font-serif text-2xl font-semibold text-white">24/7</div>
              <div class="text-white/50 text-[12px]">Availability</div>
            </div>
          </div>
        </div>

        <!-- Right: booking widget -->
        <div class="bg-white rounded-2xl p-6 shadow-2xl shadow-black/20">
          <h2 class="text-[15px] font-bold mb-4 text-[#1a1a1a]">Get a ride</h2>
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
          <p class="text-[12px] text-[#1a1a1a]/50 text-center mt-3">No surge pricing. The price you see is the price you pay.</p>
        </div>
      </div>

      <!-- Wave divider into next section -->
      <div class="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full" preserveAspectRatio="none">
          <path d="M0 40C240 80 480 0 720 40C960 80 1200 0 1440 40V80H0V40Z" fill="white"/>
        </svg>
      </div>
    </section>

    <!-- ==================== WHY RIDEUP ==================== -->
    <section class="relative overflow-hidden">
      <!-- Floating decorative circles -->
      <div class="absolute top-10 right-[10%] w-48 h-48 rounded-full border-2 border-[#58cc02]/8 hidden lg:block"></div>
      <div class="absolute bottom-20 left-[5%] w-32 h-32 rounded-full border border-[#58cc02]/6 hidden lg:block"></div>
      <div class="relative max-w-6xl mx-auto px-6 py-20 md:py-24">
        <h2 class="font-serif text-[28px] sm:text-[36px] font-medium mb-4">Why ride with RideUp?</h2>
        <p class="text-[#1a1a1a]/50 text-[15px] mb-12 max-w-lg">Everything you need for a smooth ride across New Providence.</p>
        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div class="bg-[#58cc02]/[0.06] rounded-2xl p-7 border border-[#58cc02]/10 hover:border-[#58cc02]/20 transition-colors">
            <div class="w-14 h-14 rounded-2xl bg-[#58cc02]/15 flex items-center justify-center mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-[#58cc02]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 class="text-[17px] font-bold mb-2">Upfront pricing</h3>
            <p class="text-[#1a1a1a]/50 text-[14px] leading-relaxed">Know the exact fare before you book. No surge, no surprises — the price you see is the price you pay.</p>
          </div>
          <div class="bg-[#58cc02]/[0.06] rounded-2xl p-7 border border-[#58cc02]/10 hover:border-[#58cc02]/20 transition-colors">
            <div class="w-14 h-14 rounded-2xl bg-[#58cc02]/15 flex items-center justify-center mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-[#58cc02]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 class="text-[17px] font-bold mb-2">Verified, safe drivers</h3>
            <p class="text-[#1a1a1a]/50 text-[14px] leading-relaxed">Every driver is verified, background-checked, and vehicle-inspected before their first ride. Track your trip in real-time.</p>
          </div>
          <div class="bg-[#58cc02]/[0.06] rounded-2xl p-7 border border-[#58cc02]/10 hover:border-[#58cc02]/20 transition-colors">
            <div class="w-14 h-14 rounded-2xl bg-[#58cc02]/15 flex items-center justify-center mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-[#58cc02]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 class="text-[17px] font-bold mb-2">Fast pickups</h3>
            <p class="text-[#1a1a1a]/50 text-[14px] leading-relaxed">Average pickup in under 5 minutes. Drivers across New Providence available around the clock.</p>
          </div>
          <div class="bg-[#58cc02]/[0.06] rounded-2xl p-7 border border-[#58cc02]/10 hover:border-[#58cc02]/20 transition-colors">
            <div class="w-14 h-14 rounded-2xl bg-[#58cc02]/15 flex items-center justify-center mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-[#58cc02]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <h3 class="text-[17px] font-bold mb-2">Local support</h3>
            <p class="text-[#1a1a1a]/50 text-[14px] leading-relaxed">Real people in Nassau you can call anytime. Not a chatbot, not a call center overseas.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ==================== PHONE MOCKUP + HOW IT WORKS ==================== -->
    <section class="relative overflow-hidden bg-[#f0f9e8]">
      <!-- Wave divider top -->
      <div class="absolute top-0 left-0 right-0 -translate-y-[1px]">
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full" preserveAspectRatio="none">
          <path d="M0 60V20C360 60 720 0 1080 20C1260 30 1380 50 1440 60H0Z" fill="#f0f9e8"/>
        </svg>
      </div>
      <!-- Decorative topographic lines -->
      <svg class="absolute left-0 top-1/4 opacity-[0.06] hidden lg:block" width="300" height="300" viewBox="0 0 300 300" fill="none">
        <ellipse cx="0" cy="150" rx="280" ry="100" stroke="#1a1a1a" stroke-width="1"/>
        <ellipse cx="0" cy="150" rx="220" ry="80" stroke="#1a1a1a" stroke-width="1"/>
        <ellipse cx="0" cy="150" rx="160" ry="60" stroke="#1a1a1a" stroke-width="1"/>
        <ellipse cx="0" cy="150" rx="100" ry="40" stroke="#1a1a1a" stroke-width="1"/>
      </svg>

      <div class="relative max-w-6xl mx-auto px-6 py-20 md:py-28 grid md:grid-cols-2 gap-16 items-center">
        <!-- Left: Phone mockup -->
        <div class="flex justify-center">
          <div class="relative">
            <!-- Phone frame -->
            <div class="w-[260px] h-[520px] bg-[#1a1a1a] rounded-[40px] p-3 shadow-2xl shadow-[#1a1a1a]/20">
              <div class="w-full h-full bg-white rounded-[30px] overflow-hidden flex flex-col">
                <!-- Phone status bar -->
                <div class="bg-[#1a1a1a] text-white px-5 pt-3 pb-4">
                  <div class="flex justify-between text-[10px] mb-3 opacity-60">
                    <span>9:41</span>
                    <div class="flex gap-1">
                      <div class="w-4 h-2 border border-white/60 rounded-sm"><div class="w-3 h-1 bg-white/60 rounded-sm m-px"></div></div>
                    </div>
                  </div>
                  <div class="text-[15px] font-bold font-serif">Ride<span class="text-[#58cc02]">Up</span></div>
                </div>
                <!-- App content mockup -->
                <div class="flex-1 p-4 bg-white">
                  <div class="text-[13px] font-bold text-[#1a1a1a] mb-3">Where are you going?</div>
                  <div class="space-y-2 mb-4">
                    <div class="flex items-center gap-2 bg-[#1a1a1a]/[0.04] rounded-lg px-3 py-2.5">
                      <div class="w-2 h-2 rounded-full bg-[#58cc02]"></div>
                      <span class="text-[11px] text-[#1a1a1a]/40">Pickup location</span>
                    </div>
                    <div class="flex items-center gap-2 bg-[#1a1a1a]/[0.04] rounded-lg px-3 py-2.5">
                      <div class="w-2 h-2 rounded-sm bg-[#1a1a1a]/25"></div>
                      <span class="text-[11px] text-[#1a1a1a]/40">Where to?</span>
                    </div>
                  </div>
                  <!-- Mini map area -->
                  <div class="rounded-xl bg-[#58cc02]/[0.08] h-28 flex items-center justify-center mb-3 relative overflow-hidden">
                    <div class="absolute inset-0 opacity-20" style="background-image: radial-gradient(circle, #1a1a1a 0.5px, transparent 0.5px); background-size: 12px 12px;"></div>
                    <!-- Mini route -->
                    <svg class="relative" width="80" height="60" viewBox="0 0 80 60" fill="none">
                      <path d="M15 50 Q15 25 40 25 Q65 25 65 10" stroke="#58cc02" stroke-width="2" stroke-dasharray="4 3"/>
                      <circle cx="15" cy="50" r="4" fill="#58cc02"/>
                      <rect x="61" y="6" width="8" height="8" rx="1.5" fill="#1a1a1a"/>
                    </svg>
                  </div>
                  <!-- Ride options -->
                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between bg-[#58cc02]/10 rounded-lg px-3 py-2 border border-[#58cc02]/20">
                      <div class="flex items-center gap-2">
                        <svg class="w-5 h-4 text-[#1a1a1a]" viewBox="0 0 24 16" fill="currentColor"><path d="M3 11l1.5-5h13l1.5 5H3zm2.5 3a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm13 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg>
                        <span class="text-[10px] font-semibold text-[#1a1a1a]">Standard</span>
                      </div>
                      <span class="text-[11px] font-bold text-[#1a1a1a]">$8.50</span>
                    </div>
                    <div class="flex items-center justify-between bg-[#1a1a1a]/[0.03] rounded-lg px-3 py-2">
                      <div class="flex items-center gap-2">
                        <svg class="w-5 h-4 text-[#1a1a1a]/40" viewBox="0 0 24 16" fill="currentColor"><path d="M3 11l1.5-5h13l1.5 5H3zm2.5 3a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm13 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg>
                        <span class="text-[10px] font-medium text-[#1a1a1a]/50">Comfort</span>
                      </div>
                      <span class="text-[11px] font-bold text-[#1a1a1a]/50">$12.00</span>
                    </div>
                  </div>
                </div>
                <!-- Bottom button -->
                <div class="px-4 pb-5">
                  <div class="bg-[#58cc02] text-white text-[12px] font-bold text-center py-2.5 rounded-xl">Confirm ride</div>
                </div>
              </div>
            </div>
            <!-- Glow behind phone -->
            <div class="absolute -inset-8 -z-10 rounded-full opacity-40" style="background: radial-gradient(circle, rgba(88,204,2,0.2), transparent 70%);"></div>
          </div>
        </div>

        <!-- Right: How it works -->
        <div>
          <h2 class="font-serif text-[28px] sm:text-[36px] font-medium mb-4">How RideUp works</h2>
          <p class="text-[#1a1a1a]/50 text-[15px] mb-10">Get from A to B in three easy steps.</p>
          <div class="space-y-8">
            <div class="flex gap-5">
              <div class="w-12 h-12 rounded-2xl bg-[#1cb0f6] text-white font-bold text-[18px] flex items-center justify-center shrink-0 shadow-lg shadow-[#1cb0f6]/20">1</div>
              <div>
                <h3 class="text-[17px] font-bold mb-1.5">Request</h3>
                <p class="text-[#1a1a1a]/50 text-[14px] leading-relaxed">Enter your pickup and destination. See the fare upfront before you book.</p>
              </div>
            </div>
            <div class="flex gap-5">
              <div class="w-12 h-12 rounded-2xl bg-[#1cb0f6] text-white font-bold text-[18px] flex items-center justify-center shrink-0 shadow-lg shadow-[#1cb0f6]/20">2</div>
              <div>
                <h3 class="text-[17px] font-bold mb-1.5">Ride</h3>
                <p class="text-[#1a1a1a]/50 text-[14px] leading-relaxed">A nearby driver accepts your request. Track their arrival in real-time and hop in.</p>
              </div>
            </div>
            <div class="flex gap-5">
              <div class="w-12 h-12 rounded-2xl bg-[#1cb0f6] text-white font-bold text-[18px] flex items-center justify-center shrink-0 shadow-lg shadow-[#1cb0f6]/20">3</div>
              <div>
                <h3 class="text-[17px] font-bold mb-1.5">Arrive</h3>
                <p class="text-[#1a1a1a]/50 text-[14px] leading-relaxed">Get dropped off at your destination. Pay automatically by card. Rate your driver.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ==================== NASSAU VISUAL BANNER ==================== -->
    <section class="relative overflow-hidden h-[320px] md:h-[400px]" style="background: linear-gradient(135deg, #0c3b2e 0%, #1a1a1a 30%, #1a3a2f 50%, #0f524a 75%, #1b6b5a 100%);">
      <!-- Ocean shimmer layers -->
      <div class="absolute inset-0 pointer-events-none opacity-[0.12]" style="background: repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(88,204,2,0.15) 40px, rgba(88,204,2,0.15) 41px);"></div>
      <div class="absolute inset-0 pointer-events-none opacity-[0.08]" style="background: repeating-linear-gradient(0deg, transparent, transparent 60px, rgba(255,255,255,0.06) 60px, rgba(255,255,255,0.06) 61px);"></div>
      <!-- Warm light glow (sun) -->
      <div class="absolute top-6 right-[20%] w-32 h-32 rounded-full opacity-20" style="background: radial-gradient(circle, rgba(255,220,130,0.6), transparent 70%);"></div>
      <!-- Palm silhouettes -->
      <svg class="absolute bottom-0 left-[5%] opacity-[0.12] hidden md:block" width="180" height="280" viewBox="0 0 180 280" fill="none">
        <path d="M90 280 L88 180 Q60 140 20 120 Q50 135 70 160 Q82 172 86 178 L84 120 Q40 90 10 60 Q45 85 75 110 Q82 118 84 120 L82 80 Q50 50 30 20 Q55 45 78 72 Q80 76 82 80 L80 40 Q60 10 45 0 Q65 15 80 38 L80 280Z" fill="white"/>
        <path d="M92 180 Q120 140 160 125 Q130 138 105 158 Q94 168 92 175Z" fill="white"/>
        <path d="M94 120 Q130 85 165 75 Q135 88 108 112 Q98 118 94 120Z" fill="white"/>
      </svg>
      <svg class="absolute bottom-0 right-[8%] opacity-[0.08]" width="140" height="220" viewBox="0 0 140 220" fill="none">
        <path d="M70 220 L68 140 Q40 110 10 90 Q38 105 58 125 Q65 132 67 138 L66 90 Q30 60 5 30 Q35 55 60 82 Q64 86 66 90 L65 50 Q40 20 25 0 Q45 18 64 46 L64 220Z" fill="white"/>
        <path d="M72 140 Q100 110 130 100 Q105 112 82 130 Q74 136 72 138Z" fill="white"/>
      </svg>
      <!-- Horizon line -->
      <div class="absolute bottom-[35%] left-0 right-0 h-px bg-white/[0.06]"></div>
      <!-- Water reflection -->
      <div class="absolute bottom-0 left-0 right-0 h-[35%] opacity-[0.08]" style="background: linear-gradient(180deg, rgba(88,204,2,0.2), rgba(88,204,2,0.05));"></div>
      <!-- Content overlay -->
      <div class="relative h-full flex items-center justify-center text-center px-6">
        <div>
          <p class="text-white/50 text-[13px] font-semibold tracking-wide uppercase mb-3">Nassau &middot; New Providence &middot; Paradise Island</p>
          <h2 class="font-serif text-white text-[28px] sm:text-[36px] md:text-[42px] font-medium leading-tight mb-3">Your island. Your ride.</h2>
          <p class="text-white/45 text-[15px] max-w-md mx-auto">Built by locals, for locals. Covering every corner of New Providence — from Cable Beach to the Fish Fry.</p>
        </div>
      </div>
    </section>

    <!-- ==================== POPULAR ROUTES ==================== -->
    <section class="relative overflow-hidden">
      <!-- Decorative circle ring -->
      <div class="absolute -bottom-16 -right-16 w-72 h-72 rounded-full border-2 border-[#58cc02]/6 hidden lg:block"></div>
      <div class="max-w-6xl mx-auto px-6 py-20 md:py-24">
        <h2 class="font-serif text-[28px] sm:text-[36px] font-medium mb-3">Popular routes in Nassau</h2>
        <p class="text-[#1a1a1a]/50 text-[15px] mb-10">Flat fares on the most-traveled routes across New Providence.</p>
        <div class="grid sm:grid-cols-2 gap-3">
          <div
            v-for="route in routes"
            :key="route.from + route.to"
            class="group flex items-center justify-between rounded-2xl border border-[#1a1a1a]/8 px-5 py-5 hover:bg-[#58cc02]/[0.04] hover:border-[#58cc02]/15 transition-all cursor-pointer"
            @click="goToBooking"
          >
            <div class="flex items-center gap-4">
              <div class="flex flex-col items-center gap-0.5">
                <div class="w-3 h-3 rounded-full bg-[#58cc02] shadow-sm shadow-[#58cc02]/30"></div>
                <div class="w-px h-5 bg-[#1a1a1a]/15"></div>
                <div class="w-3 h-3 rounded bg-[#1a1a1a]/25"></div>
              </div>
              <div>
                <div class="text-[15px] font-semibold">{{ route.from }}</div>
                <div class="text-[13px] text-[#1a1a1a]/45">{{ route.to }} · {{ route.time }}</div>
              </div>
            </div>
            <span class="text-[20px] font-bold font-serif group-hover:text-[#4ab300] transition-colors">{{ route.price }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ==================== GUARANTEE ==================== -->
    <section class="relative overflow-hidden bg-[#1a1a1a]">
      <!-- Wave divider top -->
      <div class="absolute top-0 left-0 right-0 -translate-y-[1px]">
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full" preserveAspectRatio="none">
          <path d="M0 60V30C360 0 720 60 1080 30C1260 15 1380 40 1440 60H0Z" fill="#1a1a1a"/>
        </svg>
      </div>
      <!-- Decorative elements inside dark section -->
      <div class="absolute inset-0 pointer-events-none">
        <div class="absolute top-1/2 left-1/4 w-64 h-64 rounded-full opacity-10" style="background: radial-gradient(circle, rgba(88,204,2,0.5), transparent 70%);"></div>
        <div class="absolute top-1/4 right-1/3 w-40 h-40 rounded-full opacity-8" style="background: radial-gradient(circle, rgba(88,204,2,0.4), transparent 70%);"></div>
      </div>
      <div class="absolute inset-0 pointer-events-none opacity-[0.05]" style="background-image: radial-gradient(circle, rgba(255,255,255,0.5) 0.6px, transparent 0.6px); background-size: 20px 20px;"></div>

      <div class="relative max-w-6xl mx-auto px-6 py-20 md:py-28">
        <div class="max-w-2xl mx-auto text-center">
          <div class="inline-flex items-center gap-2 bg-[#1cb0f6]/15 text-[#1cb0f6] text-[13px] font-semibold px-4 py-1.5 rounded-full mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            The RideUp guarantee
          </div>
          <h2 class="font-serif text-white text-[30px] sm:text-[40px] leading-tight font-medium mb-5">Your scheduled ride, on time. Or it's free.</h2>
          <p class="text-white/55 text-[16px] leading-relaxed mb-10">If your scheduled ride is late by even 1 minute, your ride is 100% free. No questions asked.</p>
          <button @click="goToBooking" class="px-8 py-4 bg-[#58cc02] hover:bg-[#4ab300] text-white font-bold rounded-xl text-[15px] transition-colors active:scale-[0.98] shadow-lg shadow-[#58cc02]/25">
            Book a ride
          </button>
        </div>
      </div>

      <!-- Wave divider bottom -->
      <div class="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full" preserveAspectRatio="none">
          <path d="M0 30C240 60 480 0 720 30C960 60 1200 0 1440 30V60H0V30Z" fill="white"/>
        </svg>
      </div>
    </section>

    <!-- ==================== SIGN UP CTA ==================== -->
    <section class="relative overflow-hidden">
      <div class="absolute inset-0 pointer-events-none" style="background: radial-gradient(ellipse 60% 80% at 50% 80%, rgba(88,204,2,0.06), transparent 60%);"></div>
      <!-- Floating circles -->
      <div class="absolute top-8 left-[8%] w-24 h-24 rounded-full border border-[#58cc02]/10 hidden lg:block"></div>
      <div class="absolute bottom-12 right-[12%] w-16 h-16 rounded-full bg-[#58cc02]/[0.04] hidden lg:block"></div>

      <div class="relative max-w-6xl mx-auto px-6 py-20 md:py-24 text-center">
        <h2 class="font-serif text-[28px] sm:text-[36px] font-medium mb-3">New to RideUp?</h2>
        <p class="text-[#1a1a1a]/50 text-[15px] mb-8 max-w-md mx-auto">Sign up and get $20 credit toward your first rides.</p>
        <form @submit.prevent="handleSubmit" class="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <input
            v-model="phone"
            type="tel"
            placeholder="Enter your phone number"
            class="flex-1 px-4 py-3.5 rounded-xl bg-[#1a1a1a]/[0.04] border border-[#1a1a1a]/8 text-[14px] outline-none focus:border-[#58cc02] transition-colors placeholder:text-[#1a1a1a]/50"
          />
          <button
            type="submit"
            :disabled="loading"
            class="px-6 py-3.5 rounded-xl bg-[#58cc02] text-white font-bold text-[14px] hover:bg-[#4ab300] transition-colors whitespace-nowrap disabled:opacity-50 active:scale-[0.98]"
          >
            {{ loading ? 'Sending...' : 'Get $20 credit' }}
          </button>
        </form>
        <p v-if="error" class="text-red-500 text-sm mt-2">{{ error }}</p>
        <p v-if="success" class="text-[#58cc02] text-sm mt-2">You're in! Your $20 credit is ready.</p>
      </div>
    </section>

    <!-- ==================== FOOTER ==================== -->
    <footer class="bg-[#1a1a1a] text-white">
      <div class="max-w-6xl mx-auto px-6 py-14 grid sm:grid-cols-4 gap-8">
        <div>
          <div class="font-serif text-lg font-semibold mb-3">Ride<span class="text-[#58cc02]">Up</span></div>
          <p class="text-white/40 text-[13px] leading-relaxed">Nassau's on-demand ride service. Available 24/7 across New Providence.</p>
        </div>
        <div>
          <div class="text-[12px] font-bold text-white/30 uppercase tracking-wider mb-3">Products</div>
          <div class="flex flex-col gap-2 text-[14px] text-white/50">
            <router-link to="/welcome" class="hover:text-white transition-colors">Ride</router-link>
            <router-link to="/drive" class="hover:text-white transition-colors">Drive</router-link>
          </div>
        </div>
        <div>
          <div class="text-[12px] font-bold text-white/30 uppercase tracking-wider mb-3">Company</div>
          <div class="flex flex-col gap-2 text-[14px] text-white/50">
            <router-link to="/about" class="hover:text-white transition-colors">About</router-link>
            <router-link to="/support" class="hover:text-white transition-colors">Support</router-link>
            <router-link to="/privacy" class="hover:text-white transition-colors">Privacy Policy</router-link>
            <router-link to="/terms" class="hover:text-white transition-colors">Terms of Service</router-link>
          </div>
        </div>
        <div>
          <div class="text-[12px] font-bold text-white/30 uppercase tracking-wider mb-3">Contact</div>
          <div class="flex flex-col gap-2 text-[14px] text-white/50">
            <a href="tel:+12424529911" class="hover:text-white transition-colors">(242) 452-9911</a>
            <span>Nassau, Bahamas</span>
          </div>
        </div>
      </div>
      <div class="border-t border-white/10 px-6 py-5 text-center text-white/25 text-[12px]">
        &copy; {{ new Date().getFullYear() }} RideUp Nassau. All rights reserved.
      </div>
    </footer>

  </div>
</template>
