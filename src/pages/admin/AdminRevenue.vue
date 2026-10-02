<template>
  <div class="max-w-5xl">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">Money</h1>
      <div class="inline-flex rounded-lg border border-[var(--color-border)] overflow-hidden text-sm" role="group" aria-label="Date range">
        <button v-for="r in RANGES" :key="r.days" @click="setRange(r.days)"
                class="px-3 py-1.5 font-semibold"
                :class="days === r.days ? 'bg-[#2b8659] text-white' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'"
                :aria-pressed="days === r.days">{{ r.label }}</button>
      </div>
    </div>

    <p v-if="error" class="mb-4 text-sm text-red-600" role="alert">{{ error }}</p>

    <!-- Headline numbers -->
    <div class="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      <div v-for="t in tiles" :key="t.label" class="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5">
        <p class="text-sm text-[var(--color-text-muted)] mb-1">{{ t.label }}</p>
        <p class="text-2xl font-bold text-[var(--color-text-primary)]">{{ t.value }}</p>
        <p v-if="t.note" class="text-xs text-[var(--color-text-muted)] mt-1">{{ t.note }}</p>
      </div>
    </div>

    <!-- Daily rider payments -->
    <div class="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5 mb-6">
      <h2 class="text-sm font-semibold text-[var(--color-text-primary)]">Rider payments per day</h2>
      <p class="text-xs text-[var(--color-text-muted)] mb-4">Trips, tips and cancellation fees charged, Nassau time. Hover a bar for the day’s numbers.</p>
      <div class="relative" @mouseleave="hover = null">
        <div class="flex items-end h-44 border-b border-[var(--color-border)]" :style="{ gap: rows.length > 60 ? '1px' : '2px' }" role="img"
             :aria-label="`Bar chart of rider payments per day over the last ${days} days. The table below lists every day.`">
          <div v-for="(d, i) in rows" :key="d.day" class="flex-1 h-full flex items-end cursor-default"
               @mouseenter="hover = i" @focus="hover = i" tabindex="-1">
            <div class="w-full rounded-t-[4px] transition-colors"
                 :class="hover === i ? 'bg-[#1f6a46]' : 'bg-[#2b8659]'"
                 :style="{ height: d.rider_paid_cents ? Math.max(2, (d.rider_paid_cents / maxPaid) * 100) + '%' : '0' }"></div>
          </div>
        </div>
        <div v-if="hover !== null && rows[hover]"
             class="absolute -top-2 z-10 pointer-events-none bg-[var(--color-surface)] border border-[var(--color-border)] shadow-lg rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] whitespace-nowrap"
             :style="{ left: `min(max(0px, calc(${((hover + 0.5) / rows.length) * 100}% - 80px)), calc(100% - 170px))` }">
          <p class="font-semibold mb-0.5">{{ fmtDay(rows[hover].day) }}</p>
          <p>Payments {{ money(rows[hover].rider_paid_cents) }}</p>
          <p>RideUp net {{ money(net(rows[hover])) }}</p>
          <p class="text-[var(--color-text-muted)]">{{ rows[hover].trips }} trip{{ rows[hover].trips === 1 ? '' : 's' }}</p>
        </div>
        <div class="flex justify-between mt-2 text-xs text-[var(--color-text-muted)]">
          <span>{{ rows[0] && fmtDay(rows[0].day) }}</span>
          <span>{{ rows.length && fmtDay(rows[rows.length - 1].day) }}</span>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <!-- Where the money went -->
      <div class="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5">
        <h2 class="text-sm font-semibold text-[var(--color-text-primary)] mb-3">RideUp’s share, last {{ days }} days</h2>
        <dl class="text-sm space-y-2">
          <div class="flex justify-between"><dt class="text-[var(--color-text-secondary)]">Trip fares (gross)</dt><dd>{{ money(sum.gross_fare_cents) }}</dd></div>
          <div class="flex justify-between pl-3 text-xs"><dt class="text-[var(--color-text-muted)]">incl. booking fees</dt><dd class="text-[var(--color-text-muted)]">{{ money(sum.booking_fee_cents) }}</dd></div>
          <div class="flex justify-between pl-3 text-xs"><dt class="text-[var(--color-text-muted)]">incl. airport fees</dt><dd class="text-[var(--color-text-muted)]">{{ money(sum.airport_fee_cents) }}</dd></div>
          <div class="flex justify-between pl-3 text-xs"><dt class="text-[var(--color-text-muted)]">incl. busy-time pricing</dt><dd class="text-[var(--color-text-muted)]">{{ money(sum.busy_extra_cents) }}</dd></div>
          <div class="flex justify-between"><dt class="text-[var(--color-text-secondary)]">Drivers’ share of fares</dt><dd>−{{ money(sum.driver_fare_cents) }}</dd></div>
          <div class="flex justify-between font-semibold border-t border-[var(--color-border)] pt-2"><dt>RideUp fees</dt><dd>{{ money(sum.platform_fee_cents) }}</dd></div>
          <div class="flex justify-between"><dt class="text-[var(--color-text-secondary)]">+ Cancellation &amp; no-show fees (RideUp part)</dt><dd>{{ money(sum.cancel_platform_cents) }}</dd></div>
          <div class="flex justify-between"><dt class="text-[var(--color-text-secondary)]">− Promo &amp; referral discounts</dt><dd>−{{ money(sum.promo_cents) }}</dd></div>
          <div class="flex justify-between"><dt class="text-[var(--color-text-secondary)]">− Ride credit used</dt><dd>−{{ money(sum.credit_cents) }}</dd></div>
          <div class="flex justify-between"><dt class="text-[var(--color-text-secondary)]">− Driver incentives</dt><dd>−{{ money(sum.quest_reward_cents) }}</dd></div>
          <div class="flex justify-between"><dt class="text-[var(--color-text-secondary)]">− Card fees (estimate)</dt><dd>−{{ money(sum.est_card_fee_cents) }}</dd></div>
          <div class="flex justify-between font-bold text-base border-t border-[var(--color-border)] pt-2"><dt>RideUp net</dt><dd :class="totalNet < 0 && 'text-red-600'">{{ money(totalNet) }}</dd></div>
        </dl>
        <p class="text-xs text-[var(--color-text-muted)] mt-3">Card fees are estimated at 2.9% + 30¢ per charge; check Stripe for exact amounts. Tips go 100% to drivers.</p>
      </div>

      <!-- What RideUp owes -->
      <div class="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5">
        <h2 class="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Owed right now</h2>
        <dl class="text-sm space-y-3">
          <div class="flex justify-between"><dt class="text-[var(--color-text-secondary)]">Driver earnings waiting for payout <span class="text-xs text-[var(--color-text-muted)]">({{ owed.drivers_owed }} drivers)</span></dt><dd class="font-semibold">{{ money(owed.driver_balances_cents) }}</dd></div>
          <div class="flex justify-between"><dt class="text-[var(--color-text-secondary)]">Unspent rider credit</dt><dd class="font-semibold">{{ money(owed.credit_outstanding_cents) }}</dd></div>
        </dl>
        <router-link to="/admin/payouts" class="inline-block mt-4 text-sm font-semibold text-[var(--color-brand)]">Record payouts →</router-link>
        <h2 class="text-sm font-semibold text-[var(--color-text-primary)] mt-6 mb-3">Drivers earned, last {{ days }} days</h2>
        <dl class="text-sm space-y-2">
          <div class="flex justify-between"><dt class="text-[var(--color-text-secondary)]">Fares</dt><dd>{{ money(sum.driver_fare_cents) }}</dd></div>
          <div class="flex justify-between"><dt class="text-[var(--color-text-secondary)]">Tips</dt><dd>{{ money(sum.tips_cents) }}</dd></div>
          <div class="flex justify-between"><dt class="text-[var(--color-text-secondary)]">Cancellation fees</dt><dd>{{ money(sum.cancel_fee_cents - sum.cancel_platform_cents) }}</dd></div>
          <div class="flex justify-between"><dt class="text-[var(--color-text-secondary)]">Incentives</dt><dd>{{ money(sum.quest_reward_cents) }}</dd></div>
          <div class="flex justify-between font-semibold border-t border-[var(--color-border)] pt-2"><dt>Total</dt><dd>{{ money(driverTotal) }}</dd></div>
        </dl>
      </div>
    </div>

    <!-- Daily table -->
    <div class="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <table class="w-full text-sm stack-table">
        <caption class="sr-only">Money by day</caption>
        <thead>
          <tr class="text-left text-[var(--color-text-muted)] text-xs uppercase tracking-wider bg-[var(--color-surface-secondary)]">
            <th class="px-4 py-3 font-medium">Day</th>
            <th class="px-4 py-3 font-medium text-right">Trips</th>
            <th class="px-4 py-3 font-medium text-right">Rider payments</th>
            <th class="px-4 py-3 font-medium text-right">Discounts</th>
            <th class="px-4 py-3 font-medium text-right">RideUp net</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in tableRows" :key="d.day" class="border-t border-[var(--color-border)]">
            <td data-label="Day" class="px-4 py-2.5">{{ fmtDay(d.day) }}</td>
            <td data-label="Trips" class="px-4 py-2.5 text-right">{{ d.trips }}</td>
            <td data-label="Rider payments" class="px-4 py-2.5 text-right">{{ money(d.rider_paid_cents) }}</td>
            <td data-label="Discounts" class="px-4 py-2.5 text-right">{{ money(d.promo_cents + d.credit_cents) }}</td>
            <td data-label="RideUp net" class="px-4 py-2.5 text-right font-semibold" :class="net(d) < 0 && 'text-red-600'">{{ money(net(d)) }}</td>
          </tr>
          <tr v-if="!loading && !tableRows.length"><td colspan="5" class="px-4 py-8 text-center text-[var(--color-text-muted)]">No paid trips in this period yet.</td></tr>
          <tr v-if="loading"><td colspan="5" class="px-4 py-8 text-center text-[var(--color-text-muted)]">Loading…</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { DEMO_MODE } from '../../lib/demoMode'

