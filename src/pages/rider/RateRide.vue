<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StarRating from '../../components/StarRating.vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'

const route = useRoute()
const router = useRouter()
const rideId = computed(() => route.params.rideId)

const rating = ref(0)
const feedback = ref('')
const submitting = ref(false)
const submitted = ref(false)

const compliments = [
  'Great conversation',
  'Clean car',
  'Smooth driving',
  'Good music',
  'Safe driving',
  'Friendly',
]
const selectedCompliments = ref([])

function toggleCompliment(c) {
  const idx = selectedCompliments.value.indexOf(c)
  if (idx >= 0) {
    selectedCompliments.value.splice(idx, 1)
  } else {
    selectedCompliments.value.push(c)
  }
}

async function submitRating() {
  if (rating.value === 0 || submitting.value) return
  submitting.value = true

  try {
    if (supabaseConfigured) {
      await supabase
        .from('rides')
        .update({
          rider_rating: rating.value,
          rider_feedback: feedback.value || null,
          rider_compliments: selectedCompliments.value.length ? selectedCompliments.value : null,
        })
        .eq('id', rideId.value)
    }
  } catch (err) {
    console.warn('Could not save rating:', err.message)
  }

  submitted.value = true
  setTimeout(() => {
    router.push('/book')
  }, 1800)
}

function skip() {
  router.push('/book')
}
</script>

<template>
  <div class="min-h-dvh bg-[var(--color-surface)] font-[var(--font-sans)] text-[var(--color-text-primary)] flex flex-col">
    <!-- Success state -->
    <Transition name="fade">
      <div v-if="submitted" class="flex-1 flex flex-col items-center justify-center px-6">
        <div class="w-16 h-16 rounded-full bg-[#2b8659] flex items-center justify-center mb-5">
          <svg class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-xl font-bold mb-1">Thanks for your feedback</h2>
        <p class="text-[var(--color-text-muted)] text-sm">Your rating helps improve the experience.</p>
      </div>
    </Transition>

    <!-- Rating form -->
    <div v-if="!submitted" class="flex-1 flex flex-col max-w-lg mx-auto w-full">
      <!-- Top bar -->
      <div class="flex items-center px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4">
        <button @click="skip" class="w-10 h-10 flex items-center justify-center" aria-label="Skip">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Driver avatar -->
      <div class="flex flex-col items-center mt-6 mb-6 px-6">
        <div class="w-20 h-20 rounded-full bg-[var(--color-surface-secondary)] flex items-center justify-center mb-5">
          <svg class="w-10 h-10 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>

        <h1 class="text-xl font-bold mb-1 text-center">How was your ride?</h1>
        <p class="text-[var(--color-text-muted)] text-sm text-center">Your feedback helps drivers improve</p>
      </div>

      <!-- Stars -->
      <div class="flex justify-center mb-8">
        <StarRating v-model="rating" size="lg" />
      </div>

      <!-- Compliment chips -->
      <Transition name="fade">
        <div v-if="rating > 0" class="px-6 mb-6">
          <div class="flex flex-wrap gap-2 justify-center">
            <button
              v-for="c in compliments"
              :key="c"
              @click="toggleCompliment(c)"
              :class="[
                'px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-150',
                selectedCompliments.includes(c)
                  ? 'bg-[#2b8659] text-white'
                  : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] active:bg-[var(--color-text-primary)]/[0.08]',
              ]"
            >
              {{ c }}
            </button>
          </div>
        </div>
      </Transition>

      <!-- Feedback -->
      <Transition name="fade">
        <div v-if="rating > 0" class="px-6 mb-6">
          <textarea
            v-model="feedback"
            rows="3"
            placeholder="Additional comments (optional)"
            class="w-full bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded-2xl px-4 py-3.5 text-sm placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none focus:border-[#2b8659]/40 transition-colors"
          />
        </div>
      </Transition>

      <!-- Spacer -->
      <div class="flex-1"></div>

      <!-- Actions -->
      <div class="px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <button
          @click="submitRating"
          :disabled="rating === 0 || submitting"
          :class="[
            'w-full py-4 rounded-2xl font-bold text-[15px] transition-all duration-150',
            rating > 0
              ? 'bg-[#2b8659] text-white active:bg-[#237a4d]'
              : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)] cursor-not-allowed',
          ]"
        >
          {{ submitting ? 'Submitting...' : 'Submit Rating' }}
        </button>
        <button
          @click="skip"
          class="w-full py-3 mt-2 text-sm text-[var(--color-text-muted)] font-medium"
        >
          Skip
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
