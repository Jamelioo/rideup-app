<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">Ride Management</h1>
      <button v-if="isAdmin" @click="exportCsv" :disabled="!filteredRides.length" class="h-10 px-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-semibold disabled:opacity-50">
        Download CSV ({{ filteredRides.length }})
      </button>
    </div>

    <!-- Search + filter tabs -->
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
      <div class="flex flex-wrap gap-1 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-1">
        <button
          v-for="tab in statusTabs"
          :key="tab"
          @click="activeTab = tab; currentPage = 1"
          :aria-pressed="activeTab === tab"
          :class="[
            'px-3.5 py-2 min-w-[44px] text-sm font-medium rounded-md transition-colors',
            activeTab === tab
              ? 'bg-[#2b8659] text-white'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]'
          ]"
        >
          {{ tab }}
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <label class="text-sm text-[var(--color-text-muted)] flex items-center gap-1">From
          <input v-model="fromDate" type="date" @change="load" class="px-2 py-1.5 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)]" />
        </label>
        <label class="text-sm text-[var(--color-text-muted)] flex items-center gap-1">To
          <input v-model="toDate" type="date" @change="load" class="px-2 py-1.5 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)]" />
        </label>
        <input
          v-model="search"
          @input="currentPage = 1"
          type="search"
          placeholder="Search rides…"
          aria-label="Search rides"
          class="px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[#2b8659]/30 focus:border-[#2b8659] w-full sm:w-56"
        />
      </div>
    </div>
    <p v-if="truncated" class="mb-3 text-xs text-[var(--color-text-muted)]">Showing the latest {{ LIMIT }} rides in these dates. Narrow the dates to see older ones.</p>

    <!-- Table -->
    <div class="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm stack-table">
          <thead>
            <tr class="text-left text-[var(--color-text-muted)] text-xs uppercase tracking-wider bg-[var(--color-surface-secondary)]">
              <th class="px-2 py-1 font-medium" :aria-sort="sortKey === 'date' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'">
                <button type="button" class="inline-flex items-center gap-1 px-2 py-2 min-h-[44px] uppercase tracking-wider hover:text-[var(--color-text-secondary)]" @click="toggleSort('date')">
                  When <span v-if="sortKey === 'date'" class="text-[var(--color-brand)]" aria-hidden="true">{{ sortDir === 'asc' ? '&#9650;' : '&#9660;' }}</span>
                </button>
              </th>
              <th class="px-4 py-3 font-medium">Rider</th>
              <th class="px-4 py-3 font-medium">Driver</th>
              <th class="px-4 py-3 font-medium">Pickup</th>
              <th class="px-4 py-3 font-medium">Drop-off</th>
              <th class="px-2 py-1 font-medium" :aria-sort="sortKey === 'fare' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'">
                <button type="button" class="inline-flex items-center gap-1 px-2 py-2 min-h-[44px] uppercase tracking-wider hover:text-[var(--color-text-secondary)]" @click="toggleSort('fare')">
                  Fare <span v-if="sortKey === 'fare'" class="text-[var(--color-brand)]" aria-hidden="true">{{ sortDir === 'asc' ? '&#9650;' : '&#9660;' }}</span>
                </button>
              </th>
              <th class="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="ride in paginatedRides"
              :key="ride.id"
              class="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-secondary)] transition-colors cursor-pointer"
              tabindex="0" @click="selected = ride.raw" @keydown.enter="selected = ride.raw"
            >
              <td data-label="When" class="px-4 py-3 text-[var(--color-text-muted)] text-xs whitespace-nowrap">{{ ride.when }}</td>
              <td data-label="Rider" class="px-4 py-3 text-[var(--color-text-primary)] font-medium">{{ ride.rider }}</td>
              <td data-label="Driver" class="px-4 py-3 text-[var(--color-text-secondary)]">{{ ride.driver }}</td>
              <td data-label="Pickup" class="px-4 py-3 text-[var(--color-text-muted)] truncate max-w-[160px]">{{ ride.pickup }}</td>
              <td data-label="Drop-off" class="px-4 py-3 text-[var(--color-text-muted)] truncate max-w-[160px]">{{ ride.dropoff }}</td>
              <td data-label="Fare" class="px-4 py-3 text-[var(--color-text-primary)] font-medium">{{ formatFare(ride.fare) }}</td>
              <td data-label="Status" class="px-4 py-3">
                <span :class="statusBadge(ride.group)">{{ ride.statusLabel }}</span>
              </td>
            </tr>
            <tr v-if="paginatedRides.length === 0">
              <td colspan="7" class="px-4 py-8 text-center text-[var(--color-text-muted)]">{{ loading ? 'Loading…' : 'No rides found.' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="filteredRides.length > perPage" class="flex items-center justify-between gap-3 px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
        <span class="text-xs text-[var(--color-text-muted)]">
          {{ ((currentPage - 1) * perPage) + 1 }}–{{ Math.min(currentPage * perPage, filteredRides.length) }} of {{ filteredRides.length }}
        </span>
        <div class="flex gap-2">
          <button @click="currentPage--" :disabled="currentPage === 1" class="h-9 px-3 text-sm font-medium rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] disabled:opacity-40">Previous</button>
          <button @click="currentPage++" :disabled="currentPage === totalPages" class="h-9 px-3 text-sm font-medium rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
    <AdminRideSheet :ride="selected" @close="selected = null" @changed="reloadSelected" />
  </div>
</template>

<script setup>
import AdminRideSheet from '../../components/AdminRideSheet.vue'
import { ref, computed, onMounted } from 'vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { formatFare } from '../../lib/pricing'
import { toCsv, downloadCsv, dollars, nassauDate } from '../../lib/csv'
import { useStaffRole } from '../../lib/staff'
import { nassauYmd, nassauMidnight } from '../../lib/nassauTime'

const { isAdmin } = useStaffRole()
const LIMIT = 1000
const statusTabs = ['All', 'Waiting', 'Active', 'Completed', 'Cancelled']
// Database status → tab and label.
const GROUP = { requested: 'Waiting', pending_driver_response: 'Active', accepted: 'Active', driver_arrived: 'Active', in_progress: 'Active', completed: 'Completed', cancelled: 'Cancelled' }
const LABEL = {
  requested: 'Waiting for driver', pending_driver_response: 'Holding card', accepted: 'Driver on the way',
  driver_arrived: 'Driver at pickup', in_progress: 'On trip', completed: 'Completed', cancelled: 'Cancelled',
}
const CANCEL_REASON = {
  no_drivers: 'no driver', rider_cancelled: 'by rider', driver_cancelled: 'by driver', rider_no_show: 'rider no-show',
  admin_cancelled: 'by RideUp', payment_failed: 'card failed',
}

const activeTab = ref('All')
const search = ref('')
const currentPage = ref(1)
const perPage = 20
const sortKey = ref('date')
const sortDir = ref('desc')
const fromDate = ref(nassauYmd(new Date(Date.now() - 30 * 86_400_000)))
const toDate = ref(nassauYmd())
const loading = ref(false)
const truncated = ref(false)

const allRides = ref([])
const selected = ref(null) // ride open in the details panel

function toggleSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'desc'
  }
}

