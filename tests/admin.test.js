import test from 'node:test'
import assert from 'node:assert/strict'
import { csvCell, toCsv, dollars } from '../src/lib/csv.js'
import { canOpenAdminPage, staffRole } from '../src/lib/staffRules.js'

test('CSV cells: commas, quotes and new lines are quoted', () => {
  assert.equal(csvCell('Cable Beach, Nassau'), '"Cable Beach, Nassau"')
  assert.equal(csvCell('He said "hi"'), '"He said ""hi"""')
  assert.equal(csvCell('line\nbreak'), '"line\nbreak"')
  assert.equal(csvCell(null), '')
  assert.equal(csvCell(12.5), '12.5')
})

test('CSV cells never run as spreadsheet formulas, but negative numbers stay numbers', () => {
  assert.equal(csvCell('=HYPERLINK("http://evil")'), `"'=HYPERLINK(""http://evil"")"`)
  assert.equal(csvCell('+1 242 555'), "'+1 242 555")
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)")
  assert.equal(csvCell('-5.00'), '-5.00')
  assert.equal(csvCell('-x'), "'-x")
})

test('a CSV has a header row and one line per row', () => {
  const csv = toCsv([{ a: 1, b: 'x' }, { a: 2, b: 'y,z' }], [{ label: 'A', value: (r) => r.a }, { label: 'B', value: (r) => r.b }])
  assert.equal(csv, 'A,B\r\n1,x\r\n2,"y,z"')
  assert.equal(dollars(1955), '19.55')
})

test('support staff can open operations pages but not money, settings or the team', () => {
  for (const p of ['/admin/live', '/admin/rides', '/admin/users', '/admin/drivers', '/admin/safety', '/admin/support']) assert.ok(canOpenAdminPage('support', p), p)
  for (const p of ['/admin', '/admin/revenue', '/admin/payouts', '/admin/promos', '/admin/settings', '/admin/team', '/admin/activity', '/admin/messages']) assert.ok(!canOpenAdminPage('support', p), p)
  assert.ok(canOpenAdminPage('admin', '/admin/revenue'))
  assert.ok(!canOpenAdminPage(null, '/admin/live'))
  assert.equal(staffRole({ app_metadata: { role: 'support' } }), 'support')
  assert.equal(staffRole({ user_metadata: { role: 'admin' } }), null) // only server-set app_metadata counts
})

test('Nassau day start follows daylight saving time', async () => {
  const { nassauDayStart, elapsed } = await import('../src/lib/nassauTime.js')
  assert.equal(nassauDayStart(new Date('2026-10-09T15:00:00Z')), '2026-10-09T04:00:00.000Z') // EDT, UTC−4
  assert.equal(nassauDayStart(new Date('2026-12-09T15:00:00Z')), '2026-12-09T05:00:00.000Z') // EST, UTC−5
  assert.equal(nassauDayStart(new Date('2026-10-10T02:00:00Z')), '2026-10-09T04:00:00.000Z') // 10pm on the 9th in Nassau
  const now = Date.parse('2026-10-09T15:00:00Z')
  assert.equal(elapsed('2026-10-09T14:59:30Z', now), '30s')
  assert.equal(elapsed('2026-10-09T14:55:00Z', now), '5 min')
  assert.equal(elapsed('2026-10-09T12:50:00Z', now), '2 h 10 min')
})

test('Nassau date filters: midnight to midnight, across the clock change', async () => {
  const { nassauMidnight } = await import('../src/lib/nassauTime.js')
  assert.equal(nassauMidnight('2026-10-09'), '2026-10-09T04:00:00.000Z')
  assert.equal(nassauMidnight('2026-10-09', 1), '2026-10-10T04:00:00.000Z')
  assert.equal(nassauMidnight('2026-11-01'), '2026-11-01T04:00:00.000Z') // clocks go back later that night
  assert.equal(nassauMidnight('2026-11-01', 1), '2026-11-02T05:00:00.000Z')
})

test('Nassau midnight on the day clocks go forward', async () => {
  const { nassauMidnight } = await import('../src/lib/nassauTime.js')
  assert.equal(nassauMidnight('2026-03-08'), '2026-03-08T05:00:00.000Z') // still EST at midnight
  assert.equal(nassauMidnight('2026-03-08', 1), '2026-03-09T04:00:00.000Z')
})
