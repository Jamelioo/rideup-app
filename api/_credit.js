import { admin } from './_auth.js'
import { GUARANTEE_REASON, GUARANTEE_COOLDOWN_HOURS, DRIVER_CANCEL_CREDIT_CENTS_DEFAULT } from '../src/lib/guarantee.js'

// Adds to the rider's credit without losing a change made at the same moment (the rider booking a trip, an
// admin): the update only applies if the balance is still the one read, else it reads again.
export async function addCredit(riderId, amount) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: r, error } = await admin.from('riders').select('credit_cents').eq('id', riderId).maybeSingle()
    if (error) throw error
    if (!r) throw new Error('Rider not found')
    const { data: done, error: updErr } = await admin.from('riders')
      .update({ credit_cents: (r.credit_cents || 0) + amount })
      .eq('id', riderId)
      .eq('credit_cents', r.credit_cents || 0)
      .select('id')
    if (updErr) throw updErr
    if (done?.length) return
  }
  throw new Error('The rider’s credit changed while saving. Try again.')
}

export function guaranteeCents(env = process.env) {
  const raw = env.DRIVER_CANCEL_CREDIT_CENTS
  const n = raw === undefined || raw === '' ? DRIVER_CANCEL_CREDIT_CENTS_DEFAULT : parseInt(raw, 10)
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 5000) : DRIVER_CANCEL_CREDIT_CENTS_DEFAULT
}

// Gives the guarantee credit for a ride a driver cancelled. Returns the cents added (0 when switched off, already
// given for this ride, or the rider had one in the cooldown window). Best effort: a failure never blocks the cancel.
export async function grantDriverCancelCredit(ride, env = process.env) {
  const amount = guaranteeCents(env)
  if (!amount || !ride?.rider_id) return 0
  try {
    const since = new Date(Date.now() - GUARANTEE_COOLDOWN_HOURS * 3600_000).toISOString()
    const { data: recent, error } = await admin.from('ride_refunds')
      .select('id, ride_id, rides!inner(rider_id)')
      .eq('reason', GUARANTEE_REASON)
      .eq('rides.rider_id', ride.rider_id)
      .gte('created_at', since)
      .limit(1)
    if (error) throw error
    if (recent?.length) return 0

    const { data: saved, error: saveErr } = await admin.from('ride_refunds').insert({
      ride_id: ride.id, target: 'fare', method: 'credit', amount_cents: amount, driver_deduction_cents: 0,
      reason: GUARANTEE_REASON, created_by: null,
    }).select('id').single()
    if (saveErr) throw saveErr
    try {
      await addCredit(ride.rider_id, amount)
    } catch (err) {
      await admin.from('ride_refunds').delete().eq('id', saved.id)
      throw err
    }
    return amount
  } catch (err) {
    console.error('Driver-cancel credit failed:', err?.message)
    return 0
  }
}
