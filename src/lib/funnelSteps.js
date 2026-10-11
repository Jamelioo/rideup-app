// The booking funnel (Admin › Money), in order. Shared by the app (src/lib/funnel.js) and the server
// (api/_routes/track.js); must match the check in migration 020.
export const FUNNEL_STEPS = ['landing', 'booking', 'price', 'request']
export const FUNNEL_LABELS = {
  landing: 'Visited the site',
  booking: 'Opened booking',
  price: 'Saw a price',
  request: 'Requested a ride',
}

// Counts each step once per browser per day: returns whether to send it, and what to remember.
//   seen: { [step]: 'YYYY-MM-DD' } from earlier sends; today: 'YYYY-MM-DD' (Nassau)
export function markStep(seen, step, today) {
  if (!FUNNEL_STEPS.includes(step)) return { send: false, seen }
  if (seen?.[step] === today) return { send: false, seen }
  return { send: true, seen: { ...(seen || {}), [step]: today } }
}
