<script setup>
defineProps({
  name: { type: String, required: true },
  rating: { type: Number, default: 4.9 },
  vehicle: { type: String, default: 'White Toyota Camry' },
  plate: { type: String, default: 'AB-1234' },
  photo: { type: String, default: null },
})

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
</script>

<template>
  <div class="flex items-center gap-3.5">
    <!-- Driver photo / initials -->
    <div class="w-12 h-12 rounded-full bg-gradient-to-br from-[#2b8659] to-[#191f1c] flex-shrink-0 flex items-center justify-center overflow-hidden">
      <img v-if="photo" :src="photo" :alt="name" class="w-full h-full object-cover" />
      <span v-else class="text-white text-sm font-bold tracking-wide">{{ initials(name) }}</span>
    </div>

    <!-- Name + rating -->
    <div class="flex-1 min-w-0">
      <div class="font-bold text-[15px] text-[var(--color-text-primary)] truncate">{{ name }}</div>
      <div class="flex items-center gap-1 mt-0.5">
        <span class="text-amber-500 text-[13px] font-bold">&#9733;</span>
        <span class="text-[13px] text-[#191f1c]/70 font-medium">{{ rating.toFixed(1) }}</span>
      </div>
    </div>

    <!-- Vehicle info -->
    <div class="text-right flex-shrink-0">
      <div class="text-[13px] text-[#191f1c]/70 font-medium">{{ vehicle }}</div>
      <div class="text-[12px] text-[#191f1c]/45 font-mono mt-0.5">{{ plate }}</div>
    </div>
  </div>
</template>
