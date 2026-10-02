import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDsn, buildEnvelope } from '../src/lib/sentryEnvelope.js'

test('Sentry DSN is parsed; anything else turns reporting off', () => {
  assert.deepEqual(parseDsn('https://abc123@o42.ingest.us.sentry.io/777'),
    { key: 'abc123', host: 'o42.ingest.us.sentry.io', project: '777', dsn: 'https://abc123@o42.ingest.us.sentry.io/777' })
  assert.equal(parseDsn(''), null)
  assert.equal(parseDsn(undefined), null)
  assert.equal(parseDsn('not a dsn'), null)
})

test('error envelope: header, item header, event with the message and stack', () => {
  const dsn = parseDsn('https://abc123@o42.ingest.us.sentry.io/777')
  const { url, body, eventId } = buildEnvelope(dsn, new TypeError('boom'), { platform: 'node', tags: { area: 'capture' }, extra: { rideId: 'r1' } })
  assert.equal(url, 'https://o42.ingest.us.sentry.io/api/777/envelope/?sentry_key=abc123&sentry_version=7')
  const [header, item, event] = body.split('\n').map((l) => JSON.parse(l))
  assert.equal(header.event_id, eventId)
  assert.match(eventId, /^[0-9a-f]{32}$/)
  assert.equal(item.type, 'event')
  assert.equal(event.platform, 'node')
  assert.equal(event.exception.values[0].type, 'TypeError')
  assert.equal(event.exception.values[0].value, 'boom')
  assert.equal(event.tags.area, 'capture')
  assert.equal(event.extra.rideId, 'r1')
  assert.ok(event.exception.values[0].stacktrace.frames.length > 0)
})

test('non-Error values are still reported', () => {
  const dsn = parseDsn('https://k@o1.ingest.sentry.io/1')
  const event = JSON.parse(buildEnvelope(dsn, 'plain string').body.split('\n')[2])
  assert.equal(event.exception.values[0].value, 'plain string')
})
