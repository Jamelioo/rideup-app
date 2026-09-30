import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Service-role client. Never falls back to the anon key: without the service
// key every protected endpoint refuses to run rather than running unprivileged.
export const admin = url && serviceKey
  ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null

export function isAdmin(user) {
  // app_metadata is server-controlled; user_metadata is user-editable and must not be trusted.
  return user?.app_metadata?.role === 'admin'
}

// Verifies the caller's Supabase JWT. Returns the user, or sends 401/500 and returns null.
export async function requireUser(req, res) {
  if (!admin) {
    res.status(500).json({ error: 'Server is not configured' })
    return null
  }
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) {
    res.status(401).json({ error: 'Sign in required' })
    return null
  }
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) {
    res.status(401).json({ error: 'Invalid or expired session' })
    return null
  }
  return data.user
}

export async function getDriverForUser(userId) {
  const { data } = await admin
    .from('drivers')
    .select('id, approved')
    .eq('auth_user_id', userId)
    .maybeSingle()
  return data
}

export async function getRiderForUser(userId) {
  const { data } = await admin
    .from('riders')
    .select('id, stripe_customer_id, payment_method_id')
    .eq('auth_user_id', userId)
    .maybeSingle()
  return data
}

// Returns { rider: bool, driver: bool, admin: bool } for the given ride + user.
export async function rideRoles(ride, user) {
  const [rider, driver] = await Promise.all([getRiderForUser(user.id), getDriverForUser(user.id)])
  return {
    rider: !!rider && rider.id === ride.rider_id,
    driver: !!driver && driver.approved === true && driver.id === ride.driver_id,
    admin: isAdmin(user),
  }
}

// Stripe/Supabase messages can leak internals; log them, return something generic.
export function fail(res, label, err, status = 500) {
  console.error(`${label}:`, err?.message || err)
  return res.status(status).json({ error: 'Something went wrong. Please try again.' })
}
