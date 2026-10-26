import { chargeOf } from '../src/lib/discounts.js'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.EMAIL_FROM || 'RideUp <noreply@rideupnassau.com>'

export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const money = (cents) => '$' + ((cents || 0) / 100).toFixed(2)

// Sends an email if Resend is configured; otherwise does nothing. Never throws.
export async function sendEmail({ to, subject, html }) {
  if (!resend || !to) return false
  try {
    await resend.emails.send({ from: FROM, to, subject, html })
    return true
  } catch (err) {
    console.error('Email send failed:', err.message)
    return false
  }
}

function layout(title, body) {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#191f1c">
    <div style="margin-bottom:24px"><span style="font-size:22px;font-weight:700">Ride</span><span style="font-size:22px;font-weight:700;color:#2b8659">Up</span></div>
    <h1 style="font-size:20px;margin:0 0 16px">${title}</h1>${body}
    <p style="font-size:12px;color:#888;margin-top:32px">Questions? Reply to this email or call (242) 452-9911.</p></div>`
}

const row = (label, value, bold = false) =>
  `<tr><td style="padding:6px 0;color:#555">${label}</td><td style="padding:6px 0;text-align:right;${bold ? 'font-weight:700' : ''}">${value}</td></tr>`

// Sent once the driver confirms the cash (api/_cash.js). Every trip is paid in cash to the driver at drop-off.
export function tripReceiptEmail({ ride, driverName }) {
  const total = chargeOf(ride)
  const date = new Date(ride.completed_at || ride.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Nassau' })
  return {
    subject: `Your RideUp receipt — ${money(total)}`,
    html: layout('Thanks for riding with RideUp', `
      <p style="font-size:14px;color:#555">${escapeHtml(date)} · Driver: ${escapeHtml(driverName || 'your driver')}</p>
      <p style="font-size:14px"><strong>From:</strong> ${escapeHtml(ride.pickup_address)}${ride.stop_address ? `<br><strong>Stop:</strong> ${escapeHtml(ride.stop_address)}` : ''}<br><strong>To:</strong> ${escapeHtml(ride.dropoff_address)}</p>
      <table style="width:100%;font-size:14px;border-top:1px solid #eee;margin-top:12px">
        ${row(Number(ride.surge_multiplier) > 1 ? 'Trip fare (busy-time pricing)' : 'Trip fare', money(ride.fare_cents - (ride.booking_fee_cents || 0) - (ride.airport_fee_cents || 0)))}
        ${ride.airport_fee_cents ? row('Airport pickup fee', money(ride.airport_fee_cents)) : ''}
        ${ride.booking_fee_cents ? row('Booking fee', money(ride.booking_fee_cents)) : ''}
        ${ride.promo_discount_cents ? row(ride.promo_code === 'REFERRAL' ? 'Friend referral' : `Promo ${escapeHtml(ride.promo_code || '')}`, '−' + money(ride.promo_discount_cents)) : ''}
        ${ride.credit_applied_cents ? row('RideUp credit', '−' + money(ride.credit_applied_cents)) : ''}
        ${row('Total paid', money(total), true)}
        ${row('Paid with', 'Cash to your driver')}
      </table>`),
  }
}

// The driver of a cash trip reported that the rider didn't pay (api/_routes/cash-unpaid.js).
export function cashUnpaidEmail({ ride, amountCents }) {
  const date = new Date(ride.completed_at || ride.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Nassau' })
  return {
    subject: `Payment needed for your RideUp trip — ${money(amountCents)}`,
    html: layout('Your cash fare wasn’t paid', `
      <p style="font-size:14px;color:#555">Your driver told us the ${money(amountCents)} cash fare for your trip on ${escapeHtml(date)} wasn’t paid.</p>
      <p style="font-size:14px"><strong>From:</strong> ${escapeHtml(ride.pickup_address)}<br><strong>To:</strong> ${escapeHtml(ride.dropoff_address)}</p>
      <p style="font-size:14px;color:#555">Until it’s sorted out, booking is paused on your account. To settle it, reply to this email or call us. If you did pay, or think this is a mistake, tell us and we’ll look into it.</p>`),
  }
}

// Refunds are given as RideUp credit (api/_routes/admin-refund.js).
export function refundEmail({ ride, amountCents, target }) {
  return {
    subject: `RideUp refund — ${money(amountCents)}`,
    html: layout('Your refund', `
      <p style="font-size:14px;color:#555">${money(amountCents)} ${target === 'tip' ? 'of your tip ' : ''}was added to your RideUp credit. It comes off your next rides automatically.</p>
      <p style="font-size:14px"><strong>Trip:</strong> ${escapeHtml(ride.pickup_address)} → ${escapeHtml(ride.dropoff_address)}</p>`),
  }
}

export function docExpiryEmail({ name, doc, when, expired }) {
  const first = escapeHtml(String(name || '').trim().split(/\s+/)[0] || 'there')
  return {
    subject: expired ? `Your ${doc} has expired` : `Your ${doc} expires on ${when}`,
    html: layout(expired ? `Your ${escapeHtml(doc)} has expired` : 'A document is expiring soon', `
      <p style="font-size:14px;color:#555">Hi ${first}, ${expired
        ? `your ${escapeHtml(doc)} expired on ${escapeHtml(when)}, so you can’t go online until we’ve checked the new one.`
        : `your ${escapeHtml(doc)} expires on ${escapeHtml(when)}. Upload the renewed document before then so you can keep driving without a break.`}</p>
      <p><a href="${escapeHtml(process.env.APP_URL || 'https://rideupnassau.com')}/driver/documents" style="display:inline-block;background:#2b8659;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">Upload document</a></p>`),
  }
}
