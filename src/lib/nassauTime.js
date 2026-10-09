// Nassau time (America/Nassau: UTC−5, or UTC−4 in summer) for "today" counts and date filters in the admin.

// '+HH:MM' / '−HH:MM' offset from UTC in Nassau at a given moment.
function offsetAt(date) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Nassau', timeZoneName: 'shortOffset' })
    .formatToParts(date).find((p) => p.type === 'timeZoneName')?.value || ''
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name) || ['', '-', '5', '00']
  return `${m[1]}${m[2].padStart(2, '0')}:${m[3] || '00'}`
}

// The date in Nassau, 'YYYY-MM-DD'.
export const nassauYmd = (date = new Date()) => date.toLocaleDateString('en-CA', { timeZone: 'America/Nassau' })

// Midnight at the start of a Nassau date ('YYYY-MM-DD', optionally moved by whole days), as an ISO timestamp.
export function nassauMidnight(ymd, addDays = 0) {
  const noon = new Date(`${ymd}T12:00:00Z`)
  noon.setUTCDate(noon.getUTCDate() + addDays)
  const day = noon.toISOString().slice(0, 10)
  // The offset can differ between midnight and noon on the day the clocks change, so check it at midnight.
  const guess = new Date(`${day}T00:00:00${offsetAt(noon)}`)
  return new Date(`${day}T00:00:00${offsetAt(guess)}`).toISOString()
}

// Start of today in Nassau.
export const nassauDayStart = (now = new Date()) => nassauMidnight(nassauYmd(now))

// "30s", "4 min", "2 h 5 min"
export function elapsed(iso, now = Date.now()) {
  if (!iso) return ''
  const sec = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${min % 60} min`
}
