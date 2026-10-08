<script setup>
// The app's map, in RideUp's look (src/lib/mapTheme.js): branded day and night palettes, Dot as the pickup pin,
// the driver's car turning and gliding between GPS updates, a route that draws itself, and soft busy-area glows
// for drivers. Classic markers and JSON styles (a cloud map ID would switch the styles off).
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { loadGoogleMaps } from '../lib/useGoogleMaps'
import {
  mapStyles, mapBackground, routeColors, hotspotColor, hotspotGradient, HOTSPOT_RADIUS_M, HOTSPOT_MIN_PX, svgUrl,
  pickupSvg, dropoffSvg, stopSvg, PICKUP_ICON, DROPOFF_ICON, STOP_ICON, CAR_SVG, CAR_SIZE,
  distanceMeters, headingDegrees, nextRotation, cumulativeDistances, pathPortion,
} from '../lib/mapTheme'

const props = defineProps({
  pickup: { type: Object, default: null },
  dropoff: { type: Object, default: null },
  stop: { type: Object, default: null }, // one extra stop on the way
  hotspots: { type: Array, default: () => [] }, // drivers' busy-area map: [{ lat, lng, weight, surge }]
  driverLocation: { type: Object, default: null }, // the driver's car: { lat, lng }
  showTraffic: { type: Boolean, default: false }, // Google's live traffic colours (green / orange / red)
  editable: { type: Boolean, default: false }, // pickup and drop-off can be dragged (booking screen)
  fitPadding: { type: Object, default: null }, // space to keep clear when framing the trip: { top, right, bottom, left }
})

const emit = defineEmits(['map-tap', 'marker-drag', 'error'])
const failed = ref(false)
const mapRef = ref(null)

let maps = null
let map = null
let probe = null // empty overlay that gives access to the map's pixel projection
let trafficLayer = null
let directionsService = null
let hotspotLayer = null
let themeObserver = null
const markers = { pickup: null, stop: null, dropoff: null }
let routeCasing = null
let routeLine = null
let routePath = [] // [{ lat, lng }] of the route on screen
let routeRequest = 0
let car = null
let carShown = null // where the car is drawn right now (mid-glide, this is between two GPS fixes)
let carRotation = 0
let carUpdatedAt = 0
let lastUserMove = 0
const frames = { car: 0, route: 0 }
let dark = false
let reduceMotion = false

const isPoint = (p) => p != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
const toPoint = (p) => ({ lat: Number(p.lat), lng: Number(p.lng) })
const isDarkMode = () => document.documentElement.classList.contains('dark')
const markUserMove = () => { lastUserMove = Date.now() }

// --- Framing -----------------------------------------------------------------------------------------------
// A bottom sheet covers the lower part of the map on phones; on wide screens most pages put their panel beside
// the map instead. Pages with a different layout pass fitPadding.
const SHEET_PADDING = { top: 80, right: 40, bottom: 380, left: 40 }
const SIDE_PADDING = { top: 64, right: 64, bottom: 64, left: 64 }

function padding() {
  const el = mapRef.value
  const w = el?.clientWidth || 0
  const h = el?.clientHeight || 0
  const base = props.fitPadding || (w >= 600 && el.getBoundingClientRect().left > 0 ? SIDE_PADDING : SHEET_PADDING)
  // Never more than 70% of the map, or Google can't fit anything and leaves the view alone.
  const v = h ? Math.min(1, (h * 0.7) / (base.top + base.bottom)) : 1
  const s = w ? Math.min(1, (w * 0.7) / (base.left + base.right)) : 1
  return { top: base.top * v, right: base.right * s, bottom: base.bottom * v, left: base.left * s }
}

// Whether a point is inside the part of the map the page leaves visible (half the padding as a margin).
function inView(point) {
  const projection = probe?.getProjection()
  const el = mapRef.value
  if (!projection || !el) return true
  const p = projection.fromLatLngToContainerPixel(new maps.LatLng(point.lat, point.lng))
  const pad = padding()
  return p.x >= pad.left / 2 && p.x <= el.clientWidth - pad.right / 2 && p.y >= pad.top / 2 && p.y <= el.clientHeight - pad.bottom / 2
}

