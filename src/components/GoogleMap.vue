<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { loadGoogleMaps } from '../lib/useGoogleMaps'

const props = defineProps({
  pickup: { type: Object, default: null },
  dropoff: { type: Object, default: null },
  driverLocation: { type: Object, default: null },
})

const emit = defineEmits(['map-tap', 'marker-drag', 'error'])
const failed = ref(false)

const mapRef = ref(null)
let map = null
let maps = null
let pickupMarker = null
let dropoffMarker = null
let driverMarker = null
let directionsService = null
let directionsRenderer = null
let useAdvanced = false

// --- Uber/Bolt-style clean map (light mode) ---
const lightMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#f0f0f0' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b6b6b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f0f0f0' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#d6d6d6' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#d4ecd0' }] },
  { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e0e0e0' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#ffd54f' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#e6be3a' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#6b6b6b' }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#d6d6d6' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#b3ddf2' }] },
  { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.fill', stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'landscape.natural', elementType: 'geometry.fill', stylers: [{ color: '#e8efe5' }] },
]

// --- Uber/Bolt dark mode map ---
const darkMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#707090' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#2a2a40' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#252540' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#606080' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#3a3a55' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#2a2a40' }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#2e2e48' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry.fill', stylers: [{ color: '#404060' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#0d1b2a' }] },
  { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.fill', stylers: [{ color: '#1e1e35' }] },
  { featureType: 'landscape.natural', elementType: 'geometry.fill', stylers: [{ color: '#1a1a2e' }] },
]

// Detect dark mode
function isDarkMode() {
  return document.documentElement.classList.contains('dark')
}

const mapStyles = isDarkMode() ? darkMapStyles : lightMapStyles

// --- Marker creation ---
function createAdvancedMarkerContent(type) {
  const div = document.createElement('div')
  if (type === 'pickup') {
    div.style.cssText = 'width:14px;height:14px;border-radius:50%;background:#2b8659;border:4px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);'
  } else {
    div.style.cssText = 'width:14px;height:14px;border-radius:3px;background:#1a1a2e;border:4px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);'
  }
  return div
}

function clearMarker(marker) {
  if (!marker) return
  if (useAdvanced) {
    marker.map = null
  } else {
    marker.setMap(null)
  }
}

function createMarker(type, position) {
  if (useAdvanced) {
    const AdvancedMarkerElement = maps.marker.AdvancedMarkerElement
    const marker = new AdvancedMarkerElement({
      map,
      position,
      content: createAdvancedMarkerContent(type),
      gmpDraggable: true,
    })
    marker.addListener('dragend', () => {
      const pos = marker.position
      emit('marker-drag', type, { lat: pos.lat, lng: pos.lng })
    })
    return marker
  } else {
    const icon =
      type === 'pickup'
        ? {
            path: maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#2b8659',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 3,
          }
        : {
            path: 'M -8,-8 L 8,-8 L 8,8 L -8,8 Z',
            scale: 1,
            fillColor: '#191f1c',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 3,
          }
    const marker = new maps.Marker({
      map,
      position,
      draggable: true,
      icon,
    })
    marker.addListener('dragend', () => {
      const pos = marker.getPosition()
      emit('marker-drag', type, { lat: pos.lat(), lng: pos.lng() })
    })
    return marker
  }
}

// --- Marker updates ---
function updateMarkers() {
  if (!map || !maps) return

  // Pickup
  if (props.pickup) {
    const pos = { lat: props.pickup.lat, lng: props.pickup.lng }
    if (pickupMarker) {
      if (useAdvanced) {
        pickupMarker.position = pos
      } else {
        pickupMarker.setPosition(pos)
      }
    } else {
      pickupMarker = createMarker('pickup', pos)
    }
  } else if (pickupMarker) {
    clearMarker(pickupMarker)
    pickupMarker = null
  }

  // Dropoff
  if (props.dropoff) {
    const pos = { lat: props.dropoff.lat, lng: props.dropoff.lng }
    if (dropoffMarker) {
      if (useAdvanced) {
        dropoffMarker.position = pos
      } else {
        dropoffMarker.setPosition(pos)
      }
    } else {
      dropoffMarker = createMarker('dropoff', pos)
    }
  } else if (dropoffMarker) {
    clearMarker(dropoffMarker)
    dropoffMarker = null
  }
}

// --- Driver marker ---
function createDriverMarkerContent() {
  const div = document.createElement('div')
  div.style.cssText = 'width:36px;height:36px;display:flex;align-items:center;justify-content:center;'
  div.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="#2b8659" xmlns="http://www.w3.org/2000/svg"><path d="M5 17h14M5 17a2 2 0 01-2-2V9l2-5h14l2 5v6a2 2 0 01-2 2M5 17a2 2 0 002 2h10a2 2 0 002-2" stroke="#fff" stroke-width="1.5"/><circle cx="7.5" cy="14.5" r="1.5" fill="#fff"/><circle cx="16.5" cy="14.5" r="1.5" fill="#fff"/></svg>'
  return div
}

function updateDriverMarker() {
  if (!map || !maps) return
  if (props.driverLocation) {
    const pos = { lat: props.driverLocation.lat, lng: props.driverLocation.lng }
    if (driverMarker) {
      if (useAdvanced) {
        driverMarker.position = pos
      } else {
        driverMarker.setPosition(pos)
      }
    } else {
      if (useAdvanced) {
        const AdvancedMarkerElement = maps.marker.AdvancedMarkerElement
        driverMarker = new AdvancedMarkerElement({ map, position: pos, content: createDriverMarkerContent() })
      } else {
        driverMarker = new maps.Marker({
          map, position: pos,
          icon: { path: maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 6, fillColor: '#2b8659', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, rotation: 0 },
        })
      }
    }
  } else if (driverMarker) {
    clearMarker(driverMarker)
    driverMarker = null
  }
}

// --- Route drawing ---
function drawRoute() {
  if (!map || !maps) return

  if (!props.pickup || !props.dropoff) {
    if (directionsRenderer) {
      directionsRenderer.setDirections({ routes: [] })
    }
    return
  }

  if (!directionsService) {
    directionsService = new maps.DirectionsService()
  }
  if (!directionsRenderer) {
    directionsRenderer = new maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#2b8659',
        strokeWeight: 6,
        strokeOpacity: 1,
      },
    })
  }

  directionsService.route(
    {
      origin: { lat: props.pickup.lat, lng: props.pickup.lng },
      destination: { lat: props.dropoff.lat, lng: props.dropoff.lng },
      travelMode: maps.TravelMode.DRIVING,
    },
    (result, status) => {
      if (status === maps.DirectionsStatus.OK) {
        directionsRenderer.setDirections(result)
      }
    }
  )
}

