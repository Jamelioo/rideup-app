import { ref } from 'vue'
import { supabase, supabaseConfigured } from './supabase'
import { useDriver } from './useDriver'

const user = ref(null)
const loading = ref(true)

let initialized = false

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
    // Don't let the previous driver's profile, ride and realtime subscriptions leak into the next session.
    if (event === 'SIGNED_OUT') useDriver().reset()
  })
}

async function signUp(email, password, name) {
  if (!supabaseConfigured) {
    return { error: { message: 'Auth not configured — add Supabase keys to .env' } }
  }
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })
  return { error }
}

async function signIn(email, password) {
  if (!supabaseConfigured) {
    return { error: { message: 'Auth not configured — add Supabase keys to .env' } }
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return { error }
}

async function signOut() {
  if (!supabaseConfigured) return
  await supabase.auth.signOut()
}

export function useAuth() {
  return { user, loading, init, signUp, signIn, signOut }
}