// Put a point in the middle of the visible part of the map.
function centerOn(point, zoom) {
  const pad = padding()
  if (zoom) map.setZoom(zoom)
  map.setCenter(point)
  map.panBy((pad.right - pad.left) / 2, (pad.bottom - pad.top) / 2)
}

// What to frame: the trip's stops, its route and the car. With no trip (the driver home screen), the busy areas
// are what matters, so they're framed with the car.
function framePoints() {
  const ends = [props.pickup, props.stop, props.dropoff].filter(isPoint).map(toPoint)
  const points = [...ends, ...routePath]
  if (carShown) points.push(carShown)
  if (!ends.length) points.push(...props.hotspots.filter(isPoint).map(toPoint))
  return points
}

// Size (corner to corner, in metres) and centre of the box around some points.
function extent(points) {
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const sw = { lat: Math.min(...lats), lng: Math.min(...lngs) }
  const ne = { lat: Math.max(...lats), lng: Math.max(...lngs) }
  return { span: distanceMeters(sw, ne), center: { lat: (sw.lat + ne.lat) / 2, lng: (sw.lng + ne.lng) / 2 } }
}

const MIN_FRAME_M = 400 // never frame less than this, or Google zooms right down to the kerb
let framedSpan = 0 // how much the last fitBounds framed

function fitBounds() {
  if (!map || !maps) return
  const points = framePoints()
  if (!points.length) return
  if (points.length === 1) {
    centerOn(points[0], 14) // just the car: the streets around it
    framedSpan = 0
    return
  }
  const { span, center } = extent(points)
  const bounds = new maps.LatLngBounds()
  points.forEach((p) => bounds.extend(p))
  if (span < MIN_FRAME_M) {
    const dLat = MIN_FRAME_M / 2 / Math.SQRT2 / 111320
    const dLng = dLat / Math.cos((center.lat * Math.PI) / 180)
    bounds.extend({ lat: center.lat - dLat, lng: center.lng - dLng })
    bounds.extend({ lat: center.lat + dLat, lng: center.lng + dLng })
  }
  framedSpan = Math.max(span, MIN_FRAME_M)
  map.fitBounds(bounds, padding())
}

// After the trip's stops change: frame the trip, or for a single point, bring it into view.
function frameTrip({ initial = false } = {}) {
  const ends = [props.pickup, props.stop, props.dropoff].filter(isPoint).map(toPoint)
  if (ends.length >= 2 || carShown || (initial && !ends.length && props.hotspots.some(isPoint))) fitBounds()
  else if (ends.length === 1 && (initial || !inView(ends[0]))) centerOn(ends[0], initial ? 15 : null)
}

function panTo(lat, lng) {
  map?.panTo({ lat, lng })
}

// --- Pickup, stop and drop-off markers ---------------------------------------------------------------------
const MARKERS = {
  pickup: { title: 'Pickup', zIndex: 30, size: PICKUP_ICON, svg: () => pickupSvg({ dark, animate: !reduceMotion }) },
  stop: { title: 'Stop', zIndex: 10, size: STOP_ICON, svg: () => stopSvg({ dark }) },
  dropoff: { title: 'Drop-off', zIndex: 20, size: DROPOFF_ICON, svg: () => dropoffSvg({ dark }) },
}

function markerIcon(kind) {
  const { size, svg } = MARKERS[kind]
  return { url: svgUrl(svg()), scaledSize: new maps.Size(size.width, size.height), anchor: new maps.Point(size.anchorX, size.anchorY) }
}

function syncMarker(kind, point) {
  if (!isPoint(point)) {
    markers[kind]?.setMap(null)
    markers[kind] = null
    return
  }
  if (markers[kind]) {
    markers[kind].setPosition(toPoint(point))
    return
  }
  const draggable = props.editable && kind !== 'stop' // the stop is edited in the address list
  const marker = new maps.Marker({
    map,
    position: toPoint(point),
    title: MARKERS[kind].title,
    zIndex: MARKERS[kind].zIndex,
    icon: markerIcon(kind),
    optimized: false, // drawn as an <img>, so the pickup pin's animation plays
    draggable,
    crossOnDrag: false,
  })
  if (draggable) {
    marker.addListener('dragend', () => {
      const p = marker.getPosition()
      emit('marker-drag', kind, { lat: p.lat(), lng: p.lng() })
    })
  }
  markers[kind] = marker
}

