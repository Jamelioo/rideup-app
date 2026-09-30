// src/lib/useDriver.js
import { ref, readonly } from 'vue'
import { supabase, supabaseConfigured } from './supabase'
import { DEMO_MODE } from './demoMode'
import { apiPost } from './api'
import { DEMO_DRIVER_PROFILE, generateFakeRideRequest } from './demoDriverMode'

const driver = ref(null)
const isOnline = ref(false)
const currentRide = ref(null)
const incomingRequest = ref(null)
const loading = ref(true)
const acceptError = ref('')

let initialized = false
let rideSubscription = null
let fakeRequestTimer = null
let pollInterval = null
let notificationPermission = 'default'

// Request notification permission on init
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(p => { notificationPermission = p })
  } else if ('Notification' in window) {
    notificationPermission = Notification.permission
  }
}

function showRideNotification(ride) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    const n = new Notification('New ride request!', {
      body: `${ride.pickup_address || 'Pickup'} → ${ride.dropoff_address || 'Dropoff'}`,
      icon: '/favicon.ico',
      tag: 'ride-request',
      requireInteraction: true,
      vibrate: [200, 100, 200],
    })
    n.onclick = () => { window.focus(); n.close() }
    // Auto-close after 15 seconds (matches the request timer)
    setTimeout(() => n.close(), 15000)
  } catch (e) { /* Notification API not fully supported */ }
}

function init() {
  if (initialized) return
  initialized = true

  if (DEMO_MODE) {
    driver.value = { ...DEMO_DRIVER_PROFILE }
    loading.value = false
    return
  }

  if (!supabaseConfigured) {
    loading.value = false
    return
  }
}

async function fetchDriver(authUserId) {
  if (DEMO_MODE) {
    driver.value = { ...DEMO_DRIVER_PROFILE }
    loading.value = false
    return
  }
  if (!supabaseConfigured || !authUserId) { loading.value = false; return }

  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single()

  if (!error && data) {
    driver.value = data
    isOnline.value = data.status === 'online'
    // Auto-subscribe to ride requests if driver was already online
    if (isOnline.value) {
      requestNotificationPermission()
      subscribeToRides()
      pollExistingRequests()
      startPolling()
    }
  }
  loading.value = false
}

// Which ride classes this driver's vehicle can serve (an XL van can take any; a standard car can't take XL).
function acceptableRideTypes() {
  return driver.value?.vehicle_type === 'xl' ? ['standard', 'xl', 'premium'] : ['standard', 'premium']
}

async function pollExistingRequests() {
  if (!driver.value) return
  // Only show rides created within the last 90 seconds
  const cutoff = new Date(Date.now() - 90000).toISOString()
  const { data: rides } = await supabase
    .from('rides')
    .select('*')
    .eq('status', 'requested')
    .in('vehicle_type', acceptableRideTypes())
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)
  if (rides && rides.length > 0) {
    const ride = rides[0]
    if (!ride.declined_by || !ride.declined_by.includes(driver.value.id)) {
      incomingRequest.value = ride
      showRideNotification(ride)
    }
  }
}

async function goOnline() {
  isOnline.value = true
  requestNotificationPermission()
  if (DEMO_MODE) {
    driver.value.status = 'online'
    startFakeRequests()
    return
  }
  if (!driver.value) return
  await supabase.from('drivers').update({ status: 'online' }).eq('id', driver.value.id)
  subscribeToRides()
  pollExistingRequests()
  startPolling()
}

async function goOffline() {
  isOnline.value = false
  if (DEMO_MODE) {
    driver.value.status = 'offline'
    stopFakeRequests()
    return
  }
  if (!driver.value) return
  await supabase.from('drivers').update({ status: 'offline' }).eq('id', driver.value.id)
  unsubscribeFromRides()
}

function subscribeToRides() {
  if (!supabaseConfigured || !driver.value) return
  // Clean up any existing subscription before creating a new one
  if (rideSubscription) {
    supabase.removeChannel(rideSubscription)
    rideSubscription = null
  }
  rideSubscription = supabase
    .channel('driver-rides')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'rides',
      filter: `status=eq.requested`,
    }, (payload) => {
      const ride = payload.new
      if (ride.declined_by && ride.declined_by.includes(driver.value.id)) return
      if (!acceptableRideTypes().includes(ride.vehicle_type)) return
      incomingRequest.value = ride
      showRideNotification(ride)
    })
    .subscribe()
}

