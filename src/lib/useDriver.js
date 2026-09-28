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
  }
  loading.value = false
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

function unsubscribeFromRides() {
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
  currentRide.value = { ...ride, status: 'accepted', accepted_at: new Date().toISOString() }

  if (DEMO_MODE) return

  await supabase.from('rides').update({
    driver_id: driver.value.id,
    status: 'accepted',
    accepted_at: new Date().toISOString(),
  }).eq('id', ride.id)

  await supabase.from('drivers').update({ status: 'on_trip' }).eq('id', driver.value.id)
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
