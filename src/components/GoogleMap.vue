<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { loadGoogleMaps } from '../lib/useGoogleMaps'

const props = defineProps({
  pickup: { type: Object, default: null },
  dropoff: { type: Object, default: null },
  driverLocation: { type: Object, default: null },
})

const emit = defineEmits(['map-tap', 'marker-drag'])

const mapRef = ref(null)
let map = null
let maps = null
let pickupMarker = null
let dropoffMarker = null
let driverMarker = null
let directionsService = null
let directionsRenderer = null
let useAdvanced = false

// --- Map styles: hide POI and transit labels ---
const mapStyles = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
]

// --- Marker creation ---
function createAdvancedMarkerContent(type) {
  const div = document.createElement('div')
  if (type === 'pickup') {
    div.style.cssText = 'width:20px;height:20px;border-radius:50%;background:#2b8659;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);'
  } else {
    div.style.cssText = 'width:20px;height:20px;border-radius:2px;background:#191f1c;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);'
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
        strokeWeight: 5,
        strokeOpacity: 0.8,
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

// --- Init ---
onMounted(async () => {
  maps = await loadGoogleMaps()

  // Check for AdvancedMarkerElement
  useAdvanced = !!maps.marker?.AdvancedMarkerElement

  const mapOptions = {
    center: { lat: 25.0443, lng: -77.3504 },
    zoom: 13,
    styles: mapStyles,
    disableDefaultUI: true,
    zoomControl: true,
    zoomControlOptions: {
      position: maps.ControlPosition.RIGHT_CENTER,
    },
  }

  if (useAdvanced) {
    mapOptions.mapId = 'RIDEUP_MAP'
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
  if (directionsRenderer) {
    directionsRenderer.setMap(null)
    directionsRenderer = null
  }
})

defineExpose({ panTo, fitBounds })
</script>

<template>
  <div ref="mapRef" class="absolute inset-0 w-full h-full"></div>
</template>
