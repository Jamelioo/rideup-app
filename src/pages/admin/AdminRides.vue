<template>
  <div>
    <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-6">Ride Management</h1>

    <!-- Search + filter tabs -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
      <div class="flex gap-1 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-1">
        <button
          v-for="tab in statusTabs"
          :key="tab"
          @click="activeTab = tab"
          :class="[
            'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
            activeTab === tab
              ? 'bg-[#2b8659] text-white'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]'
          ]"
        >
          {{ tab }}
        </button>
      </div>
      <input
        v-model="search"
        type="text"
        placeholder="Search rides..."
        class="px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[#2b8659]/30 focus:border-[#2b8659] w-full sm:w-64"
      />
    </div>

    <!-- Table -->
    <div class="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-[var(--color-text-muted)] text-xs uppercase tracking-wider bg-[var(--color-surface-secondary)]">
              <th class="px-4 py-3 font-medium cursor-pointer hover:text-[var(--color-text-secondary)]" @click="toggleSort('id')">
                ID <span v-if="sortKey === 'id'" class="text-[var(--color-brand)]">{{ sortDir === 'asc' ? '&#9650;' : '&#9660;' }}</span>
              </th>
              <th class="px-4 py-3 font-medium">Rider</th>
              <th class="px-4 py-3 font-medium">Driver</th>
              <th class="px-4 py-3 font-medium">Pickup</th>
              <th class="px-4 py-3 font-medium">Dropoff</th>
              <th class="px-4 py-3 font-medium cursor-pointer hover:text-[var(--color-text-secondary)]" @click="toggleSort('fare')">
                Fare <span v-if="sortKey === 'fare'" class="text-[var(--color-brand)]">{{ sortDir === 'asc' ? '&#9650;' : '&#9660;' }}</span>
              </th>
              <th class="px-4 py-3 font-medium">Status</th>
              <th class="px-4 py-3 font-medium cursor-pointer hover:text-[var(--color-text-secondary)]" @click="toggleSort('date')">
                Date <span v-if="sortKey === 'date'" class="text-[var(--color-brand)]">{{ sortDir === 'asc' ? '&#9650;' : '&#9660;' }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="ride in paginatedRides"
              :key="ride.id"
              class="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-secondary)] transition-colors"
            >
              <td class="px-4 py-3 text-[var(--color-text-muted)] font-mono text-xs">#{{ ride.id }}</td>
              <td class="px-4 py-3 text-[var(--color-text-primary)] font-medium">{{ ride.rider }}</td>
              <td class="px-4 py-3 text-[var(--color-text-secondary)]">{{ ride.driver }}</td>
              <td class="px-4 py-3 text-[var(--color-text-muted)] truncate max-w-[140px]">{{ ride.pickup }}</td>
              <td class="px-4 py-3 text-[var(--color-text-muted)] truncate max-w-[140px]">{{ ride.dropoff }}</td>
              <td class="px-4 py-3 text-[var(--color-text-primary)] font-medium">{{ ride.fare }}</td>
              <td class="px-4 py-3">
                <span :class="statusBadge(ride.status)">{{ ride.status }}</span>
              </td>
              <td class="px-4 py-3 text-[var(--color-text-muted)] text-xs">{{ ride.date }}</td>
            </tr>
            <tr v-if="paginatedRides.length === 0">
              <td colspan="8" class="px-4 py-8 text-center text-[var(--color-text-muted)]">No rides found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
        <span class="text-xs text-[var(--color-text-muted)]">
          Showing {{ ((currentPage - 1) * perPage) + 1 }}–{{ Math.min(currentPage * perPage, filteredRides.length) }} of {{ filteredRides.length }}
        </span>
        <div class="flex gap-1">
          <button
            v-for="p in totalPages"
            :key="p"
            @click="currentPage = p"
            :class="[
              'w-8 h-8 text-xs font-medium rounded-lg transition-colors',
              currentPage === p
                ? 'bg-[#2b8659] text-white'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-secondary)]'
            ]"
          >
            {{ p }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'

const statusTabs = ['All', 'Requested', 'Active', 'Completed', 'Cancelled']
const activeTab = ref('All')
const search = ref('')
const currentPage = ref(1)
const perPage = 10
const sortKey = ref('id')
const sortDir = ref('desc')

const allRides = ref([])

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
  if (activeTab.value !== 'All') {
    rides = rides.filter(r => r.status === activeTab.value)
  }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    rides = rides.filter(r =>
      r.rider.toLowerCase().includes(q) ||
      r.driver.toLowerCase().includes(q) ||
      r.pickup.toLowerCase().includes(q) ||
      r.dropoff.toLowerCase().includes(q)
    )
  }
  rides = [...rides].sort((a, b) => {
    let av = a[sortKey.value], bv = b[sortKey.value]
    if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase() }
    if (av < bv) return sortDir.value === 'asc' ? -1 : 1
    if (av > bv) return sortDir.value === 'asc' ? 1 : -1
    return 0
  })
  return rides
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRides.value.length / perPage)))
const paginatedRides = computed(() => {
  const start = (currentPage.value - 1) * perPage
  return filteredRides.value.slice(start, start + perPage)
})

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
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (!error && data) {
      allRides.value = data.map(r => ({
        id: r.id,
        rider: r.rider_name || 'Rider',
        driver: r.driver_name || 'Unassigned',
        pickup: r.pickup_address || 'N/A',
        dropoff: r.dropoff_address || 'N/A',
        fare: r.fare_cents ? `$${(r.fare_cents / 100).toFixed(2)}` : '$0.00',
        status: r.status || 'unknown',
        date: r.created_at ? new Date(r.created_at).toLocaleDateString() : '-',
      }))
    }
  } catch (e) { /* keep empty */ }
})
</script>
