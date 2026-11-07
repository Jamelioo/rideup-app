// Proof on the landing pages, from real trips only (api/_routes/stats.js). Nothing shows until there's enough to
// mean something; then it appears on its own. Plain rules, so the server tests and the pages share them.
export const PROOF_MIN_TRIPS = 25
export const PROOF_MIN_RATINGS = 10
export const PROOF_MIN_AVERAGE = 4.5

// What to say for these stats: [] until a number is worth showing.
export function proofLines(stats) {
  if (!stats) return []
  const lines = []
  if (stats.ratings >= PROOF_MIN_RATINGS && stats.average_rating >= PROOF_MIN_AVERAGE) {
    lines.push({ kind: 'rating', text: `${stats.average_rating.toFixed(1)} average driver rating from ${stats.ratings.toLocaleString('en-US')} rider ratings` })
  }
  if (stats.completed_trips >= PROOF_MIN_TRIPS) {
    lines.push({ kind: 'trips', text: `${stats.completed_trips.toLocaleString('en-US')} trips completed in Nassau` })
  }
  return lines
}
