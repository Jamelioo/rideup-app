<script>
export default { name: 'RiderBooking' }
</script>

<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../../lib/supabase'
import { apiPost } from '../../lib/api'
import { loadGoogleMaps, reverseGeocode } from '../../lib/useGoogleMaps'
import { calculateFare, formatFare, VEHICLE_TYPES } from '../../lib/pricing'
import { DEMO_MODE, DEMO_LOCATIONS, fakeRoute } from '../../lib/demoMode'
import GoogleMap from '../../components/GoogleMap.vue'
import HarborBackdrop from '../../components/HarborBackdrop.vue'
import SideMenu from '../../components/SideMenu.vue'
import ScheduleRidePicker from '../../components/ScheduleRidePicker.vue'
import GuestInfoSheet from '../../components/GuestInfoSheet.vue'
import CardCollectionSheet from '../../components/CardCollectionSheet.vue'

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
const activeInput = ref('pickup')
const mapRef = ref(null)
const isLocating = ref(false)
const showGuestSheet = ref(false)
const guestSheetRef = ref(null)
const showCardSheet = ref(false)
const cardSheetRef = ref(null)

// Bottom sheet drag state
const sheetRef = ref(null)
const sheetY = ref(0)
const isDragging = ref(false)
const sheetSnap = ref('mid') // 'peek' | 'mid' | 'full'
let dragStartY = 0
let dragStartSheetY = 0

function getSnapPositions() {
  const vh = window.innerHeight
  return {
    peek: vh * 0.15,  // 15% visible — mostly map
    mid: vh * 0.55,   // 55% visible — default
    full: vh * 0.85,  // 85% visible — almost full
  }
}

function onDragStart(e) {
  isDragging.value = true
  const touch = e.touches ? e.touches[0] : e
  dragStartY = touch.clientY
  dragStartSheetY = sheetY.value
  if (sheetRef.value) sheetRef.value.style.transition = 'none'
  if (!e.touches) {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }
}

function onDragMove(e) {
  if (!isDragging.value) return
  const touch = e.touches ? e.touches[0] : e
  const delta = dragStartY - touch.clientY
  const snaps = getSnapPositions()
  const newY = Math.max(snaps.peek, Math.min(snaps.full, dragStartSheetY + delta))
  sheetY.value = newY
  if (sheetRef.value) sheetRef.value.style.height = `${newY}px`
}

function onDragEnd() {
  if (!isDragging.value) return
  isDragging.value = false
  if (sheetRef.value) sheetRef.value.style.transition = 'height 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
  const snaps = getSnapPositions()
  const distances = {
    peek: Math.abs(sheetY.value - snaps.peek),
    mid: Math.abs(sheetY.value - snaps.mid),
    full: Math.abs(sheetY.value - snaps.full),
  }
  const closest = Object.entries(distances).sort((a, b) => a[1] - b[1])[0][0]
  snapTo(closest)
}

function snapTo(position) {
  const snaps = getSnapPositions()
  sheetSnap.value = position
  sheetY.value = snaps[position]
  if (sheetRef.value) {
    sheetRef.value.style.transition = 'height 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
    sheetRef.value.style.height = `${snaps[position]}px`
  }
}

function onMouseMove(e) { onDragMove(e) }
function onMouseUp() { onDragEnd(); window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp) }

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})

let directionsService = null
let placesAutocompletePickup = null
let placesAutocompleteDropoff = null
let debounceTimer = null

onMounted(async () => {
  // Initialize sheet to mid position
  nextTick(() => {
    const snaps = getSnapPositions()
    sheetY.value = snaps.mid
    if (sheetRef.value) sheetRef.value.style.height = `${snaps.mid}px`
  })

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

async function useCurrentLocation() {
  if (!navigator.geolocation) {
    showToast('Location not supported on this device')
    return
  }
  isLocating.value = true
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
      })
    })
    const { latitude, longitude } = pos.coords
    const address = await reverseGeocode(latitude, longitude)
    pickup.value = { lat: latitude, lng: longitude, address }
    pickupText.value = address
    if (pickupInput.value) pickupInput.value.value = address
    isLocating.value = false
  } catch (err) {
    isLocating.value = false
    showToast(err.code === 1 ? 'Location access denied' : 'Could not get location')
  }
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
    estimates[v.id] = fare
  }
  return estimates
})