const filteredRides = computed(() => {
  let rides = allRides.value
  if (activeTab.value !== 'All') rides = rides.filter((r) => r.group === activeTab.value)
  const q = search.value.trim().toLowerCase()
  if (q) {
    rides = rides.filter((r) =>
      r.rider.toLowerCase().includes(q) ||
      r.driver.toLowerCase().includes(q) ||
      r.pickup.toLowerCase().includes(q) ||
      r.dropoff.toLowerCase().includes(q) ||
      r.id.startsWith(q)
    )
  }
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...rides].sort((a, b) => (a[sortKey.value] < b[sortKey.value] ? -dir : a[sortKey.value] > b[sortKey.value] ? dir : 0))
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRides.value.length / perPage)))
const paginatedRides = computed(() => {
  const start = (currentPage.value - 1) * perPage
  return filteredRides.value.slice(start, start + perPage)
})

function statusBadge(group) {
  const base = 'text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap'
  switch (group) {
    case 'Completed': return `${base} bg-green-50 text-green-700`
    case 'Active': return `${base} bg-yellow-50 text-yellow-700`
    case 'Cancelled': return `${base} bg-red-50 text-red-700`
    case 'Waiting': return `${base} bg-blue-50 text-blue-700`
    default: return `${base} bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]`
  }
}

