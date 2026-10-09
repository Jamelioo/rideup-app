// Bahamas numbers are +1 (242) XXX-XXXX. Riders type them every way imaginable, so accept
// "555-0100", "242 555 0100", "1-242-555-0100" or "+1 242 555 0100" and return E.164 for SMS.
export function toE164(input, defaultArea = '242') {
  if (typeof input !== 'string') return null
  const trimmed = input.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (trimmed.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null
  if (digits.length === 7) return `+1${defaultArea}${digits}`
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

// "+12425550100" → "(242) 555-0100"; other countries are shown as stored.
export function formatPhone(value) {
  if (!value) return ''
  const digits = String(value).replace(/\D/g, '')
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (local.length === 10) return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`
  return String(value)
}

// Shown wherever a mobile number can't be read.
export const PHONE_HINT = 'Please enter a valid mobile number, like 242 555 0100. Outside the Bahamas, US and Canada, start with + and your country code.'

// What the rider typed, tidied once it's understood: "5550100" → "(242) 555-0100". Anything else is left as typed.
export function tidyPhone(input) {
  const e164 = toE164(input)
  return e164?.startsWith('+1') ? formatPhone(e164) : input
}

// A number verified by text message (the login's phone) only counts while it's still the one on the rider
// profile: a rider who changes their number in Edit Profile verifies the new one.
export function phoneIsVerified(user, riderPhone) {
  if (!user?.phone || !user.phone_confirmed_at) return false
  return !riderPhone || toE164(riderPhone) === toE164(`+${String(user.phone).replace(/^\+/, '')}`)
}

// A WhatsApp chat with a stored number (any format), optionally with a message typed in; '' if the number can't be read.
export function whatsappUrl(phone, text = '') {
  const e164 = toE164(phone || '')
  if (!e164) return ''
  return `https://wa.me/${e164.slice(1)}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}
