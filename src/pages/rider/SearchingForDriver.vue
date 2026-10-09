<script setup>
import DotMascot from '../../components/DotMascot.vue'
import BrandLogo from '../../components/BrandLogo.vue'
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../../lib/supabase'
import { DEMO_MODE } from '../../lib/demoMode'
import { apiPost } from '../../lib/api'
import HarborBackdrop from '../../components/HarborBackdrop.vue'

const props = defineProps({
  rideId: { type: String, required: true },
  notice: { type: String, default: '' }, // e.g. "Your driver had to cancel…" after an automatic re-match
})
const emit = defineEmits(['matched', 'cancelled', 'replaced'])
const router = useRouter()
const ride = ref(null)
const driverFound = ref(false)
const timedOut = ref(false)
const elapsedSeconds = ref(0)
const paymentFailed = ref(false)
const cancelling = ref(false)
const cancelError = ref('')
const confirming = ref(false) // a driver accepted; the card hold is being placed
let replacementDeadline = null
let confirmDeadline = null
let handleLatest = () => {} // set in onMounted to the status handler
const CONFIRM_TIMEOUT_MS = 45_000 // holding a card takes seconds; after this, stop waiting
let channel = null
let demoTimer = null
let timeoutTimer = null
let elapsedTimer = null
let pollTimer = null

// Everything the "matched" screen and the live ride screen need about the driver.
// Drivers' rows are private, so riders read them through the get_ride_driver RPC (own rides only).
async function buildMatch(rideRow) {
  let match = {
    driver_name: rideRow.driver_name || 'Your driver',
    vehicle: rideRow.vehicle || '',
    plate: rideRow.plate || '',
    rating: rideRow.rating ?? null,
    phone: rideRow.phone || '',
    eta_minutes: rideRow.eta_minutes || null,
  }

  if (rideRow.driver_id && !rideRow.demo) {
    const { data } = await supabase.rpc('get_ride_driver', { p_ride_id: rideRow.id })
    const d = Array.isArray(data) ? data[0] : data
    if (d) {
      match = {
        driver_name: d.name || match.driver_name,
        vehicle: [d.vehicle_color, d.vehicle_make, d.vehicle_model].filter(Boolean).join(' '),
        plate: d.license_plate || '',
        rating: d.rating ?? null,
        phone: d.phone || '',
        eta_minutes: match.eta_minutes,
      }
    }
  }

  // Rough pickup ETA from trip duration when we don't have a real one
  if (!match.eta_minutes) {
    const duration = (ride.value || rideRow).duration_minutes
    match.eta_minutes = duration ? Math.max(2, Math.round(duration * 0.3)) : 5
  }
  return match
}

function navigateToActiveRide(rideRow, match) {
  setTimeout(() => {
    router.replace({
      name: 'active-ride',
      params: { rideId: rideRow.id || props.rideId },
      query: {
        driverName: match.driver_name,
        rating: match.rating ?? '',
        vehicle: match.vehicle,
        plate: match.plate,
        phone: match.phone,
        eta: match.eta_minutes,
        pickupLat: rideRow.pickup_lat || ride.value?.pickup_lat || '',
        pickupLng: rideRow.pickup_lng || ride.value?.pickup_lng || '',
        dropoffLat: rideRow.dropoff_lat || ride.value?.dropoff_lat || '',
        dropoffLng: rideRow.dropoff_lng || ride.value?.dropoff_lng || '',
      },
    })
  }, 900)
}

async function onMatched(rideRow) {
  driverFound.value = true
  const match = await buildMatch(rideRow)
  emit('matched', { ...rideRow, ...match })
  navigateToActiveRide(rideRow, match)
}

