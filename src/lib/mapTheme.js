// RideUp's map look (used by components/GoogleMap.vue): day and night palettes, marker artwork and the small
// geometry helpers for the moving car and the route animation. Pure functions with no Google or Vue
// dependency, so they can be unit-tested. Colours follow docs/BRAND.md.

// --- Palettes ------------------------------------------------------------------------------------------------
// Classic JSON styles. A cloud map ID would turn these off, so the map keeps classic markers.
// Day: soft green-grey land, Bahamas-turquoise water, white streets, gold highways.
const DAY = [
  { elementType: 'geometry', stylers: [{ color: '#eef2ee' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5b6b62' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 3 }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#cfd8d1' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#0f3d2a' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#6f8077' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#e8ede8' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#e9f1e8' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#cdeacf' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#dfe5df' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#77877d' }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#d3dbd4' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#ffe49a' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#efc24a' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#6b5716' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit.station.airport', stylers: [{ visibility: 'on' }] },
  { featureType: 'transit.station.airport', elementType: 'geometry', stylers: [{ color: '#e2e9e3' }] },
  { featureType: 'transit.station.airport', elementType: 'labels.text.fill', stylers: [{ color: '#0f3d2a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#a5e0da' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3a8b83' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#a5e0da' }] },
]

// Night: green-black land, deep teal water, green-tinted streets. Not brown highways on navy: that's Google's
// stock night style.
const NIGHT = [
  { elementType: 'geometry', stylers: [{ color: '#0e1813' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7f9e8f' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0e1813' }, { weight: 3 }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#1f3029' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#cfe3d8' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#6f8d7e' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#111d17' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#0e1813' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#11281e' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#23352c' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0e1813' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#86a596' }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#2c4237' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#335a45' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1c3a2c' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#b7d3c4' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit.station.airport', stylers: [{ visibility: 'on' }] },
  { featureType: 'transit.station.airport', elementType: 'geometry', stylers: [{ color: '#14231c' }] },
  { featureType: 'transit.station.airport', elementType: 'labels.text.fill', stylers: [{ color: '#cfe3d8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a3037' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3f8a88' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#0a3037' }] },
]

export const mapStyles = (dark) => (dark ? NIGHT : DAY)

// Shown behind the tiles while they load, so dark mode doesn't flash Google's light grey.
export const mapBackground = (dark) => (dark ? '#0e1813' : '#eef2ee')

export const routeColors = (dark) => (dark ? { casing: '#03110b', line: '#3ccf8e' } : { casing: '#0f3d2a', line: '#1f8a55' })

// Drivers' busy areas: soft glows, green where riders are asking, orange where fares are higher (matches the
// legend on the driver home screen).
export const HOTSPOT_RADIUS_M = 700
export const HOTSPOT_MIN_PX = 44 // so busy areas still read as areas when the whole island is on screen
export const hotspotColor = (dark, surge) => (surge ? '#e8710a' : dark ? '#34c27a' : '#1f8a55')
export function hotspotGradient(color, strength) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
  const at = (alpha) => `rgba(${r},${g},${b},${+alpha.toFixed(3)})`
  return `radial-gradient(closest-side, ${at(strength)} 0%, ${at(strength * 0.55)} 45%, ${at(0)} 100%)`
}

// --- Markers -------------------------------------------------------------------------------------------------
export const svgUrl = (svg) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`

// Dot's face from DotMascot.vue (drawn at radius 100), with bigger eyes and a thicker smile so it reads at
// 26px, and a white rim so it stands out on both palettes.
const DOT =
  '<circle r="117" fill="#fff"/>' +
  '<circle r="100" fill="#F2AE1D"/>' +
  '<path d="M89 -13C89 42.2 44.2 87 -11 87C-38.6 87 -63.5 75.9 -81.6 57.8C-93.2 41.5 -100 21.5 -100 0C-100 -55.2 -55.2 -100 0 -100C27.6 -100 52.5 -88.9 70.6 -70.8C82.2 -54.5 89 -34.5 89 -13Z" fill="#FFC83D"/>' +
  '<rect x="-43" y="-40" width="26" height="46" rx="13" fill="#0F3D2A"/>' +
  '<rect x="17" y="-40" width="26" height="46" rx="13" fill="#0F3D2A"/>' +
  '<circle cx="-26.5" cy="-29" r="6" fill="#fff"/>' +
  '<circle cx="33.5" cy="-29" r="6" fill="#fff"/>' +
  '<path d="M-16 25 Q0 38 16 25" fill="none" stroke="#0F3D2A" stroke-width="11" stroke-linecap="round"/>'

const shadowFilter = (opacity) =>
  `<defs><filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1.2" stdDeviation="1.3" flood-color="#000" flood-opacity="${opacity}"/></filter></defs>`

// Pickup: Dot on a short pin whose tip is the exact spot (so riders can drag it precisely), with a soft
// shadow and a ripple on the ground. The anchor is the pin's tip.
export const PICKUP_ICON = { width: 56, height: 58, anchorX: 28, anchorY: 47 }
export function pickupSvg({ dark = false, animate = true } = {}) {
  const ring = dark ? '#FFC83D' : '#17603D'
  const ease = 'dur="2.4s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1"'
  const ripple = (begin) =>
    `<ellipse cx="28" cy="47" rx="4" ry="1.4" fill="${ring}" opacity="0">` +
    `<animate attributeName="rx" values="4;25" dur="2.4s" begin="${begin}" repeatCount="indefinite"/>` +
    `<animate attributeName="ry" values="1.4;8.8" dur="2.4s" begin="${begin}" repeatCount="indefinite"/>` +
    `<animate attributeName="opacity" values="${dark ? 0.5 : 0.36};0" dur="2.4s" begin="${begin}" repeatCount="indefinite"/>` +
    '</ellipse>'
  const ground = animate
    ? ripple('0s') + ripple('1.2s')
    : `<ellipse cx="28" cy="47" rx="12" ry="4.2" fill="${ring}" opacity="${dark ? 0.22 : 0.16}"/>`
  // Dot lifts 1.5px and back, and the pin stretches with it so the tip never moves.
  const lift = animate ? `<animateTransform attributeName="transform" type="translate" values="0 0;0 -1.5;0 0" ${ease}/>` : ''
  const stretch = animate ? `<animate attributeName="y" values="32;30.5;32" ${ease}/><animate attributeName="height" values="15;16.5;15" ${ease}/>` : ''
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="58" viewBox="0 0 56 58">' +
    '<defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.1"/></filter>' +
    `<filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1.2" stdDeviation="1.3" flood-color="#000" flood-opacity="${dark ? 0.6 : 0.3}"/></filter></defs>` +
    ground +
    `<ellipse cx="28" cy="47.5" rx="4.5" ry="1.7" fill="#000" opacity="${dark ? 0.6 : 0.3}" filter="url(#b)"/>` +
    `<rect x="27" y="32" width="2" height="15" rx="1" fill="${dark ? '#fff' : '#0F3D2A'}">${stretch}</rect>` +
    `<g>${lift}<g filter="url(#s)" transform="translate(28 20) scale(.13)">${DOT}</g></g>` +
    '</svg>'
  )
}

// Drop-off: a square, like every ride app (pickup round, drop-off square), in RideUp deep green.
export const DROPOFF_ICON = { width: 26, height: 26, anchorX: 13, anchorY: 13 }
export function dropoffSvg({ dark = false } = {}) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">' +
    shadowFilter(dark ? 0.6 : 0.3) +
    '<rect x="3" y="3" width="20" height="20" rx="5.5" fill="#fff" filter="url(#s)"/>' +
    '<rect x="6" y="6" width="14" height="14" rx="3.5" fill="#0F3D2A"/>' +
    '<rect x="10.5" y="10.5" width="5" height="5" rx="1.2" fill="#fff"/>' +
    '</svg>'
  )
}

// Extra stop: a smaller hollow square.
export const STOP_ICON = { width: 20, height: 20, anchorX: 10, anchorY: 10 }
export function stopSvg({ dark = false } = {}) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">' +
    shadowFilter(dark ? 0.6 : 0.3) +
    `<rect x="4" y="4" width="12" height="12" rx="3.5" fill="#fff" stroke="${dark ? '#3ccf8e' : '#0F3D2A'}" stroke-width="3" filter="url(#s)"/>` +
    '</svg>'
  )
}

