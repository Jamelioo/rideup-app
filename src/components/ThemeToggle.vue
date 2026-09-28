<script setup>
import { useDarkMode } from '../lib/useDarkMode'

const { mode, setMode } = useDarkMode()

const options = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'System', icon: 'monitor' },
]
</script>

<template>
  <div class="flex bg-[var(--color-surface-secondary)] rounded-xl p-1 gap-1">
    <button
      v-for="opt in options"
      :key="opt.value"
      @click="setMode(opt.value)"
      :class="[
        'flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-[13px] font-medium transition-all',
        mode === opt.value
          ? 'bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] shadow-sm'
          : 'text-[var(--color-text-muted)]'
      ]"
    >
      <!-- Sun -->
      <svg v-if="opt.icon === 'sun'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
      <!-- Moon -->
      <svg v-if="opt.icon === 'moon'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      </svg>
      <!-- Monitor -->
      <svg v-if="opt.icon === 'monitor'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
      {{ opt.label }}
    </button>
  </div>
</template>
