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

// splitPaidCents: what friends paid through split fare (the rider who booked is charged the rest).
export function tripReceiptEmail({ ride, driverName, splitPaidCents = 0, splitFriends = 0 }) {
  const charged = chargeOf(ride) - splitPaidCents
  const date = new Date(ride.completed_at || ride.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Nassau' })
  const card = ride.payment_last4 ? `${escapeHtml(ride.payment_brand || 'Card')} •••• ${escapeHtml(ride.payment_last4)}` : 'Card on file'
  return {
    subject: `Your RideUp receipt — ${money(charged)}`,
    html: layout('Thanks for riding with RideUp', `
      <p style="font-size:14px;color:#555">${escapeHtml(date)} · Driver: ${escapeHtml(driverName || 'your driver')}</p>
      <p style="font-size:14px"><strong>From:</strong> ${escapeHtml(ride.pickup_address)}${ride.stop_address ? `<br><strong>Stop:</strong> ${escapeHtml(ride.stop_address)}` : ''}<br><strong>To:</strong> ${escapeHtml(ride.dropoff_address)}</p>
      <table style="width:100%;font-size:14px;border-top:1px solid #eee;margin-top:12px">
        ${row(Number(ride.surge_multiplier) > 1 ? 'Trip fare (busy-time pricing)' : 'Trip fare', money(ride.fare_cents - (ride.booking_fee_cents || 0) - (ride.airport_fee_cents || 0)))}
        ${ride.airport_fee_cents ? row('Airport pickup fee', money(ride.airport_fee_cents)) : ''}
        ${ride.booking_fee_cents ? row('Booking fee', money(ride.booking_fee_cents)) : ''}
        ${ride.promo_discount_cents ? row(ride.promo_code === 'REFERRAL' ? 'Friend referral' : `Promo ${escapeHtml(ride.promo_code || '')}`, '−' + money(ride.promo_discount_cents)) : ''}
        ${ride.credit_applied_cents ? row('RideUp credit', '−' + money(ride.credit_applied_cents)) : ''}
        ${splitPaidCents ? row(`Split with ${splitFriends} friend${splitFriends === 1 ? '' : 's'}`, '−' + money(splitPaidCents)) : ''}
        ${row(splitPaidCents ? 'Your share' : 'Total charged', money(charged), true)}
        ${row('Paid with', card)}
      </table>`),
  }
}

export function cancellationFeeEmail({ ride, feeCents, noShow }) {
  return {
    subject: `RideUp ${noShow ? 'no-show' : 'cancellation'} fee — ${money(feeCents)}`,
    html: layout(noShow ? 'No-show fee' : 'Cancellation fee', `
      <p style="font-size:14px;color:#555">${noShow
        ? 'Your driver waited at the pickup for 5 minutes and you didn’t arrive, so the ride was cancelled.'
        : 'You cancelled more than 2 minutes after your driver accepted.'} Most of this fee goes to your driver for their time.</p>
      <p style="font-size:14px"><strong>Pickup:</strong> ${escapeHtml(ride.pickup_address)}</p>
      <table style="width:100%;font-size:14px;border-top:1px solid #eee;margin-top:12px">${row('Fee charged', money(feeCents), true)}</table>
      <p style="font-size:13px;color:#555">Think this is wrong? Reply to this email and we’ll take a look.</p>`),
  }
}

export function tipReceiptEmail({ ride, tipCents }) {
  return {
    subject: `Thanks for tipping — ${money(tipCents)}`,
    html: layout('Your tip was sent', `<p style="font-size:14px;color:#555">100% of your ${money(tipCents)} tip goes to your driver.</p>
      <p style="font-size:14px"><strong>Trip:</strong> ${escapeHtml(ride.pickup_address)} → ${escapeHtml(ride.dropoff_address)}</p>`),
  }
}

export function splitInviteEmail({ inviter, ride, url }) {
  return {
    subject: `${inviter} wants to split a RideUp fare with you`,
    html: layout('Split a ride?', `
      <p style="font-size:14px;color:#555">${escapeHtml(inviter)} invited you to split the fare for their RideUp trip. Everyone who joins pays an equal share when the trip ends.</p>
      <p style="font-size:14px"><strong>From:</strong> ${escapeHtml(ride.pickup_address)}<br><strong>To:</strong> ${escapeHtml(ride.dropoff_address)}</p>
      <p><a href="${escapeHtml(url)}" style="display:inline-block;background:#2b8659;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">View invite</a></p>
      <p style="font-size:13px;color:#555">Didn’t expect this? Just ignore it; you won’t be charged.</p>`),
  }
}

export function splitReceiptEmail({ ride, inviter, shareCents, card }) {
  return {
    subject: `Your share of a RideUp trip — ${money(shareCents)}`,
    html: layout('Thanks for splitting the fare', `
      <p style="font-size:14px;color:#555">You split this trip with ${escapeHtml(inviter)}.</p>
      <p style="font-size:14px"><strong>From:</strong> ${escapeHtml(ride.pickup_address)}<br><strong>To:</strong> ${escapeHtml(ride.dropoff_address)}</p>
      <table style="width:100%;font-size:14px;border-top:1px solid #eee;margin-top:12px">
        ${row('Your share', money(shareCents), true)}
        ${row('Paid with', card ? escapeHtml(card) : 'Card on file')}
      </table>`),
  }
}

export function refundEmail({ ride, amountCents, method, target }) {
  return {
    subject: `RideUp refund — ${money(amountCents)}`,
    html: layout('Your refund', `
      <p style="font-size:14px;color:#555">${money(amountCents)} ${target === 'tip' ? 'of your tip ' : ''}was ${method === 'card'
        ? 'refunded to your card. It usually shows on your statement within 5–10 business days.'
        : 'added to your RideUp credit. It’s used automatically on your next rides.'}</p>
      <p style="font-size:14px"><strong>Trip:</strong> ${escapeHtml(ride.pickup_address)} → ${escapeHtml(ride.dropoff_address)}</p>`),
  }
}
