<script setup>
import DriverQuests from '../../components/DriverQuests.vue'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { formatFare, driverPayout } from '../../lib/pricing'
import { generateFakeEarnings } from '../../lib/demoDriverMode'
import { DEMO_MODE } from '../../lib/demoMode'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { useDriver } from '../../lib/useDriver'

const router = useRouter()
const { driver } = useDriver()
const activeTab = ref('today')
const loading = ref(!DEMO_MODE)
const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const METHODS = { bank_transfer: 'Bank transfer', cash: 'Cash', mobile_money: 'Mobile money', other: 'Payout' }
const PAID = ['captured', 'paid', 'partially_refunded']

// Every earning line: completed trips (your 80% + 100% of tips) and your share of cancellation/no-show fees.
const items = ref([])
const summary = ref(null) // driver_earnings_summary: balance, paid out, tips
const payouts = ref([])

if (DEMO_MODE) {
  const fake = generateFakeEarnings()
  items.value = fake.today.map((t, i) => ({ id: t.id, kind: 'trip', at: t.completed_at, label: t.dropoff_address, miles: t.distance_miles, amount: driverPayout(t), tip: i % 3 === 0 ? 300 : 0, processing: false }))
  summary.value = { balance_cents: 4820, paid_out_cents: 9600, tips_cents: 900 }
  payouts.value = [{ id: 'p1', amount_cents: 9600, method: 'bank_transfer', created_at: new Date(Date.now() - 6 * 86_400_000).toISOString(), reference: 'TX-1042' }]
}

const now = new Date()
const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
const weekStart = new Date(todayStart)
weekStart.setDate(todayStart.getDate() - ((todayStart.getDay() + 6) % 7)) // Monday, also on Sundays

const total = (list) => list.reduce((s, i) => s + i.amount + i.tip, 0)
const todayItems = computed(() => items.value.filter((i) => new Date(i.at) >= todayStart))
const weekItems = computed(() => items.value.filter((i) => new Date(i.at) >= weekStart))
const todayTotal = computed(() => total(todayItems.value))
const weeklyTotal = computed(() => total(weekItems.value))
const tripsCount = (list) => list.filter((i) => i.kind === 'trip').length
const weekly = computed(() => {
  const totals = [0, 0, 0, 0, 0, 0, 0]
  const trips = [0, 0, 0, 0, 0, 0, 0]
  for (const i of weekItems.value) {
    const day = (new Date(i.at).getDay() + 6) % 7
    totals[day] += i.amount + i.tip
    if (i.kind === 'trip') trips[day]++
  }
  return { totals, trips }
})
const maxDailyEarning = computed(() => Math.max(...weekly.value.totals, 1))

onMounted(async () => {
  if (DEMO_MODE || !supabaseConfigured || !driver.value) {
    loading.value = false
    return
  }
  const since = new Date(weekStart.getTime() - 7 * 86_400_000).toISOString()
  const [{ data: rides }, { data: sum }, { data: paid }] = await Promise.all([
    supabase
      .from('rides')
      .select('id, status, fare_cents, driver_payout_cents, tip_cents, tip_payment_intent_id, payment_status, completed_at, cancelled_at, created_at, dropoff_address, distance_miles, cancel_reason')
      .eq('driver_id', driver.value.id)
      .in('status', ['completed', 'cancelled'])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.rpc('driver_earnings_summary'),
    supabase.from('driver_payouts').select('id, amount_cents, method, reference, created_at, status').eq('status', 'paid').order('created_at', { ascending: false }).limit(20),
  ])

  items.value = (rides || []).flatMap((r) => {
    if (r.status === 'completed' && !['failed', 'refunded'].includes(r.payment_status)) {
      return [{
        id: r.id, kind: 'trip', at: r.completed_at || r.created_at, label: r.dropoff_address,
        miles: Number(r.distance_miles) || null, amount: driverPayout(r),
        tip: r.tip_payment_intent_id ? (r.tip_cents || 0) : 0,
        processing: !PAID.includes(r.payment_status),
      }]
    }
    if (r.status === 'cancelled' && (r.driver_payout_cents || 0) > 0 && PAID.includes(r.payment_status)) {
      return [{ id: r.id, kind: 'fee', at: r.cancelled_at || r.created_at, label: r.cancel_reason === 'rider_no_show' ? 'No-show fee' : 'Cancellation fee', miles: null, amount: r.driver_payout_cents, tip: 0, processing: false }]
    }
    return []
  })
  summary.value = Array.isArray(sum) ? sum[0] : sum
  payouts.value = paid || []
  loading.value = false
})

