import { admin } from './_auth.js'

// Records an admin action for Admin › Activity: who did it, what, to which ride/rider/driver. Edits made
// straight from the admin pages are recorded by database triggers (migration 016); this covers the server's
// own actions. Best effort: never throws and never blocks the action itself.
export async function logAdminAction(user, { action, targetType = null, targetId = null, summary = null, details = null }) {
  if (!admin) return
  try {
    const { error } = await admin.from('admin_actions').insert({
      actor_id: user?.id || null,
      actor_email: user?.email || null,
      action,
      target_type: targetType,
      target_id: targetId == null ? null : String(targetId),
      summary,
      details,
    })
    if (error) console.error('Action log failed:', error.message)
  } catch (err) {
    console.error('Action log failed:', err.message)
  }
}
