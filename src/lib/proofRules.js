// Proof on the landing pages, from real trips and real riders only (api/_routes/stats.js). Nothing shows until
// there's enough to mean something; then it appears on its own. Plain rules, so the server tests and the pages
// share them.
export const PROOF_MIN_TRIPS = 25
export const PROOF_MIN_RATINGS = 10
export const PROOF_MIN_AVERAGE = 4.5
export const PROOF_MIN_REQUESTS = 30 // ride requests in 30 days, for the driver page
export const QUOTES_SHOWN = 3

const n = (value) => Number(value || 0).toLocaleString('en-US')

// For riders: the rating riders give their drivers, and trips completed. [] until a number is worth showing.
export function proofLines(stats) {
  if (!stats) return []
  const lines = []
  if (stats.ratings >= PROOF_MIN_RATINGS && stats.average_rating >= PROOF_MIN_AVERAGE) {
    lines.push({ kind: 'rating', text: `${stats.average_rating.toFixed(1)} average driver rating from ${n(stats.ratings)} rider ratings` })
  }
  if (stats.completed_trips >= PROOF_MIN_TRIPS) {
    lines.push({ kind: 'trips', text: `${n(stats.completed_trips)} trips completed in Nassau` })
  }
  return lines
}

// For drivers: whether there's work, in numbers. [] until it's worth showing.
export function driverProofLines(stats) {
  if (!stats) return []
  const lines = []
  if (stats.requests_30d >= PROOF_MIN_REQUESTS) {
    lines.push({ kind: 'requests', text: `${n(stats.requests_30d)} ride requests in Nassau in the last 30 days` })
  }
  if (stats.completed_trips >= PROOF_MIN_TRIPS) {
    lines.push({ kind: 'trips', text: `${n(stats.completed_trips)} trips completed so far` })
  }
  return lines
}

// Rider quotes an admin approved, newest first: at most QUOTES_SHOWN, each with words and a name.
export function quotesToShow(stats) {
  return (stats?.quotes || []).filter((q) => q?.quote && q?.name).slice(0, QUOTES_SHOWN)
}
