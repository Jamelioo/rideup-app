# Landing Page Transportation Theme Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current generic startup landing page with an Uber/Lyft-style transportation-focused design featuring a Google Maps Static API hero, stats banner, full-width value prop sections, popular routes list, driver recruitment CTA, and clean dark footer.

**Architecture:** Single file rewrite of `src/pages/RiderLanding.vue` (472 → ~500 lines). Two Unsplash photos added to `public/images/`. No new components, no new dependencies. Google Maps Static API key already configured as `VITE_GOOGLE_MAPS_API_KEY` in `.env`.

**Tech Stack:** Vue 3 (`<script setup>`), Tailwind CSS utility classes, Google Maps Static API, Unsplash photos, `vue-router` for navigation.

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Rewrite | `src/pages/RiderLanding.vue` | Entire landing page — nav, hero, stats, value props, routes, driver CTA, final CTA, footer |
| Create | `public/images/fare-photo.jpg` | Unsplash photo for "Know your fare" section |
| Create | `public/images/driver-photo.jpg` | Unsplash photo for driver recruitment CTA |

---

### Task 1: Download Unsplash Photos

**Files:**
- Create: `public/images/fare-photo.jpg`
- Create: `public/images/driver-photo.jpg`

- [ ] **Step 1: Create the images directory**

```bash
mkdir -p public/images
```

- [ ] **Step 2: Download the fare photo**

Download a copyright-free car/street scene photo from Unsplash. Use a compressed version (max 200KB).

```bash
curl -L "https://images.unsplash.com/photo-1449965408869-ebd13bc0c322?w=1200&q=70&auto=format" -o public/images/fare-photo.jpg
```

Verify the file exists and is under 200KB:
```bash
ls -la public/images/fare-photo.jpg
```

If larger than 200KB, re-download with lower quality:
```bash
curl -L "https://images.unsplash.com/photo-1449965408869-ebd13bc0c322?w=800&q=50&auto=format" -o public/images/fare-photo.jpg
```

- [ ] **Step 3: Download the driver photo**

Download a copyright-free photo of a person driving from Unsplash.

```bash
curl -L "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=1200&q=70&auto=format" -o public/images/driver-photo.jpg
```

Verify:
```bash
ls -la public/images/driver-photo.jpg
```

If larger than 200KB:
```bash
curl -L "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&q=50&auto=format" -o public/images/driver-photo.jpg
```

- [ ] **Step 4: Commit**

```bash
git add public/images/fare-photo.jpg public/images/driver-photo.jpg
git commit -m "feat: add unsplash photos for landing page redesign"
```

---

### Task 2: Rewrite RiderLanding.vue — Script Section

**Files:**
- Modify: `src/pages/RiderLanding.vue:1-28`

Replace the entire `<script setup>` block. Remove the `useLeadCapture` import (no more lead capture form) and simplify the script to just routing and route data.

- [ ] **Step 1: Replace the script section**

Replace the entire content of `src/pages/RiderLanding.vue` `<script setup>` block (lines 1–28) with:

```vue
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

  // Key locations as labeled markers
  const markers = [
    `markers=color:0x58cc02|label:P|25.0862,-77.3231`,   // Paradise Island
    `markers=color:0x58cc02|label:C|25.0780,-77.4180`,   // Cable Beach
    `markers=color:0x58cc02|label:D|25.0783,-77.3387`,   // Downtown Nassau
    `markers=color:0x58cc02|label:A|25.0390,-77.4662`,   // LPIA Airport
  ].join('&')

  // Dashed route path connecting landmarks
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
```

- [ ] **Step 2: Verify no lint errors in the script**

```bash
cd /Users/jamelioo/Downloads/rideup-app-final/rideup-app && npx vue-tsc --noEmit 2>&1 | head -20 || echo "No vue-tsc, skipping type check"
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/RiderLanding.vue
git commit -m "feat: rewrite RiderLanding script — remove lead capture, add Maps Static API URL"
```

---

