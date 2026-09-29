<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { formatFare } from '../../lib/pricing'
import { generateFakeEarnings } from '../../lib/demoDriverMode'
import { DEMO_MODE } from '../../lib/demoMode'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { useAuth } from '../../lib/useAuth'

const router = useRouter()
const activeTab = ref('today')

const earnings = ref(DEMO_MODE ? generateFakeEarnings() : { today: [], weeklyTotals: [0,0,0,0,0,0,0], weeklyTrips: [0,0,0,0,0,0,0] })

const todayTotal = computed(() => earnings.value.today.reduce((s, t) => s + t.fare_cents, 0))
const weeklyTotal = computed(() => earnings.value.weeklyTotals.reduce((s, v) => s + v, 0))
const weeklyTripsTotal = computed(() => earnings.value.weeklyTrips.reduce((s, v) => s + v, 0))
const maxDailyEarning = computed(() => Math.max(...earnings.value.weeklyTotals, 1))

onMounted(async () => {
  if (DEMO_MODE || !supabaseConfigured) return

  const { user } = useAuth()
  if (!user.value) return

  try {
    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('auth_user_id', user.value.id)
      .single()

    if (!driver) return

    const { data: rides } = await supabase
      .from('rides')
      .select('fare_cents, completed_at, created_at')
      .eq('driver_id', driver.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })

    if (!rides || rides.length === 0) return

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Today's rides
    const todayRides = rides.filter(r => new Date(r.completed_at || r.created_at) >= todayStart)
    earnings.value.today = todayRides.map(r => ({ fare_cents: r.fare_cents || 0 }))

    // Weekly totals (Mon-Sun)
    const weekTotals = [0, 0, 0, 0, 0, 0, 0]
    const weekTrips = [0, 0, 0, 0, 0, 0, 0]
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Monday

    rides.forEach(r => {
      const d = new Date(r.completed_at || r.created_at)
      if (d >= weekStart) {
        const dayIdx = (d.getDay() + 6) % 7 // Mon=0, Sun=6
        weekTotals[dayIdx] += r.fare_cents || 0
        weekTrips[dayIdx]++
      }
    })

    earnings.value.weeklyTotals = weekTotals
    earnings.value.weeklyTrips = weekTrips
  } catch (e) { /* keep defaults */ }
})
const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  return `${hrs}h ago`
}

function goBack() {
  router.back()
}
</script>

