import webpush from 'web-push'
import { admin } from './_auth.js'

const enabled = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && admin)
if (enabled) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support@rideupnassau.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
}

// Sends a push notification to every device a user has registered. Best-effort: never throws,
// and removes subscriptions the browser reports as gone.
export async function pushToUser(userId, { title, body, url = '/', tag }) {
  if (!enabled || !userId) return 0
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId)
  let sent = 0
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
  return sent
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