### Task 3: Rewrite RiderLanding.vue — Nav Bar + Hero Section

**Files:**
- Modify: `src/pages/RiderLanding.vue` (template section)

Replace the entire `<template>` block. This task covers the nav bar (kept mostly the same) and the new hero section with Google Maps Static API background.

- [ ] **Step 1: Replace the template**

Delete everything from `<template>` to `</template>` in the file and replace with the full new template. Start with the wrapper, nav, and hero:

```vue
<template>
  <div class="min-h-screen bg-white text-[#1a1a1a] font-[var(--font-sans)]">

    <!-- Nav Bar -->
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

    <!-- ==================== HERO — Google Maps Background ==================== -->
    <section class="relative overflow-hidden">
      <!-- Map background image -->
      <div class="absolute inset-0">
        <img :src="mapUrl" alt="Map of Nassau, New Providence" class="w-full h-full object-cover" />
      </div>

      <!-- Mobile: bottom gradient overlay -->
      <div class="md:hidden absolute inset-0" style="background: linear-gradient(to top, white 50%, rgba(255,255,255,0.3) 80%, transparent 100%);"></div>

      <!-- Desktop: left gradient overlay -->
      <div class="hidden md:block absolute inset-0" style="background: linear-gradient(to right, rgba(255,255,255,0.97) 45%, rgba(255,255,255,0.8) 60%, transparent 80%);"></div>

      <div class="relative max-w-6xl mx-auto px-6 pt-32 pb-16 md:pt-20 md:pb-24 md:grid md:grid-cols-[1.1fr_0.9fr] md:gap-12 md:items-center min-h-[520px] md:min-h-[480px]">
        <!-- Content — sits above gradient on mobile, left column on desktop -->
        <div class="mt-auto md:mt-0">
          <h1 class="font-serif text-[36px] sm:text-[48px] lg:text-[56px] leading-[1.08] font-medium tracking-tight mb-4 text-[#1a1a1a]">
            Request a ride,<br>hop in, and go.
          </h1>
          <p class="text-[#1a1a1a]/60 text-[15px] leading-relaxed max-w-md mb-8">
            Flat upfront pricing across New Providence. Verified drivers. 24/7.
          </p>

          <!-- Booking widget -->
          <div class="bg-white rounded-2xl p-5 shadow-xl shadow-black/8 max-w-md">
            <div class="space-y-2.5 mb-3">
              <button @click="goToBooking" class="w-full flex items-center gap-3 bg-[#f5f5f5] rounded-xl px-4 py-3.5 text-left hover:bg-[#f0f0f0] transition-colors">
                <div class="w-2.5 h-2.5 rounded-full bg-[#58cc02] shrink-0"></div>
                <span class="text-[14px] text-[#1a1a1a]/40">Pickup location</span>
              </button>
              <button @click="goToBooking" class="w-full flex items-center gap-3 bg-[#f5f5f5] rounded-xl px-4 py-3.5 text-left hover:bg-[#f0f0f0] transition-colors">
                <div class="w-2.5 h-2.5 rounded-sm bg-[#1a1a1a]/25 shrink-0"></div>
                <span class="text-[14px] text-[#1a1a1a]/40">Where to?</span>
              </button>
            </div>
            <button @click="goToBooking" class="w-full py-3.5 bg-[#58cc02] text-white font-bold rounded-xl text-[14px] hover:bg-[#4ab300] transition-colors active:scale-[0.99]">
              See prices
            </button>
          </div>
        </div>

        <!-- Right column: empty — map shows through transparent gradient -->
        <div class="hidden md:block"></div>
      </div>

      <!-- "New Providence, Bahamas" label -->
      <div class="absolute bottom-4 right-6 text-[11px] font-medium text-[#1a1a1a]/40 hidden md:block">New Providence, Bahamas</div>
    </section>
```

- [ ] **Step 2: Verify the hero renders**

```bash
cd /Users/jamelioo/Downloads/rideup-app-final/rideup-app && npm run dev &
```

