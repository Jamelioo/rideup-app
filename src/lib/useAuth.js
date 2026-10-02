import { ref, computed } from 'vue'
import { supabase, supabaseConfigured } from './supabase'
import { useDriver } from './useDriver'
import { removePushSubscription } from './push'

const user = ref(null)
const loading = ref(true)
// Set when someone opens a "reset your password" email link. App.vue then sends them to /reset-password,
// even if Supabase dropped them on the home page because /reset-password isn't in the redirect allow-list.
const passwordRecovery = ref(false)
// Guests book with an anonymous Supabase session. They have no email or password to log back in with.
const isGuest = computed(() => !!user.value?.is_anonymous)
// No email + password to log back in with: guests, and guests who only verified a phone number.
const needsLogin = computed(() => !!user.value && (user.value.is_anonymous || !user.value.email))
// Where an emailed link should land someone, whatever page Supabase actually sent them to:
// a guest who confirmed their email still needs a password, and a driver who confirmed their
// email still needs their saved application submitted. App.vue follows this.
const pendingRoute = ref('')

export const MIN_PASSWORD = 8

let initialized = false

const NOT_CONFIGURED = { message: 'Auth not configured — add Supabase keys to .env' }

export function authRedirectUrl(path) {
  return `${window.location.origin}${path}`
}

function init() {
  if (initialized) return
  initialized = true

  if (!supabaseConfigured) {
    loading.value = false
    return
  }

  supabase.auth.getSession().then(({ data: { session } }) => {
    user.value = session?.user ?? null
    loading.value = false
  })

  supabase.auth.onAuthStateChange((event, session) => {
    user.value = session?.user ?? null
    if (event === 'PASSWORD_RECOVERY') {
      passwordRecovery.value = true
      pendingRoute.value = '/reset-password'
    } else if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user && !session.user.is_anonymous && !passwordRecovery.value) {
      const meta = session.user.user_metadata || {}
      if (meta.needs_password) pendingRoute.value = '/set-password'
      else if (meta.driver_application) pendingRoute.value = '/driver/apply'
    }
    // Don't let the previous driver's profile, ride and realtime subscriptions leak into the next session.
    if (event === 'SIGNED_OUT') {
      useDriver().reset()
      passwordRecovery.value = false
    }
  })
}

// Returns { error } or { session, needsConfirmation }. With "Confirm email" on, there is no session
// until the person taps the link we email them; it brings them back to `redirectPath`.
async function signUp(email, password, name, { redirectPath = '/book', data = {} } = {}) {
  if (!supabaseConfigured) return { error: NOT_CONFIGURED }
  const { data: result, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, ...data }, emailRedirectTo: authRedirectUrl(redirectPath) },
  })
  if (error) return { error }
  // With confirmations on, Supabase answers a sign-up for an existing email with a user that has no identities.
  if (result.user && Array.isArray(result.user.identities) && result.user.identities.length === 0) {
    return { error: { code: 'user_already_exists', message: 'An account with this email already exists. Log in instead.' } }
  }
  return { error: null, session: result.session, needsConfirmation: !result.session }
}

async function resendConfirmation(email, redirectPath = '/book') {
  if (!supabaseConfigured) return { error: NOT_CONFIGURED }
  const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: authRedirectUrl(redirectPath) } })
  return { error }
}

async function sendPasswordReset(email) {
  if (!supabaseConfigured) return { error: NOT_CONFIGURED }
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl('/reset-password') })
  return { error }
}

async function signIn(email, password) {
  if (!supabaseConfigured) return { error: NOT_CONFIGURED }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return { error }
}

async function signOut() {
  if (!supabaseConfigured) return
  await removePushSubscription() // this device stops getting the previous person's trip alerts
  await supabase.auth.signOut()
}

function clearPasswordRecovery() {
  passwordRecovery.value = false
}

function clearPendingRoute() {
  pendingRoute.value = ''
}

// Supabase's error text is written for developers; riders get plain language.
export function friendlyAuthError(error) {
  if (!error) return ''
  const code = error.code || ''
  const msg = error.message || ''
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'That email and password don’t match. Try again or reset your password.'
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) return 'Please confirm your email first. Tap the link we sent you.'
  if (code === 'user_already_exists' || code === 'email_exists' || /already (been )?registered|already exists/i.test(msg)) return 'An account with this email already exists. Log in instead.'
  if (code === 'weak_password' || /password should be/i.test(msg)) return 'Please choose a stronger password: at least 8 characters, mixing letters and numbers.'
  if (code === 'same_password') return 'Your new password must be different from your old one.'
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || /rate limit|security purposes/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.'
  if (code === 'validation_failed' && /email/i.test(msg)) return 'Please enter a valid email address.'
  if (/failed to fetch|network/i.test(msg)) return 'Can’t reach RideUp. Check your connection and try again.'
  return msg || 'Something went wrong. Please try again.'
}

export function useAuth() {
  return {
    user, loading, isGuest, needsLogin, passwordRecovery, pendingRoute,
    init, signUp, signIn, signOut, resendConfirmation, sendPasswordReset, clearPasswordRecovery, clearPendingRoute,
  }
}
