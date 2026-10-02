// Minimal Sentry event sender shared by the app and the API (no SDK, no imports). Sentry's ingest API
// accepts "envelopes": a header line, an item header line and the event JSON. Does nothing without a DSN.

export function parseDsn(dsn) {
  const m = /^https:\/\/([^@]+)@([^/]+)\/(\d+)$/.exec(String(dsn || '').trim())
  return m ? { key: m[1], host: m[2], project: m[3], dsn: String(dsn).trim() } : null
}

const hex32 = () => Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')

function frames(stack) {
  // Best-effort: Sentry shows the raw stack in "extra" too, so a parse miss loses nothing.
  return String(stack || '').split('\n').slice(1, 30).reverse().map((line) => {
    const m = /at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/.exec(line.trim()) || /(?:(.*)@)?(.+?):(\d+):(\d+)$/.exec(line.trim())
    return m ? { function: m[1] || '?', filename: m[2], lineno: Number(m[3]), colno: Number(m[4]) } : null
  }).filter(Boolean)
}

export function buildEnvelope(parsed, err, { platform = 'javascript', environment, release, tags = {}, extra = {}, user, url } = {}) {
  const error = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err))
  const eventId = hex32()
  const stack = frames(error.stack)
  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform,
    level: 'error',
    environment: environment || 'production',
    release: release || undefined,
    tags,
    extra: { ...extra, stack: error.stack ? String(error.stack).slice(0, 4000) : undefined },
    user: user || undefined,
    request: url ? { url } : undefined,
    exception: { values: [{ type: error.name || 'Error', value: String(error.message || error).slice(0, 1000), stacktrace: stack.length ? { frames: stack } : undefined }] },
  }
  const body = [
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString(), dsn: parsed.dsn }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n')
  return { url: `https://${parsed.host}/api/${parsed.project}/envelope/?sentry_key=${parsed.key}&sentry_version=7`, body, eventId }
}