Open `http://localhost:5173` in a browser. Verify:
- Map image loads as the hero background
- White gradient overlay makes text readable
- "Request a ride, hop in, and go." headline visible
- Booking widget with pickup/destination inputs and "See prices" button
- Clicking any input or "See prices" navigates to `/book`

- [ ] **Step 3: Commit**

```bash
git add src/pages/RiderLanding.vue
git commit -m "feat: hero section with Google Maps Static API background"
```

---

### Task 4: Stats Banner Section

**Files:**
- Modify: `src/pages/RiderLanding.vue` (add after hero section, before closing `</div></template>`)

- [ ] **Step 1: Add the stats banner**

Insert this immediately after the hero `</section>` closing tag:

```html
    <!-- ==================== STATS BANNER ==================== -->
    <section class="bg-[#1a1a1a] py-10">
      <div class="max-w-4xl mx-auto px-6 flex items-center justify-center gap-8 sm:gap-16 text-center">
        <div>
          <div class="text-[32px] sm:text-[40px] font-serif font-semibold text-[#58cc02]">5k+</div>
          <div class="text-[12px] text-white/50 mt-1">Rides completed</div>
        </div>
        <div class="w-px h-12 bg-white/10"></div>
        <div>
          <div class="text-[32px] sm:text-[40px] font-serif font-semibold text-white">4.9<span class="text-[#58cc02]">★</span></div>
          <div class="text-[12px] text-white/50 mt-1">Average rating</div>
        </div>
        <div class="w-px h-12 bg-white/10"></div>
        <div>
          <div class="text-[32px] sm:text-[40px] font-serif font-semibold text-white">&lt;5m</div>
          <div class="text-[12px] text-white/50 mt-1">Avg. pickup</div>
        </div>
      </div>
    </section>
```

- [ ] **Step 2: Verify in browser**

Reload the page. Verify:
- Dark bar spanning full width
- Three stats with vertical dividers: "5k+" (green), "4.9★" (white with green star), "<5m" (white)
- Labels below each stat in muted white

- [ ] **Step 3: Commit**

```bash
git add src/pages/RiderLanding.vue
git commit -m "feat: stats banner — social proof numbers"
```

---

### Task 5: Value Props — Full-Width Sections

**Files:**
- Modify: `src/pages/RiderLanding.vue` (add after stats banner)

- [ ] **Step 1: Add the three value prop blocks**

Insert after the stats banner `</section>`:

```html
    <!-- ==================== VALUE PROPS ==================== -->

    <!-- Block 1: Know your fare -->
    <section class="overflow-hidden">
      <img src="/images/fare-photo.jpg" alt="Car driving through Nassau streets" class="w-full h-[280px] sm:h-[360px] object-cover" />
      <div class="max-w-3xl mx-auto px-6 py-12">
        <h2 class="font-serif text-[26px] sm:text-[32px] font-medium mb-3">Know your fare before you ride</h2>
        <p class="text-[#1a1a1a]/55 text-[15px] leading-relaxed max-w-lg">See the exact price upfront when you request. No surge pricing, no hidden fees — the fare you see is the fare you pay. Every time.</p>
      </div>
    </section>

    <!-- Divider -->
    <div class="max-w-6xl mx-auto px-6"><div class="h-px bg-[#f0f0f0]"></div></div>

    <!-- Block 2: Safety first -->
    <section class="max-w-3xl mx-auto px-6 py-12">
      <div class="flex items-start gap-5">
        <div class="w-14 h-14 rounded-full bg-[#58cc02]/10 flex items-center justify-center shrink-0 mt-1">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-[#58cc02]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div>
          <h2 class="font-serif text-[26px] sm:text-[32px] font-medium mb-3">Safety first, always</h2>
          <p class="text-[#1a1a1a]/55 text-[15px] leading-relaxed">Every driver is verified and background-checked before their first trip. Track your ride in real-time and share your trip details with family and friends.</p>
        </div>
      </div>
    </section>

    <!-- Divider -->
    <div class="max-w-6xl mx-auto px-6"><div class="h-px bg-[#f0f0f0]"></div></div>

    <!-- Block 3: Anywhere across Nassau -->
    <section class="overflow-hidden">
      <!-- Stylized route SVG -->
      <div class="bg-[#f8f8f8] py-12 flex justify-center">
        <svg width="320" height="100" viewBox="0 0 320 100" fill="none" class="max-w-full">
          <!-- Pickup pin -->
          <circle cx="40" cy="50" r="12" fill="#58cc02" />
          <circle cx="40" cy="50" r="5" fill="white" />
          <!-- Dashed route -->
          <path d="M56 50 Q120 20 180 50 Q240 80 280 50" stroke="#58cc02" stroke-width="2.5" stroke-dasharray="6 4" fill="none" />
          <!-- Destination pin -->
          <rect x="272" y="38" width="16" height="16" rx="3" fill="#1a1a1a" />
          <rect x="276" y="42" width="8" height="8" rx="1.5" fill="white" />
        </svg>
      </div>
      <div class="max-w-3xl mx-auto px-6 py-12">
        <h2 class="font-serif text-[26px] sm:text-[32px] font-medium mb-3">Anywhere across Nassau</h2>
        <p class="text-[#1a1a1a]/55 text-[15px] leading-relaxed max-w-lg">From LPIA Airport to Paradise Island, Cable Beach to the Fish Fry — RideUp covers every corner of New Providence, 24 hours a day, 7 days a week.</p>
      </div>
    </section>
```