function syncMarkers() {
  for (const kind of Object.keys(MARKERS)) syncMarker(kind, props[kind])
}

// --- Route -------------------------------------------------------------------------------------------------
function drawRoute() {
  const request = ++routeRequest
  if (!isPoint(props.pickup) || !isPoint(props.dropoff)) {
    clearRoute()
    return
  }
  directionsService ||= new maps.DirectionsService()
  directionsService.route(
    {
      origin: toPoint(props.pickup),
      destination: toPoint(props.dropoff),
      waypoints: isPoint(props.stop) ? [{ location: toPoint(props.stop), stopover: true }] : [],
      travelMode: maps.TravelMode.DRIVING,
    },
    (result, status) => {
      if (request !== routeRequest) return // the trip changed while this was loading
      const path = status === maps.DirectionsStatus.OK ? result?.routes?.[0]?.overview_path : null
      if (!path?.length) {
        clearRoute()
        return
      }
      routePath = path.map((p) => ({ lat: p.lat(), lng: p.lng() }))
      showRoute({ animate: true })
      fitBounds()
    }
  )?.catch?.(() => {}) // newer API versions also return a promise; failures are handled in the callback
}

// A darker casing under the brand-green line, drawn from pickup to drop-off.
function showRoute({ animate }) {
  const { casing, line } = routeColors(dark)
  routeCasing ||= new maps.Polyline({ map, clickable: false, zIndex: 1 })
  routeLine ||= new maps.Polyline({ map, clickable: false, zIndex: 2 })
  routeCasing.setOptions({ strokeColor: casing, strokeOpacity: 1, strokeWeight: 10 })
  routeLine.setOptions({ strokeColor: line, strokeOpacity: 1, strokeWeight: 6 })
  cancelAnimationFrame(frames.route)
  const path = routePath
  if (!animate || reduceMotion) {
    routeCasing.setPath(path)
    routeLine.setPath(path)
    return
  }
  const total = cumulativeDistances(path)
  const start = performance.now()
  const step = (now) => {
    const k = Math.min(1, Math.max(0, (now - start) / 800))
    const part = pathPortion(path, total, 1 - (1 - k) ** 3)
    routeCasing.setPath(part)
    routeLine.setPath(part)
    if (k < 1) frames.route = requestAnimationFrame(step)
  }
  frames.route = requestAnimationFrame(step)
}

function clearRoute() {
  cancelAnimationFrame(frames.route)
  routePath = []
  routeCasing?.setPath([])
  routeLine?.setPath([])
}

// --- The driver's car --------------------------------------------------------------------------------------
// An HTML overlay rather than a marker: a classic marker can't rotate an image, and the car should turn smoothly.
function createCar() {
  class Car extends maps.OverlayView {
    constructor() {
      super()
      this.position = null
      this.el = document.createElement('div')
      this.el.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;'
      this.el.setAttribute('role', 'img')
      this.el.setAttribute('aria-label', 'Driver’s car')
      this.body = document.createElement('div')
      this.body.style.cssText =
        `position:absolute;left:${-CAR_SIZE.width / 2}px;top:${-CAR_SIZE.height / 2}px;` +
        `width:${CAR_SIZE.width}px;height:${CAR_SIZE.height}px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));` +
        (reduceMotion ? '' : 'transition:transform .6s ease-out;')
      this.body.innerHTML = CAR_SVG
      this.el.appendChild(this.body)
    }
    onAdd() { this.getPanes().markerLayer.appendChild(this.el) }
    onRemove() { this.el.remove() }
    draw() {
      const projection = this.getProjection()
      if (!projection || !this.position) return
      const p = projection.fromLatLngToDivPixel(new maps.LatLng(this.position.lat, this.position.lng))
      if (p) this.el.style.transform = `translate(${p.x}px, ${p.y}px)`
    }
    moveTo(position) {
      this.position = position
      this.draw()
    }
    turnTo(degrees) { this.body.style.transform = `rotate(${degrees}deg)` }
  }
  return new Car()
}

