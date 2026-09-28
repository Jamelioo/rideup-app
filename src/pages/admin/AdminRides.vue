<template>
  <div>
    <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-6">Ride Management</h1>

    <!-- Search + filter tabs -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
      <div class="flex gap-1 bg-[var(--color-surface)] rounded-lg border border-gray-200 p-1">
        <button
          v-for="tab in statusTabs"
          :key="tab"
          @click="activeTab = tab"
          :class="[
            'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
            activeTab === tab
              ? 'bg-[#2b8659] text-white'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          ]"
        >
          {{ tab }}
        </button>
      </div>
      <input
        v-model="search"
        type="text"
        placeholder="Search rides..."
        class="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[#2b8659]/30 focus:border-[#2b8659] w-full sm:w-64"
      />
    </div>

    <!-- Table -->
    <div class="bg-[var(--color-surface)] rounded-xl border border-gray-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-gray-400 text-xs uppercase tracking-wider bg-gray-50/50">
              <th class="px-4 py-3 font-medium cursor-pointer hover:text-gray-600" @click="toggleSort('id')">
                ID <span v-if="sortKey === 'id'" class="text-[#2b8659]">{{ sortDir === 'asc' ? '&#9650;' : '&#9660;' }}</span>
              </th>
              <th class="px-4 py-3 font-medium">Rider</th>
              <th class="px-4 py-3 font-medium">Driver</th>
              <th class="px-4 py-3 font-medium">Pickup</th>
              <th class="px-4 py-3 font-medium">Dropoff</th>
              <th class="px-4 py-3 font-medium cursor-pointer hover:text-gray-600" @click="toggleSort('fare')">
                Fare <span v-if="sortKey === 'fare'" class="text-[#2b8659]">{{ sortDir === 'asc' ? '&#9650;' : '&#9660;' }}</span>
              </th>
              <th class="px-4 py-3 font-medium">Status</th>
              <th class="px-4 py-3 font-medium cursor-pointer hover:text-gray-600" @click="toggleSort('date')">
                Date <span v-if="sortKey === 'date'" class="text-[#2b8659]">{{ sortDir === 'asc' ? '&#9650;' : '&#9660;' }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="ride in paginatedRides"
              :key="ride.id"
              class="border-t border-gray-100 hover:bg-gray-50/50 transition-colors"
            >
              <td class="px-4 py-3 text-gray-400 font-mono text-xs">#{{ ride.id }}</td>
              <td class="px-4 py-3 text-[var(--color-text-primary)] font-medium">{{ ride.rider }}</td>
              <td class="px-4 py-3 text-gray-600">{{ ride.driver }}</td>
              <td class="px-4 py-3 text-gray-500 truncate max-w-[140px]">{{ ride.pickup }}</td>
              <td class="px-4 py-3 text-gray-500 truncate max-w-[140px]">{{ ride.dropoff }}</td>
              <td class="px-4 py-3 text-[var(--color-text-primary)] font-medium">${{ ride.fare.toFixed(2) }}</td>
              <td class="px-4 py-3">
                <span :class="statusBadge(ride.status)">{{ ride.status }}</span>
              </td>
              <td class="px-4 py-3 text-gray-400 text-xs">{{ ride.date }}</td>
            </tr>
            <tr v-if="paginatedRides.length === 0">
              <td colspan="8" class="px-4 py-8 text-center text-gray-400">No rides found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/30">
        <span class="text-xs text-gray-400">
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
                : 'text-gray-500 hover:bg-gray-100'
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

const allRides = ref([
  { id: 1042, rider: 'Marcus Thompson', driver: 'Deon Rolle', pickup: 'Atlantis Resort', dropoff: 'Downtown Nassau', fare: 28.50, status: 'Completed', date: '2026-09-27' },
  { id: 1041, rider: 'Shania Williams', driver: 'Kevin Stuart', pickup: 'Cable Beach', dropoff: 'PI Airport', fare: 35.00, status: 'Active', date: '2026-09-27' },
  { id: 1040, rider: 'Devon Clarke', driver: 'Andre Bain', pickup: 'Bay Street', dropoff: 'Paradise Island', fare: 22.00, status: 'Completed', date: '2026-09-27' },
  { id: 1039, rider: 'Tanya Rolle', driver: 'Michael Johnson', pickup: 'Nassau Harbour', dropoff: 'Cable Beach', fare: 18.75, status: 'Completed', date: '2026-09-27' },
  { id: 1038, rider: 'James Mitchell', driver: 'Deon Rolle', pickup: 'PI Airport', dropoff: 'Atlantis Resort', fare: 15.00, status: 'Cancelled', date: '2026-09-27' },
  { id: 1037, rider: 'Crystal Johnson', driver: 'Kevin Stuart', pickup: 'Montagu Beach', dropoff: 'Fish Fry', fare: 12.50, status: 'Completed', date: '2026-09-26' },
  { id: 1036, rider: 'Andre Davis', driver: 'Unassigned', pickup: 'Baha Mar', dropoff: 'Downtown Nassau', fare: 24.00, status: 'Requested', date: '2026-09-26' },
  { id: 1035, rider: 'Lisa Ferguson', driver: 'Andre Bain', pickup: 'Junkanoo Beach', dropoff: 'Cable Beach', fare: 19.00, status: 'Completed', date: '2026-09-26' },
  { id: 1034, rider: 'Robert Sands', driver: 'Michael Johnson', pickup: 'Fort Charlotte', dropoff: 'PI Airport', fare: 32.00, status: 'Active', date: '2026-09-26' },
  { id: 1033, rider: 'Keisha Brown', driver: 'Deon Rolle', pickup: 'Potter\'s Cay', dropoff: 'Atlantis Resort', fare: 16.50, status: 'Completed', date: '2026-09-26' },
  { id: 1032, rider: 'Troy Cartwright', driver: 'Kevin Stuart', pickup: 'Rawson Square', dropoff: 'Cable Beach', fare: 21.00, status: 'Completed', date: '2026-09-25' },
  { id: 1031, rider: 'Vanessa Moss', driver: 'Andre Bain', pickup: 'Baha Mar', dropoff: 'Bay Street', fare: 14.50, status: 'Completed', date: '2026-09-25' },
  { id: 1030, rider: 'Calvin Knowles', driver: 'Unassigned', pickup: 'PI Airport', dropoff: 'Baha Mar', fare: 38.00, status: 'Requested', date: '2026-09-25' },
  { id: 1029, rider: 'Brittany Forbes', driver: 'Michael Johnson', pickup: 'Cable Beach', dropoff: 'Downtown Nassau', fare: 17.25, status: 'Cancelled', date: '2026-09-25' },
  { id: 1028, rider: 'Rashad Taylor', driver: 'Deon Rolle', pickup: 'Atlantis Resort', dropoff: 'PI Airport', fare: 29.00, status: 'Completed', date: '2026-09-24' },
  { id: 1027, rider: 'Simone Grant', driver: 'Kevin Stuart', pickup: 'Fish Fry', dropoff: 'Paradise Island', fare: 26.00, status: 'Completed', date: '2026-09-24' },
  { id: 1026, rider: 'Darren Lightfoot', driver: 'Andre Bain', pickup: 'Nassau Harbour', dropoff: 'Montagu Beach', fare: 11.50, status: 'Completed', date: '2026-09-24' },
  { id: 1025, rider: 'Nicole Symonette', driver: 'Michael Johnson', pickup: 'Rawson Square', dropoff: 'Baha Mar', fare: 23.75, status: 'Completed', date: '2026-09-23' },
  { id: 1024, rider: 'Jerome Hall', driver: 'Deon Rolle', pickup: 'Cable Beach', dropoff: 'Fort Charlotte', fare: 13.00, status: 'Cancelled', date: '2026-09-23' },
  { id: 1023, rider: 'Latoya Archer', driver: 'Kevin Stuart', pickup: 'Downtown Nassau', dropoff: 'Atlantis Resort', fare: 27.50, status: 'Completed', date: '2026-09-23' },
  { id: 1022, rider: 'Patrick Russell', driver: 'Andre Bain', pickup: 'PI Airport', dropoff: 'Cable Beach', fare: 31.00, status: 'Completed', date: '2026-09-22' },
  { id: 1021, rider: 'Tamara Pratt', driver: 'Unassigned', pickup: 'Baha Mar', dropoff: 'Fish Fry', fare: 20.00, status: 'Requested', date: '2026-09-22' },
])

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
    default: return `${base} bg-gray-50 text-gray-700`
  }
}

onMounted(async () => {
  if (!supabaseConfigured) return
  try {
    const { data, error } = await supabase.from('rides').select('*').order('created_at', { ascending: false }).limit(50)
    if (!error && data && data.length > 0) {
      allRides.value = data.map((r, i) => ({
        id: r.id || 1000 + i,
        rider: r.rider_name || 'Unknown',
        driver: r.driver_name || 'Unassigned',
        pickup: r.pickup_address || 'N/A',
        dropoff: r.dropoff_address || 'N/A',
        fare: r.fare || 0,
        status: r.status || 'Unknown',
        date: r.created_at ? r.created_at.split('T')[0] : 'N/A',
      }))
    }
  } catch (e) { /* keep placeholder data */ }
})
</script>
