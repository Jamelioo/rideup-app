import { admin, requireUser, getDriverForUser, isStaff, fail } from '../_auth.js'
import { rateLimit } from '../_rateLimit.js'
import { chargeOf } from '../../src/lib/discounts.js'
import { formatFare } from '../../src/lib/pricing.js'
import { sendEmail, escapeHtml, cashUnpaidEmail } from '../_email.js'
import { pushToUser } from '../_push.js'
import { alertStaff } from '../_staffAlerts.js'
import { logAdminAction } from '../_audit.js'

const checkRate = rateLimit({ maxRequests: 10, windowMs: 60_000 })
const APP_URL = process.env.APP_URL || 'https://www.rideupnassau.com'
export const UNPAID_REPORT_HOURS = 24
const short = (address) => String(address || '').split(',')[0].trim() || '—'
const first = (name, fallback) => String(name || '').trim().split(/\s+/)[0] || fallback

// Why this trip can't be reported as unpaid, or null. Drivers have 24 hours after drop-off; staff any time.
export function unpaidReportProblem(ride, { staff = false, now = Date.now() } = {}) {
  if (ride.payment_status === 'cash_unpaid') return 'This fare was already reported. RideUp is following up with the rider.'
  if (ride.payment_method !== 'cash' || ride.status !== 'completed' || !['cash_due', 'cash_collected'].includes(ride.payment_status)) {
    return 'Only a finished cash trip can be reported as unpaid.'
  }
  if (!staff && (!ride.completed_at || now - Date.parse(ride.completed_at) > UNPAID_REPORT_HOURS * 3_600_000)) {
    return `Unpaid fares can be reported up to ${UNPAID_REPORT_HOURS} hours after the trip. Contact RideUp support.`
  }
  return null
}

// "Rider didn't pay" on a cash trip (like Uber's report in the trip's help). The fare is marked unpaid, so the
// driver doesn't owe RideUp its share of it; cash is turned off for the rider (and their other accounts on the
// same phone or card) until RideUp sorts it out; the rider is told and can reply if they did pay; and the team
// gets a support ticket and an alert. Staff can report it for a driver.   body: { rideId }
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const blocked = checkRate(req)
  if (blocked) {
    res.setHeader('Retry-After', blocked.retryAfter)
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' })
  }
  const user = await requireUser(req, res)
  if (!user) return

  const { rideId } = req.body || {}
  if (!rideId) return res.status(400).json({ error: 'rideId is required' })

  try {
    const { data: ride } = await admin
      .from('rides')
      .select('id, rider_id, driver_id, status, payment_method, payment_status, completed_at, created_at, fare_cents, promo_discount_cents, credit_applied_cents, pickup_address, dropoff_address, riders:rider_id(name, phone, email, auth_user_id), drivers:driver_id(name, auth_user_id)')
      .eq('id', rideId)
      .maybeSingle()
    if (!ride) return res.status(404).json({ error: 'Ride not found' })
    const staff = isStaff(user)
    if (!staff) {
      const driver = await getDriverForUser(user.id)
      if (!driver?.approved || driver.id !== ride.driver_id) return res.status(403).json({ error: 'Not your trip' })
    }
    const problem = unpaidReportProblem(ride, { staff })
    if (problem) return res.status(409).json({ error: problem })

    const { data: claimed, error } = await admin
      .from('rides')
      .update({ payment_status: 'cash_unpaid' })
      .eq('id', rideId)
      .in('payment_status', ['cash_due', 'cash_collected'])
      .select('id')
    if (error) throw error
    if (!claimed?.length) return res.status(409).json({ error: 'This fare was already reported. RideUp is following up with the rider.' })

    const { error: blockErr } = await admin
      .from('riders')
      .update({ cash_blocked: true, cash_blocked_reason: 'unpaid', cash_blocked_at: new Date().toISOString() })
      .eq('id', ride.rider_id)
    if (blockErr) console.error('Turning cash off after an unpaid fare failed:', blockErr.message)

    // A driver who reports a lot of unpaid fares is worth a look too.
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const { count: driverReports } = await admin
      .from('rides')
      .select('id', { count: 'exact', head: true })
      .eq('driver_id', ride.driver_id)
      .eq('payment_status', 'cash_unpaid')
      .gte('completed_at', since)

    const amountCents = chargeOf(ride)
    const amount = formatFare(amountCents)
    const rider = ride.riders || {}
    const driverName = ride.drivers?.name || 'The driver'
    const route = `${short(ride.pickup_address)} → ${short(ride.dropoff_address)}`
    const when = new Date(ride.completed_at || ride.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Nassau' })
    const description = `${driverName} reported that ${rider.name || 'the rider'} (${rider.phone || 'no phone on file'}) didn’t pay the ${amount} cash fare for ${route} on ${when}. Ride ${rideId}. `
      + `Cash is now off for this rider; turn it back on in Admin › Users once it’s sorted. Unpaid fares this driver reported in the last 30 days: ${driverReports ?? 1}.`
    const { error: ticketErr } = await admin.from('support_tickets').insert({
      user_id: ride.drivers?.auth_user_id || user.id,
      subject: 'Cash fare not paid',
      description,
    })
    if (ticketErr) console.error('Unpaid fare ticket failed:', ticketErr.message)

    await alertStaff({
      title: 'Cash fare not paid',
      body: `${first(driverName, 'A driver')} reported ${first(rider.name, 'a rider')} didn’t pay ${amount} (${route}). Cash is off for them until it’s sorted.`,
      url: '/admin/support',
      tag: `admin-unpaid-${rideId}`,
      emailHtml: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;color:#191f1c">
        <h2 style="margin:0 0 12px">Cash fare not paid</h2>
        <p style="margin:0 0 12px">${escapeHtml(description)}</p>
        ${rider.phone ? `<p style="margin:0 0 16px"><a href="tel:${escapeHtml(rider.phone)}">Call ${escapeHtml(first(rider.name, 'the rider'))}</a></p>` : ''}
        <p><a href="${APP_URL}/admin/support" style="display:inline-block;background:#2b8659;color:#fff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:10px">Open Support</a></p></div>`,
    })
    if (rider.email) await sendEmail({ to: rider.email, ...cashUnpaidEmail({ ride, amountCents }) })
    await pushToUser(rider.auth_user_id, {
      title: 'Payment needed for your trip',
      body: `Your driver told us the ${amount} cash fare wasn’t paid. Contact RideUp to sort it out.`,
      url: '/support',
      tag: `unpaid-${rideId}`,
    })
    if (staff) await logAdminAction(user, { action: 'ride.cash_unpaid', targetType: 'ride', targetId: rideId, summary: `Reported the ${amount} cash fare as unpaid` })
    return res.status(200).json({ success: true })
  } catch (err) {
    return fail(res, 'Cash unpaid report error', err)
  }
}
