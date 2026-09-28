<script>
export default { name: 'ScheduledRides' }
</script>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../../lib/supabase'
import { formatFare, VEHICLE_TYPES } from '../../lib/pricing'
import { DEMO_MODE } from '../../lib/demoMode'

const router = useRouter()
const rides = ref([])
const loading = ref(true)
const error = ref(null)
const cancellingId = ref(null)
const showCancelConfirm = ref(null)

const now = new Date()

const upcomingRides = computed(() =>
  rides.value.filter(r => new Date(r.scheduled_at) >= now && r.status !== 'cancelled')
)

const pastRides = computed(() =>
  rides.value.filter(r => new Date(r.scheduled_at) < now || r.status === 'cancelled')
)

function getVehicleName(type) {
  return VEHICLE_TYPES.find(v => v.id === type)?.name || type
}

function getVehicleIcon(type) {
  return VEHICLE_TYPES.find(v => v.id === type)?.icon || ''
}

function formatDateTime(isoString) {
  const d = new Date(isoString)
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }) + ' at ' + d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

async function fetchScheduledRides() {
  loading.value = true
  error.value = null

  if (DEMO_MODE) {
    rides.value = []
    loading.value = false
    return
  }

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      error.value = 'Please log in to view scheduled rides.'
      loading.value = false
      return
    }

    const { data: rider } = await supabase
      .from('riders')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!rider) {
      error.value = 'Could not find your rider profile.'
      loading.value = false
      return
    }

    const { data, error: fetchErr } = await supabase
      .from('scheduled_rides')
      .select('*')
      .eq('rider_id', rider.id)
      .order('scheduled_at', { ascending: true })

    if (fetchErr) throw fetchErr
    rides.value = data || []
  } catch (err) {
    error.value = 'Could not load scheduled rides. Please try again.'
  } finally {
    loading.value = false
  }
}

async function cancelRide(id) {
  cancellingId.value = id
  try {
    const { error: cancelErr } = await supabase
      .from('scheduled_rides')
      .update({ status: 'cancelled' })
      .eq('id', id)

    if (cancelErr) throw cancelErr

    const ride = rides.value.find(r => r.id === id)
    if (ride) ride.status = 'cancelled'
  } catch (err) {
    error.value = 'Could not cancel ride. Please try again.'
  } finally {
    cancellingId.value = null
    showCancelConfirm.value = null
  }
}

onMounted(fetchScheduledRides)
</script>

