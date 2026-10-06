// v-modal="close": accessible behaviour for a sheet or dialog panel that is rendered only while open (v-if).
// While it is mounted: Escape calls close, focus moves into the panel and Tab stays inside it, and the panel is
// announced as a modal dialog. When it unmounts, focus goes back to whatever opened it.
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'
const stack = []

function visibleFocusables(el) {
  return [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement)
}

function onKeydown(event) {
  const top = stack[stack.length - 1]
  if (!top) return
  if (event.key === 'Escape') {
    if (typeof top.close === 'function') { event.stopPropagation(); top.close() }
    return
  }
  if (event.key !== 'Tab') return
  const items = visibleFocusables(top.el)
  if (!items.length) { event.preventDefault(); top.el.focus(); return }
  const first = items[0]
  const last = items[items.length - 1]
  if (event.shiftKey && (document.activeElement === first || !top.el.contains(document.activeElement))) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && (document.activeElement === last || !top.el.contains(document.activeElement))) { event.preventDefault(); first.focus() }
}

export default {
  mounted(el, binding) {
    if (!el.hasAttribute('role')) el.setAttribute('role', 'dialog')
    el.setAttribute('aria-modal', 'true')
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
    const entry = { el, close: binding.value, returnTo: document.activeElement }
    stack.push(entry)
    if (stack.length === 1) document.addEventListener('keydown', onKeydown, true)
    // Wait for enter transitions and child components (e.g. Stripe's card field) before moving focus.
    requestAnimationFrame(() => {
      if (!el.isConnected || el.contains(document.activeElement)) return
      const target = el.querySelector('[autofocus]') || el
      target.focus({ preventScroll: true })
    })
  },
  updated(el, binding) {
    const entry = stack.find((s) => s.el === el)
    if (entry) entry.close = binding.value
  },
  unmounted(el) {
    const i = stack.findIndex((s) => s.el === el)
    if (i === -1) return
    const [entry] = stack.splice(i, 1)
    if (!stack.length) document.removeEventListener('keydown', onKeydown, true)
    if (entry.returnTo && entry.returnTo.isConnected && typeof entry.returnTo.focus === 'function') entry.returnTo.focus({ preventScroll: true })
  },
}
