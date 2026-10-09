// One serverless function for all of the app's own JSON endpoints. Vercel's Hobby plan allows 12 functions per
// deployment, so instead of one function per file, /api/<action> is routed here and handled by
// api/_routes/<action>.js. The public URLs are unchanged (the app keeps calling /api/cancel-ride etc.).
// Paths starting with "_" never become functions. Stripe's webhook, the cron job and CSP reports keep
// their own files because outside services call them (and the webhook needs the raw request body).
const routes = {
  'add-tip': () => import('./_routes/add-tip.js'),
  'admin-assign': () => import('./_routes/admin-assign.js'),
  'admin-broadcast': () => import('./_routes/admin-broadcast.js'),
  'admin-complete': () => import('./_routes/admin-complete.js'),
  'admin-credit': () => import('./_routes/admin-credit.js'),
  'admin-refund': () => import('./_routes/admin-refund.js'),
  'admin-team': () => import('./_routes/admin-team.js'),
  'authorize-ride': () => import('./_routes/authorize-ride.js'),
  'availability': () => import('./_routes/availability.js'),
  'cancel-ride': () => import('./_routes/cancel-ride.js'),
  'capture-payment': () => import('./_routes/capture-payment.js'),
  'create-setup-intent': () => import('./_routes/create-setup-intent.js'),
  'create-setup-session': () => import('./_routes/create-setup-session.js'),
  'delete-account': () => import('./_routes/delete-account.js'),
  'health': () => import('./_routes/health.js'),
  'notify-driver': () => import('./_routes/notify-driver.js'),
  'save-payment-method': () => import('./_routes/save-payment-method.js'),
  'split-fare': () => import('./_routes/split-fare.js'),
  'trip-event': () => import('./_routes/trip-event.js'),
  'verify-session': () => import('./_routes/verify-session.js'),
}

export const ACTIONS = Object.keys(routes)

export function actionFrom(req) {
  const fromQuery = req.query?.action
  const value = Array.isArray(fromQuery) ? fromQuery[0] : fromQuery
  if (value) return String(value)
  // Fallback for servers that don't fill req.query from the [action] segment.
  return String(req.url || '').split('?')[0].replace(/\/+$/, '').split('/').pop()
}

export default async function handler(req, res) {
  const action = actionFrom(req)
  const load = Object.prototype.hasOwnProperty.call(routes, action) ? routes[action] : null
  if (!load) return res.status(404).json({ error: 'Not found' })
  let route
  try {
    route = (await load()).default
  } catch (err) {
    // e.g. a missing STRIPE_SECRET_KEY makes the Stripe routes fail to load; other routes keep working.
    console.error(`API route ${action} failed to load:`, err.message)
    return res.status(500).json({ error: 'Server is not configured' })
  }
  return route(req, res)
}
