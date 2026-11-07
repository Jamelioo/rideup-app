<script setup>
import { computed } from 'vue'
import { useProof, quotesToShow } from '../lib/proof'

// What riders said after a 5-star trip, with their permission and an admin's approval (migration 022).
// Hidden until there's at least one; never sample quotes.
defineProps({ title: { type: String, default: 'What riders say' } })
const stats = useProof()
const quotes = computed(() => quotesToShow(stats.value))
</script>

<template>
  <section v-if="quotes.length" aria-labelledby="rider-quotes-title">
    <h2 id="rider-quotes-title" class="text-[24px] sm:text-[28px] font-bold leading-[1.14] tracking-tight mb-5">{{ title }}</h2>
    <ul class="grid gap-3 md:grid-cols-3">
      <li v-for="(q, i) in quotes" :key="i" class="rounded-2xl bg-[var(--color-surface-secondary)] p-5 flex flex-col">
        <div class="flex gap-0.5 text-[#e8a400] mb-2" aria-label="5 out of 5 stars" role="img">
          <svg v-for="s in 5" :key="s" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L12 17.3 5.8 21l1.6-7.1L2 9.2l7.1-.6z"/></svg>
        </div>
        <blockquote class="text-[16px] leading-[1.5] text-[var(--color-text-primary)] flex-1">“{{ q.quote }}”</blockquote>
        <p class="mt-3 text-[14px] font-semibold text-[var(--color-text-secondary)]">{{ q.name }}, RideUp rider</p>
      </li>
    </ul>
  </section>
</template>
