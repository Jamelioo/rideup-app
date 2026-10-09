import { admin } from './_auth.js'
import { pushToUser } from './_push.js'
import { sendEmail, escapeHtml } from './_email.js'
import { formatFare } from '../src/lib/pricing.js'

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

// A rider just requested a ride. `notified` is how many drivers were alerted: 0 means nobody could take it and
// the rider was told no cars are available, so the team can call them back.
//   expired: nobody accepted in time (the rider's search ran out), also a missed ride.
export async function alertRideRequest(rideId, { notified = null, scheduled = false, expired = false } = {}) {
  if (!admin) return
  try {
    const { data: ride } = await admin
      .from('rides')
      .select('id, pickup_address, dropoff_address, fare_cents, vehicle_type, rider_name, passenger_name, riders:rider_id(name, phone)')
      .eq('id', rideId)
      .maybeSingle()
    if (!ride) return
    const missed = notified === 0 || expired
    const route = `${short(ride.pickup_address)} → ${short(ride.dropoff_address)}`
    const fare = formatFare(ride.fare_cents)
    const who = ride.riders?.name || ride.rider_name || 'A rider'
    const title = missed ? 'Missed ride request' : scheduled ? 'Scheduled ride needs a driver' : 'New ride request'
    const body = missed
      ? `${route} · ${fare}. ${expired ? 'No driver accepted in time' : 'No driver was available'}. Call ${who.split(' ')[0]} back from Live.`
      : `${route} · ${fare} · ${notified == null ? 'drivers alerted' : `${notified} driver${notified === 1 ? '' : 's'} alerted`}`
    const phone = ride.riders?.phone
    const emailHtml = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;color:#191f1c">
      <h2 style="margin:0 0 12px">${escapeHtml(title)}</h2>
      <p style="margin:0 0 6px"><strong>${escapeHtml(who)}</strong>${phone ? ` · <a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a>` : ''}${ride.passenger_name ? ` (for ${escapeHtml(ride.passenger_name)})` : ''}</p>
      <p style="margin:0 0 6px">${escapeHtml(ride.pickup_address || '')} → ${escapeHtml(ride.dropoff_address || '')}</p>
      <p style="margin:0 0 16px">${fare} · ${escapeHtml(ride.vehicle_type || 'standard')}</p>
      ${missed ? `<p style="margin:0 0 16px;color:#b42318"><strong>${expired ? 'No driver accepted in time' : 'No driver was available'}, so the rider was told no cars.</strong> A quick call can still win this ride.</p>` : ''}
      <p><a href="${APP_URL}/admin/live" style="display:inline-block;background:#2b8659;color:#fff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:10px">Open Live</a></p>
      <p style="font-size:12px;color:#888">Turn these off in Admin › Team.</p></div>`
    await alertStaff({ title, body, url: '/admin/live', tag: `admin-ride-${rideId}`, emailHtml })
  } catch (err) {
    console.error('Ride request alert failed:', err.message)
  }
}
