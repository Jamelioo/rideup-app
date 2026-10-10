<script>
export default { name: 'RiderBooking' }
</script>

<script setup>
import BrandLogo from '../../components/BrandLogo.vue'
import { ref, onMounted, onUnmounted, onActivated, computed, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '../../lib/supabase'
import { apiPost } from '../../lib/api'
import { loadSettings, useSettings } from '../../lib/settings'
import { enablePushNotifications } from '../../lib/push'
import { loadGoogleMaps, reverseGeocode } from '../../lib/useGoogleMaps'
import { calculateFare, formatFare, VEHICLE_TYPES, isAirportPickup, AIRPORT_FEE_CENTS, STOP_MINUTES, normalizeSurge } from '../../lib/pricing'
import { getSavedPromo, savePromo, clearSavedPromo, checkPromo, loadRewards, previewDiscounts } from '../../lib/rewards'
import { DEMO_MODE, DEMO_LOCATIONS, fakeRoute } from '../../lib/demoMode'
import GoogleMap from '../../components/GoogleMap.vue'
import HarborBackdrop from '../../components/HarborBackdrop.vue'
import SideMenu from '../../components/SideMenu.vue'
import ScheduleRidePicker from '../../components/ScheduleRidePicker.vue'
import GuestInfoSheet from '../../components/GuestInfoSheet.vue'
import CardCollectionSheet from '../../components/CardCollectionSheet.vue'
import PhoneNumberSheet from '../../components/PhoneNumberSheet.vue'
import WhoIsRiding from '../../components/WhoIsRiding.vue'
import { toE164, phoneIsVerified } from '../../lib/phone'
import { riderHasPhone, saveRiderPhone, phoneReminderShown, rememberPhoneReminder } from '../../lib/riderPhone'
import { trackRideBooked } from '../../lib/adTracking'
import { SCHEDULING_ENABLED } from '../../lib/features'
import { useAvailability } from '../../lib/useAvailability'
import { availabilityFor, canBook, unavailableNotice, optionStatus } from '../../lib/availability'

const router = useRouter()
const route = useRoute()
const menuOpen = ref(false)
const pickupInput = ref(null)
const dropoffInput = ref(null)
// The phone sheet and the desktop panel each have their own pair of address fields.
const pickupInputDesktop = ref(null)
const dropoffInputDesktop = ref(null)
const stopInput = ref(null)
const stopInputDesktop = ref(null)

const pickup = ref(null)
const dropoff = ref(null)
const pickupText = ref('')
// One extra stop on the way (Uber-style "Add stop").
const stop = ref(null)
// Booking for someone else: { name, phone } or null for the rider themselves.
const passenger = ref(null)
const stopOpen = ref(false)
const dropoffText = ref('')

const selectedVehicle = ref('standard')
// Extra minutes live traffic adds to this trip (already included in the price).
const trafficDelayMinutes = ref(0)
const heavyTraffic = computed(() => durationMinutes.value && trafficDelayMinutes.value >= 3 && trafficDelayMinutes.value / durationMinutes.value >= 0.15)
// XL and Premium are only offered once an admin switches them on (Admin → Settings); Go is always offered.
const appSettings = useSettings()
const availableVehicles = computed(() => VEHICLE_TYPES.filter((v) =>
  v.id === 'standard' || (v.id === 'xl' && appSettings.value.offer_xl) || (v.id === 'premium' && appSettings.value.offer_premium)))
watch(availableVehicles, (list) => {
  if (!list.some((v) => v.id === selectedVehicle.value)) selectedVehicle.value = 'standard'
})
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
const showPhoneSheet = ref(false)
const phoneSheetRef = ref(null)
const phoneSheetMode = ref('book') // 'book': asked while requesting a ride; 'remind': the one-off reminder

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
  const attach = (input, kind) => {
    if (!input) return
    const ac = new maps.places.Autocomplete(input, { bounds, strictBounds: true, fields: ['formatted_address', 'geometry'] })
    ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      if (!place.geometry) return
      const location = { address: place.formatted_address, lat: place.geometry.location.lat(), lng: place.geometry.location.lng() }
      if (kind === 'pickup') {
        pickup.value = location
        activeInput.value = 'dropoff'
        visibleInput('dropoff')?.focus()
      } else if (kind === 'stop') {
        stop.value = location
      } else {
        dropoff.value = location
      }
      maybeCalculateRoute()
    })
  }
  attach(pickupInput.value, 'pickup')
  attach(pickupInputDesktop.value, 'pickup')
  attach(dropoffInput.value, 'dropoff')
  attach(dropoffInputDesktop.value, 'dropoff')
  attach(stopInput.value, 'stop')
  attach(stopInputDesktop.value, 'stop')
  syncAddressFields()
}

// Whichever copy of the field is on screen (phone sheet or desktop panel).
function visibleInput(kind) {
  const pair = kind === 'pickup' ? [pickupInput.value, pickupInputDesktop.value]
    : kind === 'stop' ? [stopInput.value, stopInputDesktop.value]
    : [dropoffInput.value, dropoffInputDesktop.value]
  return pair.find((el) => el && el.offsetParent !== null) || pair[0]
}

// Keep every address field showing the chosen pickup/destination, however it was set
// (suggestion, map tap, dragged pin, current location, or coming back to this screen).
function syncAddressFields() {
  const fields = [
    [pickupInput.value, pickup.value], [pickupInputDesktop.value, pickup.value],
    [dropoffInput.value, dropoff.value], [dropoffInputDesktop.value, dropoff.value],
    [stopInput.value, stop.value], [stopInputDesktop.value, stop.value],
  ]
  for (const [el, loc] of fields) {
    if (el && document.activeElement !== el && loc?.address) el.value = loc.address
  }
}
watch([pickup, dropoff, stop], () => nextTick(syncAddressFields), { deep: true })

