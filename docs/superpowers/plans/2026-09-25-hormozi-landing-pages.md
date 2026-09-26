# Hormozi-Style Landing Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two high-conversion Hormozi-style landing pages — a rider page (`/welcome`) and a driver page (`/drive`) — with phone number lead capture stored to Supabase.

**Architecture:** Two standalone Vue 3 SFC pages (no auth required), sharing a reusable lead capture composable that validates phone numbers and inserts into a Supabase `leads` table. Both pages use the existing Tailwind v4 design system with Fraunces/Manrope fonts and RideUp green (#34C796) on dark (#16241F) backgrounds. Router gets two new public routes.

**Tech Stack:** Vue 3 (Composition API, `<script setup>`), Tailwind CSS v4, Supabase JS client, Vue Router 5

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/001_create_leads_table.sql` | Create | SQL migration for leads table |
| `src/lib/useLeadCapture.js` | Create | Composable: phone validation, Supabase insert, loading/error/success state |
| `src/pages/RiderLanding.vue` | Create | `/welcome` — rider-facing Hormozi landing page |
| `src/pages/DriverLanding.vue` | Create | `/drive` — driver-facing Hormozi landing page |
| `src/router/index.js` | Modify | Add `/welcome` and `/drive` routes |

---

### Task 1: Supabase Leads Table Migration

**Files:**
- Create: `supabase/migrations/001_create_leads_table.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Leads table for landing page phone number capture
create table if not exists public.leads (
  id uuid default gen_random_uuid() primary key,
  phone text not null,
  source text not null check (source in ('rider', 'driver')),
  created_at timestamptz default now() not null
);

-- Index for dedup lookups
create index idx_leads_phone_source on public.leads (phone, source);

-- Enable RLS
alter table public.leads enable row level security;

-- Allow anonymous inserts (landing pages are public, no auth)
create policy "Anyone can insert leads"
  on public.leads
  for insert
  to anon
  with check (true);

-- Only authenticated service role can read leads
create policy "Service role can read leads"
  on public.leads
  for select
  to service_role
  using (true);
```

- [ ] **Step 2: Verify the file exists**

Run: `cat supabase/migrations/001_create_leads_table.sql`
Expected: The SQL above prints to stdout.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/001_create_leads_table.sql
git commit -m "feat: add leads table migration for landing page phone capture"
```

---

### Task 2: Lead Capture Composable

**Files:**
- Create: `src/lib/useLeadCapture.js`

- [ ] **Step 1: Create the composable**

```javascript
import { ref } from 'vue'
import { supabase, supabaseConfigured } from './supabase'

/**
 * Validates and submits phone numbers from landing page lead capture forms.
 * @param {'rider'|'driver'} source - Which landing page the lead came from
 */
export function useLeadCapture(source) {
  const phone = ref('')
  const loading = ref(false)
  const error = ref('')
  const success = ref(false)

  // Accept digits, spaces, dashes, parens, plus sign. Must have 7-15 digits.
  function isValidPhone(value) {
    const digits = value.replace(/\D/g, '')
    return digits.length >= 7 && digits.length <= 15
  }

  async function submit() {
    error.value = ''
    success.value = false

    const trimmed = phone.value.trim()
    if (!trimmed) {
      error.value = 'Please enter your phone number.'
      return
    }
    if (!isValidPhone(trimmed)) {
      error.value = 'Please enter a valid phone number.'
      return
    }

    if (!supabaseConfigured) {
      // Demo mode — pretend it worked
      success.value = true
      return
    }

    loading.value = true
    try {
      const { error: dbError } = await supabase
        .from('leads')
        .insert({ phone: trimmed, source })

      if (dbError) {
        error.value = 'Something went wrong. Please try again.'
        console.error('Lead capture error:', dbError)
        return
      }
      success.value = true
    } catch (e) {
      error.value = 'Something went wrong. Please try again.'
      console.error('Lead capture error:', e)
    } finally {
      loading.value = false
    }
  }

  return { phone, loading, error, success, submit }
}
```

- [ ] **Step 2: Verify the file exists and imports resolve**

Run: `npx vite build --mode development 2>&1 | tail -5`
Expected: Build succeeds (no import errors). The composable isn't used yet so it won't appear in output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/useLeadCapture.js
git commit -m "feat: add useLeadCapture composable for phone number lead capture"
```

---

### Task 3: Rider Landing Page (`/welcome`)

**Files:**
- Create: `src/pages/RiderLanding.vue`

This is the largest task. The page has 8 sections per the spec. Build it as a single SFC — all sections are static content with one interactive element (the phone capture form, used twice: hero + final CTA).

- [ ] **Step 1: Create RiderLanding.vue with all 8 sections**

```vue
<script setup>
import { useRouter } from 'vue-router'
import { useLeadCapture } from '../lib/useLeadCapture'

const router = useRouter()
const { phone, loading, error, success, submit } = useLeadCapture('rider')

async function handleSubmit() {
  await submit()
  if (success.value) {
    router.push('/login')
  }
}

const routes = [
  { from: 'Cable Beach', to: 'Downtown Nassau', price: '$8' },
  { from: 'LPIA Airport', to: 'Bahamar', price: '$12' },
  { from: 'Paradise Island', to: 'Bay Street', price: '$10' },
  { from: 'Carmichael Road', to: 'Downtown', price: '$7' },
]
</script>

<template>
  <div class="min-h-screen bg-[#16241F] font-[var(--font-sans)]">

    <!-- Section 1: Hero -->
    <section class="px-5 pt-14 pb-16">
      <div class="max-w-xl mx-auto">
        <span class="inline-block text-xs font-semibold text-[#34C796] tracking-wide uppercase mb-4">
          RideUp Nassau &middot; Open 24/7
        </span>
        <h1 class="text-4xl md:text-5xl font-bold text-white font-[var(--font-serif)] leading-tight mb-4">
          Your Ride to Work.<br>On Time. Every Time.<br>Or It's Free.
        </h1>
        <p class="text-base text-white/60 mb-8 max-w-md">
          Schedule your morning ride the night before. Background-checked drivers. Flat pricing across New Providence.
        </p>

        <!-- Lead Capture Form -->
        <form @submit.prevent="handleSubmit" class="flex flex-col sm:flex-row gap-3 max-w-md">
          <input
            v-model="phone"
            type="tel"
            placeholder="Enter your phone number"
            class="flex-1 px-4 py-3.5 rounded-xl bg-white/10 text-white placeholder-white/40 border border-white/10 focus:border-[#34C796] focus:outline-none text-base"
          />
          <button
            type="submit"
            :disabled="loading"
            class="px-6 py-3.5 rounded-xl bg-[#34C796] hover:bg-[#22A67E] text-white font-bold text-base transition-colors whitespace-nowrap disabled:opacity-50"
          >
            {{ loading ? 'Sending...' : 'Get Your $20 Credit' }}
          </button>
        </form>
        <p v-if="error" class="text-red-400 text-sm mt-2">{{ error }}</p>
        <p v-if="success" class="text-[#34C796] text-sm mt-2">You're in! Check your phone for your $20 credit.</p>
        <p class="text-white/40 text-xs mt-4">2,000+ rides completed &middot; 4.9&#9733; average rating</p>
      </div>
    </section>

    <!-- Section 2: Social Proof Bar -->
    <section class="border-y border-white/10 py-6">
      <div class="max-w-xl mx-auto px-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
        <div>
          <div class="text-xl font-bold text-white">4.9&#9733;</div>
          <div class="text-xs text-white/50 mt-1">Rating</div>
        </div>
        <div>
          <div class="text-xl font-bold text-white">2,000+</div>
          <div class="text-xs text-white/50 mt-1">Rides</div>
        </div>
        <div>
          <div class="text-xl font-bold text-white">100+</div>
          <div class="text-xs text-white/50 mt-1">Drivers</div>
        </div>
        <div>
          <div class="text-xl font-bold text-white">24/7</div>
          <div class="text-xs text-white/50 mt-1">Service</div>
        </div>
      </div>
    </section>

    <!-- Section 3: Value Equation Cards -->
    <section class="py-16 px-5">
      <div class="max-w-xl mx-auto grid gap-6 sm:grid-cols-3">
        <!-- Card 1: 5-Min Pickup -->
        <div class="bg-white/5 rounded-2xl p-6 border border-white/10">
          <div class="w-12 h-12 rounded-xl bg-[#34C796]/10 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-[#34C796]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-white mb-2">5-Minute Pickup</h3>
          <p class="text-sm text-white/60">Your driver arrives in under 5 minutes. No roadside waiting.</p>
        </div>

        <!-- Card 2: Flat Pricing -->
        <div class="bg-white/5 rounded-2xl p-6 border border-white/10">
          <div class="w-12 h-12 rounded-xl bg-[#34C796]/10 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-[#34C796]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-white mb-2">Flat Pricing</h3>
          <p class="text-sm text-white/60">The price you see is the price you pay. No surge, no surprises.</p>
        </div>

        <!-- Card 3: Background-Checked -->
        <div class="bg-white/5 rounded-2xl p-6 border border-white/10">
          <div class="w-12 h-12 rounded-xl bg-[#34C796]/10 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-[#34C796]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-white mb-2">Background-Checked</h3>
          <p class="text-sm text-white/60">Every driver verified — license, vehicle, background check.</p>
        </div>
      </div>
    </section>

    <!-- Section 4: How It Works -->
    <section class="py-16 px-5 border-t border-white/10">
      <div class="max-w-xl mx-auto">
        <h2 class="text-2xl font-bold text-white font-[var(--font-serif)] text-center mb-12">How It Works</h2>
        <div class="grid gap-8 sm:grid-cols-3 text-center">
          <div>
            <div class="w-10 h-10 rounded-full bg-[#34C796] text-white font-bold text-lg flex items-center justify-center mx-auto mb-4">1</div>
            <h3 class="text-base font-bold text-white mb-2">Enter your phone number</h3>
            <p class="text-sm text-white/60">Get $20 credit instantly</p>
          </div>
          <div>
            <div class="w-10 h-10 rounded-full bg-[#34C796] text-white font-bold text-lg flex items-center justify-center mx-auto mb-4">2</div>
            <h3 class="text-base font-bold text-white mb-2">Schedule your ride</h3>
            <p class="text-sm text-white/60">Pick your time, pickup, and destination</p>
          </div>
          <div>
            <div class="w-10 h-10 rounded-full bg-[#34C796] text-white font-bold text-lg flex items-center justify-center mx-auto mb-4">3</div>
            <h3 class="text-base font-bold text-white mb-2">Your driver arrives on time</h3>
            <p class="text-sm text-white/60">Tracked in real-time, guaranteed</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 5: Popular Routes -->
    <section class="py-16 px-5 border-t border-white/10">
      <div class="max-w-xl mx-auto">
        <h2 class="text-2xl font-bold text-white font-[var(--font-serif)] text-center mb-8">Popular Routes</h2>
        <div class="grid gap-3">
          <div
            v-for="route in routes"
            :key="route.from + route.to"
            class="flex items-center justify-between bg-white/5 rounded-xl px-5 py-4 border border-white/10"
          >
            <div class="text-sm text-white">
              <span class="font-semibold">{{ route.from }}</span>
              <span class="text-white/40 mx-2">&rarr;</span>
              <span>{{ route.to }}</span>
            </div>
            <span class="text-lg font-bold text-[#34C796]">{{ route.price }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 6: The Guarantee -->
    <section class="py-16 px-5">
      <div class="max-w-xl mx-auto bg-[#34C796]/10 border border-[#34C796]/30 rounded-2xl p-8 text-center">
        <h2 class="text-2xl font-bold text-white font-[var(--font-serif)] mb-4">The RideUp On-Time Guarantee</h2>
        <p class="text-base text-white/80 max-w-md mx-auto">
          If your scheduled ride is late by even 1 minute, your ride is 100% free. No questions asked. No fine print.
        </p>
      </div>
    </section>

    <!-- Section 7: Final CTA -->
    <section class="py-16 px-5 border-t border-white/10">
      <div class="max-w-xl mx-auto text-center">
        <h2 class="text-2xl font-bold text-white font-[var(--font-serif)] mb-2">Get Your $20 Credit</h2>
        <p class="text-white/60 mb-8">Start Riding This Week</p>
        <form @submit.prevent="handleSubmit" class="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <input
            v-model="phone"
            type="tel"
            placeholder="Enter your phone number"
            class="flex-1 px-4 py-3.5 rounded-xl bg-white/10 text-white placeholder-white/40 border border-white/10 focus:border-[#34C796] focus:outline-none text-base"
          />
          <button
            type="submit"
            :disabled="loading"
            class="px-6 py-3.5 rounded-xl bg-[#34C796] hover:bg-[#22A67E] text-white font-bold text-base transition-colors whitespace-nowrap disabled:opacity-50"
          >
            {{ loading ? 'Sending...' : 'Get Your $20 Credit' }}
          </button>
        </form>
        <p v-if="error" class="text-red-400 text-sm mt-2">{{ error }}</p>
        <p v-if="success" class="text-[#34C796] text-sm mt-2">You're in! Check your phone for your $20 credit.</p>
      </div>
    </section>

    <!-- Section 8: Footer -->
    <footer class="py-8 px-5 border-t border-white/10 text-center">
      <div class="max-w-xl mx-auto">
        <p class="text-base font-bold text-white font-[var(--font-serif)] mb-3">RideUp</p>
        <p class="text-xs text-white/40 mb-3">Nassau, Bahamas</p>
        <div class="flex justify-center gap-6 text-xs text-white/40 mb-4">
          <a href="#" class="hover:text-white transition-colors">Privacy</a>
          <a href="#" class="hover:text-white transition-colors">Terms</a>
          <a href="#" class="hover:text-white transition-colors">Contact</a>
        </div>
        <p class="text-xs text-white/30">&copy; 2026 RideUp Nassau</p>
      </div>
    </footer>

  </div>
</template>
```

- [ ] **Step 2: Verify the build succeeds**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds. RiderLanding.vue is not yet routed, but it should compile without errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/RiderLanding.vue
git commit -m "feat: add rider landing page (/welcome) with Hormozi-style sections"
```

---

### Task 4: Driver Landing Page (`/drive`)

**Files:**
- Create: `src/pages/DriverLanding.vue`

Same structure as rider page but with driver-specific content: earnings comparison, value stack, onboarding steps, testimonials, and the driver guarantee.

- [ ] **Step 1: Create DriverLanding.vue with all 8 sections**

```vue
<script setup>
const whatsappLink = 'https://wa.me/12424529911'

const benefits = [
  { icon: 'dollar', title: 'Keep 80% of Every Fare', desc: 'Lowest commission rate in Nassau' },
  { icon: 'bolt', title: 'Instant Cashout', desc: 'Cash out after every completed trip, no waiting' },
  { icon: 'shield', title: 'Fully Insured', desc: 'Commercial liability coverage while you drive' },
  { icon: 'chart', title: 'Earnings Dashboard', desc: 'Track your daily, weekly, and monthly earnings' },
]

const testimonials = [
  {
    name: 'Marcus T.',
    since: 'June 2026',
    quote: 'I switched and make $300 more per week. The instant cashout alone was worth it.',
    stat: '$1,800/week average',
  },
  {
    name: 'Darnell W.',
    since: 'July 2026',
    quote: 'Better fares, better passengers, better app. Best decision I made this year.',
    stat: '$1,500/week average',
  },
  {
    name: 'Keisha R.',
    since: 'August 2026',
    quote: 'I drive part-time evenings and still clear $800 a week. The flexibility is unmatched.',
    stat: '$800/week part-time',
  },
]
</script>

<template>
  <div class="min-h-screen bg-[#16241F] font-[var(--font-sans)]">

    <!-- Section 1: Hero -->
    <section class="px-5 pt-14 pb-16">
      <div class="max-w-xl mx-auto">
        <span class="inline-block text-xs font-semibold text-[#34C796] tracking-wide uppercase mb-4">
          Drive with RideUp
        </span>
        <h1 class="text-4xl md:text-5xl font-bold text-white font-[var(--font-serif)] leading-tight mb-4">
          Make $200/Day Driving in Nassau.<br>Keep More Than Any Other Platform.
        </h1>
        <p class="text-base text-white/60 mb-8 max-w-md">
          Lowest commission in The Bahamas. Your car, your hours, your money.
        </p>
        <a
          :href="whatsappLink"
          target="_blank"
          rel="noopener"
          class="inline-block px-8 py-3.5 rounded-xl bg-[#34C796] hover:bg-[#22A67E] text-white font-bold text-base transition-colors"
        >
          Apply in 60 Seconds
        </a>
      </div>
    </section>

    <!-- Section 2: Earnings Comparison -->
    <section class="py-16 px-5 border-t border-white/10">
      <div class="max-w-xl mx-auto">
        <h2 class="text-2xl font-bold text-white font-[var(--font-serif)] text-center mb-10">You Keep More With RideUp</h2>

        <!-- Bar comparison -->
        <div class="space-y-4 mb-8">
          <div>
            <div class="flex items-center justify-between text-sm text-white mb-1">
              <span class="font-semibold">RideUp</span>
              <span>Keep 80%</span>
            </div>
            <div class="h-8 rounded-lg bg-[#34C796]" style="width: 80%"></div>
          </div>
          <div>
            <div class="flex items-center justify-between text-sm text-white/50 mb-1">
              <span>Others</span>
              <span>Keep 60-70%</span>
            </div>
            <div class="h-8 rounded-lg bg-white/20" style="width: 65%"></div>
          </div>
        </div>

        <!-- Example -->
        <div class="bg-white/5 rounded-2xl p-6 border border-white/10 text-center">
          <p class="text-white/60 text-sm mb-2">On a $25 fare:</p>
          <div class="flex items-center justify-center gap-6 mb-4">
            <div>
              <div class="text-2xl font-bold text-[#34C796]">$20</div>
              <div class="text-xs text-white/50">RideUp</div>
            </div>
            <div class="text-white/30 text-xl">vs</div>
            <div>
              <div class="text-2xl font-bold text-white/40">$15</div>
              <div class="text-xs text-white/50">Others</div>
            </div>
          </div>
          <p class="text-lg font-bold text-white">That's <span class="text-[#34C796]">$1,200+ extra</span> per month in your pocket.</p>
        </div>
      </div>
    </section>

    <!-- Section 3: Value Stack -->
    <section class="py-16 px-5 border-t border-white/10">
      <div class="max-w-xl mx-auto grid gap-6 sm:grid-cols-2">
        <div
          v-for="b in benefits"
          :key="b.title"
          class="bg-white/5 rounded-2xl p-6 border border-white/10"
        >
          <div class="w-12 h-12 rounded-xl bg-[#34C796]/10 flex items-center justify-center mb-4">
            <!-- Dollar icon -->
            <svg v-if="b.icon === 'dollar'" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-[#34C796]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <!-- Bolt icon -->
            <svg v-else-if="b.icon === 'bolt'" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-[#34C796]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <!-- Shield icon -->
            <svg v-else-if="b.icon === 'shield'" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-[#34C796]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <!-- Chart icon -->
            <svg v-else-if="b.icon === 'chart'" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-[#34C796]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-white mb-2">{{ b.title }}</h3>
          <p class="text-sm text-white/60">{{ b.desc }}</p>
        </div>
      </div>
    </section>

    <!-- Section 4: 3-Step Onboarding -->
    <section class="py-16 px-5 border-t border-white/10">
      <div class="max-w-xl mx-auto">
        <h2 class="text-2xl font-bold text-white font-[var(--font-serif)] text-center mb-12">Start Driving in 3 Steps</h2>
        <div class="grid gap-8 sm:grid-cols-3 text-center">
          <div>
            <div class="w-10 h-10 rounded-full bg-[#34C796] text-white font-bold text-lg flex items-center justify-center mx-auto mb-4">1</div>
            <h3 class="text-base font-bold text-white mb-2">Input your details</h3>
            <p class="text-sm text-white/60">Vehicle & driver info — takes 60 seconds</p>
          </div>
          <div>
            <div class="w-10 h-10 rounded-full bg-[#34C796] text-white font-bold text-lg flex items-center justify-center mx-auto mb-4">2</div>
            <h3 class="text-base font-bold text-white mb-2">Free safety check</h3>
            <p class="text-sm text-white/60">We verify your vehicle meets our standards</p>
          </div>
          <div>
            <div class="w-10 h-10 rounded-full bg-[#34C796] text-white font-bold text-lg flex items-center justify-center mx-auto mb-4">3</div>
            <h3 class="text-base font-bold text-white mb-2">Start accepting rides</h3>
            <p class="text-sm text-white/60">Open the app and earn money today</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 5: The Guarantee -->
    <section class="py-16 px-5">
      <div class="max-w-xl mx-auto bg-[#34C796]/10 border border-[#34C796]/30 rounded-2xl p-8 text-center">
        <h2 class="text-2xl font-bold text-white font-[var(--font-serif)] mb-4">The RideUp Driver Guarantee</h2>
        <p class="text-base text-white/80 max-w-md mx-auto">
          Drive for one week. If you don't earn more per ride than your current platform, we'll match your earnings + give you a $100 bonus. Zero risk to switch.
        </p>
      </div>
    </section>

    <!-- Section 6: Testimonials -->
    <section class="py-16 px-5 border-t border-white/10">
      <div class="max-w-xl mx-auto">
        <h2 class="text-2xl font-bold text-white font-[var(--font-serif)] text-center mb-10">Drivers Love RideUp</h2>
        <div class="grid gap-6">
          <div
            v-for="t in testimonials"
            :key="t.name"
            class="bg-white/5 rounded-2xl p-6 border border-white/10"
          >
            <div class="flex items-center gap-3 mb-4">
              <div class="w-10 h-10 rounded-full bg-[#34C796]/20 flex items-center justify-center text-[#34C796] font-bold text-sm">
                {{ t.name.charAt(0) }}
              </div>
              <div>
                <div class="text-sm font-bold text-white">{{ t.name }}</div>
                <div class="text-xs text-white/40">Driving since {{ t.since }}</div>
              </div>
            </div>
            <p class="text-sm text-white/70 mb-3">"{{ t.quote }}"</p>
            <div class="text-sm font-bold text-[#34C796]">{{ t.stat }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 7: Final CTA -->
    <section class="py-16 px-5 border-t border-white/10">
      <div class="max-w-xl mx-auto text-center">
        <h2 class="text-2xl font-bold text-white font-[var(--font-serif)] mb-2">Ready to Earn More?</h2>
        <p class="text-white/60 mb-8">Apply in 60 Seconds — Start Earning This Week</p>
        <a
          :href="whatsappLink"
          target="_blank"
          rel="noopener"
          class="inline-block px-8 py-3.5 rounded-xl bg-[#34C796] hover:bg-[#22A67E] text-white font-bold text-base transition-colors"
        >
          Apply in 60 Seconds
        </a>
        <p class="text-white/40 text-sm mt-6">Questions? WhatsApp us at (242) 452-9911</p>
      </div>
    </section>

    <!-- Section 8: Footer -->
    <footer class="py-8 px-5 border-t border-white/10 text-center">
      <div class="max-w-xl mx-auto">
        <p class="text-base font-bold text-white font-[var(--font-serif)] mb-3">RideUp</p>
        <p class="text-xs text-white/40 mb-3">Nassau, Bahamas</p>
        <div class="flex justify-center gap-6 text-xs text-white/40 mb-4">
          <a href="#" class="hover:text-white transition-colors">Privacy</a>
          <a href="#" class="hover:text-white transition-colors">Terms</a>
          <a href="#" class="hover:text-white transition-colors">Contact</a>
        </div>
        <p class="text-xs text-white/30">&copy; 2026 RideUp Nassau</p>
      </div>
    </footer>

  </div>
</template>
```

- [ ] **Step 2: Verify the build succeeds**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/DriverLanding.vue
git commit -m "feat: add driver landing page (/drive) with earnings comparison and testimonials"
```

---

### Task 5: Router Updates

**Files:**
- Modify: `src/router/index.js`

- [ ] **Step 1: Add imports and routes for both landing pages**

Add these two imports at the top of `src/router/index.js`, after the existing imports:

```javascript
import RiderLanding from '../pages/RiderLanding.vue'
import DriverLanding from '../pages/DriverLanding.vue'
```

Add these two routes to the `routes` array, before the closing `]`:

```javascript
  { path: '/welcome', name: 'rider-landing', component: RiderLanding },
  { path: '/drive', name: 'driver-landing', component: DriverLanding },
```

The full updated file should be:

```javascript
import { createRouter, createWebHistory } from 'vue-router'
import RiderFlow from '../pages/rider/RiderFlow.vue'
import Login from '../pages/Login.vue'
import Signup from '../pages/Signup.vue'
import Profile from '../pages/Profile.vue'
import EditProfile from '../pages/EditProfile.vue'
import MyRides from '../pages/MyRides.vue'
import Payments from '../pages/Payments.vue'
import Support from '../pages/Support.vue'
import About from '../pages/About.vue'
import RiderLanding from '../pages/RiderLanding.vue'
import DriverLanding from '../pages/DriverLanding.vue'

const routes = [
  { path: '/', name: 'home', component: RiderFlow },
  { path: '/login', name: 'login', component: Login },
  { path: '/signup', name: 'signup', component: Signup },
  { path: '/profile', name: 'profile', component: Profile },
  { path: '/edit-profile', name: 'edit-profile', component: EditProfile },
  { path: '/my-rides', name: 'my-rides', component: MyRides },
  { path: '/payments', name: 'payments', component: Payments },
  { path: '/support', name: 'support', component: Support },
  { path: '/about', name: 'about', component: About },
  { path: '/welcome', name: 'rider-landing', component: RiderLanding },
  { path: '/drive', name: 'driver-landing', component: DriverLanding },
]

export default createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})
```

- [ ] **Step 2: Verify the build succeeds with routing**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds. Both new routes are included in the bundle.

- [ ] **Step 3: Commit**

```bash
git add src/router/index.js
git commit -m "feat: add /welcome and /drive routes for landing pages"
```

---

### Task 6: Manual Verification

No files changed in this task — this is a verification/QA step.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Dev server starts on `http://localhost:5173` (or next available port).