function startPolling() {
  stopPolling()
  pollInterval = setInterval(() => {
    if (isOnline.value && !incomingRequest.value && !currentRide.value) {
      pollExistingRequests()
    }
  }, 5000)
}

function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
}

function unsubscribeFromRides() {
  stopPolling()
  if (rideSubscription) {
    supabase.removeChannel(rideSubscription)
    rideSubscription = null
  }
}

function startFakeRequests() {
  stopFakeRequests()
  function scheduleNext() {
    const delay = 15000 + Math.random() * 15000
    fakeRequestTimer = setTimeout(() => {
      if (isOnline.value && !incomingRequest.value && !currentRide.value) {
        const fakeRide = generateFakeRideRequest()
        incomingRequest.value = fakeRide
        showRideNotification(fakeRide)
      }
      if (isOnline.value) scheduleNext()
    }, delay)
  }
  scheduleNext()
}

function stopFakeRequests() {
  if (fakeRequestTimer) { clearTimeout(fakeRequestTimer); fakeRequestTimer = null }
}

const ACCEPT_ERRORS = {
  no_payment_method: "The rider's card couldn't be verified, so the ride was cancelled.",
  card_declined: "The rider's card was declined, so the ride was cancelled.",
  payment_failed: "The rider's payment couldn't be authorized, so the ride was cancelled.",
  ride_unavailable: 'This ride is no longer available.',
}

// Returns true only when the ride is claimed AND the rider's card is held.
async function acceptRide(ride) {
  incomingRequest.value = null
  acceptError.value = ''

  if (DEMO_MODE) {
    currentRide.value = { ...ride, status: 'accepted', accepted_at: new Date().toISOString() }
    return true
  }

  if (!driver.value) return false

  try {
    // 1. Atomically claim the ride (server rejects it if another driver got there first).
    const { data: claimed, error: claimErr } = await supabase.rpc('accept_ride', { p_ride_id: ride.id })
    const claimedRide = Array.isArray(claimed) ? claimed[0] : claimed
    if (claimErr || !claimedRide?.id) {
      acceptError.value = claimErr?.code === '23505'
        ? 'You already have an active ride.'
        : 'Another driver already took this ride.'
      return false
    }

    // 2. Hold the rider's card. Without it the ride doesn't go ahead.
    const res = await apiPost('/api/authorize-ride', { rideId: ride.id })
    const result = await res.json().catch(() => ({}))
    if (!res.ok || !result.success) {
      acceptError.value = ACCEPT_ERRORS[result.error] || "Couldn't confirm payment for this ride. Please try another."
      return false
    }

    const { error: driverErr } = await supabase.from('drivers').update({ status: 'on_trip' }).eq('id', driver.value.id)
    if (driverErr) console.error('Driver status update error:', driverErr.message)

    currentRide.value = { ...claimedRide, status: 'accepted' }
    return true
  } catch (err) {
    console.error('Accept ride error:', err)
    acceptError.value = 'Connection problem. Please try again.'
    return false
  }
}

function declineRide(ride) {
  incomingRequest.value = null
  if (DEMO_MODE) return

  // Server appends this driver to declined_by (drivers can't edit unassigned rides directly).
  supabase.rpc('decline_ride', { p_ride_id: ride.id }).then(({ error }) => {
    if (error) console.error('Decline ride error:', error.message)
  })
}

async function updateRideStatus(status) {
  if (!currentRide.value) return
  const timestamps = {}
  if (status === 'driver_arrived') timestamps.started_at = null
  if (status === 'in_progress') timestamps.started_at = new Date().toISOString()
  if (status === 'completed') timestamps.completed_at = new Date().toISOString()

  const previous = currentRide.value
  currentRide.value = { ...previous, status, ...timestamps }

  if (DEMO_MODE || !driver.value) return

  const { error } = await supabase.from('rides').update({ status, ...timestamps }).eq('id', previous.id)
  if (error) {
    // Server refused the change (e.g. invalid transition) — don't leave the UI ahead of the database.
    console.error('Ride status update error:', error.message)
    currentRide.value = previous
    return false
  }

  if (status === 'completed') {
    // total_trips is incremented server-side when the ride is marked completed.
    await supabase.from('drivers').update({ status: 'online' }).eq('id', driver.value.id)
  }
  return true
}

function completeRide() {
  currentRide.value = null
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
    fetchDriver,
    goOnline,
    goOffline,
    acceptRide,
    declineRide,
    updateRideStatus,
    completeRide,
  }
}