// The driver's car from above, nose up (north). RideUp green with gold headlights and the gold dot on the roof.
export const CAR_SIZE = { width: 24, height: 42 }
export const CAR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="42" viewBox="0 0 24 42" aria-hidden="true">' +
  '<rect x="0.7" y="13.2" width="3.6" height="2.8" rx="1.3" fill="#17603D" stroke="#fff" stroke-width="1"/>' +
  '<rect x="19.7" y="13.2" width="3.6" height="2.8" rx="1.3" fill="#17603D" stroke="#fff" stroke-width="1"/>' +
  '<rect x="2.75" y="1.75" width="18.5" height="38.5" rx="7.5" fill="#17603D" stroke="#fff" stroke-width="1.5"/>' +
  '<path d="M6.2 5.4Q12 3.6 17.8 5.4L17.2 11.2H6.8Z" fill="#1F8A55"/>' +
  '<path d="M5.3 13.8Q12 11.2 18.7 13.8L17.1 18.8H6.9Z" fill="#0A2419"/>' +
  '<rect x="6.9" y="19.4" width="10.2" height="10.4" rx="2.4" fill="#1F8A55"/>' +
  '<path d="M6.9 30.4H17.1L18.3 34.5Q12 36.5 5.7 34.5Z" fill="#0A2419"/>' +
  '<rect x="5" y="2.9" width="4.2" height="1.9" rx=".95" fill="#FFC83D"/>' +
  '<rect x="14.8" y="2.9" width="4.2" height="1.9" rx=".95" fill="#FFC83D"/>' +
  '<rect x="5.3" y="37.5" width="3.8" height="1.5" rx=".75" fill="#FF5A4E"/>' +
  '<rect x="14.9" y="37.5" width="3.8" height="1.5" rx=".75" fill="#FF5A4E"/>' +
  '<circle cx="12" cy="24.6" r="2.7" fill="#FFC83D" stroke="#0F3D2A" stroke-width=".9"/>' +
  '</svg>'

