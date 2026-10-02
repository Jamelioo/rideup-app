import { supabase } from './supabase'

// The documents a driver uploads for review. Files live in the private "documents" bucket at
// driver-documents/<auth user id>/<key>; only the driver and admins can read them.
export const DRIVER_DOCS = [
  { key: 'drivers_license', label: 'Driver’s licence', description: 'Government-issued photo ID' },
  { key: 'vehicle_registration', label: 'Vehicle registration', description: 'Current registration document' },
  { key: 'insurance', label: 'Insurance certificate', description: 'Valid auto insurance for this vehicle' },
  { key: 'vehicle_photo', label: 'Vehicle photo', description: 'Clear photo of the outside of your vehicle' },
]

export const docFolder = (authUserId) => `driver-documents/${authUserId}`
export const docPath = (authUserId, key) => `${docFolder(authUserId)}/${key}`

// { [key]: { name, path, uploadedAt } } using the newest file per document
// (older uploads were saved with a file extension, newer ones without).
export async function listDriverDocs(authUserId) {
  const { data, error } = await supabase.storage.from('documents').list(docFolder(authUserId), { limit: 100 })
  if (error) throw error
  const latest = {}
  for (const f of data || []) {
    if (!f.name || f.name.startsWith('.')) continue
    const key = f.name.replace(/\.[^.]+$/, '')
    const uploadedAt = new Date(f.updated_at || f.created_at || 0).getTime()
    if (!latest[key] || uploadedAt > latest[key].uploadedAt) {
      latest[key] = { name: f.name, path: `${docFolder(authUserId)}/${f.name}`, uploadedAt }
    }
  }
  return latest
}

// 'expired' | 'soon' (within 30 days) | 'ok' | null when no date is recorded.
export function expiryState(dateString, now = new Date()) {
  if (!dateString) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const date = new Date(`${dateString}T00:00:00`)
  const days = Math.round((date - today) / 86_400_000)
  if (days < 0) return 'expired'
  if (days <= 30) return 'soon'
  return 'ok'
}
