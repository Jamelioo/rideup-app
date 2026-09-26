# Map Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen interactive Google Map behind the booking UI, with tap-to-place pins, draggable markers, and route polyline.

**Architecture:** A new `GoogleMap.vue` component renders the map and handles markers/polylines. `RiderBooking.vue` is restructured to overlay a bottom-sheet card on top of the full-screen map. `useGoogleMaps.js` gains a `reverseGeocode` helper. The existing `HarborBackdrop.vue` decorative SVG is replaced by the real map.

**Tech Stack:** Google Maps JavaScript API (already loaded), Vue 3 `<script setup>`, Tailwind CSS

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/components/GoogleMap.vue` | Create | Full-screen map rendering, markers, polyline, tap/drag events |
| `src/pages/rider/RiderBooking.vue` | Modify | Restructure layout to map + floating card, wire map events to booking logic |
| `src/lib/useGoogleMaps.js` | Modify | Add `reverseGeocode(lat, lng)` helper |
| `src/components/HarborBackdrop.vue` | No change | Still used as fallback when map hasn't loaded |

---

### Task 1: Add reverseGeocode helper to useGoogleMaps.js

**Files:**
- Modify: `src/lib/useGoogleMaps.js`

- [ ] **Step 1: Add the reverseGeocode function**

Open `src/lib/useGoogleMaps.js` and add this exported function after the existing `useGoogleMaps` function:

```js
let geocoder = null

/**
 * Reverse-geocodes a lat/lng into a formatted address string.
 * Requires Google Maps to be loaded first (call loadGoogleMaps() before this).
 */
