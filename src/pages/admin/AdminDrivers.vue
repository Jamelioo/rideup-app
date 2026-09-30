<template>
  <div>
    <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-6">Driver Management</h1>

    <!-- Filter tabs -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
      <div class="flex gap-1 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-1 overflow-x-auto">
        <button
          v-for="tab in filterTabs"
          :key="tab"
          @click="activeFilter = tab"
          :class="[
            'px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap',
            activeFilter === tab
              ? 'bg-[#2b8659] text-white'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]'
          ]"
        >
          {{ tab }}
          <span v-if="tab === 'Pending' && pendingCount > 0" class="ml-1 bg-yellow-400 text-yellow-900 text-xs px-1.5 py-0.5 rounded-full">
            {{ pendingCount }}
          </span>
        </button>
      </div>
      <input
        v-model="search"
        type="text"
        placeholder="Search drivers..."
        class="px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[#2b8659]/30 focus:border-[#2b8659] w-full sm:w-64"
      />
    </div>

    <!-- Table -->
    <div class="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-[var(--color-text-muted)] text-xs uppercase tracking-wider bg-[var(--color-surface-secondary)]">
              <th class="px-4 py-3 font-medium">Name</th>
              <th class="px-4 py-3 font-medium">Vehicle</th>
              <th class="px-4 py-3 font-medium">Status</th>
              <th class="px-4 py-3 font-medium">Rating</th>
              <th class="px-4 py-3 font-medium">Rides</th>
              <th class="px-4 py-3 font-medium">Earnings</th>
              <th class="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="driver in filteredDrivers"
              :key="driver.id"
              :class="[
                'border-t border-[var(--color-border)] transition-colors',
                driver.status === 'Pending' ? 'bg-yellow-50/40 hover:bg-yellow-50/70' : 'hover:bg-[var(--color-surface-secondary)]'
              ]"
            >
              <td class="px-4 py-3 text-[var(--color-text-primary)] font-medium">{{ driver.name }}</td>
              <td class="px-4 py-3 text-[var(--color-text-muted)]">{{ driver.vehicle }}</td>
              <td class="px-4 py-3">
                <span :class="driverStatusBadge(driver.status)">{{ driver.status }}</span>
              </td>
              <td class="px-4 py-3 text-[var(--color-text-primary)]">{{ driver.rating > 0 ? driver.rating.toFixed(1) : '--' }}</td>
              <td class="px-4 py-3 text-[var(--color-text-primary)]">{{ driver.rides }}</td>
              <td class="px-4 py-3 text-[var(--color-text-primary)] font-medium">${{ (driver.earnings || 0).toLocaleString() }}</td>
              <td class="px-4 py-3">
                <div class="flex gap-2" v-if="driver.status === 'Pending'">
                  <button
                    @click="approveDriver(driver)"
                    class="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#2b8659] text-white hover:bg-[#236e49] transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    @click="rejectDriver(driver)"
                    class="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                  >
                    Reject
                  </button>
                </div>
                <button
                  v-else-if="driver.status === 'Approved'"
                  @click="suspendDriver(driver)"
                  class="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                >
                  Suspend
                </button>
                <button
                  v-else-if="driver.status === 'Suspended'"
                  @click="reinstateDriver(driver)"
                  class="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-50 text-[#2b8659] hover:bg-green-100 transition-colors"
                >
                  Reinstate
                </button>
                <span v-else class="text-xs text-[var(--color-text-muted)]">--</span>
              </td>
            </tr>
            <tr v-if="filteredDrivers.length === 0">
              <td colspan="7" class="px-4 py-8 text-center text-[var(--color-text-muted)]">No drivers found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { apiPost } from '../../lib/api'

const filterTabs = ['All', 'Pending', 'Approved', 'Rejected', 'Suspended']
const activeFilter = ref('All')
const search = ref('')