function syncCar() {
  if (!map) return
  if (!isPoint(props.driverLocation)) {
    removeCar()
    return
  }
  const target = toPoint(props.driverLocation)
  const now = performance.now()
  if (!car) {
    car = createCar()
    car.setMap(map)
    car.moveTo(target)
    carShown = target
    carUpdatedAt = now
    fitBounds()
    return
  }
  const from = carShown
  const moved = distanceMeters(from, target)
  if (moved > 8) { // smaller moves are GPS jitter: keep the heading
    carRotation = nextRotation(carRotation, headingDegrees(from, target))
    car.turnTo(carRotation)
  }
  const gap = now - carUpdatedAt
  carUpdatedAt = now
  cancelAnimationFrame(frames.car)
  if (reduceMotion || moved < 1 || moved > 3000) {
    carShown = target
    car.moveTo(target)
    followCar()
    return
  }
  // Glide over about the time since the last fix, so a steady stream of GPS updates looks like driving.
  const duration = Math.min(2000, Math.max(600, gap * 0.85))
  const step = (t) => {
    const k = Math.min(1, Math.max(0, (t - now) / duration))
    carShown = { lat: from.lat + (target.lat - from.lat) * k, lng: from.lng + (target.lng - from.lng) * k }
    car.moveTo(carShown)
    if (k < 1) frames.car = requestAnimationFrame(step)
    else followCar()
  }
  frames.car = requestAnimationFrame(step)
}

// Reframe when the car leaves the visible area, and zoom in as it closes in on the pickup (each time the
// distance halves), unless someone moved the map in the last 20 seconds.
function followCar() {
  if (!carShown || Date.now() - lastUserMove < 20_000) return
  if (!inView(carShown) || (framedSpan > MIN_FRAME_M && extent(framePoints()).span < framedSpan / 2)) fitBounds()
}

function removeCar() {
  cancelAnimationFrame(frames.car)
  car?.setMap(null)
  car = null
  carShown = null
}

