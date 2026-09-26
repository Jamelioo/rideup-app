<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../../lib/supabase'
import { loadGoogleMaps, reverseGeocode } from '../../lib/useGoogleMaps'
import { calculateFare, formatFare, VEHICLE_TYPES } from '../../lib/pricing'
import { DEMO_MODE, DEMO_LOCATIONS, fakeRoute } from '../../lib/demoMode'
import GoogleMap from '../../components/GoogleMap.vue'
import HarborBackdrop from '../../components/HarborBackdrop.vue'
import SideMenu from '../../components/SideMenu.vue'

const router = useRouter()
const menuOpen = ref(false)
const pickupInput = ref(null)
const dropoffInput = ref(null)

const pickup = ref(null)
const dropoff = ref(null)
const pickupText = ref('')
const dropoffText = ref('')

const selectedVehicle = ref('standard')
const distanceMiles = ref(null)
const durationMinutes = ref(null)
const isCalculating = ref(false)
const error = ref(null)
const isSubmitting = ref(false)
const mapsReady = ref(DEMO_MODE)
const promoCode = ref('')
const showPromo = ref(false)
const promoApplied = ref(false)
const activeInput = ref('pickup')
const mapRef = ref(null)

let directionsService = null
let placesAutocompletePickup = null
let placesAutocompleteDropoff = null
let debounceTimer = null

onMounted(async () => {
  if (DEMO_MODE) return
  try {
    const maps = await loadGoogleMaps()
    mapsReady.value = true
    directionsService = new maps.DirectionsService()
    await nextTick()
    setupAutocomplete(maps)
  } catch (err) {
    error.value = 'Could not load maps. Check your connection and try again.'
  }
})

function setupAutocomplete(maps) {
  const bounds = new maps.LatLngBounds({ lat: 24.95, lng: -77.55 }, { lat: 25.15, lng: -77.25 })
  placesAutocompletePickup = new maps.places.Autocomplete(pickupInput.value, { bounds, strictBounds: true, fields: ['formatted_address', 'geometry'] })
  placesAutocompletePickup.addListener('place_changed', () => {
    const place = placesAutocompletePickup.getPlace()
    if (!place.geometry) return
    pickup.value = { address: place.formatted_address, lat: place.geometry.location.lat(), lng: place.geometry.location.lng() }
    activeInput.value = 'dropoff'
    dropoffInput.value?.focus()
    maybeCalculateRoute()
  })
  placesAutocompleteDropoff = new maps.places.Autocomplete(dropoffInput.value, { bounds, strictBounds: true, fields: ['formatted_address', 'geometry'] })
  placesAutocompleteDropoff.addListener('place_changed', () => {
    const place = placesAutocompleteDropoff.getPlace()
    if (!place.geometry) return
    dropoff.value = { address: place.formatted_address, lat: place.geometry.location.lat(), lng: place.geometry.location.lng() }
    maybeCalculateRoute()
  })
}

async function handleMapTap(latlng) {
  const address = await reverseGeocode(latlng.lat, latlng.lng)
  const location = { address, lat: latlng.lat, lng: latlng.lng }
  if (activeInput.value === 'pickup') {
    pickup.value = location
    pickupInput.value.value = address
    activeInput.value = 'dropoff'
  } else {
    dropoff.value = location
    dropoffInput.value.value = address
  }
  maybeCalculateRoute()
}

async function handleMarkerDrag(type, latlng) {
  const address = await reverseGeocode(latlng.lat, latlng.lng)
  const location = { address, lat: latlng.lat, lng: latlng.lng }
  if (type === 'pickup') {
    pickup.value = location
    pickupInput.value.value = address
  } else {
    dropoff.value = location
    dropoffInput.value.value = address
  }
  maybeCalculateRoute()
}

function maybeCalculateRoute() {
  if (!pickup.value || !dropoff.value) return
  isCalculating.value = true
  error.value = null
  directionsService.route(
    { origin: { lat: pickup.value.lat, lng: pickup.value.lng }, destination: { lat: dropoff.value.lat, lng: dropoff.value.lng }, travelMode: window.google.maps.TravelMode.DRIVING },
    (result, status) => {
      isCalculating.value = false
      if (status !== 'OK') { error.value = "Couldn't calculate a route between these locations."; return }
      const leg = result.routes[0].legs[0]
      distanceMiles.value = leg.distance.value / 1609.34
      durationMinutes.value = leg.duration.value / 60
    }
  )
}

