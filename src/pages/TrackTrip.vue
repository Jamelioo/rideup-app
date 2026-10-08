<script setup>
import BrandLogo from '../components/BrandLogo.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { EMERGENCY_NUMBER } from '../lib/policy'
import { etaMinutes } from '../lib/eta'
import GoogleMap from '../components/GoogleMap.vue'
import HarborBackdrop from '../components/HarborBackdrop.vue'

// Public page behind a shared trip link. No login: the secret token in the URL is the access key,
// and the database only answers while the trip is live (and for an hour after it ends).
const route = useRoute()
const token = route.params.token
const trip = ref(null)
const state = ref('loading') // loading | live | gone | error
const mapFailed = ref(false)
let poll = null

const DEMO_TRIP = {
  status: 'in_progress', rider_first_name: 'Ann', driver_first_name: 'Marcus', vehicle: 'Silver Toyota Corolla', license_plate: 'TX 4471',
  pickup_address: 'Cable Beach, Nassau', dropoff_address: 'Lynden Pindling Intl Airport (LPIA)', updated_at: new Date().toISOString(),
}

async function load() {
  if (token === 'demo' || !supabaseConfigured) {
    trip.value = DEMO_TRIP
    state.value = 'live'
    mapFailed.value = true
    return
  }
  const { data, error } = await supabase.rpc('get_shared_trip', { p_token: token })
  if (error) { state.value = trip.value ? 'live' : 'error'; return }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) { state.value = 'gone'; trip.value = null; stop(); return }
  trip.value = row
  state.value = 'live'
  if (['completed', 'cancelled'].includes(row.status)) stop()
}

function stop() {
  if (poll) { clearInterval(poll); poll = null }
}

onMounted(async () => {
  await load()
  if (state.value === 'live' && token !== 'demo') poll = setInterval(load, 10_000)
})
onUnmounted(stop)

const name = computed(() => trip.value?.rider_first_name || 'Your contact')
const headline = computed(() => {
  switch (trip.value?.status) {
    case 'requested':
    case 'pending_driver_response': return `${name.value} is looking for a driver`
    case 'accepted': return `${trip.value.driver_first_name || 'A driver'} is on the way to pick up ${name.value}`
    case 'driver_arrived': return `The driver has arrived to pick up ${name.value}`
    case 'in_progress': return `${name.value} is on the way`
    case 'completed': return `${name.value} arrived safely`
    case 'cancelled': return 'This trip was cancelled'
    default: return 'Trip status'
  }
})

const pickup = computed(() => trip.value?.pickup_lat != null ? { lat: trip.value.pickup_lat, lng: trip.value.pickup_lng } : null)
const dropoff = computed(() => trip.value?.dropoff_lat != null ? { lat: trip.value.dropoff_lat, lng: trip.value.dropoff_lng } : null)
const driverLocation = computed(() => trip.value?.driver_lat != null ? { lat: trip.value.driver_lat, lng: trip.value.driver_lng } : null)
const eta = computed(() => {
  if (trip.value?.status !== 'in_progress') return null
  return etaMinutes(driverLocation.value, dropoff.value)
})
const updated = computed(() => trip.value?.driver_location_at || trip.value?.updated_at)
const updatedText = computed(() => updated.value ? new Date(updated.value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '')
</script>

<template>
  <div class="min-h-dvh flex flex-col bg-[var(--color-surface)] text-[var(--color-text-primary)]">
    <header class="px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 flex items-center justify-between border-b border-[var(--color-border)]">
      <div class="text-lg font-semibold"><BrandLogo /></div>
      <span class="text-[12px] text-[var(--color-text-muted)]">Shared trip</span>
    </header>

    <div v-if="state === 'loading'" class="flex-1 flex items-center justify-center text-[var(--color-text-secondary)]" role="status">Loading trip…</div>

    <div v-else-if="state === 'gone' || state === 'error'" class="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <h1 class="text-xl font-bold mb-2">{{ state === 'gone' ? 'This trip link has expired' : 'Couldn’t load this trip' }}</h1>
      <p class="text-[14px] text-[var(--color-text-secondary)] max-w-sm">
        {{ state === 'gone' ? 'Shared trip links stop working an hour after the trip ends.' : 'Check your connection and refresh the page.' }}
      </p>
    </div>

    <template v-else-if="trip">
      <div class="relative h-[42dvh] min-h-[240px]">
        <GoogleMap v-if="!mapFailed" :pickup="pickup" :dropoff="dropoff" :driver-location="driverLocation" :fit-padding="{ top: 48, right: 48, bottom: 48, left: 48 }" @error="mapFailed = true" />
        <HarborBackdrop v-else show-route />
      </div>

      <div class="flex-1 px-5 py-5 max-w-lg w-full mx-auto">
        <h1 class="text-[22px] font-bold leading-tight" aria-live="polite">{{ headline }}</h1>
        <p v-if="eta" class="text-[14px] text-[var(--color-text-secondary)] mt-1">About {{ eta }} min to the destination</p>
        <p v-if="updatedText" class="text-[12px] text-[var(--color-text-muted)] mt-1">Updated {{ updatedText }} · refreshes automatically</p>

        <div v-if="trip.driver_first_name" class="mt-5 flex items-center gap-3 rounded-2xl bg-[var(--color-surface-secondary)] p-4">
          <div class="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-[#2b8659] to-[#191f1c] flex items-center justify-center text-white font-bold flex-shrink-0">
            <img v-if="trip.driver_photo_url" :src="trip.driver_photo_url" :alt="`Photo of ${trip.driver_first_name}`" class="w-full h-full object-cover" />
            <span v-else aria-hidden="true">{{ trip.driver_first_name.charAt(0) }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-bold">Driver: {{ trip.driver_first_name }}</div>
            <div class="text-[13px] text-[var(--color-text-secondary)] truncate">{{ trip.vehicle || 'Vehicle' }}</div>
          </div>
          <div v-if="trip.license_plate" class="px-2.5 py-1 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[17px] font-extrabold tracking-wider">{{ trip.license_plate }}</div>
        </div>

        <div class="mt-5 space-y-3 text-[14px]">
          <div><div class="text-[11px] uppercase tracking-wide font-semibold text-[var(--color-text-muted)]">From</div>{{ trip.pickup_address }}</div>
          <div><div class="text-[11px] uppercase tracking-wide font-semibold text-[var(--color-text-muted)]">To</div>{{ trip.dropoff_address }}</div>
        </div>

        <div class="mt-6 rounded-xl border border-[var(--color-border)] p-4 text-[13px] text-[var(--color-text-secondary)]">
          If you believe {{ name }} is in danger, call <a :href="`tel:${EMERGENCY_NUMBER}`" class="font-bold text-[var(--color-brand)]">{{ EMERGENCY_NUMBER }}</a> right away.
          This link stops working an hour after the trip ends.
        </div>
      </div>
    </template>
  </div>
</template>