// --- Drivers' busy areas -----------------------------------------------------------------------------------
// Radial-gradient glows that fade at the edge (Google's circles can only be flat), sized in metres with a
// minimum size on screen.
function createHotspotLayer() {
  class Hotspots extends maps.OverlayView {
    constructor() {
      super()
      this.spots = []
      this.el = document.createElement('div')
      this.el.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;'
    }
    onAdd() { this.getPanes().overlayLayer.appendChild(this.el) }
    onRemove() { this.el.remove() }
    setSpots(list) {
      this.el.replaceChildren()
      const valid = (list || []).filter(isPoint)
      const max = Math.max(1, ...valid.map((h) => Number(h.weight) || 0))
      this.spots = valid.map((h) => {
        const surge = Number(h.surge) > 1
        const el = document.createElement('div')
        el.style.cssText = `position:absolute;border-radius:50%;background:${hotspotGradient(hotspotColor(dark, surge), 0.22 + 0.33 * ((Number(h.weight) || 0) / max))};`
        if (surge && !reduceMotion) {
          el.animate([{ transform: 'scale(.92)' }, { transform: 'scale(1.06)' }], { duration: 2200, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' })
        }
        this.el.appendChild(el)
        return { ...toPoint(h), el }
      })
      this.draw()
    }
    draw() {
      const projection = this.getProjection()
      if (!projection) return
      for (const s of this.spots) {
        const c = projection.fromLatLngToDivPixel(new maps.LatLng(s.lat, s.lng))
        const edge = projection.fromLatLngToDivPixel(new maps.LatLng(s.lat + HOTSPOT_RADIUS_M / 111320, s.lng))
        const r = Math.max(HOTSPOT_MIN_PX, Math.abs(c.y - edge.y))
        Object.assign(s.el.style, { left: `${c.x - r}px`, top: `${c.y - r}px`, width: `${2 * r}px`, height: `${2 * r}px` })
      }
    }
  }
  return new Hotspots()
}

// --- Theme -------------------------------------------------------------------------------------------------
function applyTheme() {
  dark = isDarkMode()
  map.setOptions({ styles: mapStyles(dark) })
  for (const kind of Object.keys(markers)) markers[kind]?.setIcon(markerIcon(kind))
  if (routePath.length) showRoute({ animate: false })
  hotspotLayer?.setSpots(props.hotspots)
}

// --- Init --------------------------------------------------------------------------------------------------
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
  if (!mapRef.value) return // left the page while the script was loading

  reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  dark = isDarkMode()
  map = new maps.Map(mapRef.value, {
    center: { lat: 25.0443, lng: -77.3504 },
    zoom: 13,
    styles: mapStyles(dark),
    backgroundColor: mapBackground(dark), // no light-grey flash in dark mode while tiles load
    disableDefaultUI: true,
    clickableIcons: false, // no Google place pop-ups when tapping the map
    gestureHandling: 'greedy', // one finger moves the map, never the page
  })
  probe = new maps.OverlayView()
  probe.onAdd = probe.draw = probe.onRemove = () => {}
  probe.setMap(map)
  trafficLayer = new maps.TrafficLayer()
  if (props.showTraffic) trafficLayer.setMap(map)
  hotspotLayer = createHotspotLayer()
  hotspotLayer.setMap(map)
  hotspotLayer.setSpots(props.hotspots)

  map.addListener('click', (e) => emit('map-tap', { lat: e.latLng.lat(), lng: e.latLng.lng() }))
  map.addListener('dragstart', markUserMove)
  mapRef.value.addEventListener('wheel', markUserMove, { passive: true })
  mapRef.value.addEventListener('touchstart', markUserMove, { passive: true })

  syncMarkers()
  drawRoute()
  syncCar()
  frameTrip({ initial: true })

  themeObserver = new MutationObserver(() => { if (isDarkMode() !== dark) applyTheme() })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

// --- Watchers ----------------------------------------------------------------------------------------------
// Only a change of coordinates redraws the trip (a new address string for the same spot doesn't).
const tripKey = () => [props.pickup, props.stop, props.dropoff].map((p) => (isPoint(p) ? `${Number(p.lat)},${Number(p.lng)}` : '')).join('|')
watch(tripKey, () => {
  if (!map) return
  syncMarkers()
  drawRoute()
  frameTrip()
})
watch(() => (isPoint(props.driverLocation) ? `${Number(props.driverLocation.lat)},${Number(props.driverLocation.lng)}` : ''), syncCar)
watch(() => props.hotspots, (list, old) => {
  hotspotLayer?.setSpots(list)
  // Driver home: frame the busy areas when they first arrive (not on every refresh, or after the driver moved the map).
  const trip = [props.pickup, props.stop, props.dropoff].some(isPoint)
  if (map && !trip && list?.length && !old?.length && Date.now() - lastUserMove > 20_000) fitBounds()
}, { deep: true })
watch(() => props.showTraffic, (on) => trafficLayer?.setMap(on ? map : null))

// --- Cleanup -----------------------------------------------------------------------------------------------
onUnmounted(() => {
  themeObserver?.disconnect()
  cancelAnimationFrame(frames.car)
  cancelAnimationFrame(frames.route)
  routeRequest++ // ignore a route still loading
  Object.values(markers).forEach((m) => m?.setMap(null))
  for (const layer of [car, hotspotLayer, probe, routeCasing, routeLine, trafficLayer]) layer?.setMap(null)
  mapRef.value?.removeEventListener('wheel', markUserMove)
  mapRef.value?.removeEventListener('touchstart', markUserMove)
  if (map) maps.event.clearInstanceListeners(map)
  map = null
})

defineExpose({ panTo, fitBounds })
</script>

<template>
  <div ref="mapRef" class="absolute inset-0 w-full h-full" :class="failed && 'hidden'"></div>
</template>
