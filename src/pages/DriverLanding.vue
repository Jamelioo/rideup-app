<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
const whatsappLink = 'https://wa.me/12424529911?text=' + encodeURIComponent("Hi! I'd like to apply to drive for RideUp Nassau.")

function goToApply() {
  router.push('/driver/apply')
}

const requirements = [
  'Valid Bahamian driver license',
  'Vehicle 2015 or newer',
  'Clean driving record',
  'Smartphone with data plan',
]

const earningsExamples = [
  { route: 'Cable Beach → Downtown', distance: '4.2 mi', fare: '$12.50', yourCut: '$10.00' },
  { route: 'LPIA Airport → Bahamar', distance: '7.8 mi', fare: '$22.00', yourCut: '$17.60' },
  { route: 'Paradise Island → Bay St', distance: '5.1 mi', fare: '$15.00', yourCut: '$12.00' },
]

const testimonials = [
  {
    name: 'Marcus T.',
    area: 'Cable Beach area',
    months: 4,
    quote: 'The 80% payout makes a real difference. I switched from driving informally and my weekly take-home went up immediately.',
    trips: '320+ trips',
  },
  {
    name: 'Keisha R.',
    area: 'Downtown Nassau',
    months: 2,
    quote: 'I drive evenings after my day job. The flexibility is what sold me — no shifts, no minimums, just open the app.',
    trips: '150+ trips',
  },
  {
    name: 'Darnell W.',
    area: 'Paradise Island',
    months: 3,
    quote: 'Getting approved took two days. The app is straightforward and the support team actually picks up the phone.',
    trips: '280+ trips',
  },
]
</script>

