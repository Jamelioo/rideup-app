<script setup>
// Uber-style driver card: photo, name and rating on the left; the licence plate big and bold on the right
// so riders can check it before getting in.
defineProps({
  name: { type: String, required: true },
  rating: { type: Number, default: null },
  vehicle: { type: String, default: '' },
  plate: { type: String, default: '' },
  photo: { type: String, default: null },
})

function initials(name) {
  return name.split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2) || 'DR'
}
</script>

<template>
  <div class="flex items-center gap-3.5">
    <div class="w-14 h-14 rounded-full bg-gradient-to-br from-[#2b8659] to-[#191f1c] flex-shrink-0 flex items-center justify-center overflow-hidden">
      <img v-if="photo" :src="photo" :alt="`Photo of ${name}`" class="w-full h-full object-cover" />
      <span v-else class="text-white text-sm font-bold tracking-wide" aria-hidden="true">{{ initials(name) }}</span>
    </div>

    <div class="flex-1 min-w-0">
      <div class="font-bold text-[16px] text-[var(--color-text-primary)] truncate">{{ name }}</div>
      <div class="flex items-center gap-1 mt-0.5 text-[13px]">
        <span class="text-amber-500 font-bold" aria-hidden="true">&#9733;</span>
        <span class="text-[var(--color-text-secondary)] font-medium">{{ rating != null ? Number(rating).toFixed(1) : 'New' }}</span>
        <span class="sr-only">rating</span>
      </div>
    </div>

    <div class="text-right flex-shrink-0 max-w-[48%]">
      <div v-if="plate" class="inline-block px-2.5 py-1 rounded-lg bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[18px] leading-tight font-extrabold tracking-wider text-[var(--color-text-primary)]" :aria-label="`Licence plate ${plate}`">
        {{ plate }}
      </div>
      <div class="text-[13px] text-[var(--color-text-secondary)] font-medium mt-1 truncate">{{ vehicle || 'Vehicle details loading' }}</div>
    </div>
  </div>
</template>