- [ ] **Step 2: Verify in browser**

Reload the page. Verify:
- Full-width photo for "Know your fare" section loads
- Safety section has green shield icon + text (no photo)
- "Anywhere across Nassau" has the SVG route graphic
- Thin `#f0f0f0` dividers between sections
- No card grid, no numbered steps

- [ ] **Step 3: Commit**

```bash
git add src/pages/RiderLanding.vue
git commit -m "feat: full-width value prop sections — fare, safety, coverage"
```

---

### Task 6: Popular Routes List

**Files:**
- Modify: `src/pages/RiderLanding.vue` (add after value props)

- [ ] **Step 1: Add the popular routes section**

Insert after the "Anywhere across Nassau" `</section>`:

```html
    <!-- ==================== POPULAR ROUTES ==================== -->
    <section class="bg-[#f8f8f8]">
      <div class="max-w-3xl mx-auto px-6 py-16">
        <h2 class="font-serif text-[26px] sm:text-[32px] font-medium mb-2">Go anywhere in Nassau</h2>
        <p class="text-[#1a1a1a]/50 text-[14px] mb-8">Flat fares. No surge pricing.</p>

        <div class="bg-white rounded-2xl overflow-hidden border border-[#f0f0f0]">
          <div
            v-for="(route, i) in routes"
            :key="route.from + route.to"
            class="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-[#f8f8f8] transition-colors"
            :class="{ 'border-t border-[#f0f0f0]': i > 0 }"
            @click="goToBooking"
          >
            <div class="flex items-center gap-3">
              <div class="w-2.5 h-2.5 rounded-full bg-[#58cc02] shrink-0"></div>
              <div>
                <span class="text-[15px] font-semibold">{{ route.from }} → {{ route.to }}</span>
                <span class="text-[13px] text-[#1a1a1a]/40 ml-2">{{ route.time }}</span>
              </div>
            </div>
            <span class="text-[17px] font-bold font-serif">{{ route.price }}</span>
          </div>
        </div>

        <button @click="goToBooking" class="w-full mt-4 py-3.5 bg-[#1a1a1a] text-white font-bold rounded-xl text-[14px] hover:bg-[#333] transition-colors active:scale-[0.99]">
          See all prices
        </button>
      </div>
    </section>
```

- [ ] **Step 2: Verify in browser**

Reload. Verify:
- Clean list layout (not a grid of cards)
- Green bullet dots, route names bold, time muted, price right-aligned
- Thin dividers between rows
- "See all prices" dark button below → navigates to `/book`