function openStop() {
  stopOpen.value = true
  activeInput.value = 'stop'
  nextTick(() => visibleInput('stop')?.focus())
}

function removeStop() {
  stop.value = null
  stopOpen.value = false
  for (const el of [stopInput.value, stopInputDesktop.value]) if (el) el.value = ''
  if (activeInput.value === 'stop') activeInput.value = 'dropoff'
  maybeCalculateRoute()
}
onActivated(() => nextTick(syncAddressFields))
// Opened from the landing page's "Pickup location" / "Where to?" (/book?focus=pickup|dropoff): put the cursor
// in that field, like Uber. Only the visible copy (phone or desktop layout) is focused; the hint is then removed
// from the address so going back doesn't refocus.
function focusRequestedField() {
  const field = route.query.focus
  if (field !== 'pickup' && field !== 'dropoff') return
  nextTick(() => {
    const input = [...document.querySelectorAll(`input[data-field="${field}"]`)].find((el) => el.offsetParent !== null)
    if (input && !input.value) input.focus()
    const { focus, ...rest } = route.query
    router.replace({ query: rest })
  })
}
onMounted(focusRequestedField)
onActivated(focusRequestedField)

async function handleMapTap(latlng) {
  const address = await reverseGeocode(latlng.lat, latlng.lng)
  const location = { address, lat: latlng.lat, lng: latlng.lng }
  if (activeInput.value === 'pickup') {
    pickup.value = location
    activeInput.value = 'dropoff'
  } else if (activeInput.value === 'stop') {
    stop.value = location
    activeInput.value = 'dropoff'
  } else {
    dropoff.value = location
  }
  maybeCalculateRoute()
}

