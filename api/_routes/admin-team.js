import { admin, requireUser, isAdmin, isStaff, fail } from '../_auth.js'
import { rateLimit } from '../_rateLimit.js'
import { logAdminAction } from '../_audit.js'

const checkRate = rateLimit({ maxRequests: 30, windowMs: 60_000 })
const ROLES = ['admin', 'support']
const ROLE_NAME = { admin: 'Admin', support: 'Support' }
const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

// Admin › Team. Roles live in the user's app_metadata (what the database's is_admin() / is_staff() read);
// the staff table mirrors them for listing and for who gets ride alerts.
//   { action: 'me' }                      staff: make sure I'm listed (returns my row)
//   { action: 'alerts', on }              staff: turn my own ride alerts on or off
//   { action: 'add', email, role }        admin: give an existing RideUp account a role
//   { action: 'role', userId, role }      admin: change someone's role
//   { action: 'remove', userId }          admin: take someone off the team
// A new role reaches the person's app the next time their session refreshes (within the hour) or they sign in.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const blocked = checkRate(req)
  if (blocked) {
    res.setHeader('Retry-After', blocked.retryAfter)
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' })
  }
  const user = await requireUser(req, res)
  if (!user) return
  if (!isStaff(user)) return res.status(403).json({ error: 'Admins only' })

  const { action } = req.body || {}
  try {
    if (action === 'me') {
      const { data, error } = await admin.from('staff')
        .upsert({ user_id: user.id, email: user.email || null, role: user.app_metadata.role }, { onConflict: 'user_id' })
        .select('*').single()
      if (error) throw error
      return res.status(200).json({ me: data })
    }
    if (action === 'alerts') {
      const { data, error } = await admin.from('staff').update({ ride_alerts: !!req.body.on }).eq('user_id', user.id).select('*').maybeSingle()
      if (error) throw error
      return res.status(200).json({ me: data })
    }

    if (!isAdmin(user)) return res.status(403).json({ error: 'Only admins can change the team.' })

    if (action === 'add') {
      const email = String(req.body.email || '').trim().toLowerCase()
      const role = req.body.role
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter their email address.' })
      if (!ROLES.includes(role)) return res.status(400).json({ error: 'Choose a role.' })
      const account = await findAccount(email)
      if (!account) return res.status(404).json({ error: 'No RideUp account uses that email. Ask them to sign up at rideupnassau.com first, then add them.' })
      if (account.userId === user.id) return res.status(400).json({ error: 'You’re already on the team.' })
      await setRole(account.userId, role)
      const { data, error } = await admin.from('staff')
        .upsert({ user_id: account.userId, email, name: account.name, role }, { onConflict: 'user_id' })
        .select('*').single()
      if (error) throw error
      await logAdminAction(user, { action: 'team.add', targetType: 'staff', targetId: account.userId, summary: `Added ${email} as ${ROLE_NAME[role]}` })
      return res.status(200).json({ member: data })
    }

    const userId = req.body.userId
    if (!userId) return res.status(400).json({ error: 'Choose a team member.' })
    if (userId === user.id) return res.status(400).json({ error: 'You can’t change your own access. Ask another admin.' })
    const { data: member } = await admin.from('staff').select('*').eq('user_id', userId).maybeSingle()
    if (!member) return res.status(404).json({ error: 'That person isn’t on the team.' })

    if (action === 'role') {
      const role = req.body.role
      if (!ROLES.includes(role)) return res.status(400).json({ error: 'Choose a role.' })
      await setRole(userId, role)
      const { data, error } = await admin.from('staff').update({ role }).eq('user_id', userId).select('*').single()
      if (error) throw error
      await logAdminAction(user, { action: 'team.role', targetType: 'staff', targetId: userId, summary: `${member.email || 'Team member'}: ${ROLE_NAME[member.role]} → ${ROLE_NAME[role]}` })
      return res.status(200).json({ member: data })
    }
    if (action === 'remove') {
      await setRole(userId, null)
      const { error } = await admin.from('staff').delete().eq('user_id', userId)
      if (error) throw error
      await logAdminAction(user, { action: 'team.remove', targetType: 'staff', targetId: userId, summary: `Removed ${member.email || 'a team member'} (${ROLE_NAME[member.role]})` })
      return res.status(200).json({ removed: true })
    }
    return res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    return fail(res, 'Admin team error', err)
  }
}

// The account behind an email: every RideUp sign-up has a rider row; drivers have a driver row.
async function findAccount(email) {
  for (const table of ['riders', 'drivers']) {
    const { data } = await admin.from(table).select('auth_user_id, name').ilike('email', escapeLike(email)).not('auth_user_id', 'is', null).limit(1)
    if (data?.[0]) return { userId: data[0].auth_user_id, name: data[0].name || null }
  }
  return null
}

// Keeps the rest of app_metadata (sign-in provider etc.) and sets or clears the role.
async function setRole(userId, role) {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error || !data?.user) throw error || new Error('User not found')
  const { error: updateErr } = await admin.auth.admin.updateUserById(userId, { app_metadata: { ...data.user.app_metadata, role } })
  if (updateErr) throw updateErr
}
