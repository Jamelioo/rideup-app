// Text messages through Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM). Used for passengers who
// were booked by someone else and may not have the app. Optional: without the keys nothing is sent.
// Best-effort: never throws.

export const smsConfigured = () => Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM)

// Bahamian numbers: 7 digits → +1 242 …, 10 digits → +1 …; anything else is sent as typed with a +.
export function toE164(phone) {
  const d = String(phone || '').replace(/\D/g, '')
  if (d.length === 7) return `+1242${d}`
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return d.length >= 8 && d.length <= 15 ? `+${d}` : null
}

export async function sendSms(phone, body) {
  const to = toE164(phone)
  if (!smsConfigured() || !to) return false
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM, Body: body.slice(0, 600) }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) console.error('SMS failed:', res.status, (await res.text().catch(() => '')).slice(0, 200))
    return res.ok
  } catch (err) {
    console.error('SMS failed:', err.message)
    return false
  }
}