onMounted(async () => {
  if (DEMO_MODE) {
    demoTimer = setTimeout(() => {
      onMatched({
        id: props.rideId, status: 'accepted', driver_name: 'Marcus Rolle',
        vehicle: 'Silver Toyota Corolla', plate: 'TX 4471', rating: 4.9, eta_minutes: 4, demo: true,
      })
    }, 3500)
    return
  }
  // Start elapsed counter
  elapsedTimer = setInterval(() => {
    elapsedSeconds.value++
  }, 1000)

  // 90-second timeout
  timeoutTimer = setTimeout(expireRequest, 90000)

  const { data } = await supabase.from('rides').select('*').eq('id', props.rideId).single()
  ride.value = data

  // Handle ride status changes (from realtime or polling)
  function handleRideUpdate(updatedRide) {
    if (driverFound.value) return // already matched, ignore
    ride.value = updatedRide
    confirming.value = updatedRide.status === 'pending_driver_response'
    if (confirming.value && !confirmDeadline) {
      // A driver is found, so the "no drivers" timeout no longer applies; the payment timeout does.
      if (timeoutTimer) clearTimeout(timeoutTimer)
      confirmDeadline = setTimeout(giveUpOnPayment, CONFIRM_TIMEOUT_MS)
    }
    if (updatedRide.status === 'cancelled' && updatedRide.replaced_by_ride_id) {
      // The driver cancelled and the server already booked a fresh request: follow it.
      emit('replaced', updatedRide.replaced_by_ride_id)
      return
    }
    if (updatedRide.status === 'cancelled' && updatedRide.cancel_reason === 'driver_cancelled') {
      // The re-match lands a moment after the cancellation; give it a few seconds before giving up.
      if (!replacementDeadline) replacementDeadline = setTimeout(() => emit('cancelled'), 8000)
      return
    }
    if (updatedRide.status === 'cancelled' && updatedRide.cancel_reason !== 'payment_failed') {
      if (elapsedTimer) clearInterval(elapsedTimer)
      if (timeoutTimer) clearTimeout(timeoutTimer)
      if (pollTimer) clearInterval(pollTimer)
      if (updatedRide.cancel_reason === 'no_drivers') timedOut.value = true
      else emit('cancelled')
      return
    }
    if (updatedRide.status === 'accepted') {
      driverFound.value = true
      if (pollTimer) clearInterval(pollTimer)
      if (timeoutTimer) clearTimeout(timeoutTimer)
      if (elapsedTimer) clearInterval(elapsedTimer)
      onMatched(updatedRide)
    } else if (updatedRide.status === 'cancelled' && updatedRide.cancel_reason === 'payment_failed') {
      if (elapsedTimer) clearInterval(elapsedTimer)
      if (timeoutTimer) clearTimeout(timeoutTimer)
      if (pollTimer) clearInterval(pollTimer)
      paymentFailed.value = true
    }
  }

  handleLatest = handleRideUpdate

  // Realtime subscription
  channel = supabase.channel(`ride-${props.rideId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${props.rideId}` }, (payload) => {
      handleRideUpdate(payload.new)
    }).subscribe()

  // Polling fallback — checks every 5 seconds in case realtime misses the update
  pollTimer = setInterval(async () => {
    if (driverFound.value || timedOut.value || paymentFailed.value) return
    const { data: polledRide } = await supabase.from('rides').select('*').eq('id', props.rideId).single()
    if (polledRide && polledRide.status !== 'requested') {
      handleRideUpdate(polledRide)
    }
  }, 5000)
})

onUnmounted(() => {
  if (channel) supabase.removeChannel(channel)
  if (demoTimer) clearTimeout(demoTimer)
  if (timeoutTimer) clearTimeout(timeoutTimer)
  if (elapsedTimer) clearInterval(elapsedTimer)
  if (pollTimer) clearInterval(pollTimer)
  if (replacementDeadline) clearTimeout(replacementDeadline)
  if (confirmDeadline) clearTimeout(confirmDeadline)
})

// A driver accepted but the card hold never completed (declined card, or the driver's app dropped).
// Re-check once, then cancel for free so the rider isn't stuck on "Confirming your payment method…".
async function giveUpOnPayment() {
  if (driverFound.value || paymentFailed.value) return
  const { data: latest } = await supabase.from('rides').select('*').eq('id', props.rideId).maybeSingle()
  if (latest && latest.status !== 'pending_driver_response') {
    confirmDeadline = null
    return handleLatest(latest)
  }
  try {
    await apiPost('/api/cancel-ride', { rideId: props.rideId })
  } catch { /* the server also clears stuck rides within a couple of minutes */ }
  if (elapsedTimer) clearInterval(elapsedTimer)
  if (timeoutTimer) clearTimeout(timeoutTimer)
  if (pollTimer) clearInterval(pollTimer)
  paymentFailed.value = true
}

// Nobody answered: withdraw the request so it doesn't sit in drivers' queues.
async function expireRequest() {
  if (driverFound.value) return
  timedOut.value = true
  if (elapsedTimer) clearInterval(elapsedTimer)
  if (pollTimer) clearInterval(pollTimer)
  if (!DEMO_MODE) {
    const { data } = await supabase.from('rides')
      .update({ status: 'cancelled', cancel_reason: 'no_drivers', cancelled_at: new Date().toISOString() })
      .eq('id', props.rideId)
      .eq('status', 'requested')
      .select('id')
    // Tell RideUp's team about the missed ride, so someone can call the rider back.
    if (data?.length) apiPost('/api/trip-event', { rideId: props.rideId, event: 'expired' }).catch(() => {})
  }
}

// A cancelled request can't be revived, so "Try again" returns to the booking screen (same trip, fresh request).
function retrySearch() {
  emit('cancelled')
}

