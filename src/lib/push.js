import { supabase, supabaseConfigured } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export const pushSupported = () =>
  Boolean(VAPID_PUBLIC_KEY && supabaseConfigured && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window)

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export async function registerServiceWorker() {
  if (!pushSupported()) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch (err) {
    console.warn('Service worker registration failed:', err.message)
    return null
  }
}

// Asks for permission at a moment that makes sense (after booking / going online), then saves the subscription.
// Safe to call repeatedly; does nothing if push isn't configured or the user said no.
export async function enablePushNotifications() {
  if (!pushSupported() || Notification.permission === 'denied') return false
  try {
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (permission !== 'granted') return false
    const reg = (await navigator.serviceWorker.getRegistration()) || (await registerServiceWorker())
    if (!reg) return false
    const sub = (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }))
    const json = sub.toJSON()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    await supabase.from('push_subscriptions').upsert(
      { user_id: user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
      { onConflict: 'endpoint' }
    )
    return true
  } catch (err) {
    console.warn('Push subscription failed:', err.message)
    return false
  }
}