export async function reverseGeocode(lat, lng) {
  if (!geocoder) {
    geocoder = new window.google.maps.Geocoder()
  }
  const { results } = await geocoder.geocode({ location: { lat, lng } })
  if (results && results[0]) {
    return results[0].formatted_address
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npx vite build --logLevel error 2>&1 | tail -5`
Expected: No output (clean build)

- [ ] **Step 3: Commit**

```bash
git add src/lib/useGoogleMaps.js
git commit -m "feat: add reverseGeocode helper to useGoogleMaps"
```

---

### Task 2: Create GoogleMap.vue component

**Files:**
- Create: `src/components/GoogleMap.vue`

- [ ] **Step 1: Create the component file**

Create `src/components/GoogleMap.vue` with the following content:

```vue
<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { loadGoogleMaps } from '../lib/useGoogleMaps'

const props = defineProps({
  pickup: { type: Object, default: null },   // { lat, lng, address } or null
  dropoff: { type: Object, default: null },  // { lat, lng, address } or null
})

const emit = defineEmits(['map-tap', 'marker-drag'])

const mapContainer = ref(null)
let map = null
let pickupMarker = null
let dropoffMarker = null
let routePolyline = null
let directionsService = null
let directionsRenderer = null

// Nassau center
const NASSAU_CENTER = { lat: 25.0443, lng: -77.3504 }

onMounted(async () => {
  try {
    const maps = await loadGoogleMaps()
    initMap(maps)
  } catch (err) {
    console.error('GoogleMap: failed to load', err)
  }
})

function initMap(maps) {
  map = new maps.Map(mapContainer.value, {
    center: NASSAU_CENTER,
    zoom: 13,
    disableDefaultUI: true,
    zoomControl: true,
    zoomControlOptions: { position: maps.ControlPosition.RIGHT_CENTER },
    gestureHandling: 'greedy',
    styles: [
      { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    ],
  })

  directionsService = new maps.DirectionsService()
  directionsRenderer = new maps.DirectionsRenderer({
    map,
    suppressMarkers: true,
    polylineOptions: {
      strokeColor: '#58cc02',
      strokeWeight: 5,
      strokeOpacity: 0.8,
    },
  })

  map.addListener('click', (e) => {
    emit('map-tap', { lat: e.latLng.lat(), lng: e.latLng.lng() })
  })

  // If props already have values on mount, render them
  if (props.pickup) updatePickupMarker(maps)
  if (props.dropoff) updateDropoffMarker(maps)
  if (props.pickup && props.dropoff) drawRoute()
}

function updatePickupMarker(maps) {
  if (!map || !props.pickup) {
    if (pickupMarker) { pickupMarker.setMap(null); pickupMarker = null }
    return
  }
  const pos = { lat: props.pickup.lat, lng: props.pickup.lng }
  if (!pickupMarker) {
    pickupMarker = new maps.marker.AdvancedMarkerElement({
      map,
      position: pos,
      gmpDraggable: true,
      content: createMarkerEl('pickup'),
    })
    pickupMarker.addListener('dragend', () => {
      const p = pickupMarker.position
      emit('marker-drag', 'pickup', { lat: p.lat, lng: p.lng })
    })
  } else {
    pickupMarker.position = pos
  }
}

function updateDropoffMarker(maps) {
  if (!map || !props.dropoff) {
    if (dropoffMarker) { dropoffMarker.setMap(null); dropoffMarker = null }
    return
  }
  const pos = { lat: props.dropoff.lat, lng: props.dropoff.lng }
  if (!dropoffMarker) {
    dropoffMarker = new maps.marker.AdvancedMarkerElement({
      map,
      position: pos,
      gmpDraggable: true,
      content: createMarkerEl('dropoff'),
    })
    dropoffMarker.addListener('dragend', () => {
      const p = dropoffMarker.position
      emit('marker-drag', 'dropoff', { lat: p.lat, lng: p.lng })
    })
  } else {
    dropoffMarker.position = pos
  }
}

function createMarkerEl(type) {
  const el = document.createElement('div')
  if (type === 'pickup') {
    el.innerHTML = `<div style="width:20px;height:20px;background:#58cc02;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`
  } else {
    el.innerHTML = `<div style="width:20px;height:20px;background:#1a1a1a;border:3px solid white;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`
  }
  return el
}

function drawRoute() {
  if (!map || !props.pickup || !props.dropoff || !directionsService) return
  directionsService.route(
    {
      origin: { lat: props.pickup.lat, lng: props.pickup.lng },
      destination: { lat: props.dropoff.lat, lng: props.dropoff.lng },
      travelMode: window.google.maps.TravelMode.DRIVING,
    },
    (result, status) => {
      if (status === 'OK') {
        directionsRenderer.setDirections(result)
        fitBounds()
      }
    }
  )
}

function fitBounds() {
  if (!map || !props.pickup || !props.dropoff) return
  const bounds = new window.google.maps.LatLngBounds()
  bounds.extend({ lat: props.pickup.lat, lng: props.pickup.lng })
  bounds.extend({ lat: props.dropoff.lat, lng: props.dropoff.lng })
  map.fitBounds(bounds, { top: 60, bottom: 380, left: 40, right: 40 })
}

function panTo(lat, lng) {
  if (map) map.panTo({ lat, lng })
}

watch(() => props.pickup, async () => {
  if (!map) return
  const maps = await loadGoogleMaps()
  updatePickupMarker(maps)
  if (props.pickup && !props.dropoff) panTo(props.pickup.lat, props.pickup.lng)
  if (props.pickup && props.dropoff) drawRoute()
}, { deep: true })

watch(() => props.dropoff, async () => {
  if (!map) return
  const maps = await loadGoogleMaps()
  updateDropoffMarker(maps)
  if (props.dropoff && !props.pickup) panTo(props.dropoff.lat, props.dropoff.lng)
  if (props.pickup && props.dropoff) drawRoute()
}, { deep: true })

onUnmounted(() => {
  if (pickupMarker) pickupMarker.setMap(null)
  if (dropoffMarker) dropoffMarker.setMap(null)
  if (directionsRenderer) directionsRenderer.setMap(null)
})

defineExpose({ panTo, fitBounds })
</script>

<template>
  <div ref="mapContainer" class="absolute inset-0 w-full h-full"></div>
</template>
```

**Important notes for the implementer:**
- `AdvancedMarkerElement` requires the `marker` library. The Google Maps script URL in `useGoogleMaps.js` needs to be updated to include it: change `libraries=places,geometry` to `libraries=places,geometry,marker`. Also add `v=weekly` parameter and a `mapId` to the Map constructor (required for AdvancedMarkerElement). Use `mapId: 'DEMO_MAP_ID'` for now.
- If `AdvancedMarkerElement` is not available (older API or missing map ID), fall back to the classic `google.maps.Marker` instead. Check with: `if (maps.marker?.AdvancedMarkerElement)`.
- The `directionsRenderer` draws the polyline automatically from Directions results — no need to manually create a `Polyline` object.
- `fitBounds` padding: `bottom: 380` leaves room for the bottom booking card overlay.

- [ ] **Step 2: Update useGoogleMaps.js to load the marker library**

In `src/lib/useGoogleMaps.js`, change the script src line from:
```js
script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&loading=async`
```
to:
```js
script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry,marker&v=weekly&loading=async`
```

- [ ] **Step 3: Verify the app builds**

Run: `npx vite build --logLevel error 2>&1 | tail -5`
Expected: No output (clean build)

- [ ] **Step 4: Commit**

```bash
git add src/components/GoogleMap.vue src/lib/useGoogleMaps.js
git commit -m "feat: create GoogleMap component with markers, polyline, tap/drag"
```

---

### Task 3: Restructure RiderBooking.vue to use the map

**Files:**
- Modify: `src/pages/rider/RiderBooking.vue`

This is the largest task. The booking page changes from a vertical scroll layout with the decorative `HarborBackdrop` to a full-screen map with a floating bottom card.

- [ ] **Step 1: Update the script section**

Replace the imports at the top of `<script setup>`:

Remove:
```js
import HarborBackdrop from '../../components/HarborBackdrop.vue'
```

Add:
```js
import GoogleMap from '../../components/GoogleMap.vue'
import { reverseGeocode } from '../../lib/useGoogleMaps'
```

Add these new refs after the existing refs (after line ~30):
```js
const activeInput = ref('pickup')
const mapRef = ref(null)
```

Add these new functions after the existing `setupAutocomplete` function:

```js
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
```

Also update the `setupAutocomplete` function so that after selecting pickup, it auto-focuses dropoff:

In the pickup `place_changed` listener, after `pickup.value = { ... }`, add:
```js
activeInput.value = 'dropoff'
dropoffInput.value?.focus()
```

In the dropoff `place_changed` listener, after `dropoff.value = { ... }`, add:
```js
activeInput.value = 'dropoff'
```

- [ ] **Step 2: Replace the entire template**

Replace the full `<template>` block in `RiderBooking.vue` with:

```html
<template>
  <div class="relative h-screen bg-white text-[#1a1a1a] flex flex-col overflow-hidden">
    <SideMenu :is-open="menuOpen" @close="menuOpen = false" />

    <!-- Full-screen map -->
    <GoogleMap
      v-if="mapsReady && !DEMO_MODE"
      ref="mapRef"
      :pickup="pickup"
      :dropoff="dropoff"
      @map-tap="handleMapTap"
      @marker-drag="handleMarkerDrag"
    />

    <!-- Fallback for demo mode or loading -->
    <HarborBackdrop v-if="DEMO_MODE || !mapsReady" :show-route="hasRoute" />

    <!-- Top bar — floats over map -->
    <div class="absolute top-0 left-0 right-0 z-10 px-5 pt-[env(safe-area-inset-top,12px)] pb-3">
      <div class="flex items-center justify-between pt-3">
        <button @click="menuOpen = true" class="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect y="2" width="16" height="1.5" rx="0.75" fill="#1a1a1a"/><rect y="7.25" width="16" height="1.5" rx="0.75" fill="#1a1a1a"/><rect y="12.5" width="16" height="1.5" rx="0.75" fill="#1a1a1a"/></svg>
        </button>
        <div class="px-4 py-2 bg-white rounded-full shadow-md font-serif text-[15px] font-semibold tracking-tight">Ride<span class="text-[#58cc02]">Up</span></div>
        <div class="w-10 h-10"></div>
      </div>
    </div>

    <!-- Bottom booking card — floats over map -->
    <div class="absolute bottom-0 left-0 right-0 z-10 bg-white rounded-t-3xl shadow-[0_-4px_30px_rgba(0,0,0,0.1)] max-h-[75vh] overflow-y-auto">
      <div class="px-5 pt-4 pb-[env(safe-area-inset-bottom,20px)]">
        <!-- Drag handle -->
        <div class="flex justify-center mb-3">
          <div class="w-10 h-1 rounded-full bg-[#1a1a1a]/15"></div>
        </div>

        <h2 v-if="!hasRoute" class="font-serif text-[22px] font-medium mb-3">Where are you going?</h2>

        <!-- Inputs -->
        <div class="space-y-2.5 mb-3">
          <div class="flex items-center gap-3 bg-[#1a1a1a]/[0.035] border border-[#1a1a1a]/8 rounded-2xl px-4 py-3.5"
               :class="activeInput === 'pickup' ? 'ring-2 ring-[#58cc02]/40' : ''">
            <span class="w-2.5 h-2.5 rounded-full bg-[#58cc02] flex-shrink-0"></span>
            <input v-if="!DEMO_MODE" ref="pickupInput" type="text" placeholder="Pickup location"
                   class="bg-transparent outline-none w-full text-[14px] placeholder:text-[#1a1a1a]/35"
                   @focus="activeInput = 'pickup'" />
            <input v-else v-model="pickupText" list="demo-locations" type="text" placeholder="Pickup — try Cable Beach"
                   class="bg-transparent outline-none w-full text-[14px] placeholder:text-[#1a1a1a]/35"
                   @focus="activeInput = 'pickup'" />
          </div>
          <div class="flex items-center gap-3 bg-[#1a1a1a]/[0.035] border border-[#1a1a1a]/8 rounded-2xl px-4 py-3.5"
               :class="activeInput === 'dropoff' ? 'ring-2 ring-[#58cc02]/40' : ''">
            <span class="w-2.5 h-2.5 rounded-sm bg-[#1a1a1a]/40 flex-shrink-0"></span>
            <input v-if="!DEMO_MODE" ref="dropoffInput" type="text" placeholder="Where to?"
                   class="bg-transparent outline-none w-full text-[14px] placeholder:text-[#1a1a1a]/35"
                   @focus="activeInput = 'dropoff'" />
            <input v-else v-model="dropoffText" list="demo-locations" type="text" placeholder="Destination — try Airport"
                   class="bg-transparent outline-none w-full text-[14px] placeholder:text-[#1a1a1a]/35"
                   @focus="activeInput = 'dropoff'" />
          </div>
          <datalist id="demo-locations"><option v-for="loc in DEMO_LOCATIONS" :key="loc" :value="loc" /></datalist>
        </div>

        <p v-if="DEMO_MODE && !hasRoute" class="text-[#58cc02] text-[11px] mb-2">Demo mode — enter any two spots to see live pricing</p>
        <div v-if="!mapsReady && !error && !DEMO_MODE" class="text-[#1a1a1a]/40 text-sm text-center py-6">Loading map…</div>
        <div v-if="error" class="bg-red-500/10 border border-red-500/25 text-red-600 text-sm rounded-xl px-4 py-3 mb-3">{{ error }}</div>
        <div v-if="isCalculating" class="flex items-center gap-2 text-[#1a1a1a]/40 text-[13px] mb-3">
          <span class="w-3 h-3 border-2 border-[#1a1a1a]/15 border-t-[#58cc02] rounded-full animate-spin"></span>
          Calculating route…
        </div>

        <!-- Vehicle selection + fare -->
        <div v-if="hasRoute" class="space-y-2">
          <div class="flex items-baseline justify-between px-1 mb-1">
            <span class="text-[11px] text-[#1a1a1a]/40 font-medium">Choose a ride</span>
            <span class="text-[11px] text-[#1a1a1a]/40 font-medium">{{ distanceMiles.toFixed(1) }} mi</span>
          </div>

          <button v-for="vehicle in VEHICLE_TYPES" :key="vehicle.id" @click="selectedVehicle = vehicle.id"
                  class="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all"
                  :class="selectedVehicle === vehicle.id ? 'border-[#58cc02] bg-[#58cc02]/[0.08]' : 'border-[#1a1a1a]/8 bg-[#1a1a1a]/[0.02] hover:bg-[#1a1a1a]/[0.04]'">
            <div class="flex items-center gap-3.5">
              <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg" :class="selectedVehicle === vehicle.id ? 'bg-[#58cc02]/15' : 'bg-[#1a1a1a]/6'">{{ vehicle.icon }}</div>
              <div class="text-left">
                <div class="text-[14px] font-semibold">{{ vehicle.name }}</div>
                <div class="text-[11px] text-[#1a1a1a]/40 mt-0.5">{{ vehicle.desc }} · {{ Math.round(durationMinutes) }} min</div>
              </div>
            </div>
            <div class="text-[15px] font-bold font-serif">{{ formatFare(fareEstimates[vehicle.id]) }}</div>
          </button>

          <!-- Promo code -->
          <div v-if="!promoApplied" class="pt-1">
            <button v-if="!showPromo" @click="showPromo = true" class="text-[12px] text-[#4ab300] font-semibold underline underline-offset-2">Have a promo code?</button>
            <div v-else class="flex gap-2 mt-1">
              <input v-model="promoCode" type="text" placeholder="Enter code" class="flex-1 bg-[#1a1a1a]/[0.035] border border-[#1a1a1a]/8 rounded-xl px-3.5 py-2.5 text-[13px] outline-none" />
              <button @click="applyPromo" class="px-4 py-2.5 bg-[#1a1a1a] text-white text-[12px] font-bold rounded-xl">Apply</button>
            </div>
          </div>
          <div v-else class="flex items-center gap-2 text-[#4ab300] text-[12px] font-semibold pt-1">
            ✓ Promo applied — 10% off
          </div>

          <button @click="requestRide" :disabled="!canRequest"
                  class="w-full py-4 bg-[#58cc02] disabled:bg-[#1a1a1a]/10 disabled:text-[#1a1a1a]/30 text-white font-bold rounded-2xl text-[14px] mt-3 transition-colors active:scale-[0.99]">
            {{ isSubmitting ? 'Requesting…' : 'Request Ride' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Verify the app builds and renders**

Run: `npx vite build --logLevel error 2>&1 | tail -5`
Expected: No output (clean build)

Then open `http://localhost:5176/` in the browser. You should see:
- Full-screen Google Map centered on Nassau
- Floating bottom card with pickup/dropoff inputs
- The hamburger menu and RideUp logo floating over the map
- Typing in an input should show Google autocomplete suggestions
- Selecting a location should drop a marker on the map
- Tapping the map should reverse-geocode and fill the active input
- Both locations selected should draw a green route polyline and show vehicle/fare options

- [ ] **Step 4: Commit**

```bash
git add src/pages/rider/RiderBooking.vue
git commit -m "feat: full-screen map with floating booking card overlay"
```

---

### Task 4: Handle AdvancedMarkerElement fallback

**Files:**
- Modify: `src/components/GoogleMap.vue`

The `AdvancedMarkerElement` requires a `mapId`. If it's not available, we need a classic `Marker` fallback.

- [ ] **Step 1: Add fallback logic in GoogleMap.vue**

In the `initMap` function, after creating the map, add a `mapId` to the Map options:
```js
map = new maps.Map(mapContainer.value, {
  center: NASSAU_CENTER,
  zoom: 13,
  mapId: 'RIDEUP_MAP',
  // ... rest of options
})
```

Update `updatePickupMarker` and `updateDropoffMarker` to check for `AdvancedMarkerElement` availability:

```js
const useAdvanced = !!maps.marker?.AdvancedMarkerElement
```

If `useAdvanced` is false, use classic `maps.Marker` with a custom icon instead:

For pickup (classic fallback):
```js
pickupMarker = new maps.Marker({
  map,
  position: pos,
  draggable: true,
  icon: {
    path: maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: '#58cc02',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 3,
  },
})
pickupMarker.addListener('dragend', () => {
  const p = pickupMarker.getPosition()
  emit('marker-drag', 'pickup', { lat: p.lat(), lng: p.lng() })
})
```

For dropoff (classic fallback):
```js
dropoffMarker = new maps.Marker({
  map,
  position: pos,
  draggable: true,
  icon: {
    path: 'M -8,-8 L 8,-8 L 8,8 L -8,8 Z',
    scale: 1,
    fillColor: '#1a1a1a',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 3,
  },
})
dropoffMarker.addListener('dragend', () => {
  const p = dropoffMarker.getPosition()
  emit('marker-drag', 'dropoff', { lat: p.lat(), lng: p.lng() })
})
```

- [ ] **Step 2: Verify build**

Run: `npx vite build --logLevel error 2>&1 | tail -5`
Expected: No output (clean build)

- [ ] **Step 3: Test in browser**

Open `http://localhost:5176/`, select two locations. Markers should appear and be draggable regardless of whether AdvancedMarkerElement is available.

- [ ] **Step 4: Commit**

```bash
git add src/components/GoogleMap.vue
git commit -m "feat: add classic Marker fallback for maps without mapId support"
```
