<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import RiderBooking from './RiderBooking.vue'
import SearchingForDriver from './SearchingForDriver.vue'
import { DEMO_MODE } from '../../lib/demoMode'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { chargeOf } from '../../lib/discounts'
import { isCashRide } from '../../lib/cash'

const router = useRouter()
const step = ref(DEMO_MODE || !supabaseConfigured ? 'booking' : 'checking') // checking | booking | searching
const activeRide = ref(null)
const notice = ref('')

// One-time message carried across a page change (e.g. the trip screen after a driver cancels).
function takeNotice() {
  try {
    const text = sessionStorage.getItem('rideup_notice') || ''
    sessionStorage.removeItem('rideup_notice')
    return text
  } catch {
    return ''
  }
}

const SEARCHING = ['requested', 'pending_driver_response']
const ON_TRIP = ['accepted', 'driver_arrived', 'in_progress']

// Uber: opening the app during a trip always takes you straight back to it.
async function restoreTrip() {
  if (DEMO_MODE || !supabaseConfigured) { step.value = 'booking'; return }
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (userId) {
      const { data: rider } = await supabase.from('riders').select('id').eq('auth_user_id', userId).maybeSingle()
      if (rider) {
        const { data: ride } = await supabase
          .from('rides')
          .select('*')
          .eq('rider_id', rider.id)
          .in('status', [...SEARCHING, ...ON_TRIP])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (ride && ON_TRIP.includes(ride.status)) {
          router.replace({ name: 'active-ride', params: { rideId: ride.id } })
          return
        }
        if (ride) {
          activeRide.value = ride
          notice.value = takeNotice()
          step.value = 'searching'
          return
        }
      }
    }
  } catch (err) {
    console.warn('Could not check for an active trip:', err?.message)
  }
  step.value = 'booking'
}

onMounted(restoreTrip)

function handleRequested(ride) {
  activeRide.value = ride
  step.value = 'searching'
}

function handleCancelled() {
  activeRide.value = null
  notice.value = ''
  step.value = 'booking'
}

function handleReplaced(newRideId) {
  activeRide.value = { id: newRideId }
  notice.value = 'Your driver had to cancel. We’re finding you another driver. You weren’t charged.'
}
</script>

<template>
  <div v-if="step === 'checking'" class="min-h-dvh flex items-center justify-center bg-[var(--color-surface)] text-[var(--color-text-secondary)]" role="status" aria-live="polite">
    <div class="flex flex-col items-center gap-3">
      <div class="w-8 h-8 rounded-full border-[3px] border-[#2b8659]/25 border-t-[#2b8659] animate-spin" aria-hidden="true"></div>
      <span class="text-[13px]">Loading…</span>
    </div>
  </div>
  <RiderBooking v-else-if="step === 'booking'" @requested="handleRequested" @existing-ride="restoreTrip" />
  <SearchingForDriver v-else-if="step === 'searching' && activeRide" :key="activeRide.id" :ride-id="activeRide.id" :notice="notice"
                      :drivers-alerted="activeRide.drivers_alerted ?? null" :cash-cents="isCashRide(activeRide) ? chargeOf(activeRide) : null"
                      @cancelled="handleCancelled" @replaced="handleReplaced" />
</template>