watch([pickupText, dropoffText], ([p, d]) => {
  if (!DEMO_MODE) return
  clearTimeout(debounceTimer)
  if (!p.trim() || !d.trim()) { distanceMiles.value = null; durationMinutes.value = null; return }
  isCalculating.value = true
  debounceTimer = setTimeout(() => {
    const { distanceMiles: dist, durationMinutes: dur } = fakeRoute(p, d)
    distanceMiles.value = dist
    durationMinutes.value = dur
    pickup.value = { address: p, lat: 25.05, lng: -77.35 }
    dropoff.value = { address: d, lat: 25.08, lng: -77.32 }
    isCalculating.value = false
  }, 500)
})

const fareEstimates = computed(() => {
  if (!distanceMiles.value || !durationMinutes.value) return {}
  const estimates = {}
  for (const v of VEHICLE_TYPES) {
    let fare = calculateFare(distanceMiles.value, durationMinutes.value, v.id)
    if (promoApplied.value) fare = Math.round(fare * 0.9)
    estimates[v.id] = fare
  }
  return estimates
})

const canRequest = computed(() => pickup.value && dropoff.value && fareEstimates.value[selectedVehicle.value] && !isSubmitting.value)
const hasRoute = computed(() => distanceMiles.value && !isCalculating.value)

function applyPromo() {
  if (promoCode.value.trim().length > 0) { promoApplied.value = true; showPromo.value = false }
}

const emit = defineEmits(['requested'])

