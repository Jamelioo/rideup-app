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
