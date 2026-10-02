// Straight-line distance and a rough road-time estimate, used for live ETAs until a routing API is wired in.
export function milesBetween(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null
  const rad = (d) => (d * Math.PI) / 180
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Roads are ~1.35× longer than the straight line; Nassau traffic averages ~18 mph.
export function etaMinutes(from, to) {
  const miles = milesBetween(from, to)
  if (miles == null) return null
  return Math.max(1, Math.round(((miles * 1.35) / 18) * 60))
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