async function requestRide() {
  if (!canRequest.value) return
  isSubmitting.value = true
  error.value = null
  const fare = fareEstimates.value[selectedVehicle.value]

  if (DEMO_MODE) {
    await new Promise((r) => setTimeout(r, 600))
    emit('requested', {
      id: 'demo-' + Date.now(),
      pickup_address: pickup.value.address,
      dropoff_address: dropoff.value.address,
      vehicle_type: selectedVehicle.value,
      fare_cents: fare,
      status: 'requested',
      demo: true,
    })
    isSubmitting.value = false
    return
  }

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { error.value = 'Please log in to request a ride.'; isSubmitting.value = false; return }
    const { data: rider, error: riderErr } = await supabase.from('riders').select('id').eq('auth_user_id', user.id).single()
    if (riderErr || !rider) { error.value = 'Could not find your rider profile. Please try logging in again.'; isSubmitting.value = false; return }
    const { data: ride, error: rideErr } = await supabase.from('rides').insert({
      rider_id: rider.id, status: 'requested',
      pickup_address: pickup.value.address, pickup_lat: pickup.value.lat, pickup_lng: pickup.value.lng,
      dropoff_address: dropoff.value.address, dropoff_lat: dropoff.value.lat, dropoff_lng: dropoff.value.lng,
      vehicle_type: selectedVehicle.value, distance_miles: distanceMiles.value, fare_cents: fare,
    }).select().single()
    if (rideErr) { error.value = 'Something went wrong requesting your ride. Please try again.'; isSubmitting.value = false; return }
    emit('requested', ride)
  } catch (err) {
    error.value = 'Connection error. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="relative h-screen bg-white text-[#1a1a1a] overflow-hidden">
    <SideMenu :is-open="menuOpen" @close="menuOpen = false" />

    <!-- Full-screen map background -->
    <GoogleMap
      v-if="mapsReady && !DEMO_MODE"
      ref="mapRef"
      :pickup="pickup"
      :dropoff="dropoff"
      class="absolute inset-0 z-0"
      @map-tap="handleMapTap"
      @marker-drag="handleMarkerDrag"
    />
    <HarborBackdrop v-if="DEMO_MODE" :show-route="hasRoute" />

    <!-- Top bar floating over map -->
    <div class="absolute top-0 left-0 right-0 z-10 px-5 pt-[max(2rem,env(safe-area-inset-top))] flex items-center justify-between pointer-events-none">
      <button @click="menuOpen = true" class="pointer-events-auto w-11 h-11 rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.1)] flex items-center justify-center active:scale-95 transition-transform">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect y="3" width="18" height="1.5" rx="0.75" fill="#1a1a1a"/><rect y="8.25" width="18" height="1.5" rx="0.75" fill="#1a1a1a"/><rect y="13.5" width="18" height="1.5" rx="0.75" fill="#1a1a1a"/></svg>
      </button>
      <router-link to="/welcome" class="pointer-events-auto bg-white shadow-[0_2px_12px_rgba(0,0,0,0.1)] rounded-full px-5 py-2 font-serif text-[17px] font-bold tracking-tight">Ride<span class="text-[#58cc02]">Up</span></router-link>
      <div class="w-11 h-11"></div>
    </div>

    <!-- Bottom floating card -->
    <div class="absolute bottom-0 left-0 right-0 z-10 bg-white rounded-t-[28px] shadow-[0_-4px_40px_rgba(0,0,0,0.1)] max-h-[70vh] overflow-y-auto" style="padding-bottom: env(safe-area-inset-bottom, 0px);">
      <!-- Drag handle -->
      <div class="flex justify-center pt-3 pb-2">
        <div class="w-9 h-[5px] rounded-full bg-[#1a1a1a]/10"></div>
      </div>

      <div class="px-5 pb-6">
        <!-- Title (only when no route) -->
        <div v-if="!hasRoute" class="pt-1 pb-5">
          <h1 class="font-serif text-[28px] leading-[1.1] font-bold tracking-tight">Where to?</h1>
          <p class="text-[#1a1a1a]/50 text-[13px] mt-1 leading-relaxed">Enter pickup & destination for upfront pricing</p>
        </div>

        <!-- Pickup / Dropoff inputs with connector -->
        <div class="flex gap-3">
          <!-- Dot connector -->
          <div class="flex flex-col items-center pt-[18px] gap-0">
            <div class="w-[10px] h-[10px] rounded-full border-[2.5px] border-[#58cc02] bg-white flex-shrink-0"></div>
            <div class="w-[2px] flex-1 my-1 bg-[#1a1a1a]/10 rounded-full min-h-[24px]"></div>
            <div class="w-[10px] h-[10px] rounded-[2px] bg-[#1a1a1a] flex-shrink-0"></div>
          </div>

          <!-- Input fields -->
          <div class="flex-1 space-y-2">
            <div class="flex items-center bg-[#f5f5f5] rounded-xl px-4 py-3 border-2 transition-all duration-200"
                 :class="activeInput === 'pickup' ? 'border-[#58cc02] bg-white shadow-[0_0_0_3px_rgba(88,204,2,0.12)]' : 'border-transparent'">
              <input v-if="!DEMO_MODE" ref="pickupInput" type="text" placeholder="Pickup location"
                     @focus="activeInput = 'pickup'"
                     class="bg-transparent outline-none w-full text-[15px] font-medium placeholder:text-[#1a1a1a]/40 placeholder:font-normal" />
              <input v-else v-model="pickupText" list="demo-locations" type="text" placeholder="Pickup — try Cable Beach"
                     @focus="activeInput = 'pickup'"
                     class="bg-transparent outline-none w-full text-[15px] font-medium placeholder:text-[#1a1a1a]/40 placeholder:font-normal" />
            </div>
            <div class="flex items-center bg-[#f5f5f5] rounded-xl px-4 py-3 border-2 transition-all duration-200"
                 :class="activeInput === 'dropoff' ? 'border-[#58cc02] bg-white shadow-[0_0_0_3px_rgba(88,204,2,0.12)]' : 'border-transparent'">
              <input v-if="!DEMO_MODE" ref="dropoffInput" type="text" placeholder="Where to?"
                     @focus="activeInput = 'dropoff'"
                     class="bg-transparent outline-none w-full text-[15px] font-medium placeholder:text-[#1a1a1a]/40 placeholder:font-normal" />
              <input v-else v-model="dropoffText" list="demo-locations" type="text" placeholder="Destination — try Airport"
                     @focus="activeInput = 'dropoff'"
                     class="bg-transparent outline-none w-full text-[15px] font-medium placeholder:text-[#1a1a1a]/40 placeholder:font-normal" />
            </div>
            <datalist id="demo-locations"><option v-for="loc in DEMO_LOCATIONS" :key="loc" :value="loc" /></datalist>
          </div>
        </div>

        <!-- Status messages -->
        <p v-if="DEMO_MODE && !hasRoute" class="text-[#58cc02] text-[12px] mt-3 ml-[22px] font-medium">Demo mode — enter any two spots to see live pricing</p>
        <div v-if="!mapsReady && !error && !DEMO_MODE" class="text-[#1a1a1a]/40 text-sm text-center py-10">Loading map...</div>
        <div v-if="error" class="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-xl px-4 py-3 mt-3">{{ error }}</div>
        <div v-if="isCalculating" class="flex items-center gap-2.5 text-[#1a1a1a]/50 text-[13px] mt-4 ml-[22px]">
          <span class="w-4 h-4 border-2 border-[#1a1a1a]/10 border-t-[#58cc02] rounded-full animate-spin"></span>
          Calculating route...
        </div>

        <!-- Vehicle selection & booking -->
        <div v-if="hasRoute" class="mt-5">
          <!-- Route info pill -->
          <div class="flex items-center gap-2 mb-4">
            <div class="inline-flex items-center gap-1.5 bg-[#1a1a1a]/[0.05] rounded-full px-3 py-1.5">
              <svg class="w-3.5 h-3.5 text-[#1a1a1a]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
              <span class="text-[12px] font-semibold text-[#1a1a1a]/60">{{ distanceMiles.toFixed(1) }} mi</span>
            </div>
            <div class="inline-flex items-center gap-1.5 bg-[#1a1a1a]/[0.05] rounded-full px-3 py-1.5">
              <svg class="w-3.5 h-3.5 text-[#1a1a1a]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span class="text-[12px] font-semibold text-[#1a1a1a]/60">~{{ Math.round(durationMinutes) }} min</span>
            </div>
          </div>

          <p class="text-[11px] font-semibold text-[#1a1a1a]/40 uppercase tracking-wider mb-2.5 px-1">Choose your ride</p>

          <div class="space-y-2">
            <button v-for="vehicle in VEHICLE_TYPES" :key="vehicle.id" @click="selectedVehicle = vehicle.id"
                    class="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all duration-200"
                    :class="selectedVehicle === vehicle.id ? 'border-[#58cc02] bg-[#58cc02]/[0.06] shadow-[0_0_0_3px_rgba(88,204,2,0.08)]' : 'border-transparent bg-[#f5f5f5] hover:bg-[#f0f0f0] active:scale-[0.99]'">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl" :class="selectedVehicle === vehicle.id ? 'bg-[#58cc02]/15' : 'bg-white'">{{ vehicle.icon }}</div>
                <div class="text-left">
                  <div class="text-[15px] font-bold">{{ vehicle.name }}</div>
                  <div class="text-[12px] text-[#1a1a1a]/50 mt-0.5">{{ vehicle.desc }}</div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-[16px] font-bold font-serif" :class="selectedVehicle === vehicle.id ? 'text-[#58cc02]' : ''">{{ formatFare(fareEstimates[vehicle.id]) }}</div>
                <div v-if="promoApplied" class="text-[10px] text-[#58cc02] font-semibold">10% off</div>
              </div>
            </button>
          </div>

          <!-- Promo code -->
          <div class="mt-3">
            <div v-if="!promoApplied">
              <button v-if="!showPromo" @click="showPromo = true" class="text-[13px] text-[#58cc02] font-semibold flex items-center gap-1.5 px-1 py-1">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                Add promo code
              </button>
              <div v-else class="flex gap-2 mt-1">
                <input v-model="promoCode" type="text" placeholder="Enter code"
                       class="flex-1 bg-[#f5f5f5] border-2 border-transparent rounded-xl px-4 py-3 text-[14px] font-medium outline-none focus:border-[#58cc02] focus:bg-white transition-all min-h-[44px] uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal placeholder:font-normal" />
                <button @click="applyPromo" class="px-5 py-3 bg-[#1a1a1a] text-white text-[13px] font-bold rounded-xl min-h-[44px] active:scale-95 transition-transform">Apply</button>
              </div>
            </div>
            <div v-else class="flex items-center gap-2 text-[#58cc02] text-[13px] font-semibold px-1">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
              Promo applied — 10% off
            </div>
          </div>

          <button @click="requestRide" :disabled="!canRequest"
                  class="w-full py-4 bg-[#58cc02] disabled:bg-[#1a1a1a]/8 disabled:text-[#1a1a1a]/25 text-white font-bold rounded-2xl text-[15px] mt-4 transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(88,204,2,0.3)] disabled:shadow-none">
            {{ isSubmitting ? 'Requesting...' : 'Request Ride' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
