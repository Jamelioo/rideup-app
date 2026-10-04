<template>
  <div>
    <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-6">Dashboard</h1>
    <p v-if="loadError" class="mb-4 text-sm text-red-600" role="alert">{{ loadError }}</p>
    <router-link v-if="openSafetyReports > 0" to="/admin/safety" class="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
      <span>{{ openSafetyReports }} open safety report{{ openSafetyReports === 1 ? '' : 's' }} need review</span>
      <span aria-hidden="true">→</span>
    </router-link>

    <!-- Metric cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
      <div v-for="card in metricCards" :key="card.label" class="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5 hover:shadow-md transition-shadow">
        <p class="text-sm text-[var(--color-text-muted)] mb-1">{{ card.label }}</p>
        <p class="text-2xl font-bold text-[var(--color-text-primary)]">{{ card.value }}</p>
        <p v-if="card.change" :class="['text-xs mt-1', card.changePositive ? 'text-[var(--color-brand)]' : 'text-red-500']">
          {{ card.change }} vs yesterday
        </p>
      </div>
    </div>

    <!-- Charts + Recent rides -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <!-- Bar chart: rides per day -->
      <div class="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5">
        <h2 class="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Completed Trips — Last 7 Days</h2>
        <div class="flex items-end gap-2 h-40">
          <div
            v-for="day in weeklyRides"
            :key="day.label"
            class="flex-1 flex flex-col items-center gap-1"
          >
            <span class="text-xs text-[var(--color-text-muted)] font-medium">{{ day.count }}</span>
            <div
              class="w-full rounded-t-md bg-[#2b8659] transition-all duration-300 hover:bg-[#236e49]"
              :style="{ height: (day.count / maxRides) * 120 + 'px' }"
            />
            <span class="text-xs text-[var(--color-text-muted)] mt-1">{{ day.label }}</span>
          </div>
        </div>
      </div>

      <!-- Recent rides table -->
      <div class="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5">
        <h2 class="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Recent Rides</h2>
        <div class="overflow-x-auto" tabindex="0" aria-label="Today’s rides">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-[var(--color-text-muted)] text-xs uppercase tracking-wider border-b border-[var(--color-border)]">
                <th class="pb-2 font-medium">Rider</th>
                <th class="pb-2 font-medium">Route</th>
                <th class="pb-2 font-medium">Fare</th>
                <th class="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="ride in recentRides"
                :key="ride.id"
                class="border-b border-gray-50 hover:bg-[var(--color-surface-secondary)] transition-colors"
              >
                <td class="py-2.5 text-[var(--color-text-primary)] font-medium">{{ ride.rider }}</td>
                <td class="py-2.5 text-[var(--color-text-muted)] truncate max-w-[160px]">{{ ride.pickup }} → {{ ride.dropoff }}</td>
                <td class="py-2.5 text-[var(--color-text-primary)]">${{ typeof ride.fare === 'number' ? ride.fare.toFixed(2) : ride.fare }}</td>
                <td class="py-2.5">
                  <span :class="statusBadge(ride.status)">{{ ride.status }}</span>
                </td>
              </tr>
              <tr v-if="recentRides.length === 0"><td colspan="4" class="py-6 text-center text-[var(--color-text-muted)]">No rides today yet.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { DEMO_MODE } from '../../lib/demoMode'

const SAMPLE_METRICS = [
  { label: 'Rides Today', value: '142', change: '+12%', changePositive: true },
  { label: 'Active Drivers', value: '38', change: '+3', changePositive: true },
  { label: 'Gross Bookings Today', value: '$4,280.50', change: '+8.2%', changePositive: true },
  { label: 'New Signups', value: '23', change: '-2', changePositive: false },
]
const metricCards = ref(DEMO_MODE ? SAMPLE_METRICS : [
  { label: 'Completed Trips', value: '—', change: '' },
  { label: 'Approved Drivers', value: '—', change: '' },
  { label: 'Gross Bookings', value: '—', change: '' },
  { label: 'Total Riders', value: '—', change: '' },
])

const SAMPLE_WEEK = [
  { label: 'Mon', count: 98 },
  { label: 'Tue', count: 132 },
  { label: 'Wed', count: 115 },
  { label: 'Thu', count: 148 },
  { label: 'Fri', count: 178 },
  { label: 'Sat', count: 195 },
  { label: 'Sun', count: 142 },
]
const weeklyRides = ref(DEMO_MODE ? SAMPLE_WEEK : [])

const maxRides = computed(() => Math.max(1, ...weeklyRides.value.map(d => d.count)))