- [ ] **Step 3: Commit**

```bash
git add src/pages/RiderLanding.vue
git commit -m "feat: popular routes list — Uber-style fare estimator layout"
```

---

### Task 7: Driver Recruitment CTA

**Files:**
- Modify: `src/pages/RiderLanding.vue` (add after popular routes)

- [ ] **Step 1: Add the driver recruitment section**

Insert after the popular routes `</section>`:

```html
    <!-- ==================== DRIVER RECRUITMENT ==================== -->
    <section class="max-w-3xl mx-auto px-6 py-16">
      <div class="rounded-2xl overflow-hidden">
        <!-- Photo with dark overlay -->
        <div class="relative h-[220px] sm:h-[280px]">
          <img src="/images/driver-photo.jpg" alt="Driver behind the wheel" class="w-full h-full object-cover" />
          <div class="absolute inset-0 bg-gradient-to-t from-[#1a1a1a]/80 to-[#1a1a1a]/20"></div>
        </div>
        <!-- Text content -->
        <div class="bg-[#1a1a1a] px-6 py-8 sm:px-8">
          <h2 class="font-serif text-[24px] sm:text-[28px] font-medium text-white mb-2">Earn on your schedule</h2>
          <p class="text-white/55 text-[14px] leading-relaxed mb-6">Drive with RideUp and keep 80% of every fare. No shifts, no minimums.</p>
          <button @click="goToDriverApply" class="px-8 py-3.5 bg-[#58cc02] text-white font-bold rounded-xl text-[14px] hover:bg-[#4ab300] transition-colors active:scale-[0.99]">
            Apply to drive
          </button>
        </div>
      </div>
    </section>
```

- [ ] **Step 2: Verify in browser**

Reload. Verify:
- Driver photo with dark gradient overlay
- "Earn on your schedule" headline on dark background
- Green "Apply to drive" button → navigates to `/driver/apply`

- [ ] **Step 3: Commit**

```bash
git add src/pages/RiderLanding.vue
git commit -m "feat: driver recruitment CTA with photo card"
```

---

### Task 8: Final CTA + Footer

**Files:**
- Modify: `src/pages/RiderLanding.vue` (add after driver recruitment, close the template)

- [ ] **Step 1: Add the final CTA and footer**

Insert after the driver recruitment `</section>`:

```html
    <!-- ==================== FINAL CTA ==================== -->
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
        <!-- Logo -->
        <div class="font-serif text-xl font-semibold mb-6">Ride<span class="text-[#58cc02]">Up</span></div>

        <!-- Links grid -->
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-2 mb-8">
          <router-link to="/" class="text-[14px] text-white/50 hover:text-white transition-colors">Ride</router-link>
          <router-link to="/driver/apply" class="text-[14px] text-white/50 hover:text-white transition-colors">Drive</router-link>
          <router-link to="/support" class="text-[14px] text-white/50 hover:text-white transition-colors">Support</router-link>
          <router-link to="/about" class="text-[14px] text-white/50 hover:text-white transition-colors">About</router-link>
          <router-link to="/privacy" class="text-[14px] text-white/50 hover:text-white transition-colors">Privacy</router-link>
          <router-link to="/terms" class="text-[14px] text-white/50 hover:text-white transition-colors">Terms</router-link>
        </div>

        <!-- Social icons -->
        <div class="flex gap-4 mb-8">
          <!-- Instagram -->
          <a href="https://instagram.com/rideupnassau" target="_blank" rel="noopener" class="w-9 h-9 rounded-full bg-white/[0.08] flex items-center justify-center hover:bg-white/15 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
            </svg>
          </a>
          <!-- WhatsApp -->
          <a href="https://wa.me/12424529911" target="_blank" rel="noopener" class="w-9 h-9 rounded-full bg-white/[0.08] flex items-center justify-center hover:bg-white/15 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </a>
        </div>

        <!-- Divider -->
        <div class="h-px bg-white/[0.08] mb-5"></div>

        <!-- Copyright -->
        <div class="text-[12px] text-white/25">&copy; 2026 RideUp Nassau. All rights reserved.</div>
      </div>
    </footer>

  </div>
</template>
```

