import { createClient } from '@supabase/supabase-js'

// Get these from Supabase Dashboard → Project Settings → API
// https://supabase.com/dashboard
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fallback to harmless placeholders so the app can still render and
// show a clear on-screen warning instead of crashing on load when
// .env hasn't been set up yet.
const hasRealConfig = Boolean(supabaseUrl && supabaseAnonKey)

export const supabaseConfigured = hasRealConfig

if (!hasRealConfig) {
  console.warn(
    'Supabase env vars missing. Copy .env.example to .env and fill in your project URL + anon key.'
  )
}

export const supabase = createClient(
  hasRealConfig ? supabaseUrl : 'https://placeholder.supabase.co',
  hasRealConfig ? supabaseAnonKey : 'placeholder-anon-key'
)
