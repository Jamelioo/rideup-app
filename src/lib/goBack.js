// Back buttons: return to the previous page in the app, or, when this page was opened directly (from Google, an ad,
// an email or a shared link), to a page on the site instead of leaving it. Vue Router records the previous route in
// history.state.back.
export function goBack(router, fallback = '/') {
  if (typeof window !== 'undefined' && window.history.state?.back) router.back()
  else router.push(fallback)
}
