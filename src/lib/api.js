import { supabase } from './supabase'

// POST JSON to our /api routes with the signed-in user's access token.
// The server verifies the token; it never trusts user ids sent in the body.
// Aborts after `timeoutMs` so a stalled request surfaces as an error instead of a frozen screen.
export async function apiPost(path, body = {}, { timeoutMs = 25000 } = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = { 'Content-Type': 'application/json' }
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(path, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal })
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('The request timed out. Check your connection and try again.')
    throw err
  } finally {
    clearTimeout(timer)
  }
}
