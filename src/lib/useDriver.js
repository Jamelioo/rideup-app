// src/lib/useDriver.js — driver session state: profile, online status, incoming requests, the active trip.
import { ref, readonly } from 'vue'
import { supabase, supabaseConfigured } from './supabase'
import { DEMO_MODE } from './demoMode'
import { apiPost } from './api'
import { loadSettings } from './settings'
import { enablePushNotifications } from './push'
import { DEMO_DRIVER_PROFILE, generateFakeRideRequest } from './demoDriverMode'

const driver = ref(null)
const isOnline = ref(false)
const currentRide = ref(null)
const incomingRequest = ref(null)
const loading = ref(true)
const acceptError = ref('')
const onlineError = ref('')

const ACTIVE_STATUSES = ['pending_driver_response', 'accepted', 'driver_arrived', 'in_progress']
const REQUEST_POLL_MS = 4000
const MAX_PICKUP_DISTANCE_MILES = 10

let initialized = false
let fakeRequestTimer = null
let pollInterval = null
const dismissedRequests = new Set() // declined / expired locally, so they don't flash back before the server catches up

function showRideNotification(ride) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || document.visibilityState === 'visible') return
  try {
    const n = new Notification('New ride request', {
      body: `${ride.pickup_address || 'Pickup'} → ${ride.dropoff_address || 'Drop-off'}`,
      icon: '/icon-192.png',
      tag: 'ride-request',
    })
    n.onclick = () => { window.focus(); n.close() }
    setTimeout(() => n.close(), 15000)
  } catch { /* Notification API not fully supported */ }
}

// Clears everything tied to the signed-in driver (called on sign-out so the next user on this tab starts clean).
function reset() {
  stopFakeRequests()
  stopPolling()
  driver.value = null
  isOnline.value = false
  currentRide.value = null
  incomingRequest.value = null
  acceptError.value = ''
  onlineError.value = ''
  loading.value = true
  dismissedRequests.clear()
}

function init() {
  if (initialized) return
  initialized = true
  if (DEMO_MODE) {
    driver.value = { ...DEMO_DRIVER_PROFILE }
    loading.value = false
    return
  }
  if (!supabaseConfigured) loading.value = false
}

async function fetchDriver(authUserId) {
  if (DEMO_MODE) {
    driver.value = { ...DEMO_DRIVER_PROFILE }
    loading.value = false
    return
  }
  if (!supabaseConfigured || !authUserId) { loading.value = false; return }

  const { data } = await supabase.from('drivers').select('*').eq('auth_user_id', authUserId).maybeSingle()
  if (data) {
    driver.value = data
    await restoreActiveRide()
    isOnline.value = ['online', 'on_trip'].includes(driver.value.status)
    if (isOnline.value && !currentRide.value) startPolling()
  }
  loading.value = false
}

// --- Trip recovery (Uber: reopening the app always returns you to the trip in progress) ---------------
async function restoreActiveRide() {
  if (!driver.value || DEMO_MODE) return null
  const { data: ride } = await supabase
    .from('rides')
    .select('*')
    .eq('driver_id', driver.value.id)
    .in('status', ACTIVE_STATUSES)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!ride) {
    // A trip that ended while the app was closed: make sure the driver isn't stuck "on trip".
    if (driver.value.status === 'on_trip') await setDriverStatus('online')
    currentRide.value = null
    return null
  }

  if (ride.status === 'pending_driver_response') {
    // The card hold never finished (app closed mid-accept). Finish it now; the server cancels if the card fails.
    const ok = await authorize(ride.id)
    if (!ok) return null
    ride.status = 'accepted'
  }
  currentRide.value = ride
  if (driver.value.status !== 'on_trip') await setDriverStatus('on_trip')
  return ride
}

async function setDriverStatus(status) {
  const { data } = await supabase.from('drivers').update({ status }).eq('id', driver.value.id).select('status').maybeSingle()
  if (data) driver.value = { ...driver.value, status: data.status }
  return data?.status
}

// --- Going online / offline ---------------------------------------------------------------------------
async function goOnline() {
  onlineError.value = ''
  if (DEMO_MODE) {
    isOnline.value = true
    driver.value.status = 'online'
    startFakeRequests()
    return true
  }
  if (!driver.value) return false
  const status = await setDriverStatus('online')
  if (status !== 'online') {
    // The database keeps unapproved drivers and drivers with expired documents offline.
    onlineError.value = !driver.value.approved
      ? 'Your account is under review. We’ll let you know when you can drive.'
      : 'Your licence or insurance on file has expired. Upload renewed documents to go online.'
    isOnline.value = false
    return false
  }
  isOnline.value = true
  enablePushNotifications() // ride requests even when the app is in the background
  startPolling()
  pollRequests()
  return true
}