// --- Geometry (city scale, so a flat-earth approximation is accurate to well under a metre) -----------------
const EARTH_M = 6371000
const rad = (d) => (d * Math.PI) / 180
const offsets = (a, b) => [rad(b.lng - a.lng) * Math.cos(rad((a.lat + b.lat) / 2)), rad(b.lat - a.lat)]

export function distanceMeters(a, b) {
  const [x, y] = offsets(a, b)
  return Math.hypot(x, y) * EARTH_M
}

// Compass heading from a to b: 0 = north, 90 = east.
export function headingDegrees(a, b) {
  const [x, y] = offsets(a, b)
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360
}

// Next value for a running rotation so the car turns the short way (350° → 10° turns 20°, not back 340°).
export function nextRotation(current, target) {
  return current + ((((target - current) % 360) + 540) % 360) - 180
}

export function cumulativeDistances(path) {
  const out = [0]
  for (let i = 1; i < path.length; i++) out.push(out[i - 1] + distanceMeters(path[i - 1], path[i]))
  return out
}

// The first `fraction` (0–1) of a path, measured by distance, ending exactly at that point.
export function pathPortion(path, cumulative, fraction) {
  if (path.length < 2 || fraction >= 1) return path
  const target = cumulative[cumulative.length - 1] * Math.max(0, fraction)
  let i = 1
  while (i < path.length - 1 && cumulative[i] < target) i++
  const a = path[i - 1]
  const b = path[i]
  const t = Math.min(1, (target - cumulative[i - 1]) / (cumulative[i] - cumulative[i - 1] || 1))
  return [...path.slice(0, i), { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }]
}
