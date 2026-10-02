<script setup>
import { ref } from 'vue'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'

const props = defineProps({
  ride: { type: Object, default: () => ({}) },
  role: { type: String, default: 'rider' }, // 'rider' | 'driver'
})

const emit = defineEmits(['back', 'close'])

const { user } = useAuth()

const categories = props.role === 'driver'
  ? ['Rider behavior', 'Felt unsafe', 'Damage to vehicle', 'Other']
  : ['Driver behavior', 'Felt unsafe', 'Route concern', 'Vehicle issue', 'Other']
const selectedCategory = ref('')
const description = ref('')
const submitting = ref(false)
const submitted = ref(false)
const error = ref('')

function selectCategory(cat) {
  selectedCategory.value = cat
}

async function handleSubmit() {
  if (!selectedCategory.value) return

  submitting.value = true
  error.value = ''

  try {
    if (supabaseConfigured) {
      const rideId = props.ride?.id && !String(props.ride.id).startsWith('demo') ? props.ride.id : null
      const { error: insertErr } = await supabase.from('safety_reports').insert({
        reporter_id: user.value?.id,
        category: `${props.role === 'driver' ? '[Driver] ' : ''}${selectedCategory.value}`,
        description: description.value.trim().slice(0, 2000),
        ride_id: rideId,
      })
      if (insertErr) throw insertErr
    }
    submitted.value = true
  } catch (err) {
    console.error('Safety report failed:', err?.message)
    error.value = 'Something went wrong. Please try again or call 919.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="px-5 pt-2 pb-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-5">
      <button @click="emit('back')" class="w-8 h-8 flex items-center justify-center rounded-full active:bg-[var(--color-surface-secondary)]" aria-label="Back">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[var(--color-text-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h2 class="text-lg font-bold text-[var(--color-text-primary)]">Report safety issue</h2>
      <button @click="emit('close')" class="w-8 h-8 flex items-center justify-center rounded-full active:bg-[var(--color-surface-secondary)]" aria-label="Close">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Success State -->
    <div v-if="submitted" class="flex flex-col items-center py-8">
      <div class="w-16 h-16 rounded-full bg-[#2b8659]/10 flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 class="text-lg font-bold text-[var(--color-text-primary)] mb-2">Report submitted</h3>
      <p class="text-[13px] text-[var(--color-text-muted)] text-center max-w-[260px]">Thank you for letting us know. Our team reviews every report and will contact you if we need more details. If you are in danger, call 919 now.</p>
      <button
        @click="emit('close')"
        class="mt-6 w-full py-3.5 bg-[#2b8659] text-white font-semibold text-[14px] rounded-xl active:bg-[#236e49] transition-colors"
      >
        Done
      </button>
    </div>

    <!-- Form -->
    <div v-else>
      <!-- Category Chips -->
      <p class="text-[13px] font-medium text-[var(--color-text-muted)] mb-3">What happened?</p>
      <div class="flex flex-wrap gap-2 mb-5">
        <button
          v-for="cat in categories"
          :key="cat"
          @click="selectCategory(cat)"
          :class="[
            'px-4 py-2.5 rounded-full text-[13px] font-medium transition-colors',
            selectedCategory === cat
              ? 'bg-[#2b8659] text-white'
              : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] active:bg-[var(--color-text-primary)]/[0.08]'
          ]"
        >
          {{ cat }}
        </button>
      </div>

      <!-- Description -->
      <p class="text-[13px] font-medium text-[var(--color-text-muted)] mb-2">Tell us more (optional)</p>
      <textarea
        v-model="description"
        placeholder="Describe what happened..."
        rows="3"
        class="w-full px-4 py-3 bg-[var(--color-surface-secondary)] rounded-xl text-[14px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[#2b8659]/30"
      />

      <!-- Error -->
      <p v-if="error" class="text-red-500 text-[13px] mt-2">{{ error }}</p>

      <!-- Submit -->
      <button
        @click="handleSubmit"
        :disabled="!selectedCategory || submitting"
        :class="[
          'w-full mt-5 py-3.5 font-semibold text-[14px] rounded-xl transition-colors',
          selectedCategory && !submitting
            ? 'bg-[#2b8659] text-white active:bg-[#236e49]'
            : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)] cursor-not-allowed'
        ]"
      >
        {{ submitting ? 'Submitting...' : 'Submit report' }}
      </button>
    </div>
  </div>
</template>