const showSchedulePicker = ref(false)
const isScheduling = ref(false)
const toast = ref('')
function showToast(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 3000)
}

const canRequest = computed(() => pickup.value && dropoff.value && fareEstimates.value[selectedVehicle.value] && !isSubmitting.value)
const hasRoute = computed(() => distanceMiles.value && !isCalculating.value)

const emit = defineEmits(['requested'])

async function requestRide() {
  if (!canRequest.value) return
  isSubmitting.value = true
  error.value = null

  if (DEMO_MODE) {
    const fare = fareEstimates.value[selectedVehicle.value]
    const vehicleName = VEHICLE_TYPES.find(v => v.id === selectedVehicle.value)?.name || 'RideUp Ride'
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    isSubmitting.value = false
    showGuestSheet.value = true
    return
  }

  const { data: rider } = await supabase
    .from('riders')
    .select('payment_method_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!rider?.payment_method_id) {
    isSubmitting.value = false
    showCardSheet.value = true
    return
  }

  await createRideForUser(user)
}

async function createRideForUser(user, guestInfo = null) {
  isSubmitting.value = true
  error.value = null
  const fare = fareEstimates.value[selectedVehicle.value]

  try {
    let { data: rider } = await supabase.from('riders').select('id, payment_method_id').eq('auth_user_id', user.id).maybeSingle()
    if (!rider) {
      const riderName = guestInfo?.name || user.user_metadata?.name || user.email?.split('@')[0] || 'Rider'
      const riderPhone = guestInfo?.phone || user.phone || ''
      const riderEmail = user.email || ''
      const { data: newRider, error: createErr } = await supabase.from('riders').insert({
        auth_user_id: user.id,
        name: riderName,
        email: riderEmail,
        phone: riderPhone,
        is_guest: !!guestInfo,
      }).select('id, payment_method_id').single()
      if (createErr || !newRider) { error.value = 'Could not create your rider profile. Please try again.'; isSubmitting.value = false; return }
      rider = newRider
    }

    // Enforce: no ride without a payment method on file
    if (!rider.payment_method_id) {
      isSubmitting.value = false
      showCardSheet.value = true
      return
    }

    const riderName = guestInfo?.name || user.user_metadata?.name || user.email?.split('@')[0] || 'Rider'
    const { data: ride, error: rideErr } = await supabase.from('rides').insert({
      rider_id: rider.id, status: 'requested',
      rider_name: riderName,
      pickup_address: pickup.value.address, pickup_lat: pickup.value.lat, pickup_lng: pickup.value.lng,
      dropoff_address: dropoff.value.address, dropoff_lat: dropoff.value.lat, dropoff_lng: dropoff.value.lng,
      vehicle_type: selectedVehicle.value, distance_miles: distanceMiles.value,
      duration_minutes: durationMinutes.value || Math.round((distanceMiles.value || 1) * 3),
      fare_cents: fare,
    }).select().single()
    if (rideErr) { error.value = 'Something went wrong requesting your ride. Please try again.'; isSubmitting.value = false; return }

    showGuestSheet.value = false
    emit('requested', ride)
    isSubmitting.value = false
  } catch (err) {
    error.value = 'Connection error. Please try again.'
    isSubmitting.value = false
  }
}

async function saveCardForUser(user, cardElement, stripe) {
  const res = await apiPost('/api/create-setup-intent', {
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'Rider',
  })
  const { client_secret, customer_id, error: apiError } = await res.json()
  if (apiError) throw new Error(apiError)

  const { setupIntent, error: stripeError } = await stripe.confirmCardSetup(client_secret, {
    payment_method: { card: cardElement },
  })
  if (stripeError) throw new Error(stripeError.message)

  // The server re-verifies the SetupIntent with Stripe and stores the card (clients can't write it).
  const saveRes = await apiPost('/api/save-payment-method', { setupIntentId: setupIntent.id })
  const saved = await saveRes.json().catch(() => ({}))
  if (!saveRes.ok || !saved.success) throw new Error('Could not save your card. Please try again.')

  return { customer_id, payment_method_id: setupIntent.payment_method }
}