function timeLabel(isoString) {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.max(0, Math.round(diff / 60000))
  if (mins < 60) return `${mins} min ago`
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h ago`
  return new Date(isoString).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function goBack() {
  router.back()
}
</script>

<template>
  <div class="min-h-dvh bg-[var(--color-surface)] text-[var(--color-text-primary)]">
    <!-- Top bar -->
    <div class="flex items-center justify-between px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4">
      <button @click="goBack" class="w-10 h-10 flex items-center justify-center rounded-full active:bg-[var(--color-surface-secondary)]" aria-label="Back">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-[17px] font-bold">Earnings</h1>
      <div class="w-10 h-10"></div>
    </div>

    <div class="max-w-lg mx-auto px-5 pb-8">
      <!-- Balance -->
      <div class="rounded-2xl bg-[#191f1c] text-white p-5 mb-6">
        <p class="text-[12px] font-semibold uppercase tracking-wide text-white/70">Balance</p>
        <p class="text-[34px] font-bold leading-tight">{{ summary ? formatFare(Math.max(0, summary.balance_cents || 0)) : (loading ? '…' : '$0.00') }}</p>
        <p class="text-[12px] text-white/70 mt-1" v-if="summary">Paid out so far {{ formatFare(summary.paid_out_cents || 0) }} · Tips {{ formatFare(summary.tips_cents || 0) }}</p>
        <p class="text-[12px] text-white/80 mt-3 leading-relaxed">Your balance includes incentive rewards. RideUp pays it by bank transfer, cash or mobile money. Each payout you receive is listed below.</p>
      </div>
      <DriverQuests />

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
          <div class="text-[13px] text-[var(--color-text-muted)] mt-1">{{ tripsCount(todayItems) }} trips</div>
        </div>

        <p class="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 px-1">Today’s activity</p>
        <div class="space-y-2">
          <div v-for="item in todayItems" :key="item.id"
               class="bg-[var(--color-surface-secondary)] rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-[14px] font-semibold truncate">{{ item.kind === 'trip' ? `Trip to ${item.label || 'drop-off'}` : item.label }}</div>
              <div class="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                {{ timeLabel(item.at) }}<span v-if="item.miles"> · {{ item.miles.toFixed(1) }} mi</span><span v-if="item.tip"> · includes {{ formatFare(item.tip) }} tip</span><span v-if="item.processing"> · processing</span>
              </div>
            </div>
            <div class="text-[15px] font-bold text-[var(--color-brand)] flex-shrink-0">+{{ formatFare(item.amount + item.tip) }}</div>
          </div>
        </div>

        <div v-if="!loading && todayItems.length === 0" class="text-center text-[13px] text-[var(--color-text-muted)] py-10">
          No trips today yet
        </div>
      </div>

      <!-- WEEK TAB -->
      <div v-else>
        <div class="text-center mb-6">
          <div class="text-[36px] font-bold font-serif">{{ formatFare(weeklyTotal) }}</div>
          <div class="text-[13px] text-[var(--color-text-muted)] mt-1">{{ tripsCount(weekItems) }} trips this week</div>
        </div>

        <!-- Bar chart -->
        <div class="bg-[var(--color-surface-secondary)] rounded-2xl p-5 mb-6">
          <div class="flex items-end justify-between gap-2 h-[120px]">
            <div v-for="(total, i) in weekly.totals" :key="i" class="flex-1 flex flex-col items-center gap-1">
              <div class="w-full rounded-lg transition-all"
                   :style="{ height: (total / maxDailyEarning * 100) + '%', minHeight: total > 0 ? '8px' : '2px' }"
                   :class="total > 0 ? 'bg-[#2b8659]' : 'bg-[var(--color-surface-secondary)]'">
              </div>
            </div>
          </div>
          <div class="flex justify-between mt-2">
            <div v-for="(label, i) in dayLabels" :key="label" class="flex-1 text-center text-[11px] font-medium"
                 :class="weekly.totals[i] > 0 ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)]'">
              {{ label }}
            </div>
          </div>
        </div>

        <!-- Daily breakdown -->
        <p class="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 px-1">Daily breakdown</p>
        <div class="space-y-2">
          <div v-for="(total, i) in weekly.totals" :key="i"
               class="flex items-center justify-between px-4 py-3 bg-[var(--color-surface-secondary)] rounded-xl">
            <div class="flex items-center gap-3">
              <span class="text-[13px] font-semibold w-8">{{ dayLabels[i] }}</span>
              <span class="text-[12px] text-[var(--color-text-muted)]">{{ weekly.trips[i] }} trips</span>
            </div>
            <span class="text-[14px] font-bold font-serif" :class="total > 0 ? '' : 'text-[var(--color-text-muted)]'">{{ formatFare(total) }}</span>
          </div>
        </div>
      </div>

      <!-- Payout history -->
      <div class="mt-8">
        <p class="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 px-1">Payouts received</p>
        <div v-if="payouts.length" class="space-y-2">
          <div v-for="p in payouts" :key="p.id" class="flex items-center justify-between bg-[var(--color-surface-secondary)] rounded-2xl px-4 py-3.5">
            <div>
              <div class="text-[14px] font-semibold">{{ METHODS[p.method] || 'Payout' }}</div>
              <div class="text-[11px] text-[var(--color-text-muted)] mt-0.5">{{ new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}<span v-if="p.reference"> · Ref {{ p.reference }}</span></div>
            </div>
            <div class="text-[15px] font-bold">{{ formatFare(p.amount_cents) }}</div>
          </div>
        </div>
        <p v-else-if="!loading" class="text-[13px] text-[var(--color-text-muted)] px-1">No payouts yet. Questions about a payout? <router-link to="/support" class="text-[var(--color-brand)] font-semibold">Contact support</router-link>.</p>
      </div>
    </div>
  </div>
</template>