async function goOffline() {
  isOnline.value = false
  incomingRequest.value = null
  if (DEMO_MODE) {
    driver.value.status = 'offline'
    stopFakeRequests()
    return
  }
  stopPolling()
  if (driver.value) await setDriverStatus('offline')
}

// --- Nearby requests ------------------------------------------------------------------------------------
// The server returns only open requests near the driver, with an approximate pickup and the rider's first name.
let lastPosition = null
function currentPosition() {
  if (lastPosition && Date.now() - lastPosition.at < 30_000) return Promise.resolve(lastPosition)
  if (!('geolocation' in navigator)) return Promise.resolve(null)
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lastPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude, at: Date.now() }
        resolve(lastPosition)
      },
      () => resolve(lastPosition),
      { maximumAge: 30_000, timeout: 5000 }
    )
  })
}

async function pollRequests() {
  if (!driver.value || !isOnline.value || currentRide.value) return
  const pos = await currentPosition()
  const { data, error } = await supabase.rpc('open_ride_requests', {
    p_lat: pos?.lat ?? null,
    p_lng: pos?.lng ?? null,
    p_radius_miles: MAX_PICKUP_DISTANCE_MILES,
  })
  if (error) return
  const open = (data || []).filter((r) => !dismissedRequests.has(r.id))

  // The request on screen was taken, cancelled or expired: close it.
  if (incomingRequest.value && !open.some((r) => r.id === incomingRequest.value.id)) {
    incomingRequest.value = null
  }
  if (!incomingRequest.value && open.length) {
    incomingRequest.value = open[0]
    showRideNotification(open[0])
  }
}

function startPolling() {
  stopPolling()
  pollInterval = setInterval(pollRequests, REQUEST_POLL_MS)
}

function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
}

function startFakeRequests() {
  stopFakeRequests()
  const scheduleNext = () => {
    fakeRequestTimer = setTimeout(() => {
      if (isOnline.value && !incomingRequest.value && !currentRide.value) {
        const fake = generateFakeRideRequest()
        incomingRequest.value = { ...fake, rider_first_name: fake.rider_name?.split(' ')[0], pickup_distance_miles: 1.2 + Math.round(Math.random() * 20) / 10 }
      }
      if (isOnline.value) scheduleNext()
    }, 15000 + Math.random() * 15000)
  }
  scheduleNext()
}

function stopFakeRequests() {
  if (fakeRequestTimer) { clearTimeout(fakeRequestTimer); fakeRequestTimer = null }
}

// --- Accept / decline -------------------------------------------------------------------------------------
const ACCEPT_ERRORS = {
  no_payment_method: 'The rider’s card couldn’t be verified, so the ride was cancelled.',
  card_declined: 'The rider’s card was declined, so the ride was cancelled.',
  payment_failed: 'The rider’s payment couldn’t be authorized, so the ride was cancelled.',
  ride_unavailable: 'This ride is no longer available.',
}

async function authorize(rideId) {
  try {
    const res = await apiPost('/api/authorize-ride', { rideId })
    const result = await res.json().catch(() => ({}))
    if (res.ok && result.success) return true
    acceptError.value = ACCEPT_ERRORS[result.error] || 'Couldn’t confirm payment for this ride. Please try another.'
  } catch {
    acceptError.value = 'Connection problem. Please try again.'
  }
  return false
}

// Returns true only when the ride is claimed AND the rider's card is held.
async function acceptRide(ride) {
  incomingRequest.value = null
  acceptError.value = ''
  dismissedRequests.add(ride.id)

  if (DEMO_MODE) {
    currentRide.value = { ...ride, status: 'accepted', accepted_at: new Date().toISOString() }
    return true
  }
  if (!driver.value) return false

  // 1. Atomically claim the ride (server rejects it if another driver got there first).
  const { data: claimed, error: claimErr } = await supabase.rpc('accept_ride', { p_ride_id: ride.id })
  const claimedRide = Array.isArray(claimed) ? claimed[0] : claimed
  if (claimErr || !claimedRide?.id) {
    if (claimErr?.code === '23505') {
      // We already have a trip (e.g. after a reload): take the driver back to it.
      if (await restoreActiveRide()) return true
      acceptError.value = 'You already have an active ride.'
    } else {
      acceptError.value = 'Another driver already took this ride.'
    }
    return false
  }

  // 2. Hold the rider's card. Without it the ride doesn't go ahead.
  if (!(await authorize(ride.id))) return false

  stopPolling()
  await setDriverStatus('on_trip')
  currentRide.value = { ...claimedRide, status: 'accepted' }
  return true
}