<template>
  <div class="min-h-screen bg-[var(--color-surface)] text-[var(--color-text-primary)]">
    <!-- Top bar -->
    <div class="flex items-center justify-between px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4">
      <button @click="goBack" class="w-10 h-10 flex items-center justify-center rounded-full active:bg-[var(--color-surface-secondary)]">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-[17px] font-bold">Earnings</h1>
      <div class="w-10 h-10"></div>
    </div>

    <div class="max-w-lg mx-auto px-5 pb-8">
      <!-- Tab toggle -->
      <div class="flex bg-[var(--color-surface-secondary)] rounded-xl p-1 mb-6">
        <button @click="activeTab = 'today'"
                class="flex-1 py-2.5 rounded-lg text-[14px] font-semibold transition-all"
                :class="activeTab === 'today' ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-muted)]'">
          Today
        </button>
        <button @click="activeTab = 'week'"
                class="flex-1 py-2.5 rounded-lg text-[14px] font-semibold transition-all"
                :class="activeTab === 'week' ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-muted)]'">
          This Week
        </button>
      </div>

      <!-- TODAY TAB -->
      <div v-if="activeTab === 'today'">
        <div class="text-center mb-6">
          <div class="text-[36px] font-bold font-serif">{{ formatFare(todayTotal) }}</div>
          <div class="text-[13px] text-[var(--color-text-muted)] mt-1">{{ earnings.today.length }} trips</div>
        </div>

        <p class="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 px-1">Completed trips</p>
        <div class="space-y-2">
          <div v-for="trip in earnings.today" :key="trip.id"
               class="bg-[var(--color-surface-secondary)] rounded-2xl px-4 py-3.5 flex items-center justify-between">
            <div>
              <div class="text-[14px] font-semibold">{{ trip.pickup_address.split(',')[0] }} → {{ trip.dropoff_address.split(',')[0] }}</div>
              <div class="text-[11px] text-[var(--color-text-muted)] mt-0.5">{{ timeAgo(trip.completed_at) }} · {{ trip.distance_miles.toFixed(1) }} mi</div>
            </div>
            <div class="text-[15px] font-bold text-[#2b8659]">+{{ formatFare(trip.fare_cents) }}</div>
          </div>
        </div>

        <div v-if="earnings.today.length === 0" class="text-center text-[13px] text-[var(--color-text-muted)] py-10">
          No trips today yet
        </div>
      </div>

      <!-- WEEK TAB -->
      <div v-else>
        <div class="text-center mb-6">
          <div class="text-[36px] font-bold font-serif">{{ formatFare(weeklyTotal) }}</div>
          <div class="text-[13px] text-[var(--color-text-muted)] mt-1">{{ weeklyTripsTotal }} trips this week</div>
        </div>

        <!-- Bar chart -->
        <div class="bg-[var(--color-surface-secondary)] rounded-2xl p-5 mb-6">
          <div class="flex items-end justify-between gap-2 h-[120px]">
            <div v-for="(total, i) in earnings.weeklyTotals" :key="i" class="flex-1 flex flex-col items-center gap-1">
              <div class="w-full rounded-lg transition-all"
                   :style="{ height: (total / maxDailyEarning * 100) + '%', minHeight: total > 0 ? '8px' : '2px' }"
                   :class="total > 0 ? 'bg-[#2b8659]' : 'bg-[var(--color-surface-secondary)]'">
              </div>
            </div>
          </div>
          <div class="flex justify-between mt-2">
            <div v-for="(label, i) in dayLabels" :key="label" class="flex-1 text-center text-[10px] font-medium"
                 :class="earnings.weeklyTotals[i] > 0 ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)]'">
              {{ label }}
            </div>
          </div>
        </div>

        <!-- Daily breakdown -->
        <p class="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 px-1">Daily breakdown</p>
        <div class="space-y-2">
          <div v-for="(total, i) in earnings.weeklyTotals" :key="i"
               class="flex items-center justify-between px-4 py-3 bg-[var(--color-surface-secondary)] rounded-xl">
            <div class="flex items-center gap-3">
              <span class="text-[13px] font-semibold w-8">{{ dayLabels[i] }}</span>
              <span class="text-[12px] text-[var(--color-text-muted)]">{{ earnings.weeklyTrips[i] }} trips</span>
            </div>
            <span class="text-[14px] font-bold font-serif" :class="total > 0 ? '' : 'text-[var(--color-text-muted)]'">{{ formatFare(total) }}</span>
          </div>
        </div>
      </div>

      <!-- Payout Actions -->
      <div class="mt-8">
        <p class="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 px-1">Payouts</p>
        <div class="space-y-2">
          <button class="w-full flex items-center justify-between bg-[var(--color-surface-secondary)] rounded-2xl px-4 py-4 opacity-60" disabled>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-[#2b8659]/10 flex items-center justify-center">
                <svg class="w-5 h-5 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div class="text-left">
                <p class="text-[14px] font-semibold text-[var(--color-text-primary)]">Instant Cashout</p>
                <p class="text-[11px] text-[var(--color-text-muted)]">Transfer earnings to your bank instantly</p>
              </div>
            </div>
            <span class="text-[10px] font-bold text-white bg-[#2b8659] px-2 py-1 rounded-full">COMING SOON</span>
          </button>
          <button class="w-full flex items-center justify-between bg-[var(--color-surface-secondary)] rounded-2xl px-4 py-4 opacity-60" disabled>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-[#2b8659]/10 flex items-center justify-center">
                <svg class="w-5 h-5 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div class="text-left">
                <p class="text-[14px] font-semibold text-[var(--color-text-primary)]">Bank Withdrawal</p>
                <p class="text-[11px] text-[var(--color-text-muted)]">Weekly automatic deposits to your account</p>
              </div>
            </div>
            <span class="text-[10px] font-bold text-white bg-[#2b8659] px-2 py-1 rounded-full">COMING SOON</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