const drivers = ref([
  { id: 1, name: 'Deon Rolle', vehicle: '2024 Toyota Camry — White', status: 'Approved', rating: 4.9, rides: 312, earnings: 18450 },
  { id: 2, name: 'Kevin Stuart', vehicle: '2023 Honda Accord — Silver', status: 'Approved', rating: 4.7, rides: 245, earnings: 14200 },
  { id: 3, name: 'Andre Bain', vehicle: '2024 Nissan Altima — Black', status: 'Approved', rating: 4.8, rides: 189, earnings: 11300 },
  { id: 4, name: 'Michael Johnson', vehicle: '2022 Hyundai Elantra — Grey', status: 'Approved', rating: 4.6, rides: 156, earnings: 9800 },
  { id: 5, name: 'Terrence Knowles', vehicle: '2025 Kia K5 — Blue', status: 'Pending', rating: 0, rides: 0, earnings: 0 },
  { id: 6, name: 'Sandra Pinder', vehicle: '2024 Toyota Corolla — Red', status: 'Pending', rating: 0, rides: 0, earnings: 0 },
  { id: 7, name: 'Wayne Miller', vehicle: '2023 Chevrolet Malibu — White', status: 'Pending', rating: 0, rides: 0, earnings: 0 },
  { id: 8, name: 'Bridget Cooper', vehicle: '2022 Honda Civic — Black', status: 'Rejected', rating: 0, rides: 0, earnings: 0 },
  { id: 9, name: 'Lionel Forbes', vehicle: '2021 Nissan Sentra — Silver', status: 'Suspended', rating: 3.1, rides: 42, earnings: 2100 },
  { id: 10, name: 'Carmen Lightbourne', vehicle: '2024 Hyundai Sonata — White', status: 'Approved', rating: 4.5, rides: 78, earnings: 4650 },
])

const pendingCount = computed(() => drivers.value.filter(d => d.status === 'Pending').length)

const filteredDrivers = computed(() => {
  let list = drivers.value
  if (activeFilter.value !== 'All') {
    list = list.filter(d => d.status === activeFilter.value)
  }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.vehicle.toLowerCase().includes(q)
    )
  }
  return list
})

async function approveDriver(driver) {
  if (supabaseConfigured) {
    const { error } = await supabase.from('drivers').update({ approved: true, status: 'approved' }).eq('id', driver.id)
    if (error) { console.error('Approve error:', error.message); return }
    // Send approval notification (fire-and-forget)
    apiPost('/api/notify-driver', { driverId: driver.id, type: 'approved' }).catch(() => {})
  }
  driver.status = 'Approved'
}

async function rejectDriver(driver) {
  if (supabaseConfigured) {
    const { error } = await supabase.from('drivers').update({ approved: false, status: 'rejected' }).eq('id', driver.id)
    if (error) { console.error('Reject error:', error.message); return }
    apiPost('/api/notify-driver', { driverId: driver.id, type: 'rejected' }).catch(() => {})
  }
  driver.status = 'Rejected'
}

async function suspendDriver(driver) {
  if (supabaseConfigured) {
    const { error } = await supabase.from('drivers').update({ approved: false, status: 'suspended' }).eq('id', driver.id)
    if (error) { console.error('Suspend error:', error.message); return }
  }
  driver.status = 'Suspended'
}

async function reinstateDriver(driver) {
  if (supabaseConfigured) {
    const { error } = await supabase.from('drivers').update({ approved: true, status: 'approved' }).eq('id', driver.id)
    if (error) { console.error('Reinstate error:', error.message); return }
  }
  driver.status = 'Approved'
}

function driverStatusBadge(status) {
  const base = 'text-xs font-medium px-2 py-0.5 rounded-full'
  switch (status) {
    case 'Approved': return `${base} bg-green-50 text-green-700`
    case 'Pending': return `${base} bg-yellow-50 text-yellow-700`
    case 'Rejected': return `${base} bg-red-50 text-red-700`
    case 'Suspended': return `${base} bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]`
    default: return `${base} bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]`
  }
}

onMounted(async () => {
  if (!supabaseConfigured) return
  try {
    const { data, error } = await supabase.from('drivers').select('*').order('created_at', { ascending: false })
    if (!error && data && data.length > 0) {
      drivers.value = data.map((d, i) => ({
        id: d.id || i,
        name: d.name || d.full_name || 'Unknown',
        vehicle: `${d.vehicle_year || ''} ${d.vehicle_make || ''} ${d.vehicle_model || ''} — ${d.vehicle_color || ''}`.trim() || 'N/A',
        status: d.approved ? 'Approved' : d.rejected ? 'Rejected' : d.suspended ? 'Suspended' : 'Pending',
        rating: d.rating || 0,
        rides: d.total_rides || 0,
        earnings: d.total_earnings || 0,
      }))
    }
  } catch (e) { /* keep placeholder data */ }
})
</script>