async function handleGuestSubmit({ name, phone, cardElement, stripe }) {
  error.value = null
  try {
    const { data, error: authErr } = await supabase.auth.signInAnonymously()
    if (authErr || !data.user) {
      if (guestSheetRef.value) guestSheetRef.value.reset()
      error.value = 'Could not start your session. Please try again.'
      return
    }

    let { data: rider } = await supabase.from('riders').select('id').eq('auth_user_id', data.user.id).maybeSingle()
    if (!rider) {
      const { data: newRider, error: createErr } = await supabase.from('riders').insert({
        auth_user_id: data.user.id,
        name,
        phone,
        is_guest: true,
      }).select('id').single()
      if (createErr || !newRider) {
        if (guestSheetRef.value) guestSheetRef.value.reset()
        error.value = 'Could not create your profile. Please try again.'
        return
      }
      rider = newRider
    }

    await saveCardForUser(data.user, cardElement, stripe)

    await createRideForUser(data.user, { name, phone })
    if (error.value && guestSheetRef.value) guestSheetRef.value.reset()
  } catch (err) {
    if (guestSheetRef.value) guestSheetRef.value.reset()
    error.value = err.message || 'Connection error. Please try again.'
  }
}

async function handleCardSubmit({ cardElement, stripe }) {
  error.value = null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      if (cardSheetRef.value) cardSheetRef.value.reset()
      error.value = 'Session expired. Please log in again.'
      return
    }

    await saveCardForUser(user, cardElement, stripe)

    showCardSheet.value = false
    await createRideForUser(user)
  } catch (err) {
    if (cardSheetRef.value) cardSheetRef.value.reset()
    error.value = err.message || 'Could not save card. Please try again.'
  }
}

async function scheduleRide({ date, time, summary }) {
  if (!canRequest.value) return
  isScheduling.value = true
  showSchedulePicker.value = false
  const fare = fareEstimates.value[selectedVehicle.value]
  const scheduledAt = new Date(`${date}T${time}:00`).toISOString()

  if (DEMO_MODE) {
    await new Promise((r) => setTimeout(r, 400))
    showToast(`Ride scheduled for ${summary}`)
    isScheduling.value = false
    return
  }

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { error.value = 'Please log in to schedule a ride.'; isScheduling.value = false; return }
    let { data: rider } = await supabase.from('riders').select('id').eq('auth_user_id', user.id).maybeSingle()
    if (!rider) {
      const { data: newRider, error: createErr } = await supabase.from('riders').insert({
        auth_user_id: user.id,
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'Rider',
        email: user.email,
        phone: user.phone || '',
      }).select('id').single()
      if (createErr || !newRider) { error.value = 'Could not create your rider profile.'; isScheduling.value = false; return }
      rider = newRider
    }
    const { error: insertErr } = await supabase.from('scheduled_rides').insert({
      rider_id: rider.id,
      pickup_address: pickup.value.address,
      pickup_lat: pickup.value.lat,
      pickup_lng: pickup.value.lng,
      dropoff_address: dropoff.value.address,
      dropoff_lat: dropoff.value.lat,
      dropoff_lng: dropoff.value.lng,
      vehicle_type: selectedVehicle.value,
      distance_miles: distanceMiles.value,
      fare_cents: fare,
      scheduled_at: scheduledAt,
      status: 'scheduled',
    })
    if (insertErr) throw insertErr
    showToast(`Ride scheduled for ${summary}`)
  } catch (err) {
    error.value = 'Could not schedule ride. Please try again.'
  } finally {
    isScheduling.value = false
  }
}
</script>