// Real numbers from admin_money_summary / admin_money_owed (migration 010).
const RANGES = [{ days: 7, label: '7 days' }, { days: 30, label: '30 days' }, { days: 90, label: '90 days' }]
const FIELDS = ['trips', 'gross_fare_cents', 'platform_fee_cents', 'driver_fare_cents', 'booking_fee_cents', 'airport_fee_cents',
  'busy_extra_cents', 'promo_cents', 'credit_cents', 'tips_cents', 'cancel_fee_cents', 'cancel_platform_cents',
  'quest_reward_cents', 'rider_paid_cents', 'est_card_fee_cents', 'cancelled_trips']

const days = ref(30)
const rows = ref([])
const owed = ref({ credit_outstanding_cents: 0, driver_balances_cents: 0, drivers_owed: 0 })
const loading = ref(false)
const error = ref('')
const hover = ref(null)

const money = (c) => `${c < 0 ? '−' : ''}$${(Math.abs(c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const net = (d) => d.platform_fee_cents + d.cancel_platform_cents - d.promo_cents - d.credit_cents - d.quest_reward_cents - d.est_card_fee_cents

const sum = computed(() => Object.fromEntries(FIELDS.map((f) => [f, rows.value.reduce((s, d) => s + d[f], 0)])))
const totalNet = computed(() => net(sum.value))
const driverTotal = computed(() => sum.value.driver_fare_cents + sum.value.tips_cents + sum.value.cancel_fee_cents - sum.value.cancel_platform_cents + sum.value.quest_reward_cents)
const maxPaid = computed(() => Math.max(1, ...rows.value.map((d) => d.rider_paid_cents)))
const tableRows = computed(() => rows.value.filter((d) => d.trips || d.rider_paid_cents || d.quest_reward_cents).slice().reverse())
const tiles = computed(() => [
  { label: 'Rider payments', value: money(sum.value.rider_paid_cents), note: `${sum.value.trips} trips` },
  { label: 'RideUp net', value: money(totalNet.value), note: 'after discounts, incentives and card fees' },
  { label: 'Drivers earned', value: money(driverTotal.value) },
  { label: 'Average trip fare', value: money(sum.value.trips ? Math.round(sum.value.gross_fare_cents / sum.value.trips) : 0), note: `${sum.value.cancelled_trips} cancellation fees` },
])

function nassauDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Nassau' }) // YYYY-MM-DD
}

async function load() {
  error.value = ''
  if (!supabaseConfigured || DEMO_MODE) {
    rows.value = Array.from({ length: days.value }, (_, i) => ({ day: nassauDate(i - days.value + 1), ...Object.fromEntries(FIELDS.map((f) => [f, 0])) }))
    return
  }
  loading.value = true
  const [summary, owedRes] = await Promise.all([
    supabase.rpc('admin_money_summary', { p_from: nassauDate(1 - days.value), p_to: nassauDate(0) }),
    supabase.rpc('admin_money_owed'),
  ])
  loading.value = false
  if (summary.error) { error.value = 'Could not load money data. Run migration 010 and check your account has the admin role.'; return }
  rows.value = (summary.data || []).map((d) => ({ ...d, ...Object.fromEntries(FIELDS.map((f) => [f, Number(d[f]) || 0])) }))
  const o = Array.isArray(owedRes.data) ? owedRes.data[0] : owedRes.data
  if (o) owed.value = { credit_outstanding_cents: Number(o.credit_outstanding_cents) || 0, driver_balances_cents: Number(o.driver_balances_cents) || 0, drivers_owed: Number(o.drivers_owed) || 0 }
}

function setRange(n) {
  days.value = n
  hover.value = null
  load()
}

onMounted(load)
</script>