async function handleMarkerDrag(type, latlng) {
  const address = await reverseGeocode(latlng.lat, latlng.lng)
  const location = { address, lat: latlng.lat, lng: latlng.lng }
  if (type === 'pickup') {
    pickup.value = location
  } else {
    dropoff.value = location
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
    {
      origin: { lat: pickup.value.lat, lng: pickup.value.lng },
      destination: { lat: dropoff.value.lat, lng: dropoff.value.lng },
      waypoints: stop.value ? [{ location: { lat: stop.value.lat, lng: stop.value.lng }, stopover: true }] : [],
      travelMode: window.google.maps.TravelMode.DRIVING,
      // Live traffic, like Uber's upfront price: rush hour costs more, quiet hours never less than normal.
      drivingOptions: { departureTime: new Date(), trafficModel: 'bestguess' },
    },
    (result, status) => {
      isCalculating.value = false
      if (status !== 'OK') { error.value = "Couldn't calculate a route between these locations."; return }
      const legs = result.routes[0].legs
      distanceMiles.value = legs.reduce((sum, l) => sum + l.distance.value, 0) / 1609.34
      const normal = legs.reduce((sum, l) => sum + l.duration.value, 0)
      // Google only gives live-traffic times for trips without stops.
      const withTraffic = legs.length === 1 ? legs[0].duration_in_traffic?.value || 0 : 0
      durationMinutes.value = Math.max(normal, withTraffic) / 60 + (stop.value ? STOP_MINUTES : 0)
      trafficDelayMinutes.value = Math.max(0, (withTraffic - normal) / 60)
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

// ── Busy-time pricing: the database says how busy it is around the pickup; refreshed every minute ──
const surge = ref(1)
const busy = computed(() => surge.value > 1)
async function refreshSurge() {
  if (DEMO_MODE || !pickup.value) { surge.value = 1; return }
  const { data, error: surgeErr } = await supabase.rpc('surge_multiplier_at', { p_lat: pickup.value.lat, p_lng: pickup.value.lng })
  if (!surgeErr && data != null) surge.value = normalizeSurge(data)
}
watch(() => pickup.value && `${pickup.value.lat},${pickup.value.lng}`, refreshSurge)
const surgeTimer = setInterval(() => { if (pickup.value && dropoff.value) refreshSurge() }, 60_000)
onUnmounted(() => clearInterval(surgeTimer))
onActivated(refreshSurge)

const fareEstimates = computed(() => {
  if (!distanceMiles.value || !durationMinutes.value) return {}
  const estimates = {}
  for (const v of VEHICLE_TYPES) {
    let fare = calculateFare(distanceMiles.value, durationMinutes.value, v.id, { pickup: pickup.value, surge: surge.value, stop: !!stop.value })
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

// Route and price ready. Scheduling for later only needs this; booking now also needs a car that can come.
const routeReady = computed(() => pickup.value && dropoff.value && fareEstimates.value[selectedVehicle.value] && !isSubmitting.value)

// ── Can a car come now? Checked when the pickup changes and every 30 seconds (Uber: "No cars available") ──
const { availability, refresh: refreshAvailability } = useAvailability(pickup)
const selectedAvailability = computed(() => availabilityFor(availability.value, selectedVehicle.value))
const carsUnavailable = computed(() => !canBook(selectedAvailability.value))
const noCarsNotice = computed(() => unavailableNotice(selectedAvailability.value))
// Another ride option that can come now, offered when the chosen one can't (e.g. no XL driver online).
const availableAlternative = computed(() => (selectedAvailability.value && selectedAvailability.value.state !== 'available'
  ? availableVehicles.value.find((v) => v.id !== selectedVehicle.value && availabilityFor(availability.value, v.id)?.state === 'available') || null
  : null))
const optionLine = (type) => {
  const entry = availabilityFor(availability.value, type)
  return { text: optionStatus(entry), unavailable: !canBook(entry) }
}
const canRequest = computed(() => routeReady.value && !carsUnavailable.value)
const hasRoute = computed(() => distanceMiles.value && !isCalculating.value)

const emit = defineEmits(['requested', 'existing-ride'])

// Card on file, shown above the request button (Uber: "Visa •••• 4242").
const paymentLabel = ref('')
const hasCardOnFile = ref(false)
const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Card')
async function loadPaymentMethod() {
  if (DEMO_MODE) { paymentLabel.value = 'Visa •••• 4242'; hasCardOnFile.value = true; return }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { paymentLabel.value = 'Pay by card · added at the next step'; return }
  const { data } = await supabase.from('riders').select('payment_method_id, card_brand, card_last4').eq('auth_user_id', session.user.id).maybeSingle()
  hasCardOnFile.value = !!data?.payment_method_id
  paymentLabel.value = hasCardOnFile.value
    ? `${capitalize(data.card_brand)}${data.card_last4 ? ' •••• ' + data.card_last4 : ''}`
    : 'Add a card at the next step'
}
onMounted(loadPaymentMethod)

// ── Promo codes, referral discount and ride credit (the database applies them; this previews them) ──
const rewards = ref({ credit_cents: 0, referral_discount_pending: false })
const promo = ref(getSavedPromo())
const promoOpen = ref(false)
const promoInput = ref('')
const promoError = ref('')
const promoBusy = ref(false)
const airportPickup = computed(() => isAirportPickup(pickup.value))
const discounts = computed(() => previewDiscounts(fareEstimates.value[selectedVehicle.value], {
  promo: promo.value,
  referralPending: rewards.value.referral_discount_pending,
  creditCents: rewards.value.credit_cents,
}))

async function loadRiderRewards() {
  if (DEMO_MODE) return
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  rewards.value = (await loadRewards()) || rewards.value
  // A saved code may have been used or expired since it was entered.
  if (promo.value) {
    const res = await checkPromo(promo.value.code)
    if (!res.ok) { clearSavedPromo(); promo.value = null }
  }
}
onMounted(loadRiderRewards)

async function applyPromo() {
  const code = promoInput.value.trim().toUpperCase()
  if (!code) return
  promoError.value = ''
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { promoError.value = 'Book once (or log in) to use promo codes.'; return }
  promoBusy.value = true
  const res = await checkPromo(code)
  promoBusy.value = false
  if (!res.ok) { promoError.value = res.message; return }
  promo.value = res.promo
  savePromo(res.promo)
  promoOpen.value = false
  promoInput.value = ''
}

function removePromo() {
  promo.value = null
  clearSavedPromo()
}

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
      drivers_alerted: selectedAvailability.value ? selectedAvailability.value.state === 'available' : null,
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

  const [{ data: rider, error: riderErr }, settings] = await Promise.all([
    supabase.from('riders').select('id, phone, payment_method_id').eq('auth_user_id', user.id).maybeSingle(),
    loadSettings(),
  ])

  if (settings.require_verified_phone && !phoneIsVerified(user, rider?.phone)) {
    isSubmitting.value = false
    router.push({ path: '/verify-phone', query: { redirect: '/book' } })
    return
  }

  // A number for the driver to call or text at pickup. Accounts made before sign-up asked for one add it here.
  if (!riderErr && !(await riderHasPhone(user, rider))) {
    isSubmitting.value = false
    phoneSheetMode.value = 'book'
    showPhoneSheet.value = true
    return
  }

  if (!rider?.payment_method_id) {
    isSubmitting.value = false
    showCardSheet.value = true
    return
  }

  await createRideForUser(user)
}

// One place that finds (or creates) the signed-in user's rider row.
// Sign-up creates a bare row via a database trigger, so guest details are written onto it when given.
async function ensureRider(user, guestInfo = null) {
  const { data: existing } = await supabase
    .from('riders')
    .select('id, name, phone, payment_method_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (existing) {
    if (guestInfo && (existing.name !== guestInfo.name || existing.phone !== guestInfo.phone)) {
      await supabase
        .from('riders')
        .update({ name: guestInfo.name, phone: guestInfo.phone, is_guest: true })
        .eq('id', existing.id)
    }
    return existing
  }

  const { data: created, error: createErr } = await supabase
    .from('riders')
    .insert({
      auth_user_id: user.id,
      name: guestInfo?.name || user.user_metadata?.name || user.email?.split('@')[0] || 'Rider',
      email: user.email || '',
      phone: guestInfo?.phone || toE164(user.user_metadata?.phone || '') || user.phone || '',
      is_guest: !!guestInfo,
    })
    .select('id, name, phone, payment_method_id')
    .single()
  return createErr ? null : created
}

async function createRideForUser(user, guestInfo = null) {
  isSubmitting.value = true
  error.value = null
  // One last check just before booking: if every driver just started a trip, the note above the button says so
  // now instead of after a search. An unknown answer (the check failed) never blocks booking.
  const latest = availabilityFor(await refreshAvailability({ timeoutMs: 4000 }), selectedVehicle.value)
  if (!canBook(latest)) {
    showGuestSheet.value = false // after signing up or adding a card, show the note rather than leave a sheet open
    showCardSheet.value = false
    isSubmitting.value = false
    return
  }
  const fare = fareEstimates.value[selectedVehicle.value]

  try {
    const rider = await ensureRider(user, guestInfo)
    if (!rider) { error.value = 'Could not create your rider profile. Please try again.'; isSubmitting.value = false; return }

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
      promo_code: promo.value?.code || null,
      surge_multiplier: surge.value,
      stop_address: stop.value?.address || null, stop_lat: stop.value?.lat ?? null, stop_lng: stop.value?.lng ?? null,
      passenger_name: passenger.value?.name || null, passenger_phone: passenger.value?.phone || null,
    }).select().single()
    if (rideErr) {
      isSubmitting.value = false
      if (rideErr.code === '23505') {
        // Already has a ride in progress: take them to it instead of booking a second one.
        showGuestSheet.value = false
        emit('existing-ride')
        return
      }
      if (rideErr.hint === 'passenger') {
        error.value = rideErr.message
        return
      }
      if (rideErr.hint === 'surge') {
        // It got busier between seeing the price and booking: show the new price and let them confirm.
        await refreshSurge()
        error.value = rideErr.message
        return
      }
      if (rideErr.hint === 'promo') {
        // The code stopped being valid (used, expired): drop it and let the rider book at the normal price.
        removePromo()
        error.value = `${rideErr.message} We removed it. Tap the button again to book at the normal price.`
        return
      }
      if (/verify your phone/i.test(rideErr.message)) {
        router.push({ path: '/verify-phone', query: { redirect: '/book' } })
        return
      }
      error.value = /suspended/i.test(rideErr.message)
        ? 'Your account is suspended. Please contact support.'
        : 'Something went wrong requesting your ride. Please try again.'
      return
    }

    showGuestSheet.value = false
    passenger.value = null // the next booking is for the rider again unless they choose otherwise
    trackRideBooked(ride)
    // Whether a driver could be alerted decides how long the search runs (unknown: the full length).
    emit('requested', { ...ride, drivers_alerted: latest ? latest.state === 'available' : null })
    isSubmitting.value = false
    // Wake up nearby drivers, and offer trip alerts to the rider ("driver arrived" while the app is closed).
    apiPost('/api/trip-event', { rideId: ride.id, event: 'requested' }).catch(() => {})
    enablePushNotifications()
  } catch (err) {
    error.value = 'Connection error. Please try again.'
    isSubmitting.value = false
  }
}

async function saveCardForUser(user, cardElement, stripe) {
  const res = await apiPost('/api/create-setup-intent', {
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'Rider',
  })
  const setup = await res.json().catch(() => ({}))
  if (!res.ok || !setup.client_secret) {
    console.error('create-setup-intent failed', res.status, setup)
    throw new Error(setup.error || `Couldn't start card setup (error ${res.status}). Please try again.`)
  }

  const { setupIntent, error: stripeError } = await stripe.confirmCardSetup(setup.client_secret, {
    payment_method: { card: cardElement },
  })
  if (stripeError) throw new Error(stripeError.message)

  // The server re-verifies the SetupIntent with Stripe and stores the card (clients can't write it).
  const saveRes = await apiPost('/api/save-payment-method', { setupIntentId: setupIntent.id })
  const saved = await saveRes.json().catch(() => ({}))
  if (!saveRes.ok || !saved.success) {
    console.error('save-payment-method failed', saveRes.status, saved)
    throw new Error(saved.error || `Your card was verified but couldn't be saved (error ${saveRes.status}). Please try again.`)
  }

  return { customer_id: setup.customer_id, payment_method_id: setupIntent.payment_method }
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

    const guestRider = await ensureRider(data.user, { name, phone })
    if (!guestRider) {
      if (guestSheetRef.value) guestSheetRef.value.reset()
      error.value = 'Could not create your profile. Please try again.'
      return
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
    loadPaymentMethod()

    showCardSheet.value = false
    await createRideForUser(user)
  } catch (err) {
    const message = err.message || 'Could not save card. Please try again.'
    if (cardSheetRef.value) { cardSheetRef.value.reset(); cardSheetRef.value.setError(message) }
    error.value = message
  }
}

// The number from "Add your mobile number". While booking, carry on with the request (the card comes next if needed).
async function handlePhoneSubmit(phone) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { phoneSheetRef.value?.setError('Session expired. Please log in again.'); return }
  try {
    await saveRiderPhone(user, phone)
  } catch {
    phoneSheetRef.value?.setError('Couldn’t save your number. Check your connection and try again.')
    return
  }
  showPhoneSheet.value = false
  if (phoneSheetMode.value === 'book') requestRide()
  else showToast('Mobile number saved')
}

// Accounts made before sign-up asked for a number get asked once here; booking a ride asks anyway. Never over
// another sheet, while they're typing an address, or once they have a price to look at.
async function remindAboutPhone() {
  if (DEMO_MODE) return
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user || user.is_anonymous || phoneReminderShown(user.id)) return
  const { data: rider, error: riderErr } = await supabase.from('riders').select('id, phone').eq('auth_user_id', user.id).maybeSingle()
  if (riderErr || !rider || await riderHasPhone(user, rider)) return
  if (showGuestSheet.value || showCardSheet.value || showPhoneSheet.value || hasRoute.value || document.activeElement?.tagName === 'INPUT') return
  rememberPhoneReminder(user.id)
  phoneSheetMode.value = 'remind'
  showPhoneSheet.value = true
}
onMounted(remindAboutPhone)

async function scheduleRide({ date, time, summary }) {
  if (!SCHEDULING_ENABLED || !routeReady.value) return
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
    const rider = await ensureRider(user)
    if (!rider) { error.value = 'Could not create your rider profile.'; isScheduling.value = false; return }
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
        :stop="stop"
        show-traffic
        editable
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
      <div class="pointer-events-auto bg-[var(--color-surface)] shadow-[0_2px_12px_rgba(0,0,0,0.1)] rounded-full px-5 py-2 text-[17px] font-bold tracking-tight"><BrandLogo /></div>
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
              <input v-if="!DEMO_MODE" ref="pickupInput" data-field="pickup" aria-label="Pickup location" type="text" placeholder="Pickup location"
                     @focus="activeInput = 'pickup'"
                     class="bg-transparent outline-none w-full py-3 -my-3 text-[15px] font-medium placeholder:text-[var(--color-text-muted)] placeholder:font-normal" />
              <input v-else v-model="pickupText" data-field="pickup" aria-label="Pickup location" list="demo-locations" type="text" placeholder="Pickup — try Cable Beach"
                     @focus="activeInput = 'pickup'"
                     class="bg-transparent outline-none w-full py-3 -my-3 text-[15px] font-medium placeholder:text-[var(--color-text-muted)] placeholder:font-normal" />
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
            <div v-if="!DEMO_MODE" v-show="stopOpen" class="flex items-center bg-[var(--color-surface-secondary)] rounded-xl px-4 py-3 border-2 transition-all duration-200"
                 :class="activeInput === 'stop' ? 'border-[#2b8659] bg-[var(--color-surface)] shadow-[0_0_0_3px_rgba(43,134,89,0.12)]' : 'border-transparent'">
              <input ref="stopInput" type="text" placeholder="Add a stop" aria-label="Stop on the way"
                     @focus="activeInput = 'stop'"
                     class="bg-transparent outline-none w-full py-3 -my-3 text-[15px] font-medium placeholder:text-[var(--color-text-muted)] placeholder:font-normal" />
              <button type="button" @click="removeStop" class="ml-1 w-11 h-11 -mr-3 flex items-center justify-center text-[var(--color-text-muted)]" aria-label="Remove stop">✕</button>
            </div>
            <div class="flex items-center bg-[var(--color-surface-secondary)] rounded-xl px-4 py-3 border-2 transition-all duration-200"
                 :class="activeInput === 'dropoff' ? 'border-[#2b8659] bg-[var(--color-surface)] shadow-[0_0_0_3px_rgba(43,134,89,0.12)]' : 'border-transparent'">
              <input v-if="!DEMO_MODE" ref="dropoffInput" data-field="dropoff" aria-label="Destination" type="text" placeholder="Where to?"
                     @focus="activeInput = 'dropoff'"
                     class="bg-transparent outline-none w-full py-3 -my-3 text-[15px] font-medium placeholder:text-[var(--color-text-muted)] placeholder:font-normal" />
              <input v-else v-model="dropoffText" data-field="dropoff" aria-label="Destination" list="demo-locations" type="text" placeholder="Destination — try Airport"
                     @focus="activeInput = 'dropoff'"
                     class="bg-transparent outline-none w-full py-3 -my-3 text-[15px] font-medium placeholder:text-[var(--color-text-muted)] placeholder:font-normal" />
            </div>
            <button v-if="!DEMO_MODE && !stopOpen" type="button" @click="openStop"
                    class="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-[var(--color-brand)] rounded-lg min-h-[44px]">
              <span aria-hidden="true" class="text-[16px] leading-none">+</span> Add stop
            </button>
            <datalist id="demo-locations"><option v-for="loc in DEMO_LOCATIONS" :key="loc" :value="loc" /></datalist>
          </div>
        </div>

        <p v-if="DEMO_MODE && !hasRoute" class="text-[var(--color-brand)] text-[12px] mt-3 ml-[22px] font-medium">Demo mode — enter any two spots to see live pricing</p>
        <div v-if="!mapsReady && !error && !DEMO_MODE" class="text-[var(--color-text-muted)] text-sm text-center py-10">Loading map...</div>
        <div v-if="error" class="bg-red-50 border border-red-200 text-[var(--color-danger)] text-[13px] rounded-xl px-4 py-3 mt-3">{{ error }}</div>
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
            <div v-if="heavyTraffic" class="inline-flex items-center gap-1.5 bg-amber-500/15 rounded-full px-3 py-1.5" title="Live traffic is adding time to this trip. It's included in the price.">
              <span class="w-2 h-2 rounded-full bg-[#e8710a]" aria-hidden="true"></span>
              <span class="text-[12px] font-semibold text-[var(--color-text-primary)]">Heavy traffic · +{{ Math.round(trafficDelayMinutes) }} min</span>
            </div>
            <div v-if="busy" class="inline-flex items-center gap-1.5 bg-[#2b8659]/12 rounded-full px-3 py-1.5" title="More people are requesting rides than there are drivers nearby, so fares are higher for now.">
              <span aria-hidden="true">⚡</span>
              <span class="text-[12px] font-semibold text-[var(--color-text-primary)]">Busy</span>
            </div>
          </div>
          <p class="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2.5 px-1">Choose your ride</p>
          <div class="space-y-2">
            <button v-for="vehicle in availableVehicles" :key="vehicle.id" @click="selectedVehicle = vehicle.id"
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
                <div class="text-[16px] font-bold" :class="[selectedVehicle === vehicle.id ? 'text-[var(--color-brand)]' : '', optionLine(vehicle.id).unavailable ? 'opacity-50' : '']">{{ formatFare(fareEstimates[vehicle.id]) }}</div>
                <div v-if="optionLine(vehicle.id).text" class="text-[12px] mt-0.5 text-[var(--color-text-muted)]" :class="optionLine(vehicle.id).unavailable ? 'font-semibold' : ''">{{ optionLine(vehicle.id).text }}</div>
              </div>
            </button>
          </div>
          <div class="sticky bottom-0 z-10 -mx-5 px-5 pt-3 pb-1 mt-3 bg-[var(--color-surface)] border-t border-[var(--color-border)]">
            <div v-if="hasRoute && noCarsNotice" class="mb-2 rounded-xl bg-[var(--color-surface-secondary)] px-3 py-2.5" role="status" aria-live="polite">
              <p class="text-[14px] font-semibold text-[var(--color-text-primary)]">{{ noCarsNotice.title }}</p>
              <p class="text-[12px] leading-snug text-[var(--color-text-muted)] mt-0.5">{{ noCarsNotice.body }}</p>
              <button v-if="availableAlternative" type="button" @click="selectedVehicle = availableAlternative.id" class="mt-1.5 text-[13px] font-semibold text-[var(--color-brand)]">Choose {{ availableAlternative.name }}, available now</button>
            </div>
            <!-- Airport fee, promo / referral discount and credit, shown before booking -->
            <div v-if="hasRoute" class="px-1 mb-2 space-y-1 text-[13px]">
              <p v-if="airportPickup" class="text-[var(--color-text-secondary)]">Includes {{ formatFare(AIRPORT_FEE_CENTS) }} airport pickup fee</p>
              <p v-if="busy" class="text-[var(--color-text-secondary)]">Fares are higher right now because it’s busy. Drivers earn more too.</p>
              <p v-if="stop" class="text-[var(--color-text-secondary)]">Includes your stop at {{ stop.address.split(',')[0] }}. Please keep the stop to about 3 minutes.</p>
              <div v-if="discounts.discount || discounts.credit" class="flex items-center justify-between gap-2 rounded-xl bg-[#2b8659]/10 px-3 py-2">
                <span class="text-[var(--color-text-primary)]">
                  <span v-if="discounts.discount">{{ discounts.label }} −{{ formatFare(discounts.discount) }}</span>
                  <span v-if="discounts.discount && discounts.credit"> · </span>
                  <span v-if="discounts.credit">Credit −{{ formatFare(discounts.credit) }}</span>
                </span>
                <span class="font-bold text-[var(--color-brand)] whitespace-nowrap">You pay {{ formatFare(discounts.charge) }}</span>
              </div>
              <div v-if="!DEMO_MODE" class="flex items-center gap-3">
                <button v-if="!promo && !promoOpen" type="button" @click="promoOpen = true" class="text-[var(--color-brand)] font-semibold py-1">Add promo code</button>
                <button v-if="promo" type="button" @click="removePromo" class="text-[var(--color-text-muted)] py-1">Remove {{ promo.code }}</button>
              </div>
              <form v-if="promoOpen" @submit.prevent="applyPromo" class="flex gap-2">
                <label class="sr-only" for="promo-code">Promo code</label>
                <input id="promo-code" v-model="promoInput" autocapitalize="characters" autocomplete="off" placeholder="Promo code"
                       class="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] uppercase" />
                <button type="submit" :disabled="promoBusy" class="px-4 rounded-xl bg-[#2b8659] text-white font-semibold disabled:opacity-50">{{ promoBusy ? '…' : 'Apply' }}</button>
                <button type="button" @click="promoOpen = false; promoError = ''" class="px-2 text-[var(--color-text-muted)]" aria-label="Close">✕</button>
              </form>
              <p v-if="promoError" class="text-[var(--color-danger)]" role="alert">{{ promoError }}</p>
            </div>
            <WhoIsRiding v-model="passenger" />
            <component :is="hasCardOnFile && !DEMO_MODE ? 'router-link' : 'div'" :to="hasCardOnFile && !DEMO_MODE ? '/payments' : undefined"
                       class="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)] mb-2.5 px-1">
              <svg class="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
              <span class="flex-1 truncate">{{ paymentLabel || 'Card' }}</span>
              <span v-if="hasCardOnFile && !DEMO_MODE" class="text-[var(--color-brand)] font-semibold">Change</span>
            </component>
          <div class="flex gap-2.5">
            <button @click="requestRide" :disabled="!canRequest"
                    class="flex-1 py-4 bg-[#2b8659] disabled:bg-[var(--color-surface-secondary)] disabled:text-[var(--color-text-muted)] text-white font-bold rounded-2xl text-[15px] transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(43,134,89,0.3)] disabled:shadow-none">
              {{ isSubmitting ? 'Requesting…' : carsUnavailable ? 'No cars available' : `Choose ${VEHICLE_TYPES.find(v => v.id === selectedVehicle)?.name || 'ride'}` }}
            </button>
            <button v-if="SCHEDULING_ENABLED" @click="showSchedulePicker = true" :disabled="!routeReady"
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
    </div>

    <!-- DESKTOP: Side panel -->
    <div class="hidden md:flex absolute inset-y-0 left-0 z-10 w-[400px] bg-[var(--color-surface)] shadow-[4px_0_24px_rgba(0,0,0,0.08)] flex-col">
      <!-- Panel header -->
      <div class="px-6 pt-8 pb-2 flex items-center justify-between">
        <div class="text-[22px] font-bold tracking-tight"><BrandLogo /></div>
        <button @click="menuOpen = true" class="w-11 h-11 rounded-full hover:bg-[var(--color-surface-secondary)] flex items-center justify-center transition-colors" aria-label="Open menu">
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
              <input v-if="!DEMO_MODE" ref="pickupInputDesktop" data-field="pickup" aria-label="Pickup location" type="text" placeholder="Pickup location"
                     @focus="activeInput = 'pickup'"
                     class="bg-transparent outline-none w-full py-3 -my-3 text-[15px] font-medium placeholder:text-[var(--color-text-muted)] placeholder:font-normal" />
              <input v-else v-model="pickupText" data-field="pickup" aria-label="Pickup location" list="demo-locations-desktop" type="text" placeholder="Pickup — try Cable Beach"
                     @focus="activeInput = 'pickup'"
                     class="bg-transparent outline-none w-full py-3 -my-3 text-[15px] font-medium placeholder:text-[var(--color-text-muted)] placeholder:font-normal" />
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
            <div v-if="!DEMO_MODE" v-show="stopOpen" class="flex items-center bg-[var(--color-surface-secondary)] rounded-xl px-4 py-3.5 border-2 transition-all duration-200"
                 :class="activeInput === 'stop' ? 'border-[#2b8659] bg-[var(--color-surface)] shadow-[0_0_0_3px_rgba(43,134,89,0.12)]' : 'border-transparent'">
              <input ref="stopInputDesktop" type="text" placeholder="Add a stop" aria-label="Stop on the way"
                     @focus="activeInput = 'stop'"
                     class="bg-transparent outline-none w-full py-3 -my-3 text-[15px] font-medium placeholder:text-[var(--color-text-muted)] placeholder:font-normal" />
              <button type="button" @click="removeStop" class="ml-1 w-11 h-11 -mr-3 flex items-center justify-center text-[var(--color-text-muted)]" aria-label="Remove stop">✕</button>
            </div>
            <div class="flex items-center bg-[var(--color-surface-secondary)] rounded-xl px-4 py-3.5 border-2 transition-all duration-200"
                 :class="activeInput === 'dropoff' ? 'border-[#2b8659] bg-[var(--color-surface)] shadow-[0_0_0_3px_rgba(43,134,89,0.12)]' : 'border-transparent'">
              <input v-if="!DEMO_MODE" ref="dropoffInputDesktop" data-field="dropoff" aria-label="Destination" type="text" placeholder="Where to?"
                     @focus="activeInput = 'dropoff'"
                     class="bg-transparent outline-none w-full py-3 -my-3 text-[15px] font-medium placeholder:text-[var(--color-text-muted)] placeholder:font-normal" />
              <input v-else v-model="dropoffText" data-field="dropoff" aria-label="Destination" list="demo-locations-desktop" type="text" placeholder="Destination — try Airport"
                     @focus="activeInput = 'dropoff'"
                     class="bg-transparent outline-none w-full py-3 -my-3 text-[15px] font-medium placeholder:text-[var(--color-text-muted)] placeholder:font-normal" />
            </div>
            <button v-if="!DEMO_MODE && !stopOpen" type="button" @click="openStop"
                    class="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-[var(--color-brand)] rounded-lg min-h-[44px]">
              <span aria-hidden="true" class="text-[16px] leading-none">+</span> Add stop
            </button>
            <datalist id="demo-locations-desktop"><option v-for="loc in DEMO_LOCATIONS" :key="loc" :value="loc" /></datalist>
          </div>
        </div>

        <p v-if="DEMO_MODE && !hasRoute" class="text-[var(--color-brand)] text-[12px] mt-3 ml-[22px] font-medium">Demo mode — enter any two spots to see live pricing</p>
        <div v-if="!mapsReady && !error && !DEMO_MODE" class="text-[var(--color-text-muted)] text-sm text-center py-10">Loading map...</div>
        <div v-if="error" class="bg-red-50 border border-red-200 text-[var(--color-danger)] text-[13px] rounded-xl px-4 py-3 mt-3">{{ error }}</div>
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
            <div v-if="heavyTraffic" class="inline-flex items-center gap-1.5 bg-amber-500/15 rounded-full px-3 py-1.5" title="Live traffic is adding time to this trip. It's included in the price.">
              <span class="w-2 h-2 rounded-full bg-[#e8710a]" aria-hidden="true"></span>
              <span class="text-[12px] font-semibold text-[var(--color-text-primary)]">Heavy traffic · +{{ Math.round(trafficDelayMinutes) }} min</span>
            </div>
            <div v-if="busy" class="inline-flex items-center gap-1.5 bg-[#2b8659]/12 rounded-full px-3 py-1.5" title="More people are requesting rides than there are drivers nearby, so fares are higher for now.">
              <span aria-hidden="true">⚡</span>
              <span class="text-[12px] font-semibold text-[var(--color-text-primary)]">Busy</span>
            </div>
          </div>
          <p class="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 px-1">Choose your ride</p>
          <div class="space-y-2">
            <button v-for="vehicle in availableVehicles" :key="vehicle.id" @click="selectedVehicle = vehicle.id"
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
                <div class="text-[17px] font-bold" :class="[selectedVehicle === vehicle.id ? 'text-[var(--color-brand)]' : '', optionLine(vehicle.id).unavailable ? 'opacity-50' : '']">{{ formatFare(fareEstimates[vehicle.id]) }}</div>
                <div v-if="optionLine(vehicle.id).text" class="text-[12px] mt-0.5 text-[var(--color-text-muted)]" :class="optionLine(vehicle.id).unavailable ? 'font-semibold' : ''">{{ optionLine(vehicle.id).text }}</div>
              </div>
            </button>
          </div>
          <div class="sticky bottom-0 z-10 -mx-6 px-6 pt-3 pb-4 mt-4 bg-[var(--color-surface)] border-t border-[var(--color-border)]">
            <div v-if="hasRoute && noCarsNotice" class="mb-2 rounded-xl bg-[var(--color-surface-secondary)] px-3 py-2.5" role="status" aria-live="polite">
              <p class="text-[14px] font-semibold text-[var(--color-text-primary)]">{{ noCarsNotice.title }}</p>
              <p class="text-[12px] leading-snug text-[var(--color-text-muted)] mt-0.5">{{ noCarsNotice.body }}</p>
              <button v-if="availableAlternative" type="button" @click="selectedVehicle = availableAlternative.id" class="mt-1.5 text-[13px] font-semibold text-[var(--color-brand)]">Choose {{ availableAlternative.name }}, available now</button>
            </div>
            <!-- Airport fee, promo / referral discount and credit, shown before booking -->
            <div v-if="hasRoute" class="px-1 mb-2 space-y-1 text-[13px]">
              <p v-if="airportPickup" class="text-[var(--color-text-secondary)]">Includes {{ formatFare(AIRPORT_FEE_CENTS) }} airport pickup fee</p>
              <p v-if="busy" class="text-[var(--color-text-secondary)]">Fares are higher right now because it’s busy. Drivers earn more too.</p>
              <p v-if="stop" class="text-[var(--color-text-secondary)]">Includes your stop at {{ stop.address.split(',')[0] }}. Please keep the stop to about 3 minutes.</p>
              <div v-if="discounts.discount || discounts.credit" class="flex items-center justify-between gap-2 rounded-xl bg-[#2b8659]/10 px-3 py-2">
                <span class="text-[var(--color-text-primary)]">
                  <span v-if="discounts.discount">{{ discounts.label }} −{{ formatFare(discounts.discount) }}</span>
                  <span v-if="discounts.discount && discounts.credit"> · </span>
                  <span v-if="discounts.credit">Credit −{{ formatFare(discounts.credit) }}</span>
                </span>
                <span class="font-bold text-[var(--color-brand)] whitespace-nowrap">You pay {{ formatFare(discounts.charge) }}</span>
              </div>
              <div v-if="!DEMO_MODE" class="flex items-center gap-3">
                <button v-if="!promo && !promoOpen" type="button" @click="promoOpen = true" class="text-[var(--color-brand)] font-semibold py-1">Add promo code</button>
                <button v-if="promo" type="button" @click="removePromo" class="text-[var(--color-text-muted)] py-1">Remove {{ promo.code }}</button>
              </div>
              <form v-if="promoOpen" @submit.prevent="applyPromo" class="flex gap-2">
                <label class="sr-only" for="promo-code">Promo code</label>
                <input id="promo-code" v-model="promoInput" autocapitalize="characters" autocomplete="off" placeholder="Promo code"
                       class="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] uppercase" />
                <button type="submit" :disabled="promoBusy" class="px-4 rounded-xl bg-[#2b8659] text-white font-semibold disabled:opacity-50">{{ promoBusy ? '…' : 'Apply' }}</button>
                <button type="button" @click="promoOpen = false; promoError = ''" class="px-2 text-[var(--color-text-muted)]" aria-label="Close">✕</button>
              </form>
              <p v-if="promoError" class="text-[var(--color-danger)]" role="alert">{{ promoError }}</p>
            </div>
            <WhoIsRiding v-model="passenger" />
            <component :is="hasCardOnFile && !DEMO_MODE ? 'router-link' : 'div'" :to="hasCardOnFile && !DEMO_MODE ? '/payments' : undefined"
                       class="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)] mb-2.5 px-1">
              <svg class="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
              <span class="flex-1 truncate">{{ paymentLabel || 'Card' }}</span>
              <span v-if="hasCardOnFile && !DEMO_MODE" class="text-[var(--color-brand)] font-semibold">Change</span>
            </component>
          <div class="flex gap-2.5">
            <button @click="requestRide" :disabled="!canRequest"
                    class="flex-1 py-4 bg-[#2b8659] disabled:bg-[var(--color-surface-secondary)] disabled:text-[var(--color-text-muted)] text-white font-bold rounded-2xl text-[15px] transition-all hover:bg-[#236e49] shadow-[0_4px_16px_rgba(43,134,89,0.3)] disabled:shadow-none">
              {{ isSubmitting ? 'Requesting…' : carsUnavailable ? 'No cars available' : `Choose ${VEHICLE_TYPES.find(v => v.id === selectedVehicle)?.name || 'ride'}` }}
            </button>
            <button v-if="SCHEDULING_ENABLED" @click="showSchedulePicker = true" :disabled="!routeReady"
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
    </div>

    <!-- Schedule Ride Picker -->
    <GuestInfoSheet ref="guestSheetRef" :show="showGuestSheet" @submit="handleGuestSubmit" @close="showGuestSheet = false" />
    <ScheduleRidePicker v-if="SCHEDULING_ENABLED" :show="showSchedulePicker" @close="showSchedulePicker = false" @confirm="scheduleRide" />
    <CardCollectionSheet ref="cardSheetRef" :show="showCardSheet" @submit="handleCardSubmit" @close="showCardSheet = false" />
    <PhoneNumberSheet ref="phoneSheetRef" :show="showPhoneSheet" :mode="phoneSheetMode" @submit="handlePhoneSubmit" @close="showPhoneSheet = false" />

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
