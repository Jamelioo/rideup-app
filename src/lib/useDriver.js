// src/lib/useDriver.js
import { ref, readonly } from 'vue'
import { supabase, supabaseConfigured } from './supabase'
import { DEMO_MODE } from './demoMode'
import { DEMO_DRIVER_PROFILE, generateFakeRideRequest } from './demoDriverMode'

const driver = ref(null)
const isOnline = ref(false)
const currentRide = ref(null)
const incomingRequest = ref(null)
const loading = ref(true)

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

async function pollExistingRequests() {
  if (!driver.value) return
  const { data: rides } = await supabase
    .from('rides')
    .select('*')
    .eq('status', 'requested')
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

async function acceptRide(ride) {
  incomingRequest.value = null

  if (DEMO_MODE) {
    currentRide.value = { ...ride, status: 'accepted', accepted_at: new Date().toISOString() }
    return
  }

  if (!driver.value) return

  try {
    // Try pre-authorizing payment (only if rider has a card on file)
    let paymentOk = false
    try {
      const res = await fetch('/api/authorize-ride', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId: ride.id }),
      })
      const result = await res.json()
      paymentOk = result.success
      if (!paymentOk) console.warn('Payment pre-auth skipped or failed:', result.error)
    } catch (payErr) {
      console.warn('Payment API unavailable, proceeding without pre-auth:', payErr.message)
    }

    // Update ride status in DB regardless — core matching must work
    const { error: rideErr } = await supabase.from('rides').update({
      driver_id: driver.value.id,
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    }).eq('id', ride.id)
    if (rideErr) console.error('Accept ride DB error:', rideErr.message)

    const { error: driverErr } = await supabase.from('drivers').update({ status: 'on_trip' }).eq('id', driver.value.id)
    if (driverErr) console.error('Driver status update error:', driverErr.message)

    currentRide.value = { ...ride, status: 'accepted', accepted_at: new Date().toISOString() }
  } catch (err) {
    console.error('Accept ride error:', err)
  }
}

function declineRide(ride) {
  incomingRequest.value = null
  if (DEMO_MODE) return

  supabase.from('rides').update({
    declined_by: [...(ride.declined_by || []), driver.value.id],
  }).eq('id', ride.id)
}

async function updateRideStatus(status) {
  if (!currentRide.value) return
  const timestamps = {}
  if (status === 'driver_arrived') timestamps.started_at = null
  if (status === 'in_progress') timestamps.started_at = new Date().toISOString()
  if (status === 'completed') timestamps.completed_at = new Date().toISOString()

  currentRide.value = { ...currentRide.value, status, ...timestamps }

  if (status === 'completed') {
    if (!DEMO_MODE && driver.value) {
      await supabase.from('rides').update({ status, ...timestamps }).eq('id', currentRide.value.id)
      await supabase.from('drivers').update({
        status: 'online',
        total_trips: (driver.value.total_trips || 0) + 1,
      }).eq('id', driver.value.id)
      driver.value.total_trips = (driver.value.total_trips || 0) + 1
    }
  } else if (!DEMO_MODE) {
    await supabase.from('rides').update({ status, ...timestamps }).eq('id', currentRide.value.id)
  }
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
    fetchDriver,
    goOnline,
    goOffline,
    acceptRide,
    declineRide,
    updateRideStatus,
    completeRide,
  }
}
