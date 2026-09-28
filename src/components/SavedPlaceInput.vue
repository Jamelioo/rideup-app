<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  place: { type: Object, default: null },
  presetLabel: { type: String, default: '' },
})

const emit = defineEmits(['close', 'save', 'delete'])

const label = ref('')
const address = ref('')

watch(() => props.visible, (val) => {
  if (val) {
    if (props.place) {
      label.value = props.place.label || ''
      address.value = props.place.address || ''
    } else {
      label.value = props.presetLabel || ''
      address.value = ''
    }
  }
})

const isPreset = ['Home', 'Work'].includes(props.presetLabel) || (props.place && ['Home', 'Work'].includes(props.place.label))

function handleSave() {
  if (!address.value.trim()) return
  const finalLabel = label.value.trim() || 'Saved Place'
  emit('save', {
    label: finalLabel,
    address: address.value.trim(),
    lat: null,
    lng: null,
  })
}

function handleDelete() {
  emit('delete')
}
</script>

<template>
  <Transition name="sheet">
    <div v-if="visible" class="fixed inset-0 z-50 flex items-end justify-center bg-black/40" @click.self="emit('close')">
      <div class="w-full max-w-md bg-white rounded-t-3xl px-6 pt-6 pb-10 shadow-xl">
        <!-- Handle -->
        <div class="flex justify-center mb-5">
          <div class="w-10 h-1 bg-[#191f1c]/10 rounded-full"></div>
        </div>

        <h3 class="text-lg font-bold text-[#191f1c] mb-5">
          {{ place ? 'Edit place' : 'Add a place' }}
        </h3>

        <!-- Label input -->
        <div class="mb-4" v-if="!presetLabel && !(place && ['Home', 'Work'].includes(place.label))">
          <label class="block text-xs text-[#191f1c]/40 mb-1">Label</label>
          <input
            v-model="label"
            type="text"
            placeholder="e.g. Gym, Airport"
            class="w-full bg-transparent text-base text-[#191f1c] pb-2 border-b border-[#191f1c]/10 outline-none focus:border-[#2b8659] transition-colors"
          />
        </div>

        <!-- Preset label display -->
        <div v-else class="mb-4">
          <label class="block text-xs text-[#191f1c]/40 mb-1">Label</label>
          <p class="text-base text-[#191f1c] pb-2 border-b border-[#191f1c]/10">
            {{ presetLabel || place?.label }}
          </p>
        </div>

        <!-- Address input -->
        <div class="mb-6">
          <label class="block text-xs text-[#191f1c]/40 mb-1">Address</label>
          <input
            v-model="address"
            type="text"
            placeholder="Enter address"
            class="w-full bg-transparent text-base text-[#191f1c] pb-2 border-b border-[#191f1c]/10 outline-none focus:border-[#2b8659] transition-colors"
          />
        </div>

        <!-- Save button -->
        <button
          @click="handleSave"
          :disabled="!address.trim()"
          class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-xl text-[14px] text-center disabled:opacity-40 transition-opacity"
        >
          Save
        </button>

        <!-- Delete button (only when editing) -->
        <button
          v-if="place"
          @click="handleDelete"
          class="w-full py-3 text-red-500 text-[14px] font-medium mt-3"
        >
          Remove this place
        </button>

        <!-- Cancel -->
        <button @click="emit('close')" class="w-full py-3 text-[14px] text-[#191f1c]/50 font-medium">
          Cancel
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.sheet-enter-active,
.sheet-leave-active {
  transition: all 0.3s ease;
}
.sheet-enter-active > div:last-child,
.sheet-leave-active > div:last-child {
  transition: transform 0.3s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from > div:last-child,
.sheet-leave-to > div:last-child {
  transform: translateY(100%);
}
</style>
