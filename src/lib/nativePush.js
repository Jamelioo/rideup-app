import { supabase } from './supabase'

// Push for the App Store / Google Play apps (Capacitor). The plugin is only loaded inside the native app,
// so the website never downloads it.
const TOKEN_KEY = 'rideup_native_push_token'

export const isNativeApp = () => typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true
const platform = () => window.Capacitor?.getPlatform?.() // 'ios' | 'android'

let pluginPromise = null
const plugin = () => (pluginPromise ||= import('@capacitor/push-notifications').then((m) => m.PushNotifications))

const savedToken = () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }
const saveToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ } }

let listening = false
let registrationWaiters = []

// Call once at start-up: handles new tokens and opens the right screen when a notification is tapped.
export async function initNativePush(router) {
  if (!isNativeApp() || listening) return
  listening = true
  const Push = await plugin()
  if (platform() === 'android') {
    await Push.createChannel({ id: 'trips', name: 'Trip alerts', description: 'Driver arrived, trip requests and receipts', importance: 5, sound: 'default', vibration: true }).catch(() => {})
  }
  await Push.addListener('registration', async ({ value }) => {
    const { error } = await supabase.rpc('register_native_push', { p_platform: platform(), p_token: value })
    if (!error) saveToken(value)
    registrationWaiters.splice(0).forEach((done) => done(!error))
  })
  await Push.addListener('registrationError', (err) => {
    console.warn('Native push registration failed:', err?.error)
    registrationWaiters.splice(0).forEach((done) => done(false))
  })
  await Push.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const url = notification?.data?.url
    if (typeof url === 'string' && url.startsWith('/')) router.push(url)
  })
  await refreshNativePush()
}

// Already allowed on an earlier visit: re-send the token for whoever is signed in now (tokens can also
// change after an app update or a phone restore).
export async function refreshNativePush() {
  if (!isNativeApp() || !listening) return
  const Push = await plugin()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  const { receive } = await Push.checkPermissions()
  if (receive === 'granted') await Push.register()
}

export async function enableNativePush() {
  if (!isNativeApp()) return false
  const Push = await plugin()
  let { receive } = await Push.checkPermissions()
  if (receive === 'prompt' || receive === 'prompt-with-rationale') receive = (await Push.requestPermissions()).receive
  if (receive !== 'granted') return false
  const registered = new Promise((resolve) => {
    registrationWaiters.push(resolve)
    setTimeout(() => resolve(Boolean(savedToken())), 10000)
  })
  await Push.register()
  return registered
}

export async function disableNativePush() {
  const token = savedToken()
  if (!isNativeApp() || !token) return
  try { await supabase.rpc('unregister_native_push', { p_token: token }) } catch { /* best effort */ }
  saveToken(null)
}

export async function nativePushStatus() {
  const Push = await plugin()
  const { receive } = await Push.checkPermissions()
  if (receive === 'denied') return 'blocked'
  return receive === 'granted' && savedToken() ? 'on' : 'off'
}
