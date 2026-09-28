import { ref, watchEffect } from 'vue'

const mode = ref(localStorage.getItem('theme') || 'system') // 'light' | 'dark' | 'system'

function applyTheme() {
  const isDark =
    mode.value === 'dark' ||
    (mode.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  document.documentElement.classList.toggle('dark', isDark)
}

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)
  applyTheme()
}

export function useDarkMode() {
  watchEffect(applyTheme)

  function setMode(newMode) {
    mode.value = newMode
    localStorage.setItem('theme', newMode)
    applyTheme()
  }

  return { mode, setMode }
}
