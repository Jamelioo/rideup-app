// Spreadsheet downloads for the admin pages (rides, payouts, money). Plain functions so they're unit-tested.
// A cell that starts with = + - @ is shown as text (prefixed with ') so Excel and Google Sheets never run it
// as a formula: a rider's name or address is typed by them.
export function csvCell(value) {
  let s = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// columns: [{ label, value: (row) => any }]
export function toCsv(rows, columns) {
  const lines = [columns.map((c) => csvCell(c.label)).join(',')]
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(','))
  return lines.join('\r\n')
}

export const dollars = (cents) => ((cents || 0) / 100).toFixed(2)
export const nassauDate = (iso) => (iso ? new Date(iso).toLocaleString('en-CA', { timeZone: 'America/Nassau', hour12: false }).replace(',', '') : '')

export function downloadCsv(filename, csv) {
  // The BOM makes Excel read accents (é, ’) correctly.
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
