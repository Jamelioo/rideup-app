import crypto from 'node:crypto'
import http2 from 'node:http2'

// Push for the App Store / Google Play apps, with no extra dependencies:
//   iPhone  → Apple Push Notification service (token auth with a .p8 key)
//   Android → Firebase Cloud Messaging HTTP v1 (service-account key)
// Env (each platform is optional; without its keys that platform is skipped):
//   APNS_KEY (contents of the .p8 file), APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID (default com.rideupnassau.app),
//   APNS_PRODUCTION=1 for App Store / TestFlight builds (leave unset for Xcode debug builds)
//   FCM_SERVICE_ACCOUNT (the whole service-account JSON from Firebase)

const b64url = (input) => Buffer.from(input).toString('base64url')
const pem = (key) => String(key || '').replace(/\\n/g, '\n')

export const apnsConfigured = () => Boolean(process.env.APNS_KEY && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID)

let fcmAccount = null
export function fcmConfigured() {
  if (fcmAccount) return true
  try {
    const parsed = JSON.parse(process.env.FCM_SERVICE_ACCOUNT || 'null')
    if (parsed?.client_email && parsed?.private_key && parsed?.project_id) fcmAccount = parsed
  } catch { /* not configured */ }
  return Boolean(fcmAccount)
}

// ── APNs ────────────────────────────────────────────────────────────────
let apnsJwt = { token: null, at: 0 }
function apnsToken() {
  // Apple accepts a token for an hour and rejects ones refreshed more than every 20 minutes.
  if (apnsJwt.token && Date.now() - apnsJwt.at < 40 * 60_000) return apnsJwt.token
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: process.env.APNS_KEY_ID }))
  const claims = b64url(JSON.stringify({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) }))
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${claims}`), { key: pem(process.env.APNS_KEY), dsaEncoding: 'ieee-p1363' })
  apnsJwt = { token: `${header}.${claims}.${b64url(sig)}`, at: Date.now() }
  return apnsJwt.token
}

function apnsSend(session, deviceToken, payload) {
  return new Promise((resolve) => {
    const req = session.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${apnsToken()}`,
      'apns-topic': process.env.APNS_BUNDLE_ID || 'com.rideupnassau.app',
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': String(Math.floor(Date.now() / 1000) + 120),
      ...(payload.tag ? { 'apns-collapse-id': String(payload.tag).slice(0, 64) } : {}),
    })
    let status = 0
    let body = ''
    req.setTimeout(8000, () => req.close(http2.constants.NGHTTP2_CANCEL))
    req.on('response', (h) => { status = h[':status'] })
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      let reason = null
      try { reason = body ? JSON.parse(body).reason : null } catch { reason = body.slice(0, 100) }
      resolve({ status, reason })
    })
    req.on('error', (err) => resolve({ status: 0, reason: err.message }))
    req.end(JSON.stringify({
      aps: { alert: { title: payload.title, body: payload.body }, sound: 'default', 'thread-id': payload.tag || 'rideup' },
      url: payload.url || '/',
    }))
  })
}

// ── FCM ─────────────────────────────────────────────────────────────────
let fcmAccess = { token: null, exp: 0 }
async function fcmAccessToken() {
  if (fcmAccess.token && Date.now() < fcmAccess.exp - 60_000) return fcmAccess.token
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({
    iss: fcmAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${claims}`), pem(fcmAccount.private_key))
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${b64url(sig)}` }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`FCM auth failed: ${json.error || res.status}`)
  fcmAccess = { token: json.access_token, exp: Date.now() + json.expires_in * 1000 }
  return fcmAccess.token
}

async function fcmSend(deviceToken, payload) {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${fcmAccount.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await fcmAccessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification: { title: payload.title, body: payload.body },
        data: { url: payload.url || '/' },
        android: {
          priority: 'high',
          ttl: '120s',
          collapse_key: payload.tag || undefined,
          notification: { channel_id: 'trips', tag: payload.tag || undefined, sound: 'default' },
        },
      },
    }),
  })
  if (res.ok) return { status: 200 }
  const json = await res.json().catch(() => ({}))
  const code = json.error?.details?.find((d) => d.errorCode)?.errorCode || json.error?.status
  return { status: res.status, reason: code }
}

// Sends to every token; returns { sent, dead } where dead are tokens the platform says are gone.
export async function sendNativePush(tokens, payload) {
  const out = { sent: 0, dead: [] }
  const ios = tokens.filter((t) => t.platform === 'ios')
  const android = tokens.filter((t) => t.platform === 'android')

  if (ios.length && apnsConfigured()) {
    const host = process.env.APNS_PRODUCTION === '1' ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com'
    const session = http2.connect(host)
    session.on('error', (err) => console.error('APNs connection error:', err.message))
    try {
      for (const t of ios) {
        const r = await apnsSend(session, t.token, payload)
        if (r.status === 200) out.sent++
        else if (r.status === 410 || r.reason === 'BadDeviceToken' || r.reason === 'Unregistered') out.dead.push(t.token)
        else console.error('APNs push failed:', r.status, r.reason)
      }
    } finally {
      session.close()
    }
  }

  if (android.length && fcmConfigured()) {
    for (const t of android) {
      try {
        const r = await fcmSend(t.token, payload)
        if (r.status === 200) out.sent++
        else if (r.status === 404 || r.reason === 'UNREGISTERED') out.dead.push(t.token)
        else console.error('FCM push failed:', r.status, r.reason)
      } catch (err) {
        console.error('FCM push failed:', err.message)
      }
    }
  }
  return out
}