<template>
  <div class="min-h-screen bg-[#f0fdf4]">
    <!-- Header -->
    <div class="bg-white border-b border-[#191f1c]/8">
      <div class="max-w-lg mx-auto px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4 flex items-center gap-3">
        <button @click="router.back()" class="w-10 h-10 rounded-full hover:bg-[#191f1c]/5 flex items-center justify-center transition-colors -ml-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#191f1c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 class="text-[20px] font-bold text-[#191f1c] tracking-tight">Scheduled rides</h1>
      </div>
    </div>

    <div class="max-w-lg mx-auto px-5 py-6">
      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <span class="w-6 h-6 border-2 border-[#191f1c]/10 border-t-[#2b8659] rounded-full animate-spin"></span>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-xl px-4 py-3">
        {{ error }}
      </div>

      <!-- Empty state -->
      <div v-else-if="rides.length === 0" class="text-center py-20">
        <div class="w-16 h-16 rounded-full bg-[#2b8659]/10 flex items-center justify-center mx-auto mb-4">
          <svg class="w-7 h-7 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p class="text-[17px] font-bold text-[#191f1c]">No scheduled rides</p>
        <p class="text-[14px] text-[#191f1c]/50 mt-1">Schedule a ride from the booking screen</p>
        <button @click="router.push('/book')" class="mt-5 px-6 py-3 bg-[#2b8659] text-white font-semibold rounded-xl text-[14px] active:scale-[0.98] transition-transform">
          Book a ride
        </button>
      </div>

      <template v-else>
        <!-- Upcoming rides -->
        <div v-if="upcomingRides.length > 0">
          <p class="text-[11px] font-semibold text-[#191f1c]/40 uppercase tracking-wider mb-3 px-1">Upcoming</p>
          <div class="space-y-3">
            <div v-for="ride in upcomingRides" :key="ride.id" class="bg-white rounded-2xl p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-2.5">
                  <div class="w-10 h-10 rounded-xl bg-[#2b8659]/10 flex items-center justify-center text-base">
                    {{ getVehicleIcon(ride.vehicle_type) }}
                  </div>
                  <div>
                    <p class="text-[14px] font-bold text-[#191f1c]">{{ getVehicleName(ride.vehicle_type) }}</p>
                    <p class="text-[12px] text-[#2b8659] font-semibold">{{ formatDateTime(ride.scheduled_at) }}</p>
                  </div>
                </div>
                <span class="text-[16px] font-bold text-[#191f1c]">{{ formatFare(ride.fare_cents) }}</span>
              </div>

              <div class="flex gap-2.5 ml-0.5">
                <div class="flex flex-col items-center pt-1 gap-0">
                  <div class="w-[8px] h-[8px] rounded-full border-2 border-[#2b8659] bg-white flex-shrink-0"></div>
                  <div class="w-[1.5px] flex-1 my-0.5 bg-[#191f1c]/10 rounded-full min-h-[16px]"></div>
                  <div class="w-[8px] h-[8px] rounded-[2px] bg-[#191f1c] flex-shrink-0"></div>
                </div>
                <div class="flex-1 space-y-2">
                  <p class="text-[13px] text-[#191f1c]/70 leading-tight">{{ ride.pickup_address }}</p>
                  <p class="text-[13px] text-[#191f1c]/70 leading-tight">{{ ride.dropoff_address }}</p>
                </div>
              </div>

              <div class="mt-3 pt-3 border-t border-[#191f1c]/6">
                <button
                  v-if="showCancelConfirm !== ride.id"
                  @click="showCancelConfirm = ride.id"
                  class="text-[13px] font-semibold text-red-500 active:text-red-700 transition-colors"
                >
                  Cancel ride
                </button>
                <div v-else class="flex items-center gap-3">
                  <span class="text-[13px] text-[#191f1c]/60">Cancel this ride?</span>
                  <button
                    @click="cancelRide(ride.id)"
                    :disabled="cancellingId === ride.id"
                    class="text-[13px] font-bold text-red-500 disabled:text-red-300"
                  >
                    {{ cancellingId === ride.id ? 'Cancelling...' : 'Yes, cancel' }}
                  </button>
                  <button @click="showCancelConfirm = null" class="text-[13px] font-semibold text-[#191f1c]/50">
                    Keep
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Past rides -->
        <div v-if="pastRides.length > 0" :class="upcomingRides.length > 0 ? 'mt-8' : ''">
          <p class="text-[11px] font-semibold text-[#191f1c]/40 uppercase tracking-wider mb-3 px-1">Past</p>
          <div class="space-y-3">
            <div v-for="ride in pastRides" :key="ride.id" class="bg-white rounded-2xl p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] opacity-50">
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-2.5">
                  <div class="w-10 h-10 rounded-xl bg-[#191f1c]/5 flex items-center justify-center text-base grayscale">
                    {{ getVehicleIcon(ride.vehicle_type) }}
                  </div>
                  <div>
                    <p class="text-[14px] font-bold text-[#191f1c]">{{ getVehicleName(ride.vehicle_type) }}</p>
                    <p class="text-[12px] text-[#191f1c]/50 font-semibold">{{ formatDateTime(ride.scheduled_at) }}</p>
                  </div>
                </div>
                <div class="text-right">
                  <span class="text-[16px] font-bold text-[#191f1c]/60">{{ formatFare(ride.fare_cents) }}</span>
                  <p v-if="ride.status === 'cancelled'" class="text-[11px] text-red-400 font-semibold">Cancelled</p>
                </div>
              </div>

              <div class="flex gap-2.5 ml-0.5">
                <div class="flex flex-col items-center pt-1 gap-0">
                  <div class="w-[8px] h-[8px] rounded-full border-2 border-[#191f1c]/20 bg-white flex-shrink-0"></div>
                  <div class="w-[1.5px] flex-1 my-0.5 bg-[#191f1c]/10 rounded-full min-h-[16px]"></div>
                  <div class="w-[8px] h-[8px] rounded-[2px] bg-[#191f1c]/20 flex-shrink-0"></div>
                </div>
                <div class="flex-1 space-y-2">
                  <p class="text-[13px] text-[#191f1c]/40 leading-tight">{{ ride.pickup_address }}</p>
                  <p class="text-[13px] text-[#191f1c]/40 leading-tight">{{ ride.dropoff_address }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
