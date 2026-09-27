<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { DEMO_MODE } from '../lib/demoMode'
import { formatFare } from '../lib/pricing'

const router = useRouter()
const { user } = useAuth()

const rides = ref([])
const loading = ref(true)

const demoRides = [
  { id: 1, pickup_address: 'Bahamar Resort', fare_cents: 1298, status: 'completed', created_at: '2024-10-20T14:00:00Z' },
  { id: 2, pickup_address: 'Atlantis Paradise Island', fare_cents: 2781, status: 'completed', created_at: '2024-10-14T11:30:00Z' },
  { id: 3, pickup_address: 'Downtown Nassau', fare_cents: 991, status: 'completed', created_at: '2024-09-28T09:15:00Z' },
  { id: 4, pickup_address: 'Cable Beach', fare_cents: 1356, status: 'completed', created_at: '2024-09-12T16:45:00Z' },
  { id: 5, pickup_address: 'LPIA Airport', fare_cents: 1937, status: 'completed', created_at: '2024-08-25T07:00:00Z' },
  { id: 6, pickup_address: 'Fish Fry Arawak Cay', fare_cents: 1774, status: 'completed', created_at: '2024-08-08T19:20:00Z' },
  { id: 7, pickup_address: "Potter's Cay Dock", fare_cents: 1156, status: 'completed', created_at: '2024-07-18T13:10:00Z' },
  { id: 8, pickup_address: 'Fort Charlotte', fare_cents: 2242, status: 'completed', created_at: '2024-07-03T10:45:00Z' },
]

function formatDate(isoString) {
  const d = new Date(isoString)
  const day = d.getDate()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']
  const month = months[d.getMonth()]
  const hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${month}, ${hours}:${minutes}`
}

function monthYearLabel(isoString) {
  const d = new Date(isoString)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']
  return `${months[d.getMonth()]} ${d.getFullYear()}`
}

const ridesByMonth = computed(() => {
  const groups = []
  const map = new Map()

  for (const ride of rides.value) {
    const label = monthYearLabel(ride.created_at)
    if (!map.has(label)) {
      const group = { label, rides: [] }
      map.set(label, group)
      groups.push(group)
    }
    map.get(label).rides.push(ride)
  }

  return groups
})

onMounted(async () => {
  if (DEMO_MODE) {
    rides.value = demoRides
    loading.value = false
    return
  }

  try {
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('rider_id', user.value?.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    rides.value = data || []
  } catch (err) {
    console.error('Failed to fetch rides:', err)
    rides.value = []
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-white text-[#191f1c]">
    <!-- Top Bar -->
    <div class="sticky top-0 z-10 flex items-center bg-white px-4 py-4">
      <button
        class="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-[#191f1c]/5"
        @click="router.back()"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-[#191f1c]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="flex-1 text-center text-xl font-bold text-[#191f1c] font-serif">My rides</h1>
      <div class="w-10"></div>
    </div>

    <!-- Loading Spinner -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <svg class="h-8 w-8 animate-spin text-[#2b8659]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
    </div>

    <!-- Empty State -->
    <div v-else-if="rides.length === 0" class="flex flex-col items-center justify-center px-4 py-20">
      <svg xmlns="http://www.w3.org/2000/svg" class="mb-4 h-16 w-16 text-[#191f1c]/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h.01M12 7h.01M16 7h.01M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
      </svg>
      <p class="text-center text-lg font-semibold text-[#191f1c]/60">No rides yet.</p>
      <p class="mt-1 text-center text-sm text-[#191f1c]/40">Book your first ride!</p>
    </div>

    <!-- Ride Groups -->
    <div v-else class="px-4 pb-4">
      <div v-for="group in ridesByMonth" :key="group.label" class="mb-6">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-[#191f1c]/40">
          {{ group.label }}
        </h2>

        <div
          v-for="ride in group.rides"
          :key="ride.id"
          class="flex items-center justify-between border-b border-[#191f1c]/8 py-4 last:border-b-0"
        >
          <!-- Left: dot + info -->
          <div class="flex items-start gap-3">
            <div class="mt-1.5 h-3 w-3 shrink-0 rounded-full bg-[#2b8659]"></div>
            <div>
              <p class="text-base font-semibold text-[#191f1c]">{{ ride.pickup_address }}</p>
              <p class="mt-0.5 text-sm text-[#191f1c]/40">{{ formatDate(ride.created_at) }}</p>
            </div>
          </div>

          <!-- Right: fare -->
          <span class="text-base font-semibold text-[#191f1c]">{{ formatFare(ride.fare_cents) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
