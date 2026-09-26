import { ref } from 'vue'
import { supabase, supabaseConfigured } from './supabase'

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

  supabase.auth.onAuthStateChange((_event, session) => {
    user.value = session?.user ?? null
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
