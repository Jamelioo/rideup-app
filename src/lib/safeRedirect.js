// After logging in we only follow in-app paths like "/book". Anything that could leave the site
// ("//evil.example", "https://…", "/\evil.example") falls back to the booking screen.
export function safeRedirect(value, fallback = '/book') {
  if (typeof value !== 'string' || value.length > 512) return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  if (/[\u0000-\u001f]/.test(value)) return fallback
  return value
}