async function load() {
  if (!supabaseConfigured) return
  loading.value = true
  const { data, error } = await supabase
    .from('rides')
    .select('*, riders:rider_id(name, phone, email), drivers:driver_id(name, phone)')
    .gte('created_at', nassauMidnight(fromDate.value))
    .lt('created_at', nassauMidnight(toDate.value, 1))
    .order('created_at', { ascending: false })
    .limit(LIMIT)
  loading.value = false
  if (error || !data) return
  truncated.value = data.length === LIMIT
  allRides.value = data.map((r) => ({
    id: r.id,
    rider: r.riders?.name || r.rider_name || 'Rider',
    driver: r.drivers?.name || (r.status === 'requested' ? 'Waiting' : '—'),
    pickup: r.pickup_address || 'N/A',
    dropoff: r.dropoff_address || 'N/A',
    fare: r.fare_cents || 0,
    group: GROUP[r.status] || 'Other',
    statusLabel: r.status === 'cancelled' && CANCEL_REASON[r.cancel_reason] ? `Cancelled · ${CANCEL_REASON[r.cancel_reason]}` : LABEL[r.status] || r.status,
    date: r.created_at || '',
    when: r.created_at ? new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-',
    raw: r,
  }))
  currentPage.value = Math.min(currentPage.value, totalPages.value)
}

async function reloadSelected() {
  const id = selected.value?.id
  await load()
  if (id) selected.value = allRides.value.find((r) => r.id === id)?.raw || null
}

function exportCsv() {
  const csv = toCsv(filteredRides.value.map((r) => r.raw), [
    { label: 'Ride ID', value: (r) => r.id },
    { label: 'Requested (Nassau)', value: (r) => nassauDate(r.created_at) },
    { label: 'Completed (Nassau)', value: (r) => nassauDate(r.completed_at) },
    { label: 'Status', value: (r) => r.status },
    { label: 'Cancel reason', value: (r) => r.cancel_reason || '' },
    { label: 'Rider', value: (r) => r.riders?.name || r.rider_name || '' },
    { label: 'Rider email', value: (r) => r.riders?.email || '' },
    { label: 'Driver', value: (r) => r.drivers?.name || '' },
    { label: 'Pickup', value: (r) => r.pickup_address || '' },
    { label: 'Drop-off', value: (r) => r.dropoff_address || '' },
    { label: 'Type', value: (r) => r.vehicle_type || 'standard' },
    { label: 'Miles', value: (r) => r.distance_miles ?? '' },
    { label: 'Fare', value: (r) => dollars(r.fare_cents) },
    { label: 'Booking fee', value: (r) => dollars(r.booking_fee_cents) },
    { label: 'Airport fee', value: (r) => dollars(r.airport_fee_cents) },
    { label: 'Promo', value: (r) => r.promo_code || '' },
    { label: 'Promo discount', value: (r) => dollars(r.promo_discount_cents) },
    { label: 'Credit used', value: (r) => dollars(r.credit_applied_cents) },
    { label: 'Cancellation fee', value: (r) => dollars(r.cancel_fee_cents) },
    { label: 'Tip', value: (r) => dollars(r.tip_payment_intent_id ? r.tip_cents : 0) },
    { label: 'Driver earns', value: (r) => dollars(r.driver_payout_cents) },
    { label: 'RideUp keeps', value: (r) => dollars(r.platform_fee_cents) },
    { label: 'Payment', value: (r) => r.payment_status || '' },
  ])
  downloadCsv(`rideup-rides-${fromDate.value}-to-${toDate.value}.csv`, csv)
}

onMounted(load)
</script>