<template>
  <div class="min-h-screen bg-white text-[#191f1c] font-[var(--font-sans)]">

    <!-- Nav Bar — simplified for conversion -->
    <nav class="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#191f1c]/8">
      <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <router-link to="/" class="text-xl font-semibold">Ride<span class="text-[#2b8659]">Up</span></router-link>
        <router-link to="/login" class="text-[14px] font-medium text-[#191f1c]/55 hover:text-[#191f1c] transition-colors">Already a driver? <span class="text-[#191f1c] font-semibold">Log in</span></router-link>
      </div>
    </nav>

    <!-- ==================== HERO ==================== -->
    <section class="relative overflow-hidden bg-[#191f1c]">
      <!-- Gradient blobs -->
      <div class="absolute inset-0 pointer-events-none">
        <div class="absolute -top-32 right-0 w-[600px] h-[600px] rounded-full opacity-25" style="background: radial-gradient(circle, rgba(88,204,2,0.4), transparent 70%);"></div>
        <div class="absolute bottom-0 -left-20 w-[400px] h-[400px] rounded-full opacity-15" style="background: radial-gradient(circle, rgba(75,179,0,0.5), transparent 70%);"></div>
      </div>
      <!-- Dot grid -->
      <div class="absolute inset-0 pointer-events-none opacity-[0.15]" style="background-image: radial-gradient(circle, rgba(255,255,255,0.4) 0.8px, transparent 0.8px); background-size: 28px 28px;"></div>
      <!-- Floating map pins -->
      <svg class="absolute top-20 right-[15%] opacity-[0.1] hidden md:block" width="28" height="40" viewBox="0 0 32 44" fill="none">
        <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 28 16 28s16-16 16-28C32 7.16 24.84 0 16 0z" fill="#2b8659"/>
        <circle cx="16" cy="16" r="6" fill="white"/>
      </svg>
      <svg class="absolute bottom-28 left-[18%] opacity-[0.07] hidden lg:block" width="22" height="31" viewBox="0 0 32 44" fill="none">
        <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 28 16 28s16-16 16-28C32 7.16 24.84 0 16 0z" fill="white"/>
        <circle cx="16" cy="16" r="6" fill="#191f1c"/>
      </svg>
      <!-- Route line -->
      <svg class="absolute left-[6%] top-12 opacity-[0.08] hidden lg:block" width="120" height="320" viewBox="0 0 120 320" fill="none">
        <path d="M60 0 L60 60 Q60 100 20 120 L10 125 Q0 140 0 165 L0 220 Q0 260 40 275 L80 290 Q120 305 120 320" stroke="#2b8659" stroke-width="2.5" stroke-dasharray="6 5" />
        <circle cx="60" cy="0" r="5" fill="#2b8659" />
        <rect x="114" y="314" width="10" height="10" rx="2" fill="#2b8659" opacity="0.6" />
      </svg>

      <div class="relative max-w-6xl mx-auto px-6 pt-12 pb-16 md:pt-14 md:pb-24">
        <div class="grid md:grid-cols-[1.15fr_0.85fr] gap-10 items-center">
          <!-- Left: hero copy — 80% is the headline -->
          <div>
            <div class="inline-flex items-center gap-2 bg-white/10 text-white/80 text-[13px] font-medium px-4 py-1.5 rounded-full mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Now recruiting drivers in Nassau
            </div>
            <h1 class="text-white leading-[1.05] font-medium tracking-tight mb-4">
              <span class="block text-[44px] sm:text-[56px] lg:text-[68px]">Keep <span class="text-[#2b8659]">80%</span></span>
              <span class="block text-[32px] sm:text-[40px] lg:text-[46px] text-white/80">of Every Fare.</span>
            </h1>
            <p class="text-white/55 text-[16px] leading-relaxed max-w-md mb-6">
              Drive with RideUp across New Providence. Your car, your hours, your money. We take 20% — you keep the rest.
            </p>

            <!-- CTA -->
            <button
              @click="goToApply"
              class="inline-flex items-center gap-2 px-8 py-4 bg-[#2b8659] hover:bg-[#236e49] text-white font-bold rounded-xl text-[16px] transition-colors active:scale-[0.98] shadow-lg shadow-[#2b8659]/25 mb-4"
            >
              Start Driving
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
            <div class="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-white/40">
              <span>5-minute application</span>
              <span class="text-white/15">|</span>
              <span>Use your own car</span>
              <span class="text-white/15">|</span>
              <span>No lease required</span>
            </div>
          </div>

          <!-- Right: Driver app phone mockup -->
          <div class="flex justify-center">
            <div class="relative">
              <div class="w-[250px] h-[490px] bg-[#0e1a16] rounded-[38px] p-2.5 shadow-2xl shadow-black/30">
                <div class="w-full h-full bg-white rounded-[30px] overflow-hidden flex flex-col">
                  <!-- Status bar -->
                  <div class="bg-[#191f1c] text-white px-5 pt-3 pb-3">
                    <div class="flex justify-between text-[10px] mb-2 opacity-50">
                      <span>9:41</span>
                      <div class="flex gap-1 items-center">
                        <div class="w-3.5 h-2 border border-white/50 rounded-sm"><div class="w-2.5 h-1 bg-white/50 rounded-sm m-px"></div></div>
                      </div>
                    </div>
                    <div class="flex items-center justify-between">
                      <div class="text-[14px] font-bold font-serif">Ride<span class="text-[#2b8659]">Up</span> <span class="text-[9px] font-normal text-white/50 ml-0.5">Driver</span></div>
                      <div class="flex items-center gap-1 bg-[#2b8659]/20 px-2 py-0.5 rounded-full">
                        <div class="w-1.5 h-1.5 rounded-full bg-[#2b8659]"></div>
                        <span class="text-[9px] text-[#2b8659] font-semibold">Online</span>
                      </div>
                    </div>
                  </div>
                  <!-- App content -->
                  <div class="flex-1 p-3.5 bg-white">
                    <div class="text-[10px] text-[#191f1c]/35 mb-0.5">Today's earnings</div>
                    <div class="text-[26px] font-bold text-[#191f1c] mb-3">$147<span class="text-[18px]">.50</span></div>
                    <!-- Stats row -->
                    <div class="grid grid-cols-3 gap-1.5 mb-3">
                      <div class="bg-[#191f1c]/[0.04] rounded-lg py-2 text-center">
                        <div class="text-[13px] font-bold text-[#191f1c]">8</div>
                        <div class="text-[8px] text-[#191f1c]/35">Trips</div>
                      </div>
                      <div class="bg-[#191f1c]/[0.04] rounded-lg py-2 text-center">
                        <div class="text-[13px] font-bold text-[#191f1c]">4.9</div>
                        <div class="text-[8px] text-[#191f1c]/35">Rating</div>
                      </div>
                      <div class="bg-[#2b8659]/10 rounded-lg py-2 text-center">
                        <div class="text-[13px] font-bold text-[#236e49]">6h</div>
                        <div class="text-[8px] text-[#191f1c]/35">Online</div>
                      </div>
                    </div>
                    <!-- Map area -->
                    <div class="rounded-xl bg-[#2b8659]/[0.07] h-20 flex items-center justify-center mb-2.5 relative overflow-hidden">
                      <div class="absolute inset-0 opacity-[0.15]" style="background-image: radial-gradient(circle, #191f1c 0.4px, transparent 0.4px); background-size: 10px 10px;"></div>
                      <svg class="relative" width="70" height="50" viewBox="0 0 70 50" fill="none">
                        <path d="M12 42 Q12 22 35 22 Q58 22 58 8" stroke="#2b8659" stroke-width="1.5" stroke-dasharray="3 2.5"/>
                        <circle cx="12" cy="42" r="3.5" fill="#2b8659"/>
                        <rect x="54" y="4" width="7" height="7" rx="1.5" fill="#191f1c"/>
                      </svg>
                    </div>
                    <!-- Incoming ride -->
                    <div class="bg-[#2b8659]/10 rounded-xl p-2.5 border border-[#2b8659]/15">
                      <div class="flex items-center justify-between mb-1.5">
                        <span class="text-[9px] font-semibold text-[#236e49] uppercase tracking-wide">New request</span>
                        <span class="text-[12px] font-bold text-[#191f1c]">$14.50</span>
                      </div>
                      <div class="flex items-center gap-1.5 mb-2">
                        <div class="w-1.5 h-1.5 rounded-full bg-[#2b8659]"></div>
                        <span class="text-[9px] text-[#191f1c]/50">Cable Beach → Downtown · 4.2 mi</span>
                      </div>
                      <div class="bg-[#2b8659] text-white text-[10px] font-bold text-center py-1.5 rounded-lg">Accept ride</div>
                    </div>
                  </div>
                </div>
              </div>
              <!-- Glow -->
              <div class="absolute -inset-8 -z-10 rounded-full opacity-30" style="background: radial-gradient(circle, rgba(88,204,2,0.25), transparent 70%);"></div>
            </div>
          </div>
        </div>

        <!-- Trust bar -->
        <div class="mt-10 pt-8 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          <div>
            <div class="text-[22px] font-semibold text-white">80%</div>
            <div class="text-white/50 text-[12px]">Driver payout</div>
          </div>
          <div>
            <div class="text-[22px] font-semibold text-white">200+</div>
            <div class="text-white/50 text-[12px]">Active drivers</div>
          </div>
          <div>
            <div class="text-[22px] font-semibold text-white">Weekly</div>
            <div class="text-white/50 text-[12px]">Direct deposit</div>
          </div>
          <div>
            <div class="text-[22px] font-semibold text-white">24/7</div>
            <div class="text-white/50 text-[12px]">Local support</div>
          </div>
        </div>
      </div>

      <!-- Wave divider -->
      <div class="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full" preserveAspectRatio="none">
          <path d="M0 40C240 80 480 0 720 40C960 80 1200 0 1440 40V80H0V40Z" fill="white"/>
        </svg>
      </div>
    </section>

    <!-- ==================== WHY DRIVE WITH RIDEUP ==================== -->
    <section class="relative overflow-hidden">
      <div class="relative max-w-6xl mx-auto px-6 py-20 md:py-24">
        <h2 class="text-[28px] sm:text-[36px] font-medium text-center mb-4">Why drive with RideUp?</h2>
        <p class="text-[#191f1c]/50 text-[15px] text-center mb-12 max-w-lg mx-auto">Everything you need to earn on your own terms — built for Nassau drivers.</p>

        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div class="bg-white rounded-2xl p-6 border border-[#191f1c]/8 text-center hover:border-[#2b8659]/20 transition-colors">
            <div class="w-14 h-14 rounded-2xl bg-[#2b8659]/10 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 class="text-[16px] font-bold mb-1.5">80% of every fare</h3>
            <p class="text-[#191f1c]/55 text-[14px] leading-relaxed">Keep more of what you earn. We only take 20%.</p>
          </div>

          <div class="bg-white rounded-2xl p-6 border border-[#191f1c]/8 text-center hover:border-[#2b8659]/20 transition-colors">
            <div class="w-14 h-14 rounded-2xl bg-[#2b8659]/10 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 class="text-[16px] font-bold mb-1.5">Your schedule</h3>
            <p class="text-[#191f1c]/55 text-[14px] leading-relaxed">Drive when you want. No shifts, no minimums.</p>
          </div>

          <div class="bg-white rounded-2xl p-6 border border-[#191f1c]/8 text-center hover:border-[#2b8659]/20 transition-colors">
            <div class="w-14 h-14 rounded-2xl bg-[#2b8659]/10 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h3 class="text-[16px] font-bold mb-1.5">Weekly payouts</h3>
            <p class="text-[#191f1c]/55 text-[14px] leading-relaxed">Get paid consistently, every week by direct deposit.</p>
          </div>

          <div class="bg-white rounded-2xl p-6 border border-[#191f1c]/8 text-center hover:border-[#2b8659]/20 transition-colors">
            <div class="w-14 h-14 rounded-2xl bg-[#2b8659]/10 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 class="text-[16px] font-bold mb-1.5">Local support</h3>
            <p class="text-[#191f1c]/55 text-[14px] leading-relaxed">Built for Nassau drivers. Real people, real help.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ==================== 3-STEP PROCESS ==================== -->
    <section class="relative overflow-hidden">
      <div class="absolute inset-0 pointer-events-none opacity-[0.03]" style="background-image: linear-gradient(#191f1c 1px, transparent 1px), linear-gradient(90deg, #191f1c 1px, transparent 1px); background-size: 60px 60px;"></div>
      <div class="relative max-w-6xl mx-auto px-6 py-20 md:py-24">
        <h2 class="text-[28px] sm:text-[36px] font-medium mb-4">Start driving in 3 steps</h2>
        <p class="text-[#191f1c]/50 text-[15px] mb-12">From application to your first ride — most drivers are on the road within 48 hours.</p>

        <!-- Steps as connected cards -->
        <div class="grid md:grid-cols-3 gap-0 md:gap-0">
          <div class="relative bg-[#2b8659]/[0.06] rounded-2xl md:rounded-r-none p-7 border border-[#2b8659]/10">
            <div class="w-12 h-12 rounded-2xl bg-[#2b8659] text-white font-bold text-[18px] flex items-center justify-center mb-5 shadow-lg shadow-[#2b8659]/20">1</div>
            <h3 class="text-[17px] font-bold mb-2">Apply</h3>
            <p class="text-[#191f1c]/50 text-[14px] leading-relaxed">Submit your license, vehicle info, and phone number. The whole form takes about 5 minutes.</p>
            <!-- Connector arrow (desktop) -->
            <div class="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-8 h-8 bg-white rounded-full border border-[#2b8659]/15 flex items-center justify-center">
              <svg class="w-4 h-4 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
            </div>
          </div>
          <div class="relative bg-[#2b8659]/[0.06] rounded-2xl md:rounded-none p-7 border border-[#2b8659]/10 md:border-l-0">
            <div class="w-12 h-12 rounded-2xl bg-[#2b8659] text-white font-bold text-[18px] flex items-center justify-center mb-5 shadow-lg shadow-[#2b8659]/20">2</div>
            <h3 class="text-[17px] font-bold mb-2">Get approved</h3>
            <p class="text-[#191f1c]/50 text-[14px] leading-relaxed">We verify your documents and run a background check. Vehicle inspection is free and takes 20 minutes.</p>
            <div class="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-8 h-8 bg-white rounded-full border border-[#2b8659]/15 flex items-center justify-center">
              <svg class="w-4 h-4 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
            </div>
          </div>
          <div class="bg-[#2b8659]/[0.06] rounded-2xl md:rounded-l-none p-7 border border-[#2b8659]/10 md:border-l-0">
            <div class="w-12 h-12 rounded-2xl bg-[#2b8659] text-white font-bold text-[18px] flex items-center justify-center mb-5 shadow-lg shadow-[#2b8659]/20">3</div>
            <h3 class="text-[17px] font-bold mb-2">Start earning</h3>
            <p class="text-[#191f1c]/50 text-[14px] leading-relaxed">Download the RideUp Driver app, go online, and accept your first ride. You get paid weekly by direct deposit.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ==================== EARNINGS EXAMPLES ==================== -->
    <section class="relative overflow-hidden bg-[#f0f9e8]">
      <!-- Wave top -->
      <div class="absolute top-0 left-0 right-0 -translate-y-[1px]">
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full" preserveAspectRatio="none">
          <path d="M0 60V20C360 60 720 0 1080 20C1260 30 1380 50 1440 60H0Z" fill="#f0f9e8"/>
        </svg>
      </div>
      <!-- Topo lines -->
      <svg class="absolute right-0 top-1/4 opacity-[0.05] hidden lg:block" width="300" height="300" viewBox="0 0 300 300" fill="none">
        <ellipse cx="300" cy="150" rx="280" ry="100" stroke="#191f1c" stroke-width="1"/>
        <ellipse cx="300" cy="150" rx="220" ry="80" stroke="#191f1c" stroke-width="1"/>
        <ellipse cx="300" cy="150" rx="160" ry="60" stroke="#191f1c" stroke-width="1"/>
      </svg>

      <div class="relative max-w-6xl mx-auto px-6 py-20 md:py-28">
        <h2 class="text-[28px] sm:text-[36px] font-medium mb-3">What you actually earn</h2>
        <p class="text-[#191f1c]/50 text-[15px] mb-10 max-w-lg">Real route examples across Nassau. You keep 80% of every fare — here's what that looks like.</p>

        <!-- Earnings table -->
        <div class="bg-white rounded-2xl border border-[#191f1c]/8 overflow-x-auto shadow-sm mb-8">
          <div class="min-w-[480px]">
            <!-- Header -->
            <div class="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-3 bg-[#191f1c]/[0.03] text-[12px] font-semibold text-[#191f1c]/50 uppercase tracking-wider">
              <span>Route</span>
              <span class="text-right">Distance</span>
              <span class="text-right">Fare</span>
              <span class="text-right text-[#236e49]">You keep</span>
            </div>
            <!-- Rows -->
            <div
              v-for="(ex, i) in earningsExamples"
              :key="i"
              class="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-4 items-center"
              :class="i < earningsExamples.length - 1 ? 'border-b border-[#191f1c]/6' : ''"
            >
              <div class="flex items-center gap-3">
                <div class="flex flex-col items-center gap-0.5 shrink-0">
                  <div class="w-2 h-2 rounded-full bg-[#2b8659]"></div>
                  <div class="w-px h-3 bg-[#191f1c]/12"></div>
                  <div class="w-2 h-2 rounded bg-[#191f1c]/20"></div>
                </div>
                <span class="text-[14px] font-medium">{{ ex.route }}</span>
              </div>
              <span class="text-[14px] text-[#191f1c]/55 text-right">{{ ex.distance }}</span>
              <span class="text-[14px] text-[#191f1c]/60 text-right">{{ ex.fare }}</span>
              <span class="text-[15px] font-bold text-[#236e49] text-right">{{ ex.yourCut }}</span>
            </div>
          </div>
        </div>

        <!-- Weekly summary cards -->
        <div class="grid sm:grid-cols-3 gap-4">
          <div class="bg-white rounded-2xl p-6 border border-[#191f1c]/5 shadow-sm">
            <div class="text-[#191f1c]/40 text-[13px] font-medium mb-1">Part-time (15 trips/week)</div>
            <div class="text-[30px] font-semibold">$200–400</div>
            <div class="text-[12px] text-[#191f1c]/35 mt-1">per week after commission</div>
          </div>
          <div class="bg-white rounded-2xl p-6 border border-[#191f1c]/5 shadow-sm">
            <div class="text-[#191f1c]/40 text-[13px] font-medium mb-1">Full-time (40 trips/week)</div>
            <div class="text-[30px] font-semibold">$550–900</div>
            <div class="text-[12px] text-[#191f1c]/35 mt-1">per week after commission</div>
          </div>
          <div class="bg-[#2b8659] rounded-2xl p-6 text-white shadow-lg shadow-[#2b8659]/15">
            <div class="text-white/70 text-[13px] font-medium mb-1">Your commission rate</div>
            <div class="text-[30px] font-semibold">80%</div>
            <div class="text-[12px] text-white/50 mt-1">of every fare, every time</div>
          </div>
        </div>
        <p class="text-[12px] text-[#191f1c]/30 mt-4">Earnings vary based on time, demand, and trips completed. Figures shown are estimates based on Nassau route averages.</p>
      </div>
    </section>

    <!-- ==================== DRIVER TESTIMONIALS ==================== -->
    <section class="relative overflow-hidden">
      <div class="absolute top-16 right-[6%] w-48 h-48 rounded-full border-2 border-[#2b8659]/6 hidden lg:block"></div>
      <div class="absolute bottom-12 left-[4%] w-24 h-24 rounded-full border border-[#2b8659]/8 hidden lg:block"></div>

      <div class="relative max-w-6xl mx-auto px-6 py-20 md:py-24">
        <h2 class="text-[28px] sm:text-[36px] font-medium mb-4">Hear from RideUp drivers</h2>
        <p class="text-[#191f1c]/50 text-[15px] mb-12">Real drivers, real feedback from across New Providence.</p>
        <div class="grid md:grid-cols-3 gap-5">
          <div
            v-for="t in testimonials"
            :key="t.name"
            class="bg-white rounded-2xl p-6 border border-[#191f1c]/8 hover:border-[#2b8659]/15 transition-colors"
          >
            <!-- Avatar + name -->
            <div class="flex items-center gap-3 mb-4">
              <div class="w-11 h-11 rounded-full bg-[#2b8659]/15 flex items-center justify-center text-[#236e49] font-bold text-[16px]">
                {{ t.name.charAt(0) }}
              </div>
              <div>
                <div class="text-[15px] font-bold">{{ t.name }}</div>
                <div class="text-[12px] text-[#191f1c]/40">{{ t.area }} · {{ t.months }} months</div>
              </div>
            </div>
            <!-- Quote -->
            <p class="text-[14px] text-[#191f1c]/60 leading-relaxed mb-4">"{{ t.quote }}"</p>
            <!-- Trip count -->
            <div class="flex items-center gap-2">
              <div class="w-5 h-5 rounded bg-[#2b8659]/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span class="text-[13px] font-semibold text-[#236e49]">{{ t.trips }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ==================== REQUIREMENTS + TRUST ==================== -->
    <section class="relative overflow-hidden bg-[#191f1c]">
      <!-- Wave top -->
      <div class="absolute top-0 left-0 right-0 -translate-y-[1px]">
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full" preserveAspectRatio="none">
          <path d="M0 60V30C360 0 720 60 1080 30C1260 15 1380 40 1440 60H0Z" fill="#191f1c"/>
        </svg>
      </div>
      <div class="absolute inset-0 pointer-events-none">
        <div class="absolute top-1/3 left-1/4 w-72 h-72 rounded-full opacity-10" style="background: radial-gradient(circle, rgba(88,204,2,0.5), transparent 70%);"></div>
      </div>
      <div class="absolute inset-0 pointer-events-none opacity-[0.05]" style="background-image: radial-gradient(circle, rgba(255,255,255,0.5) 0.6px, transparent 0.6px); background-size: 20px 20px;"></div>

      <div class="relative max-w-6xl mx-auto px-6 py-20 md:py-28">
        <div class="md:grid md:grid-cols-2 md:gap-16 md:items-start">
          <!-- Left: Requirements -->
          <div>
            <div class="inline-flex items-center gap-2 bg-[#2b8659]/15 text-[#2b8659] text-[13px] font-semibold px-4 py-1.5 rounded-full mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4" />
              </svg>
              Requirements
            </div>
            <h2 class="text-white text-[28px] sm:text-[36px] leading-tight font-medium mb-6">What you need to get started</h2>
            <ul class="space-y-3 mb-8">
              <li v-for="req in requirements" :key="req" class="flex items-center gap-4 bg-white/[0.06] rounded-xl px-5 py-4 border border-white/8">
                <div class="w-8 h-8 rounded-lg bg-[#2b8659]/20 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span class="text-white/80 text-[15px] font-medium">{{ req }}</span>
              </li>
            </ul>
          </div>

          <!-- Right: Trust + support info -->
          <div class="mt-8 md:mt-14">
            <h3 class="text-white text-[18px] font-bold mb-5">Driver support &amp; safety</h3>
            <div class="space-y-4 mb-8">
              <div class="flex items-start gap-4">
                <div class="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <div class="text-white text-[15px] font-semibold mb-1">Local phone support</div>
                  <div class="text-white/45 text-[14px]">Call <a href="tel:+12424529911" class="text-[#2b8659] hover:underline">(242) 452-9911</a> — real people in Nassau, not a call center</div>
                </div>
              </div>
              <div class="flex items-start gap-4">
                <div class="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <div class="text-white text-[15px] font-semibold mb-1">Commercial liability coverage</div>
                  <div class="text-white/45 text-[14px]">Every trip is covered while you have a rider in the vehicle</div>
                </div>
              </div>
              <div class="flex items-start gap-4">
                <div class="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <div class="text-white text-[15px] font-semibold mb-1">Verified riders only</div>
                  <div class="text-white/45 text-[14px]">Every rider is phone-verified before they can request a ride</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Wave bottom -->
      <div class="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full" preserveAspectRatio="none">
          <path d="M0 30C240 60 480 0 720 30C960 60 1200 0 1440 30V60H0V30Z" fill="white"/>
        </svg>
      </div>
    </section>

    <!-- ==================== FINAL CTA ==================== -->
    <section class="relative overflow-hidden">
      <div class="absolute inset-0 pointer-events-none" style="background: radial-gradient(ellipse 60% 80% at 50% 80%, rgba(88,204,2,0.06), transparent 60%);"></div>
      <div class="absolute top-10 left-[10%] w-20 h-20 rounded-full border border-[#2b8659]/10 hidden lg:block"></div>
      <div class="absolute bottom-8 right-[8%] w-28 h-28 rounded-full border border-[#2b8659]/8 hidden lg:block"></div>

      <div class="relative max-w-6xl mx-auto px-6 py-20 md:py-24 text-center">
        <h2 class="text-[28px] sm:text-[36px] font-medium mb-3">Ready to start earning?</h2>
        <p class="text-[#191f1c]/50 text-[15px] mb-8 max-w-lg mx-auto">Join 200+ drivers already earning with RideUp across New Providence. No lease, no upfront fees.</p>
        <button
          @click="goToApply"
          class="inline-flex items-center gap-2 px-8 py-4 bg-[#2b8659] hover:bg-[#236e49] text-white font-bold rounded-xl text-[16px] transition-colors active:scale-[0.98] shadow-lg shadow-[#2b8659]/20 mb-4"
        >
          Start Driving
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
        <div class="flex flex-wrap justify-center gap-x-5 gap-y-1 text-[13px] text-[#191f1c]/35">
          <span>5-minute application</span>
          <span class="text-[#191f1c]/15">|</span>
          <span>Use your own car</span>
          <span class="text-[#191f1c]/15">|</span>
          <span>No lease required</span>
        </div>
        <p class="text-[#191f1c]/35 text-[14px] mt-8">Questions? Call us at <a href="tel:+12424529911" class="underline hover:text-[#191f1c]/60">(242) 452-9911</a></p>
      </div>
    </section>

    <!-- ==================== FOOTER ==================== -->
    <footer class="bg-[#191f1c] text-white">
      <div class="max-w-6xl mx-auto px-6 py-14 grid sm:grid-cols-4 gap-8">
        <div>
          <div class="text-lg font-semibold mb-3">Ride<span class="text-[#2b8659]">Up</span></div>
          <p class="text-white/40 text-[13px] leading-relaxed">Nassau's on-demand ride service. Available 24/7 across New Providence.</p>
        </div>
        <div>
          <div class="text-[12px] font-bold text-white/30 uppercase tracking-wider mb-3">For riders</div>
          <div class="flex flex-col gap-2 text-[14px] text-white/50">
            <router-link to="/welcome" class="hover:text-white transition-colors">Book a ride</router-link>
          </div>
        </div>
        <div>
          <div class="text-[12px] font-bold text-white/30 uppercase tracking-wider mb-3">Support</div>
          <div class="flex flex-col gap-2 text-[14px] text-white/50">
            <a href="tel:+12424529911" class="hover:text-white transition-colors">(242) 452-9911</a>
            <a :href="whatsappLink" target="_blank" class="hover:text-white transition-colors">WhatsApp us</a>
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
