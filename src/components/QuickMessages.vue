<script setup>
const props = defineProps({
  messages: {
    type: Array,
    default: () => ["I'm here", 'On my way', 'Running late', "Can't find you", 'Please wait'],
  },
})

const emit = defineEmits(['send'])
</script>

<template>
  <div class="flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-hide">
    <button
      v-for="msg in messages"
      :key="msg"
      @click="emit('send', msg)"
      class="flex-shrink-0 px-3.5 py-1.5 rounded-full bg-[#2b8659]/10 text-[#236e49] text-[12px] font-semibold whitespace-nowrap active:bg-[#2b8659]/20 transition-colors"
    >
      {{ msg }}
    </button>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
