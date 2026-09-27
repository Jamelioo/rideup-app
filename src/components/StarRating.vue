<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Number, default: 0 },
  size: { type: String, default: 'md', validator: (v) => ['sm', 'md', 'lg'].includes(v) },
  readonly: { type: Boolean, default: false },
  count: { type: Number, default: 5 },
})

const emit = defineEmits(['update:modelValue'])

const sizeClasses = computed(() => ({
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
}[props.size]))

const gapClass = computed(() => ({
  sm: 'gap-1',
  md: 'gap-2',
  lg: 'gap-3',
}[props.size]))

const stars = computed(() => {
  const result = []
  for (let i = 1; i <= props.count; i++) {
    const diff = props.modelValue - i + 1
    if (diff >= 1) {
      result.push('full')
    } else if (diff >= 0.25 && props.readonly) {
      result.push('half')
    } else {
      result.push('empty')
    }
  }
  return result
})

function selectStar(index) {
  if (props.readonly) return
  emit('update:modelValue', index)
}
</script>

<template>
  <div :class="['flex items-center', gapClass]" role="group" aria-label="Star rating">
    <button
      v-for="(state, i) in stars"
      :key="i"
      type="button"
      :disabled="readonly"
      :aria-label="`${i + 1} star${i === 0 ? '' : 's'}`"
      :class="[
        'relative flex-shrink-0 transition-transform duration-150 ease-out',
        !readonly && 'cursor-pointer active:scale-125 hover:scale-110',
        readonly && 'cursor-default',
      ]"
      @click="selectStar(i + 1)"
    >
      <!-- Empty star -->
      <svg
        v-if="state === 'empty'"
        :class="sizeClasses"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill="rgba(25,31,28,0.12)"
          stroke="rgba(25,31,28,0.08)"
          stroke-width="0.5"
        />
      </svg>

      <!-- Full star -->
      <svg
        v-else-if="state === 'full'"
        :class="sizeClasses"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill="#2b8659"
        />
      </svg>

      <!-- Half star -->
      <svg
        v-else
        :class="sizeClasses"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <clipPath :id="'half-clip-' + i">
            <rect x="0" y="0" width="12" height="24" />
          </clipPath>
        </defs>
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill="rgba(25,31,28,0.12)"
          stroke="rgba(25,31,28,0.08)"
          stroke-width="0.5"
        />
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill="#2b8659"
          :clip-path="'url(#half-clip-' + i + ')'"
        />
      </svg>
    </button>
  </div>
</template>
