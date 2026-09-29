<script setup>
// Light mint ambient backdrop — soft glows, no longer the dark harbor theme.
defineProps({ showRoute: { type: Boolean, default: false } })
</script>

<template>
  <div class="absolute inset-0 overflow-hidden pointer-events-none">
    <div class="absolute inset-0"
         style="background: radial-gradient(ellipse 110% 55% at 15% 0%, rgba(88,204,2,0.10), transparent 55%), radial-gradient(ellipse 90% 45% at 90% 100%, rgba(88,204,2,0.08), transparent 60%), linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-secondary) 100%);">
    </div>
    <svg v-if="showRoute" class="absolute inset-0 w-full h-full opacity-60" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
      <path d="M 60 180 C 140 220 180 260 220 340 S 320 480 300 600"
            stroke="#2b8659" stroke-width="2.5" stroke-dasharray="4 8" fill="none" opacity="0.5" />
      <circle cx="60" cy="180" r="5" fill="#2b8659" />
      <circle cx="60" cy="180" r="12" fill="none" stroke="#2b8659" stroke-width="1" opacity="0.3" />
      <circle cx="300" cy="600" r="5" fill="currentColor" opacity="0.6" />
      <circle cx="300" cy="600" r="12" fill="none" stroke="currentColor" stroke-width="1" opacity="0.15" />
    </svg>
  </div>
</template>