// --- Bounds fitting ---
function fitBounds() {
  if (!map || !maps || !props.pickup || !props.dropoff) return
  const bounds = new maps.LatLngBounds()
  bounds.extend({ lat: props.pickup.lat, lng: props.pickup.lng })
  bounds.extend({ lat: props.dropoff.lat, lng: props.dropoff.lng })
  map.fitBounds(bounds, { top: 60, bottom: 380, left: 40, right: 40 })
}

function panTo(lat, lng) {
  if (map) map.panTo({ lat, lng })
}

// --- Dark mode observer: switch map styles when theme toggles ---
let themeObserver = null
function watchThemeChanges() {
  themeObserver = new MutationObserver(() => {
    if (map) {
      map.setOptions({ styles: isDarkMode() ? darkMapStyles : lightMapStyles })
    }
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
}

// --- Init ---
onMounted(async () => {
  try {
    maps = await loadGoogleMaps()
  } catch (err) {
    // No key / blocked script / offline: tell the parent so it can show a fallback instead of a blank map.
    console.warn('Map unavailable:', err.message)
    failed.value = true
    emit('error', err)
    return
  }

  useAdvanced = false // Use regular markers so JSON styles work

  const mapOptions = {
    center: { lat: 25.0443, lng: -77.3504 },
    zoom: 13,
    styles: mapStyles,
    disableDefaultUI: true,
    zoomControl: false,
  }

  map = new maps.Map(mapRef.value, mapOptions)

  map.addListener('click', (e) => {
    emit('map-tap', { lat: e.latLng.lat(), lng: e.latLng.lng() })
  })

  updateMarkers()
  updateDriverMarker()
  drawRoute()
  if (props.pickup && props.dropoff) {
    fitBounds()
  }
  watchThemeChanges()
})

// --- Watchers ---
watch(
  () => props.pickup,
  () => {
    updateMarkers()
    drawRoute()
    if (props.pickup && props.dropoff) fitBounds()
  },
  { deep: true }
)

watch(
  () => props.dropoff,
  () => {
    updateMarkers()
    drawRoute()
    if (props.pickup && props.dropoff) fitBounds()
  },
  { deep: true }
)

watch(
  () => props.driverLocation,
  () => { updateDriverMarker() },
  { deep: true }
)

// --- Cleanup ---
onUnmounted(() => {
  clearMarker(pickupMarker)
  pickupMarker = null
  clearMarker(dropoffMarker)
  dropoffMarker = null
  clearMarker(driverMarker)
  driverMarker = null
  if (themeObserver) { themeObserver.disconnect(); themeObserver = null }
  if (directionsRenderer) {
    directionsRenderer.setMap(null)
    directionsRenderer = null
  }
})

defineExpose({ panTo, fitBounds })
</script>

<template>
  <div ref="mapRef" class="absolute inset-0 w-full h-full" :class="failed && 'hidden'"></div>
</template>
