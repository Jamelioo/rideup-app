import { supabase } from './supabase'
import { isGuaranteeCredit } from './guarantee'

// The RideUp guarantee credit the server added when this ride's driver cancelled, as a sentence ('' if none).
export async function guaranteeNote(rideId) {
  try {
    const { data } = await supabase.from('ride_refunds').select('amount_cents, reason').eq('ride_id', rideId)
    const credit = (data || []).find(isGuaranteeCredit)
    return credit ? ` We also added $${(credit.amount_cents / 100).toFixed(2)} RideUp credit for your next booking.` : ''
  } catch {
    return ''
  }
}