function declineRide(ride) {
  incomingRequest.value = null
  dismissedRequests.add(ride.id)
  if (DEMO_MODE) return
  supabase.rpc('decline_ride', { p_ride_id: ride.id }).then(({ error }) => {
    if (error) console.error('Decline ride error:', error.message)
  })
}

// --- Trip progress ----------------------------------------------------------------------------------------
async function pinRequired() {
  if (DEMO_MODE) return false
  return (await loadSettings()).require_pickup_pin === true
}

// Moves the trip forward. Returns { ok, error }.
async function updateRideStatus(status) {
  if (!currentRide.value) return { ok: false }
  const previous = currentRide.value

  if (DEMO_MODE) {
    const now = new Date().toISOString()
    currentRide.value = {
      ...previous, status,
      arrived_at: status === 'driver_arrived' ? now : previous.arrived_at,
      started_at: status === 'in_progress' ? now : previous.started_at,
      completed_at: status === 'completed' ? now : previous.completed_at,
    }
    return { ok: true }
  }

  // Timestamps are set by the database, so read the row back.
  const { data, error } = await supabase.from('rides').update({ status }).eq('id', previous.id).select().maybeSingle()
  if (error || !data) {
    console.error('Ride status update error:', error?.message)
    await refreshCurrentRide()
    return { ok: false, error: error?.message?.includes('finished') ? 'This ride was cancelled.' : 'Couldn’t update the trip. Check your connection and try again.' }
  }
  currentRide.value = data
  if (status === 'driver_arrived') apiPost('/api/trip-event', { rideId: data.id, event: 'arrived' }).catch(() => {})
  if (status === 'in_progress') apiPost('/api/trip-event', { rideId: data.id, event: 'started' }).catch(() => {})
  if (status === 'completed') await setDriverStatus('online')
  return { ok: true }
}

// Starting the trip: with pickup PINs on, the rider's PIN is checked by the server.
async function startTrip(pin) {
  if (!currentRide.value) return { ok: false }
  if (DEMO_MODE || !(await pinRequired())) return updateRideStatus('in_progress')
  const { error } = await supabase.rpc('start_trip', { p_ride_id: currentRide.value.id, p_pin: pin || null })
  if (error) return { ok: false, error: error.message.includes('PIN') ? 'Wrong PIN. Ask the rider for the 4-digit PIN shown in their app.' : 'Couldn’t start the trip. Try again.' }
  await refreshCurrentRide()
  apiPost('/api/trip-event', { rideId: currentRide.value.id, event: 'started' }).catch(() => {})
  return { ok: true }
}

async function refreshCurrentRide() {
  if (!currentRide.value || DEMO_MODE) return currentRide.value
  const { data } = await supabase.from('rides').select('*').eq('id', currentRide.value.id).maybeSingle()
  if (data) currentRide.value = data
  return currentRide.value
}

// Driver cancels (free for the rider), or marks a no-show after the free wait (rider pays the fee).
async function cancelCurrentRide({ noShow = false } = {}) {
  if (!currentRide.value) return { ok: false }
  if (DEMO_MODE) { completeRide(); return { ok: true } }
  try {
    const res = await apiPost('/api/cancel-ride', { rideId: currentRide.value.id, noShow })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data.error || 'Couldn’t cancel. Try again.' }
    driver.value = { ...driver.value, status: 'online' }
    completeRide()
    return { ok: true, feeCents: data.fee_cents || 0 }
  } catch {
    return { ok: false, error: 'Connection problem. Try again.' }
  }
}

function completeRide() {
  currentRide.value = null
  if (isOnline.value && !DEMO_MODE) startPolling()
}

export function useDriver() {
  init()
  return {
    driver: readonly(driver),
    isOnline: readonly(isOnline),
    currentRide,
    incomingRequest,
    loading: readonly(loading),
    acceptError,
    onlineError,
    fetchDriver,
    restoreActiveRide,
    refreshCurrentRide,
    reset,
    goOnline,
    goOffline,
    acceptRide,
    declineRide,
    updateRideStatus,
    startTrip,
    pinRequired,
    cancelCurrentRide,
    completeRide,
  }
}