async function cancelRequest() {
  if (demoTimer) clearTimeout(demoTimer)
  if (DEMO_MODE) { emit('cancelled'); return }
  if (cancelling.value) return
  cancelling.value = true
  cancelError.value = ''
  try {
    const res = await apiPost('/api/cancel-ride', { rideId: props.rideId })
    const data = await res.json().catch(() => ({}))
    if (!res.ok && res.status !== 409) throw new Error(data.error || 'Could not cancel. Please try again.')
    if (res.status === 409) {
      // A driver accepted at the same moment: take the rider to the trip instead of silently cancelling.
      const { data: latest } = await supabase.from('rides').select('*').eq('id', props.rideId).maybeSingle()
      if (latest && ['accepted', 'driver_arrived', 'in_progress'].includes(latest.status)) { onMatched(latest); return }
    }
    emit('cancelled')
  } catch (err) {
    cancelError.value = err.message
  } finally {
    cancelling.value = false
  }
}
</script>

<template>
  <div class="relative min-h-dvh bg-[var(--color-surface)] text-[var(--color-text-primary)] flex flex-col overflow-hidden">
    <HarborBackdrop />
    <div class="relative px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-4 flex items-center gap-3">
      <button @click="cancelRequest" class="w-11 h-11 rounded-full bg-[var(--color-surface-secondary)] border border-[var(--color-border)] flex items-center justify-center text-base" aria-label="Cancel">←</button>
      <div class="text-lg font-semibold"><BrandLogo /></div>
    </div>
    <div class="relative flex-1 flex flex-col items-center justify-center gap-6 px-6">
      <template v-if="!timedOut && !paymentFailed">
        <div class="relative w-28 h-28 rounded-full border border-[#2b8659]/35 flex items-center justify-center">
          <div class="absolute -inset-4 rounded-full border border-[#2b8659]/20"></div>
          <div class="absolute -inset-8 rounded-full border border-[#2b8659]/10"></div>
          <DotMascot :pose="driverFound ? 'hi' : 'finding'" class="w-24 h-24" />
        </div>
        <div v-if="notice" class="w-full max-w-sm rounded-2xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] px-4 py-3 text-[13px] text-[var(--color-text-primary)] text-center" role="status">{{ notice }}</div>
        <div class="text-center">
          <div class="text-xl font-medium mb-1.5">{{ driverFound || confirming ? 'Driver found' : 'Looking for a driver' }}</div>
          <div class="text-[var(--color-text-secondary)] text-[13px]">{{ driverFound ? 'Connecting you now…' : confirming ? 'Confirming your payment method…' : 'Connecting you with a nearby driver' }}</div>
          <p v-if="!timedOut && elapsedSeconds > 10" class="text-[var(--color-text-muted)] text-xs mt-2">
            Searching... {{ elapsedSeconds }}s
          </p>
        </div>
        <button @click="cancelRequest" :disabled="cancelling" class="text-[var(--color-text-secondary)] text-[13px] underline underline-offset-2 mt-2 py-2 px-4 min-h-[44px] disabled:opacity-50">{{ cancelling ? 'Cancelling…' : 'Cancel request' }}</button>
        <p v-if="cancelError" class="text-[13px] text-[var(--color-danger)]" role="alert">{{ cancelError }}</p>
      </template>
      <div v-if="timedOut" class="text-center px-6">
        <DotMascot pose="sleepy" class="w-28 h-28 mx-auto mb-3" />
        <h2 class="text-xl font-bold text-[var(--color-text-primary)] mb-2">No drivers available</h2>
        <p class="text-[var(--color-text-muted)] text-sm mb-6">We couldn’t find a driver near you right now. You haven’t been charged.</p>
        <button @click="retrySearch" class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px] mb-3">
          Try again
        </button>
        <button @click="emit('cancelled')" class="w-full py-3 text-[var(--color-text-muted)] text-[14px] font-medium">
          Cancel ride
        </button>
      </div>
      <div v-if="paymentFailed" class="text-center px-6">
        <div class="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 class="text-xl font-bold text-[var(--color-text-primary)] mb-2">Payment issue</h2>
        <p class="text-[var(--color-text-muted)] text-sm mb-6">Your card couldn’t be charged (for example, it was declined or has insufficient funds), so the ride was cancelled. You weren’t charged.</p>
        <button @click="router.push('/payments')" class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px] mb-2">
          Use a different card
        </button>
        <button @click="emit('cancelled')" class="w-full py-3 text-[var(--color-text-secondary)] font-semibold text-[14px]">
          Try again with the same card
        </button>
      </div>
    </div>
  </div>
</template>