const SAMPLE_RECENT = [
  { id: 1, rider: 'Marcus Thompson', pickup: 'Atlantis Resort', dropoff: 'Downtown Nassau', fare: 28.50, status: 'Completed' },
  { id: 2, rider: 'Shania Williams', pickup: 'Cable Beach', dropoff: 'PI Airport', fare: 35.00, status: 'Active' },
  { id: 3, rider: 'Devon Clarke', pickup: 'Bay Street', dropoff: 'Paradise Island', fare: 22.00, status: 'Completed' },
  { id: 4, rider: 'Tanya Rolle', pickup: 'Nassau Harbour', dropoff: 'Cable Beach', fare: 18.75, status: 'Completed' },
  { id: 5, rider: 'James Mitchell', pickup: 'PI Airport', dropoff: 'Atlantis Resort', fare: 15.00, status: 'Cancelled' },
  { id: 6, rider: 'Crystal Johnson', pickup: 'Montagu Beach', dropoff: 'Fish Fry', fare: 12.50, status: 'Completed' },
  { id: 7, rider: 'Andre Davis', pickup: 'Baha Mar', dropoff: 'Downtown Nassau', fare: 24.00, status: 'Requested' },
  { id: 8, rider: 'Lisa Ferguson', pickup: 'Junkanoo Beach', dropoff: 'Cable Beach', fare: 19.00, status: 'Completed' },
  { id: 9, rider: 'Robert Sands', pickup: 'Fort Charlotte', dropoff: 'PI Airport', fare: 32.00, status: 'Active' },
  { id: 10, rider: 'Keisha Brown', pickup: 'Potter\'s Cay', dropoff: 'Atlantis Resort', fare: 16.50, status: 'Completed' },
]
const recentRides = ref(DEMO_MODE ? SAMPLE_RECENT : [])
const openSafetyReports = ref(0)
const loadError = ref('')

function statusBadge(status) {
  const base = 'text-xs font-medium px-2 py-0.5 rounded-full'
  switch (status) {
    case 'Completed': return `${base} bg-green-50 text-green-700`
    case 'Active': return `${base} bg-yellow-50 text-yellow-700`
    case 'Cancelled': return `${base} bg-red-50 text-red-700`
    case 'Requested': return `${base} bg-blue-50 text-blue-700`
    default: return `${base} bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]`
  }
}

onMounted(async () => {
  if (!supabaseConfigured) return
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    const weekStart = new Date(today)
    weekStart.setDate(weekStart.getDate() - 6)

    const [ridesRes, driversRes, ridersRes, revenueRes, todayRidesRes, weekRes, safetyRes] = await Promise.all([
      supabase.from('rides').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('drivers').select('id', { count: 'exact', head: true }).eq('approved', true),
      supabase.from('riders').select('id', { count: 'exact', head: true }),
      supabase.from('rides').select('fare_cents').eq('status', 'completed'),
      supabase.from('rides').select('*').gte('created_at', todayISO).order('created_at', { ascending: false }).limit(10),
      supabase.from('rides').select('created_at, completed_at').eq('status', 'completed').gte('created_at', new Date(weekStart.getTime() - 86400000).toISOString()),
      supabase.from('safety_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    ])
    if (ridesRes.error) throw ridesRes.error

    // Last 7 days, oldest first
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      days.push({ key: d.toDateString(), label: d.toLocaleDateString('en-US', { weekday: 'short' }), count: 0 })
    }
    for (const r of weekRes.data || []) {
      const day = days.find((x) => x.key === new Date(r.completed_at || r.created_at).toDateString())
      if (day) day.count++
    }
    weeklyRides.value = days
    openSafetyReports.value = safetyRes.count || 0

    const totalRevenue = (revenueRes.data || []).reduce((sum, r) => sum + (r.fare_cents || 0), 0)

    metricCards.value = [
      { label: 'Completed Trips', value: String(ridesRes.count || 0), change: '', changePositive: true },
      { label: 'Approved Drivers', value: String(driversRes.count || 0), change: '', changePositive: true },
      { label: 'Gross Bookings', value: `$${(totalRevenue / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, change: '', changePositive: true },
      { label: 'Total Riders', value: String(ridersRes.count || 0), change: '', changePositive: true },
    ]

    const STATUS_LABELS = { completed: 'Completed', cancelled: 'Cancelled', requested: 'Requested', pending_driver_response: 'Requested', accepted: 'Active', driver_arrived: 'Active', in_progress: 'Active' }
    {
      recentRides.value = (todayRidesRes.data || []).map(r => ({
        id: r.id,
        rider: r.rider_name || 'Rider',
        pickup: r.pickup_address || 'N/A',
        dropoff: r.dropoff_address || 'N/A',
        fare: r.fare_cents ? (r.fare_cents / 100).toFixed(2) : '0.00',
        status: STATUS_LABELS[r.status] || r.status || 'Unknown',
      }))
    }
  } catch (e) {
    loadError.value = 'Could not load dashboard data. Check that your account has the admin role.'
  }
})
</script>
