import webpush from 'web-push'
import { admin } from './_auth.js'
import { sendNativePush, apnsConfigured, fcmConfigured } from './_nativePush.js'

const enabled = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && admin)
if (enabled) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support@rideupnassau.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
}

// Sends a push notification to every device a user has registered: browsers / Home Screen apps (web push)
// and the App Store / Google Play apps (APNs / FCM). Best-effort: never throws, and removes devices the
// platform reports as gone.
export async function pushToUser(userId, { title, body, url = '/', tag }) {
  if (!admin || !userId) return 0
  let sent = 0
  if (enabled) {
    const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId)
    for (const s of subs || []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title, body, url, tag }),
          { TTL: 120 }
        )
        sent++
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('id', s.id)
        } else {
          console.error('Push failed:', err.statusCode || err.message)
        }
      }
    }
  }
  if (apnsConfigured() || fcmConfigured()) {
    try {
      const { data: tokens } = await admin.from('native_push_tokens').select('platform, token').eq('user_id', userId)
      if (tokens?.length) {
        const out = await sendNativePush(tokens, { title, body, url, tag })
        sent += out.sent
        if (out.dead.length) await admin.from('native_push_tokens').delete().in('token', out.dead)
      }
    } catch (err) {
      console.error('Native push failed:', err.message)
    }
  }
  return sent
}

// Which of these users have at least one device we can currently push to (web push or the store apps).
// Used to keep drivers online while RideUp is in the background: a driver we can alert is still reachable.
export async function usersWithPush(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  const reachable = new Set()
  if (!admin || ids.length === 0) return reachable
  const lookups = []
  if (enabled) lookups.push(admin.from('push_subscriptions').select('user_id').in('user_id', ids))
  if (apnsConfigured() || fcmConfigured()) lookups.push(admin.from('native_push_tokens').select('user_id').in('user_id', ids))
  for (const { data } of await Promise.all(lookups)) for (const r of data || []) reachable.add(r.user_id)
  return reachable
}

// Looks up the auth user ids behind a ride so events can be pushed to the right people.
export async function rideParticipants(rideId) {
  const { data } = await admin
    .from('rides')
    .select('id, rider_id, driver_id, riders:rider_id(auth_user_id, email), drivers:driver_id(auth_user_id, name)')
    .eq('id', rideId)
    .maybeSingle()
  return {
    riderUserId: data?.riders?.auth_user_id || null,
    riderEmail: data?.riders?.email || null,
    driverUserId: data?.drivers?.auth_user_id || null,
    driverName: data?.drivers?.name ? data.drivers.name.trim().split(/\s+/)[0] : null, // first name only, like Uber
  }
}
