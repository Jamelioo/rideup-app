import { admin } from './_auth.js'
import { pushToUser } from './_push.js'
import { sendEmail, escapeHtml } from './_email.js'
import { formatFare } from '../src/lib/pricing.js'
import { REQUEST_SEARCH_MINUTES } from '../src/lib/dispatch.js'

const APP_URL = process.env.APP_URL || 'https://www.rideupnassau.com'
const short = (address) => String(address || '').split(',')[0].trim() || '—'

// Staff with ride alerts on (Admin › Team). Empty until migration 016 has run.
async function alertRecipients() {
  const { data, error } = await admin.from('staff').select('user_id, email').eq('ride_alerts', true)
  return error ? [] : data || []
}

// Tells the team about something that needs attention now: a push to every device they turned alerts on for,
// and an email as a backup (a phone's notifications can be off). Best effort: never throws.
export async function alertStaff({ title, body, url = '/admin/live', tag, emailHtml }) {
  if (!admin) return 0
  try {
    const people = await alertRecipients()
    const results = await Promise.all(people.map(async (p) => {
      const pushed = await pushToUser(p.user_id, { title, body, url, tag })
      if (p.email && emailHtml) await sendEmail({ to: p.email, subject: `RideUp: ${title}`, html: emailHtml })
      return pushed
    }))
    return results.reduce((a, b) => a + b, 0)
  } catch (err) {
    console.error('Staff alert failed:', err.message)
    return 0
  }
}

// The alert's wording for a ride request. `notified` is how many drivers were alerted: 0 means nobody is online
// to take it, so the request stays open and the team is asked to go online or assign a driver while the rider
// waits. expired: nobody accepted in time (the search ran out), a missed ride the team can call back.
export function rideAlertText(ride, { notified = null, scheduled = false, expired = false } = {}) {
  const waiting = notified === 0 && !expired
  const cash = ride.payment_method === 'cash'
  const route = `${short(ride.pickup_address)} → ${short(ride.dropoff_address)}`
  const fare = formatFare(ride.fare_cents) + (cash ? ' cash' : '')
  const who = ride.riders?.name || ride.rider_name || 'A rider'
  const title = expired ? 'Missed ride request'
    : waiting ? (cash ? 'Cash rider waiting: no driver taking cash' : 'Rider waiting: no driver online')
      : scheduled ? 'Scheduled ride needs a driver' : 'New ride request'
  const body = expired
    ? `${route} · ${fare}. No driver accepted in time. Call ${who.split(' ')[0]} back from Live.`
    : waiting
      ? `${route} · ${fare}. Go online in the driver app, or assign a driver in Live. It stays open for ${REQUEST_SEARCH_MINUTES} minutes.`
      : `${route} · ${fare} · ${notified == null ? 'drivers alerted' : `${notified} driver${notified === 1 ? '' : 's'} alerted`}`
  const phone = ride.riders?.phone
  const emailHtml = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;color:#191f1c">
      <h2 style="margin:0 0 12px">${escapeHtml(title)}</h2>
      <p style="margin:0 0 6px"><strong>${escapeHtml(who)}</strong>${phone ? ` · <a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a>` : ''}${ride.passenger_name ? ` (for ${escapeHtml(ride.passenger_name)})` : ''}</p>
      <p style="margin:0 0 6px">${escapeHtml(ride.pickup_address || '')} → ${escapeHtml(ride.dropoff_address || '')}</p>
      <p style="margin:0 0 16px">${fare} · ${escapeHtml(ride.vehicle_type || 'standard')}</p>
      ${expired ? '<p style="margin:0 0 16px;color:#b42318"><strong>No driver accepted in time, so the rider was told no cars.</strong> A quick call can still win this ride.</p>' : ''}
      ${waiting ? `<p style="margin:0 0 16px;color:#b42318"><strong>${cash ? 'No driver who takes cash is online' : 'No driver is online'}, and the rider is waiting.</strong> Go online in the driver app, or assign a driver in Live. The request closes after ${REQUEST_SEARCH_MINUTES} minutes if nobody accepts.</p>` : ''}
      <p><a href="${APP_URL}/admin/live" style="display:inline-block;background:#2b8659;color:#fff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:10px">Open Live</a></p>
      <p style="font-size:12px;color:#888">Turn these off in Admin › Team.</p></div>`
  return { title, body, emailHtml }
}

// Tells the team about a ride request (see rideAlertText for when it's urgent).
export async function alertRideRequest(rideId, options = {}) {
  if (!admin) return
  try {
    const { data: ride } = await admin
      .from('rides')
      .select('*, riders:rider_id(name, phone)')
      .eq('id', rideId)
      .maybeSingle()
    if (!ride) return
    const { title, body, emailHtml } = rideAlertText(ride, options)
    await alertStaff({ title, body, url: '/admin/live', tag: `admin-ride-${rideId}`, emailHtml })
  } catch (err) {
    console.error('Ride request alert failed:', err.message)
  }
}
