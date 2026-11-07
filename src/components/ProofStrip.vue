<script setup>
import { computed } from 'vue'
import { useProof, proofLines, driverProofLines } from '../lib/proof'

// Real proof (completed trips, riders' ratings, ride requests), shown only once there's enough of it
// (src/lib/proofRules.js). audience="driver" shows demand instead of ratings.
const props = defineProps({
  onDark: { type: Boolean, default: false },
  audience: { type: String, default: 'rider' },
})
const stats = useProof()
const lines = computed(() => (props.audience === 'driver' ? driverProofLines(stats.value) : proofLines(stats.value)))
</script>

<template>
  <ul v-if="lines.length" class="flex flex-wrap gap-x-5 gap-y-1.5 text-[14px] font-semibold" :class="onDark ? 'text-white/90' : 'text-[var(--color-text-primary)]'">
    <li v-for="line in lines" :key="line.kind" class="flex items-center gap-1.5">
      <svg v-if="line.kind === 'rating'" class="w-4 h-4 text-[#e8a400]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L12 17.3 5.8 21l1.6-7.1L2 9.2l7.1-.6z"/></svg>
      <svg v-else class="w-4 h-4" :class="onDark ? 'text-[#4cc48a]' : 'text-[var(--color-brand)]'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
      {{ line.text }}
    </li>
  </ul>
</template>
