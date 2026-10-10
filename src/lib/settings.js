import { ref } from 'vue'
import { supabase, supabaseConfigured } from './supabase'

// Admin-controlled feature flags (app_settings table). Loaded once and cached.
const settings = ref({ require_pickup_pin: false, require_verified_phone: false, offer_premium: false, offer_xl: false, accept_cash: false })
let loaded = null

export function loadSettings() {
  if (!supabaseConfigured) return Promise.resolve(settings.value)
  if (!loaded) {
    loaded = supabase.from('app_settings').select('key, value').then(({ data }) => {
      for (const row of data || []) settings.value[row.key] = row.value === true
      return settings.value
    }).catch(() => settings.value)
  }
  return loaded
}

export function useSettings() {
  loadSettings()
  return settings
}
