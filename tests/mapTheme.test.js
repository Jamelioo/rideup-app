import test from 'node:test'
import assert from 'node:assert/strict'
import {
  mapStyles, routeColors, hotspotGradient, pickupSvg, dropoffSvg, stopSvg, CAR_SVG, PICKUP_ICON,
  distanceMeters, headingDegrees, nextRotation, cumulativeDistances, pathPortion,
} from '../src/lib/mapTheme.js'

const DOWNTOWN = { lat: 25.0776, lng: -77.3432 }
const CABLE_BEACH = { lat: 25.0703, lng: -77.405 }

test('distances at city scale match the haversine formula to within a metre', () => {
  const rad = (d) => (d * Math.PI) / 180
  const a = Math.sin(rad(DOWNTOWN.lat - CABLE_BEACH.lat) / 2) ** 2 +
    Math.cos(rad(CABLE_BEACH.lat)) * Math.cos(rad(DOWNTOWN.lat)) * Math.sin(rad(DOWNTOWN.lng - CABLE_BEACH.lng) / 2) ** 2
  const haversine = 2 * 6371000 * Math.asin(Math.sqrt(a))
  assert.ok(Math.abs(distanceMeters(CABLE_BEACH, DOWNTOWN) - haversine) < 1)
})

test('the car faces the way it is driving: 0 north, 90 east, 180 south, 270 west', () => {
  const here = { lat: 25.07, lng: -77.35 }
  const near = (d) => (n) => Math.abs(n - d) < 0.5
  assert.ok(near(0)(headingDegrees(here, { lat: 25.08, lng: -77.35 })))
  assert.ok(near(90)(headingDegrees(here, { lat: 25.07, lng: -77.34 })))
  assert.ok(near(180)(headingDegrees(here, { lat: 25.06, lng: -77.35 })))
  assert.ok(near(270)(headingDegrees(here, { lat: 25.07, lng: -77.36 })))
  assert.ok(near(83)(headingDegrees(CABLE_BEACH, DOWNTOWN))) // along West Bay Street, east-ish
})

test('the car turns the short way round and keeps a running total', () => {
  assert.equal(nextRotation(350, 10), 370)
  assert.equal(nextRotation(10, 350), -10)
  assert.equal(nextRotation(720, 90), 810)
  assert.equal(nextRotation(-90, 0), 0)
})

test('the route draws itself by distance and ends exactly where it should', () => {
  const path = [{ lat: 25, lng: -77.4 }, { lat: 25, lng: -77.39 }, { lat: 25, lng: -77.37 }]
  const total = cumulativeDistances(path)
  assert.equal(total.length, 3)
  assert.ok(Math.abs(total[2] - 3 * total[1]) < 0.5) // second leg is twice the first
  assert.deepEqual(pathPortion(path, total, 1), path)
  const half = pathPortion(path, total, 0.5)
  assert.equal(half.length, 3)
  assert.ok(Math.abs(half[2].lng - -77.385) < 1e-6) // halfway by distance is inside the second leg
  const start = pathPortion(path, total, 0)
  assert.deepEqual(start[0], path[0])
  assert.deepEqual(start[1], path[0])
  assert.deepEqual(pathPortion(path.slice(0, 1), [0], 0.5), path.slice(0, 1))
})

test('both palettes hide clutter and give water a colour', () => {
  for (const dark of [false, true]) {
    const styles = mapStyles(dark)
    const rule = (feature, element) => styles.filter((s) => s.featureType === feature && (s.elementType || 'all') === element)
    assert.ok(rule('poi', 'all').some((s) => s.stylers.some((x) => x.visibility === 'off')))
    assert.ok(rule('water', 'geometry').length === 1)
    assert.ok(styles.every((s) => s.stylers.every((x) => !('color' in x) || /^#[0-9a-f]{6}$/i.test(x.color))))
    const { casing, line } = routeColors(dark)
    assert.notEqual(casing, line)
  }
})

test('marker artwork is complete SVG, animated unless motion is reduced', () => {
  for (const dark of [false, true]) {
    for (const svg of [pickupSvg({ dark }), pickupSvg({ dark, animate: false }), dropoffSvg({ dark }), stopSvg({ dark }), CAR_SVG]) {
      assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*>.*<\/svg>$/s)
      assert.ok(!/undefined|NaN/.test(svg))
    }
    assert.ok(pickupSvg({ dark }).includes('<animate'))
    assert.ok(!pickupSvg({ dark, animate: false }).includes('<animate'))
  }
  assert.ok(PICKUP_ICON.anchorY < PICKUP_ICON.height && PICKUP_ICON.anchorX === PICKUP_ICON.width / 2)
})

test('busy-area glows fade from the centre to nothing', () => {
  assert.equal(hotspotGradient('#e8710a', 0.4), 'radial-gradient(closest-side, rgba(232,113,10,0.4) 0%, rgba(232,113,10,0.22) 45%, rgba(232,113,10,0) 100%)')
})
