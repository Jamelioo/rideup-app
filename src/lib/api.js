import { supabase } from './supabase'

// POST JSON to our /api routes with the signed-in user's access token.
// The server verifies the token; it never trusts user ids sent in the body.
export async function apiPost(path, body = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = { 'Content-Type': 'application/json' }
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
  return fetch(path, { method: 'POST', headers, body: JSON.stringify(body) })
}
