import { supabase } from './supabase'
import { toE164 } from './phone'

// The rider's mobile number lives on their rider profile (riders.phone): drivers, the team and text messages read
// it there. Sign-up puts it there (migration 017); these cover accounts made before sign-up asked for it.

// True when the rider has a number on their profile. A number that only reached their login (Edit Profile saved
// it there, or they signed up before migration 017 ran) is copied onto the profile first.
export async function riderHasPhone(user, rider) {
  if (toE164(rider?.phone || '')) return true
  const saved = toE164(user?.user_metadata?.phone || '')
  if (!saved) return false
  if (!rider?.id) return true // no profile yet: it's created with this number when they book
  const { error } = await supabase.from('riders').update({ phone: saved }).eq('id', rider.id)
  return !error
}

// Saves a number (E.164) on the rider profile, and on the login so a profile created later still gets it.
export async function saveRiderPhone(user, phone) {
  const { error } = await supabase.from('riders').update({ phone }).eq('auth_user_id', user.id)
  if (error) throw error
  if (user.user_metadata?.phone === phone) return
  try {
    await supabase.auth.updateUser({ data: { phone } })
  } catch { /* the profile has it, which is what counts */ }
}

// The booking screen asks riders with no number once (booking a ride always asks). Remembered per account on
// this device, and for this visit when the browser won't store it.
const reminded = new Set()
const reminderKey = (userId) => `rideup_phone_asked_${userId}`
export function phoneReminderShown(userId) {
  if (reminded.has(userId)) return true
  try { return localStorage.getItem(reminderKey(userId)) === '1' } catch { return false }
}
export function rememberPhoneReminder(userId) {
  reminded.add(userId)
  try { localStorage.setItem(reminderKey(userId), '1') } catch { /* private mode: once this visit */ }
}