<template>
  <div class="relative h-dvh bg-[var(--color-surface)] text-[var(--color-text-primary)] overflow-hidden">
    <SideMenu :is-open="menuOpen" @close="menuOpen = false" />

    <!-- Map fills the whole screen on mobile, right side on desktop -->
    <div class="absolute inset-0 md:left-[400px]">
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
    </div>

    <!-- Top bar — floats over map on mobile, inside panel on desktop -->
    <div class="absolute top-0 left-0 right-0 z-20 px-5 pt-[max(2rem,env(safe-area-inset-top))] flex items-center justify-between pointer-events-none md:hidden">
      <button @click="menuOpen = true" class="pointer-events-auto w-11 h-11 rounded-full bg-[var(--color-surface)] shadow-[0_2px_12px_rgba(0,0,0,0.1)] flex items-center justify-center active:scale-95 transition-transform" aria-label="Open menu">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect y="3" width="18" height="1.5" rx="0.75" fill="currentColor"/><rect y="8.25" width="18" height="1.5" rx="0.75" fill="currentColor"/><rect y="13.5" width="18" height="1.5" rx="0.75" fill="currentColor"/></svg>
      </button>
      <div class="pointer-events-auto bg-[var(--color-surface)] shadow-[0_2px_12px_rgba(0,0,0,0.1)] rounded-full px-5 py-2 text-[17px] font-bold tracking-tight">Ride<span class="text-[var(--color-brand)]">Up</span></div>
      <div class="w-11 h-11"></div>
    </div>

    <!-- MOBILE: Bottom sheet -->
    <div ref="sheetRef" class="md:hidden absolute bottom-[var(--bottom-nav-h,0px)] left-0 right-0 z-10 bg-[var(--color-surface)] rounded-t-[28px] shadow-[0_-4px_40px_rgba(0,0,0,0.1)] overflow-hidden" style="padding-bottom: env(safe-area-inset-bottom, 0px); transition: height 0.3s cubic-bezier(0.25, 1, 0.5, 1);">
      <!-- Drag handle -->
      <div class="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
           @touchstart.passive="onDragStart"
           @touchmove.passive="onDragMove"
           @touchend="onDragEnd"
           @mousedown="onDragStart">
        <div class="w-9 h-[5px] rounded-full bg-[var(--color-text-muted)]"></div>
      </div>
      <div class="overflow-y-auto" :style="{ maxHeight: `calc(100% - 28px)` }">
      <div class="px-5 pb-6">
        <!-- Shared booking content -->
        <div v-if="!hasRoute" class="pt-1 pb-5">
          <h1 class="text-[28px] leading-[1.1] font-bold tracking-tight">Where to?</h1>
          <p class="text-[var(--color-text-muted)] text-[13px] mt-1 leading-relaxed">Enter pickup & destination for upfront pricing</p>
        </div>

        <div class="flex gap-3">
          <div class="flex flex-col items-center pt-[18px] gap-0">
            <div class="w-[10px] h-[10px] rounded-full border-[2.5px] border-[#2b8659] bg-[var(--color-surface)] flex-shrink-0"></div>
            <div class="w-[2px] flex-1 my-1 bg-[var(--color-border)] rounded-full min-h-[24px]"></div>
            <div class="w-[10px] h-[10px] rounded-[2px] bg-[var(--color-text-primary)] flex-shrink-0"></div>
          </div>
          <div class="flex-1 space-y-2">
            <div class="flex items-center bg-[var(--color-surface-secondary)] rounded-xl px-4 py-3 border-2 transition-all duration-200"
                 :class="activeInput === 'pickup' ? 'border-[#2b8659] bg-[var(--color-surface)] shadow-[0_0_0_3px_rgba(43,134,89,0.12)]' : 'border-transparent'">
              <input v-if="!DEMO_MODE" ref="pickupInput" type="text" placeholder="Pickup location"
                     @focus="activeInput = 'pickup'"
                     class="bg-transparent outline-none w-full text-[15px] font-medium placeholder:text-[var(--color-text-muted)] placeholder:font-normal" />
              <input v-else v-model="pickupText" list="demo-locations" type="text" placeholder="Pickup — try Cable Beach"
                     @focus="activeInput = 'pickup'"
                     class="bg-transparent outline-none w-full text-[15px] font-medium placeholder:text-[var(--color-text-muted)] placeholder:font-normal" />
            </div>
            <button
              @click="useCurrentLocation"
              :disabled="isLocating"
              class="flex items-center gap-2 px-3 py-2.5 text-[13px] font-medium text-[var(--color-brand)] active:bg-[var(--color-surface-secondary)] rounded-lg transition-colors min-h-[44px]"
            >
              <svg v-if="!isLocating" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4m0 12v4m10-10h-4M6 12H2" />
              </svg>
              <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ isLocating ? 'Locating...' : 'Use current location' }}
            </button>
            <div class="flex items-center bg-[var(--color-surface-secondary)] rounded-xl px-4 py-3 border-2 transition-all duration-200"
                 :class="activeInput === 'dropoff' ? 'border-[#2b8659] bg-[var(--color-surface)] shadow-[0_0_0_3px_rgba(43,134,89,0.12)]' : 'border-transparent'">
              <input v-if="!DEMO_MODE" ref="dropoffInput" type="text" placeholder="Where to?"
                     @focus="activeInput = 'dropoff'"
                     class="bg-transparent outline-none w-full text-[15px] font-medium placeholder:text-[var(--color-text-muted)] placeholder:font-normal" />
              <input v-else v-model="dropoffText" list="demo-locations" type="text" placeholder="Destination — try Airport"
                     @focus="activeInput = 'dropoff'"
                     class="bg-transparent outline-none w-full text-[15px] font-medium placeholder:text-[var(--color-text-muted)] placeholder:font-normal" />
            </div>
            <datalist id="demo-locations"><option v-for="loc in DEMO_LOCATIONS" :key="loc" :value="loc" /></datalist>
          </div>
        </div>

        <p v-if="DEMO_MODE && !hasRoute" class="text-[var(--color-brand)] text-[12px] mt-3 ml-[22px] font-medium">Demo mode — enter any two spots to see live pricing</p>
        <div v-if="!mapsReady && !error && !DEMO_MODE" class="text-[var(--color-text-muted)] text-sm text-center py-10">Loading map...</div>
        <div v-if="error" class="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-xl px-4 py-3 mt-3">{{ error }}</div>
        <div v-if="isCalculating" class="flex items-center gap-2.5 text-[var(--color-text-muted)] text-[13px] mt-4 ml-[22px]">
          <span class="w-4 h-4 border-2 border-[var(--color-border)] border-t-[#2b8659] rounded-full animate-spin"></span>
          Calculating route...
        </div>

        <div v-if="hasRoute" class="mt-5">
          <div class="flex items-center gap-2 mb-4">
            <div class="inline-flex items-center gap-1.5 bg-[var(--color-surface-secondary)] rounded-full px-3 py-1.5">
              <svg class="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
              <span class="text-[12px] font-semibold text-[var(--color-text-secondary)]">{{ distanceMiles.toFixed(1) }} mi</span>
            </div>
            <div class="inline-flex items-center gap-1.5 bg-[var(--color-surface-secondary)] rounded-full px-3 py-1.5">
              <svg class="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span class="text-[12px] font-semibold text-[var(--color-text-secondary)]">~{{ Math.round(durationMinutes) }} min</span>
            </div>
          </div>
          <p class="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2.5 px-1">Choose your ride</p>
          <div class="space-y-2">
            <button v-for="vehicle in VEHICLE_TYPES" :key="vehicle.id" @click="selectedVehicle = vehicle.id"
                    class="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all duration-200"
                    :class="selectedVehicle === vehicle.id ? 'border-[#2b8659] bg-[#2b8659]/[0.06] shadow-[0_0_0_3px_rgba(43,134,89,0.08)]' : 'border-transparent bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-secondary)] active:scale-[0.99]'">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl" :class="selectedVehicle === vehicle.id ? 'bg-[#2b8659]/15' : 'bg-[var(--color-surface)]'">{{ vehicle.icon }}</div>
                <div class="text-left">
                  <div class="text-[15px] font-bold">{{ vehicle.name }}</div>
                  <div class="text-[12px] text-[var(--color-text-muted)] mt-0.5">{{ vehicle.desc }}</div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-[16px] font-bold" :class="selectedVehicle === vehicle.id ? 'text-[var(--color-brand)]' : ''">{{ formatFare(fareEstimates[vehicle.id]) }}</div>
              </div>
            </button>
          </div>
          <div class="flex gap-2.5 mt-4">
            <button @click="requestRide" :disabled="!canRequest"
                    class="flex-1 py-4 bg-[#2b8659] disabled:bg-[var(--color-surface-secondary)] disabled:text-[var(--color-text-muted)] text-white font-bold rounded-2xl text-[15px] transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(43,134,89,0.3)] disabled:shadow-none">
              {{ isSubmitting ? 'Requesting...' : 'Request Ride' }}
            </button>
            <button @click="showSchedulePicker = true" :disabled="!canRequest"
                    class="w-[52px] flex-shrink-0 flex items-center justify-center bg-[var(--color-surface-secondary)] disabled:bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] disabled:text-[var(--color-text-muted)] rounded-2xl transition-all active:scale-[0.97] border border-[var(--color-border)]"
                    title="Schedule for later">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>

    <!-- DESKTOP: Side panel -->
    <div class="hidden md:flex absolute inset-y-0 left-0 z-10 w-[400px] bg-[var(--color-surface)] shadow-[4px_0_24px_rgba(0,0,0,0.08)] flex-col">
      <!-- Panel header -->
      <div class="px-6 pt-8 pb-2 flex items-center justify-between">
        <div class="text-[22px] font-bold tracking-tight">Ride<span class="text-[var(--color-brand)]">Up</span></div>
        <button @click="menuOpen = true" class="w-10 h-10 rounded-full hover:bg-[var(--color-surface-secondary)] flex items-center justify-center transition-colors" aria-label="Open menu">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect y="3" width="18" height="1.5" rx="0.75" fill="currentColor"/><rect y="8.25" width="18" height="1.5" rx="0.75" fill="currentColor"/><rect y="13.5" width="18" height="1.5" rx="0.75" fill="currentColor"/></svg>
        </button>
      </div>

      <!-- Panel content -->
      <div class="flex-1 overflow-y-auto px-6 pb-8">
        <div v-if="!hasRoute" class="pt-4 pb-6">
          <h1 class="text-[32px] leading-[1.1] font-bold tracking-tight">Where to?</h1>
          <p class="text-[var(--color-text-muted)] text-[14px] mt-2 leading-relaxed">Enter pickup & destination for upfront pricing</p>
        </div>

        <div class="flex gap-3">
          <div class="flex flex-col items-center pt-[18px] gap-0">
            <div class="w-[10px] h-[10px] rounded-full border-[2.5px] border-[#2b8659] bg-[var(--color-surface)] flex-shrink-0"></div>
            <div class="w-[2px] flex-1 my-1 bg-[var(--color-border)] rounded-full min-h-[24px]"></div>
            <div class="w-[10px] h-[10px] rounded-[2px] bg-[var(--color-text-primary)] flex-shrink-0"></div>
          </div>
          <div class="flex-1 space-y-2">
            <div class="flex items-center bg-[var(--color-surface-secondary)] rounded-xl px-4 py-3.5 border-2 transition-all duration-200"
                 :class="activeInput === 'pickup' ? 'border-[#2b8659] bg-[var(--color-surface)] shadow-[0_0_0_3px_rgba(43,134,89,0.12)]' : 'border-transparent'">
              <input v-if="!DEMO_MODE" ref="pickupInput" type="text" placeholder="Pickup location"
                     @focus="activeInput = 'pickup'"
                     class="bg-transparent outline-none w-full text-[15px] font-medium placeholder:text-[var(--color-text-muted)] placeholder:font-normal" />
              <input v-else v-model="pickupText" list="demo-locations-desktop" type="text" placeholder="Pickup — try Cable Beach"
                     @focus="activeInput = 'pickup'"
                     class="bg-transparent outline-none w-full text-[15px] font-medium placeholder:text-[var(--color-text-muted)] placeholder:font-normal" />
            </div>
            <button
              @click="useCurrentLocation"
              :disabled="isLocating"
              class="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-[var(--color-brand)] hover:bg-[var(--color-surface-secondary)] rounded-lg transition-colors"
            >
              <svg v-if="!isLocating" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4m0 12v4m10-10h-4M6 12H2" />
              </svg>
              <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ isLocating ? 'Locating...' : 'Use current location' }}
            </button>
            <div class="flex items-center bg-[var(--color-surface-secondary)] rounded-xl px-4 py-3.5 border-2 transition-all duration-200"
                 :class="activeInput === 'dropoff' ? 'border-[#2b8659] bg-[var(--color-surface)] shadow-[0_0_0_3px_rgba(43,134,89,0.12)]' : 'border-transparent'">
              <input v-if="!DEMO_MODE" ref="dropoffInput" type="text" placeholder="Where to?"
                     @focus="activeInput = 'dropoff'"
                     class="bg-transparent outline-none w-full text-[15px] font-medium placeholder:text-[var(--color-text-muted)] placeholder:font-normal" />
              <input v-else v-model="dropoffText" list="demo-locations-desktop" type="text" placeholder="Destination — try Airport"
                     @focus="activeInput = 'dropoff'"
                     class="bg-transparent outline-none w-full text-[15px] font-medium placeholder:text-[var(--color-text-muted)] placeholder:font-normal" />
            </div>
            <datalist id="demo-locations-desktop"><option v-for="loc in DEMO_LOCATIONS" :key="loc" :value="loc" /></datalist>
          </div>
        </div>

        <p v-if="DEMO_MODE && !hasRoute" class="text-[var(--color-brand)] text-[12px] mt-3 ml-[22px] font-medium">Demo mode — enter any two spots to see live pricing</p>
        <div v-if="!mapsReady && !error && !DEMO_MODE" class="text-[var(--color-text-muted)] text-sm text-center py-10">Loading map...</div>
        <div v-if="error" class="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-xl px-4 py-3 mt-3">{{ error }}</div>
        <div v-if="isCalculating" class="flex items-center gap-2.5 text-[var(--color-text-muted)] text-[13px] mt-4 ml-[22px]">
          <span class="w-4 h-4 border-2 border-[var(--color-border)] border-t-[#2b8659] rounded-full animate-spin"></span>
          Calculating route...
        </div>

        <div v-if="hasRoute" class="mt-6">
          <div class="flex items-center gap-2 mb-4">
            <div class="inline-flex items-center gap-1.5 bg-[var(--color-surface-secondary)] rounded-full px-3 py-1.5">
              <svg class="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
              <span class="text-[12px] font-semibold text-[var(--color-text-secondary)]">{{ distanceMiles.toFixed(1) }} mi</span>
            </div>
            <div class="inline-flex items-center gap-1.5 bg-[var(--color-surface-secondary)] rounded-full px-3 py-1.5">
              <svg class="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span class="text-[12px] font-semibold text-[var(--color-text-secondary)]">~{{ Math.round(durationMinutes) }} min</span>
            </div>
          </div>
          <p class="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 px-1">Choose your ride</p>
          <div class="space-y-2">
            <button v-for="vehicle in VEHICLE_TYPES" :key="vehicle.id" @click="selectedVehicle = vehicle.id"
                    class="w-full flex items-center justify-between px-4 py-4 rounded-2xl border-2 transition-all duration-200"
                    :class="selectedVehicle === vehicle.id ? 'border-[#2b8659] bg-[#2b8659]/[0.06] shadow-[0_0_0_3px_rgba(43,134,89,0.08)]' : 'border-transparent bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-secondary)]'">
              <div class="flex items-center gap-3.5">
                <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl" :class="selectedVehicle === vehicle.id ? 'bg-[#2b8659]/15' : 'bg-[var(--color-surface)]'">{{ vehicle.icon }}</div>
                <div class="text-left">
                  <div class="text-[15px] font-bold">{{ vehicle.name }}</div>
                  <div class="text-[12px] text-[var(--color-text-muted)] mt-0.5">{{ vehicle.desc }}</div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-[17px] font-bold" :class="selectedVehicle === vehicle.id ? 'text-[var(--color-brand)]' : ''">{{ formatFare(fareEstimates[vehicle.id]) }}</div>
              </div>
            </button>
          </div>
          <div class="flex gap-2.5 mt-5">
            <button @click="requestRide" :disabled="!canRequest"
                    class="flex-1 py-4 bg-[#2b8659] disabled:bg-[var(--color-surface-secondary)] disabled:text-[var(--color-text-muted)] text-white font-bold rounded-2xl text-[15px] transition-all hover:bg-[#236e49] shadow-[0_4px_16px_rgba(43,134,89,0.3)] disabled:shadow-none">
              {{ isSubmitting ? 'Requesting...' : 'Request Ride' }}
            </button>
            <button @click="showSchedulePicker = true" :disabled="!canRequest"
                    class="w-[52px] flex-shrink-0 flex items-center justify-center bg-[var(--color-surface-secondary)] disabled:bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] disabled:text-[var(--color-text-muted)] rounded-2xl transition-all hover:opacity-90 active:scale-[0.97] border border-[var(--color-border)]"
                    title="Schedule for later">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Schedule Ride Picker -->
    <GuestInfoSheet ref="guestSheetRef" :show="showGuestSheet" @submit="handleGuestSubmit" @close="showGuestSheet = false" />
    <ScheduleRidePicker :show="showSchedulePicker" @close="showSchedulePicker = false" @confirm="scheduleRide" />
    <CardCollectionSheet ref="cardSheetRef" :show="showCardSheet" @submit="handleCardSubmit" @close="showCardSheet = false" />

    <!-- Toast -->
    <Transition name="fade">
      <div v-if="toast" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] bg-[#191f1c] text-white text-[13px] font-medium px-5 py-3 rounded-full shadow-lg">
        {{ toast }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
