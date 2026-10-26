<script setup>
import { formatFare } from '../lib/pricing'

// Shown above the request button: every trip is paid in cash to the driver at drop-off (like a cash trip on Uber).
defineProps({ chargeCents: { type: Number, default: null } }) // what the rider pays, after promos and credit
</script>

<template>
  <p class="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)] mb-2.5 px-1">
    <svg class="w-4 h-4 text-[var(--color-brand)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>
    <span class="flex-1 min-w-0"><span class="font-semibold text-[var(--color-text-primary)]">Cash</span> · pay {{ chargeCents ? formatFare(chargeCents) : 'the fare' }} to your driver at drop-off</span>
  </p>
</template>
