<script setup>
import { ref } from 'vue'

const props = defineProps({
  onApply: { type: Function, required: true },
})

const code = ref('')
const applying = ref(false)
const feedback = ref({ type: '', message: '' })

async function handleApply() {
  const trimmed = code.value.trim().toUpperCase()
  if (!trimmed) return

  applying.value = true
  feedback.value = { type: '', message: '' }

  try {
    const result = await props.onApply(trimmed)
    if (result.success) {
      feedback.value = { type: 'success', message: result.message || 'Promo code applied' }
      code.value = ''
    } else {
      feedback.value = { type: 'error', message: result.message || 'Invalid promo code' }
    }
  } catch {
    feedback.value = { type: 'error', message: 'Something went wrong. Try again.' }
  } finally {
    applying.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex gap-2">
      <input
        v-model="code"
        type="text"
        placeholder="Enter promo code"
        class="flex-1 px-4 py-3 border border-[var(--color-border)] rounded-xl text-[15px] font-[var(--font-sans)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[#2b8659] focus:ring-1 focus:ring-[#2b8659] transition-colors uppercase tracking-wider"
        :disabled="applying"
        @keyup.enter="handleApply"
      />
      <button
        @click="handleApply"
        :disabled="applying || !code.trim()"
        class="px-6 py-3 bg-[#2b8659] text-white font-bold text-[14px] rounded-xl disabled:opacity-40 active:scale-[0.97] transition-all"
      >
        <span v-if="applying" class="flex items-center gap-2">
          <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4 31.4" stroke-linecap="round" />
          </svg>
        </span>
        <span v-else>Apply</span>
      </button>
    </div>

    <Transition name="fade">
      <div v-if="feedback.message" class="mt-3">
        <p
          :class="[
            'text-[13px] font-medium px-3 py-2 rounded-lg',
            feedback.type === 'success' ? 'bg-[var(--color-surface-secondary)] text-[var(--color-brand)]' : 'bg-red-50 text-red-600',
          ]"
        >
          {{ feedback.message }}
        </p>
      </div>
    </Transition>
  </div>
</template>
