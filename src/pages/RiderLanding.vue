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
</script>

<template>
  <div class="min-h-screen bg-white text-[#1a1a1a] font-[var(--font-sans)]">

    <!-- ==================== NAV BAR ==================== -->
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

    <!-- ==================== HERO SECTION ==================== -->
    <section class="relative overflow-hidden bg-[#fafdf6]">
      <!-- Subtle dot pattern -->
      <div class="absolute inset-0 pointer-events-none opacity-[0.4]" style="background-image: radial-gradient(circle, #58cc02 0.5px, transparent 0.5px); background-size: 40px 40px;"></div>

      <div class="relative max-w-6xl mx-auto px-6 pt-16 pb-20 md:pt-20 md:pb-28">
        <div class="grid lg:grid-cols-2 gap-12 items-center">
          <!-- Left: Copy + Booking Widget -->
          <div>
            <!-- Green label -->
            <div class="inline-flex items-center gap-2 bg-[#58cc02]/10 text-[#58cc02] text-[13px] font-bold px-4 py-1.5 rounded-full mb-6">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              Book a Ride
            </div>

            <!-- Heading -->
            <h1 class="font-serif text-[36px] sm:text-[48px] lg:text-[56px] leading-[1.08] font-semibold tracking-tight mb-5 text-[#1a1a1a]">
              On Time, Safe &<br><span class="text-[#58cc02]">Affordable</span> Rides
            </h1>
            <p class="text-[#1a1a1a]/55 text-[16px] leading-relaxed max-w-lg mb-8">
              Request a ride across Nassau with upfront pricing, verified drivers, and 24/7 availability. The modern way to get around New Providence.
            </p>

            <!-- Booking Widget Row -->
            <div class="flex flex-col sm:flex-row gap-3 mb-10">
              <button @click="goToBooking" class="flex-1 flex items-center gap-3 bg-white rounded-2xl px-5 py-4 text-left border border-[#1a1a1a]/8 hover:border-[#58cc02]/30 transition-colors shadow-sm">
                <div class="w-3 h-3 rounded-full bg-[#58cc02] shrink-0"></div>
                <span class="text-[14px] text-[#1a1a1a]/45">Pickup location</span>
              </button>
              <button @click="goToBooking" class="flex-1 flex items-center gap-3 bg-white rounded-2xl px-5 py-4 text-left border border-[#1a1a1a]/8 hover:border-[#58cc02]/30 transition-colors shadow-sm">
                <div class="w-3 h-3 rounded-sm bg-[#1a1a1a]/25 shrink-0"></div>
                <span class="text-[14px] text-[#1a1a1a]/45">Where to?</span>
              </button>
              <button @click="goToBooking"
                      class="px-8 py-4 bg-[#58cc02] text-white font-bold rounded-2xl text-[15px] hover:bg-[#4ab300] transition-colors active:scale-[0.98] shadow-lg shadow-[#58cc02]/20 whitespace-nowrap">
                Book Ride
              </button>
            </div>

            <!-- Stats Row -->
            <div class="flex flex-wrap items-center gap-x-10 gap-y-4">
              <div>
                <div class="font-serif text-[28px] font-bold text-[#1a1a1a]">1,000+</div>
                <div class="text-[#1a1a1a]/45 text-[13px] font-medium">Travelers</div>
              </div>
              <div class="w-px h-10 bg-[#1a1a1a]/10 hidden sm:block"></div>
              <div>
                <div class="font-serif text-[28px] font-bold text-[#1a1a1a]">5,000+</div>
                <div class="text-[#1a1a1a]/45 text-[13px] font-medium">Safe Rides</div>
              </div>
              <div class="w-px h-10 bg-[#1a1a1a]/10 hidden sm:block"></div>
              <div>
                <div class="font-serif text-[28px] font-bold text-[#1a1a1a]">24/7</div>
                <div class="text-[#1a1a1a]/45 text-[13px] font-medium">Availability</div>
              </div>
            </div>
          </div>

          <!-- Right: Car Illustration + Trust Badge + Feature Pills -->
          <div class="relative flex items-center justify-center min-h-[400px] hidden lg:flex">
            <!-- Background decorative circle -->
            <div class="absolute w-[360px] h-[360px] rounded-full bg-[#58cc02]/[0.06] border border-[#58cc02]/10"></div>
            <div class="absolute w-[280px] h-[280px] rounded-full bg-[#58cc02]/[0.04]"></div>

            <!-- SVG Car Illustration -->
            <svg class="relative z-10" width="320" height="180" viewBox="0 0 320 180" fill="none">
              <!-- Road -->
              <rect x="0" y="140" width="320" height="4" rx="2" fill="#1a1a1a" opacity="0.08"/>
              <!-- Car body -->
              <path d="M60 120 L70 80 Q75 65 90 60 L200 55 Q220 55 230 65 L260 120 Z" fill="#58cc02"/>
              <!-- Car roof -->
              <path d="M95 60 L105 35 Q110 25 125 25 L185 25 Q200 25 205 35 L215 60" fill="#4ab300"/>
              <!-- Windows -->
              <path d="M108 58 L115 38 Q118 32 128 32 L155 32 L155 58 Z" fill="white" opacity="0.85"/>
              <path d="M162 58 L162 32 L190 32 Q198 32 200 38 L208 58 Z" fill="white" opacity="0.85"/>
              <!-- Car bottom -->
              <rect x="55" y="118" width="210" height="22" rx="8" fill="#4ab300"/>
              <!-- Headlight -->
              <rect x="255" y="108" width="12" height="10" rx="3" fill="#FFD700"/>
              <!-- Taillight -->
              <rect x="54" y="108" width="8" height="10" rx="3" fill="#ff4444" opacity="0.7"/>
              <!-- Front wheel -->
              <circle cx="100" cy="140" r="18" fill="#1a1a1a"/>
              <circle cx="100" cy="140" r="10" fill="#555"/>
              <circle cx="100" cy="140" r="4" fill="#888"/>
              <!-- Rear wheel -->
              <circle cx="220" cy="140" r="18" fill="#1a1a1a"/>
              <circle cx="220" cy="140" r="10" fill="#555"/>
              <circle cx="220" cy="140" r="4" fill="#888"/>
              <!-- Ground shadow -->
              <ellipse cx="160" cy="160" rx="130" ry="6" fill="#1a1a1a" opacity="0.06"/>
              <!-- Motion lines -->
              <line x1="30" y1="100" x2="10" y2="100" stroke="#58cc02" stroke-width="2" opacity="0.3" stroke-linecap="round"/>
              <line x1="35" y1="110" x2="5" y2="110" stroke="#58cc02" stroke-width="2" opacity="0.2" stroke-linecap="round"/>
              <line x1="38" y1="120" x2="15" y2="120" stroke="#58cc02" stroke-width="2" opacity="0.15" stroke-linecap="round"/>
            </svg>

            <!-- Trust Badge (floating card) -->
            <div class="absolute top-4 right-0 bg-white rounded-2xl p-4 shadow-xl shadow-black/8 border border-[#1a1a1a]/5 trust-float">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-[#58cc02]/10 flex items-center justify-center">
                  <svg class="w-5 h-5 text-[#58cc02]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                  </svg>
                </div>
                <div>
                  <div class="text-[13px] font-bold text-[#1a1a1a]">Trusted by Nassau Riders</div>
                  <div class="text-[12px] text-[#1a1a1a]/50">4.9 <span class="text-[#58cc02]">&#9733;&#9733;&#9733;&#9733;&#9733;</span></div>
                </div>
              </div>
            </div>

            <!-- Floating pill: Comfortable -->
            <div class="absolute bottom-16 left-0 bg-white rounded-full px-5 py-2.5 shadow-lg shadow-black/6 border border-[#1a1a1a]/5 pill-float-1">
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4 text-[#58cc02]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
                </svg>
                <span class="text-[13px] font-semibold text-[#1a1a1a]">Comfortable</span>
              </div>
            </div>

            <!-- Floating pill: Safe Ride -->
            <div class="absolute bottom-4 right-8 bg-white rounded-full px-5 py-2.5 shadow-lg shadow-black/6 border border-[#1a1a1a]/5 pill-float-2">
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4 text-[#58cc02]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
                <span class="text-[13px] font-semibold text-[#1a1a1a]">Safe Ride</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ==================== BECOME A DRIVER ==================== -->
    <section class="relative overflow-hidden bg-white">
      <div class="max-w-6xl mx-auto px-6 py-20 md:py-28">
        <!-- Top: Label + Heading + Description -->
        <div class="grid lg:grid-cols-2 gap-8 mb-14">
          <div>
            <div class="inline-flex items-center gap-2 bg-[#58cc02]/10 text-[#58cc02] text-[13px] font-bold px-4 py-1.5 rounded-full mb-5">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
              Become a Driver
            </div>
            <h2 class="font-serif text-[30px] sm:text-[40px] lg:text-[46px] font-semibold leading-[1.1] text-[#1a1a1a]">
              Drive on your time,<br>Earn when you want
            </h2>
          </div>
          <div class="flex items-end">
            <p class="text-[#1a1a1a]/55 text-[16px] leading-relaxed max-w-md">
              Join the RideUp driver network in Nassau. Keep 80% of every fare, set your own hours, and get paid instantly. No boss, no office, no limits.
            </p>
          </div>
        </div>

        <!-- Feature Cards + Driver Avatar -->
        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <!-- Card 1: Green gradient -->
          <div class="rounded-3xl p-7 bg-gradient-to-br from-[#58cc02] to-[#3da301] text-white relative overflow-hidden">
            <div class="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10"></div>
            <div class="relative">
              <div class="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-5">
                <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <h3 class="text-[18px] font-bold mb-2">Reliable Income</h3>
              <p class="text-white/80 text-[14px] leading-relaxed">Keep 80% of every fare. Earn more per ride than any other platform in Nassau.</p>
            </div>
          </div>

          <!-- Card 2: White -->
          <div class="rounded-3xl p-7 bg-white border border-[#1a1a1a]/8 hover:border-[#58cc02]/20 transition-colors">
            <div class="w-12 h-12 rounded-2xl bg-[#58cc02]/10 flex items-center justify-center mb-5">
              <svg class="w-6 h-6 text-[#58cc02]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h3 class="text-[18px] font-bold mb-2 text-[#1a1a1a]">Flexibility in Scheduling</h3>
            <p class="text-[#1a1a1a]/50 text-[14px] leading-relaxed">Drive when it works for you. Morning, evening, weekends -- you decide your hours.</p>
          </div>

          <!-- Card 3: White -->
          <div class="rounded-3xl p-7 bg-white border border-[#1a1a1a]/8 hover:border-[#58cc02]/20 transition-colors">
            <div class="w-12 h-12 rounded-2xl bg-[#58cc02]/10 flex items-center justify-center mb-5">
              <svg class="w-6 h-6 text-[#58cc02]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <h3 class="text-[18px] font-bold mb-2 text-[#1a1a1a]">Instant Payment Available</h3>
            <p class="text-[#1a1a1a]/50 text-[14px] leading-relaxed">Cash out your earnings instantly. No waiting for weekly payouts.</p>
          </div>

          <!-- Driver Avatar Placeholder -->
          <div class="rounded-3xl bg-[#f0f9e8] border border-[#58cc02]/10 flex items-center justify-center relative overflow-hidden">
            <!-- Decorative shapes -->
            <div class="absolute -bottom-6 -right-6 w-28 h-28 rounded-full bg-[#58cc02]/10"></div>
            <div class="absolute top-6 left-6 w-8 h-8 rounded-full bg-[#58cc02]/15"></div>
            <!-- Driver silhouette -->
            <div class="text-center py-8">
              <div class="w-20 h-20 rounded-full bg-[#58cc02]/15 mx-auto mb-4 flex items-center justify-center">
                <svg class="w-10 h-10 text-[#58cc02]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
              </div>
              <div class="text-[14px] font-bold text-[#1a1a1a]">Join Today</div>
              <div class="text-[12px] text-[#1a1a1a]/45 mt-1">200+ Drivers Active</div>
            </div>
          </div>
        </div>

        <!-- CTA -->
        <div class="mt-10 text-center">
          <router-link to="/drive" class="inline-flex items-center gap-2 px-8 py-4 bg-[#1a1a1a] text-white font-bold rounded-2xl text-[15px] hover:bg-[#1a1a1a]/90 transition-colors active:scale-[0.98]">
            Start Driving
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
            </svg>
          </router-link>
        </div>
      </div>
    </section>

    <!-- ==================== CHOOSE YOUR PERFECT RIDE ==================== -->
    <section class="relative overflow-hidden bg-[#fafdf6]">
      <div class="max-w-6xl mx-auto px-6 py-20 md:py-28">
        <div class="grid lg:grid-cols-2 gap-12 items-center">
          <!-- Left: Big Typography -->
          <div>
            <h2 class="font-serif text-[48px] sm:text-[64px] lg:text-[80px] font-bold leading-[0.95] tracking-tight">
              <span class="text-[#1a1a1a]">CHOOSE<br>YOUR</span><br>
              <span class="text-[#58cc02]">PERFECT<br>RIDE</span>
            </h2>
          </div>

          <!-- Right: Description + Vehicle Options -->
          <div>
            <p class="text-[#1a1a1a]/55 text-[16px] leading-relaxed mb-10 max-w-md">
              Whether you need an everyday ride or something more comfortable, RideUp has the right vehicle for every trip across Nassau and New Providence.
            </p>

            <!-- Vehicle Option Cards -->
            <div class="space-y-4">
              <!-- Standard -->
              <div class="flex items-center gap-5 bg-white rounded-2xl p-5 border border-[#1a1a1a]/8 hover:border-[#58cc02]/20 transition-colors cursor-pointer group" @click="goToBooking">
                <div class="w-14 h-14 rounded-2xl bg-[#58cc02]/10 flex items-center justify-center shrink-0">
                  <svg class="w-7 h-5 text-[#58cc02]" viewBox="0 0 28 20" fill="currentColor">
                    <path d="M4 14l2-6h16l2 6H4zm3 4a2 2 0 100-4 2 2 0 000 4zm14 0a2 2 0 100-4 2 2 0 000 4z"/>
                  </svg>
                </div>
                <div class="flex-1">
                  <h4 class="text-[16px] font-bold text-[#1a1a1a] group-hover:text-[#58cc02] transition-colors">Standard</h4>
                  <p class="text-[13px] text-[#1a1a1a]/45">Everyday rides. Affordable, reliable, and always nearby.</p>
                </div>
                <svg class="w-5 h-5 text-[#1a1a1a]/25 group-hover:text-[#58cc02] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </div>

              <!-- Comfort -->
              <div class="flex items-center gap-5 bg-white rounded-2xl p-5 border border-[#1a1a1a]/8 hover:border-[#58cc02]/20 transition-colors cursor-pointer group" @click="goToBooking">
                <div class="w-14 h-14 rounded-2xl bg-[#1a1a1a]/[0.06] flex items-center justify-center shrink-0">
                  <svg class="w-7 h-5 text-[#1a1a1a]" viewBox="0 0 28 20" fill="currentColor">
                    <path d="M4 14l2-6h16l2 6H4zm3 4a2 2 0 100-4 2 2 0 000 4zm14 0a2 2 0 100-4 2 2 0 000 4z"/>
                    <circle cx="14" cy="7" r="2" fill="#58cc02" opacity="0.6"/>
                  </svg>
                </div>
                <div class="flex-1">
                  <h4 class="text-[16px] font-bold text-[#1a1a1a] group-hover:text-[#58cc02] transition-colors">Comfort</h4>
                  <p class="text-[13px] text-[#1a1a1a]/45">Premium vehicles. Extra legroom, newer models, top-rated drivers.</p>
                </div>
                <svg class="w-5 h-5 text-[#1a1a1a]/25 group-hover:text-[#58cc02] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ==================== SAFETY SECTION ==================== -->
    <section class="relative overflow-hidden bg-white">
      <div class="max-w-6xl mx-auto px-6 py-20 md:py-28">
        <div class="grid lg:grid-cols-2 gap-16 items-center">
          <!-- Left: Copy + Cards -->
          <div>
            <!-- Green label -->
            <div class="inline-flex items-center gap-2 bg-[#58cc02]/10 text-[#58cc02] text-[13px] font-bold px-4 py-1.5 rounded-full mb-5">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
              Stay Safe with Us
            </div>

            <h2 class="font-serif text-[30px] sm:text-[40px] lg:text-[46px] font-semibold leading-[1.1] text-[#1a1a1a] mb-5">
              Your Safety always comes first without any compromise
            </h2>
            <p class="text-[#1a1a1a]/55 text-[16px] leading-relaxed mb-10 max-w-lg">
              Every RideUp driver is background-checked and verified. Share your trip with family, track your ride in real-time, and reach our local support team anytime -- day or night.
            </p>

            <!-- Safety Feature Cards -->
            <div class="grid sm:grid-cols-2 gap-4">
              <!-- 24/7 Local Support -->
              <div class="rounded-2xl p-6 bg-[#fafdf6] border border-[#58cc02]/10">
                <div class="w-12 h-12 rounded-2xl bg-[#58cc02]/10 flex items-center justify-center mb-4">
                  <svg class="w-6 h-6 text-[#58cc02]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                  </svg>
                </div>
                <h4 class="text-[16px] font-bold text-[#1a1a1a] mb-1">24/7 Local Support</h4>
                <p class="text-[13px] text-[#1a1a1a]/45 leading-relaxed">Real people in Nassau ready to help. Call anytime, get answers fast.</p>
              </div>

              <!-- Track Your Ride -->
              <div class="rounded-2xl p-6 bg-[#fafdf6] border border-[#58cc02]/10">
                <div class="w-12 h-12 rounded-2xl bg-[#58cc02]/10 flex items-center justify-center mb-4">
                  <svg class="w-6 h-6 text-[#58cc02]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                </div>
                <h4 class="text-[16px] font-bold text-[#1a1a1a] mb-1">Track Your Ride</h4>
                <p class="text-[13px] text-[#1a1a1a]/45 leading-relaxed">Share your live location with family and friends on every trip.</p>
              </div>
            </div>
          </div>

          <!-- Right: Family/Safety Illustration -->
          <div class="relative flex items-center justify-center">
            <!-- Main shape: rounded rectangle with subtle styling -->
            <div class="w-full max-w-[400px] aspect-square rounded-3xl bg-[#f0f9e8] border border-[#58cc02]/10 relative overflow-hidden flex items-center justify-center">
              <!-- Decorative circles -->
              <div class="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[#58cc02]/[0.08]"></div>
              <div class="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-[#58cc02]/[0.06]"></div>

              <!-- Shield + People SVG -->
              <svg class="relative z-10" width="180" height="200" viewBox="0 0 180 200" fill="none">
                <!-- Shield -->
                <path d="M90 20 L150 45 L150 100 Q150 155 90 180 Q30 155 30 100 L30 45 Z" fill="#58cc02" opacity="0.15" stroke="#58cc02" stroke-width="2"/>
                <!-- Checkmark in shield -->
                <path d="M70 100 L85 115 L115 80" stroke="#58cc02" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                <!-- Person 1 -->
                <circle cx="70" cy="55" r="8" fill="#58cc02" opacity="0.3"/>
                <path d="M58 72 Q58 64 70 64 Q82 64 82 72" fill="#58cc02" opacity="0.2"/>
                <!-- Person 2 -->
                <circle cx="110" cy="55" r="8" fill="#58cc02" opacity="0.3"/>
                <path d="M98 72 Q98 64 110 64 Q122 64 122 72" fill="#58cc02" opacity="0.2"/>
                <!-- Person 3 (child) -->
                <circle cx="90" cy="145" r="6" fill="#58cc02" opacity="0.3"/>
                <path d="M80 158 Q80 152 90 152 Q100 152 100 158" fill="#58cc02" opacity="0.2"/>
              </svg>

              <!-- Floating verified badge -->
              <div class="absolute top-6 right-6 bg-white rounded-xl px-3 py-2 shadow-md">
                <div class="flex items-center gap-1.5">
                  <svg class="w-4 h-4 text-[#58cc02]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                  </svg>
                  <span class="text-[11px] font-bold text-[#1a1a1a]">Verified</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ==================== CTA / SIGNUP SECTION ==================== -->
    <section class="relative overflow-hidden bg-[#1a1a1a]">
      <!-- Decorative elements -->
      <div class="absolute inset-0 pointer-events-none">
        <div class="absolute top-1/2 left-1/4 w-64 h-64 rounded-full opacity-10" style="background: radial-gradient(circle, rgba(88,204,2,0.5), transparent 70%);"></div>
        <div class="absolute top-1/4 right-1/3 w-40 h-40 rounded-full opacity-8" style="background: radial-gradient(circle, rgba(88,204,2,0.4), transparent 70%);"></div>
      </div>
      <div class="absolute inset-0 pointer-events-none opacity-[0.04]" style="background-image: radial-gradient(circle, rgba(255,255,255,0.5) 0.6px, transparent 0.6px); background-size: 24px 24px;"></div>

      <div class="relative max-w-6xl mx-auto px-6 py-20 md:py-28 text-center">
        <h2 class="font-serif text-white text-[30px] sm:text-[40px] lg:text-[48px] font-semibold leading-tight mb-5">Ready to ride?</h2>
        <p class="text-white/50 text-[16px] leading-relaxed mb-10 max-w-md mx-auto">Sign up and get $20 credit toward your first rides across Nassau.</p>

        <form @submit.prevent="handleSubmit" class="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto mb-4">
          <input
            v-model="phone"
            type="tel"
            placeholder="Enter your phone number"
            class="flex-1 px-5 py-4 rounded-2xl bg-white/10 border border-white/15 text-white text-[14px] outline-none focus:border-[#58cc02] transition-colors placeholder:text-white/40"
          />
          <button
            type="submit"
            :disabled="loading"
            class="px-8 py-4 rounded-2xl bg-[#58cc02] text-white font-bold text-[15px] hover:bg-[#4ab300] transition-colors whitespace-nowrap disabled:opacity-50 active:scale-[0.98] shadow-lg shadow-[#58cc02]/25"
          >
            {{ loading ? 'Sending...' : 'Get $20 Credit' }}
          </button>
        </form>
        <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
        <p v-if="success" class="text-[#58cc02] text-sm">You're in! Your $20 credit is ready.</p>
        <p v-if="!error && !success" class="text-white/30 text-[13px]">No surge pricing. The price you see is the price you pay.</p>
      </div>
    </section>

    <!-- ==================== FOOTER ==================== -->
    <footer class="bg-[#1a1a1a] border-t border-white/5 text-white">
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

<style scoped>
/* Trust badge floating animation */
@keyframes trustFloat {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
}
.trust-float {
  animation: trustFloat 4s ease-in-out infinite;
}

/* Pill floating animations */
@keyframes pillFloat1 {
  0%, 100% { transform: translateY(0px) translateX(0px); }
  50% { transform: translateY(-6px) translateX(3px); }
}
@keyframes pillFloat2 {
  0%, 100% { transform: translateY(0px) translateX(0px); }
  50% { transform: translateY(-5px) translateX(-3px); }
}
.pill-float-1 {
  animation: pillFloat1 5s ease-in-out infinite;
}
.pill-float-2 {
  animation: pillFloat2 6s ease-in-out infinite 1s;
}
</style>