- [ ] **Step 2: Verify rider landing page**

Open `http://localhost:5173/welcome` in a browser. Verify:
- Dark background with white text
- Green "RideUp Nassau" tag visible
- Hero headline renders in serif font (Fraunces)
- Phone input and green CTA button visible
- Social proof bar with 4 metrics
- 3 value cards (5-min pickup, flat pricing, background-checked)
- 3-step "How It Works" section
- 4 popular routes with prices
- Green guarantee box
- Final CTA with phone input
- Footer with links and copyright

- [ ] **Step 3: Verify driver landing page**

Open `http://localhost:5173/drive` in a browser. Verify:
- Dark background with "Drive with RideUp" tag
- Hero headline with $200/day claim
- "Apply in 60 Seconds" green button links to WhatsApp
- Earnings comparison bars (green 80% vs gray 65%)
- $25 fare example card
- 4 benefit cards
- 3-step onboarding
- Guarantee box
- 3 testimonial cards with initials
- Final CTA links to WhatsApp
- Footer

- [ ] **Step 4: Verify mobile responsiveness**

Use browser dev tools to check both pages at 375px width:
- Single-column layout on mobile
- No horizontal scrolling
- Phone input and button stack vertically
- All text is readable

- [ ] **Step 5: Test lead capture form (rider page)**

On `/welcome`, enter a phone number and click "Get Your $20 Credit":
- Without Supabase config: should show success message (demo mode)
- With invalid phone (e.g., "abc"): should show validation error
- With empty input: should show "Please enter your phone number"

- [ ] **Step 6: Final commit (if any tweaks were needed)**

```bash
git add -A
git commit -m "fix: landing page polish from manual testing"
```