- [ ] **Step 2: Verify the complete page in browser**

Reload the page. Full scroll-through verification:
1. Nav bar — sticky, logo, Ride/Drive links, Log in / Sign up
2. Hero — map background with gradient, headline, booking widget
3. Stats banner — dark bar, three stats
4. Value props — fare photo, safety icon+text, route SVG
5. Popular routes — clean list, prices right-aligned
6. Driver recruitment — photo card with "Apply to drive"
7. Final CTA — "Ready to ride?" with green button
8. Footer — dark, logo, links, Instagram + WhatsApp icons, copyright

Verify all buttons navigate correctly:
- "See prices" / pickup / destination inputs → `/book`
- "See all prices" → `/book`
- "Apply to drive" → `/driver/apply`
- "Book a ride now" → `/book`
- Instagram → `instagram.com/rideupnassau`
- WhatsApp → `wa.me/12424529911`

- [ ] **Step 3: Commit**

```bash
git add src/pages/RiderLanding.vue
git commit -m "feat: final CTA + dark footer with social links — landing page redesign complete"
```

---

### Task 9: Mobile Responsiveness Check & Polish

**Files:**
- Modify: `src/pages/RiderLanding.vue` (if adjustments needed)

- [ ] **Step 1: Test mobile viewport**

Open Chrome DevTools → Device toolbar → iPhone 14 (390px). Scroll through the full page:

1. Hero: map visible in upper portion, content fades up from bottom via white gradient
2. Stats banner: three stats should stack nicely or wrap, no overflow
3. Photos: full-width, appropriate height
4. Routes list: each row readable, price visible
5. Driver card: photo + content stack vertically
6. Footer: links in 2-column grid, social icons visible

- [ ] **Step 2: Fix any overflow or layout issues found**

If the stats banner overflows on mobile (small screens), the `flex` layout with `gap-8` should wrap. If it doesn't, add `flex-wrap` class. Check each section carefully.

Common mobile fixes if needed:
- Hero headline: may need smaller font on very small screens (`text-[32px]` instead of `text-[36px]`)
- Stats banner: verify numbers don't truncate
- Route list: ensure long route names don't overflow

- [ ] **Step 3: Test tablet viewport (768px)**

Switch to iPad view. Verify the desktop layout kicks in at `md:` breakpoint for the hero (side-by-side map + content).

- [ ] **Step 4: Commit any fixes**

```bash
git add src/pages/RiderLanding.vue
git commit -m "fix: mobile responsiveness polish for landing page"
```

---

### Task 10: Final Cleanup & Verification

**Files:**
- Modify: `src/pages/RiderLanding.vue` (if needed)

- [ ] **Step 1: Remove unused imports**

Verify that `useLeadCapture` import is gone. The file should NOT import `useLeadCapture` anymore since the lead capture form was removed.

```bash
grep -n "useLeadCapture" src/pages/RiderLanding.vue
```

Expected: no results.

- [ ] **Step 2: Verify no dead code**

```bash
grep -n "phone\|loading\|error\|success\|submit\|handleSubmit" src/pages/RiderLanding.vue
```

Expected: no results (all were part of the old lead capture form).

- [ ] **Step 3: Check for broken links**

Verify all `router-link` `to` props point to valid routes:
- `/` — home (this page)
- `/login` — login page
- `/signup` — signup page
- `/profile` — profile page
- `/book` — booking screen
- `/driver/apply` — driver application
- `/support` — support page
- `/about` — about page
- `/privacy` — privacy policy
- `/terms` — terms of service

```bash
grep -n "to=\"/" src/pages/RiderLanding.vue
```

Cross-reference against routes in `src/router/index.js`.

- [ ] **Step 4: Final commit**

```bash
git add src/pages/RiderLanding.vue
git commit -m "chore: cleanup — remove dead code from landing page rewrite"
```
