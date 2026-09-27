<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StarRating from '../../components/StarRating.vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'

const route = useRoute()
const router = useRouter()
const rideId = computed(() => route.params.rideId)

const rating = ref(0)
const comment = ref('')
const submitting = ref(false)
const submitted = ref(false)

async function submitRating() {
  if (rating.value === 0 || submitting.value) return
  submitting.value = true

  try {
    if (supabaseConfigured) {
      await supabase
        .from('rides')
        .update({
          driver_rating: rating.value,
          driver_feedback: comment.value || null,
        })
        .eq('id', rideId.value)
    }
  } catch (err) {
    console.warn('Could not save rating:', err.message)
  }

  submitted.value = true
  setTimeout(() => {
    router.push('/driver/dashboard')
  }, 1800)
}

function skip() {
  router.push('/driver/dashboard')
}
</script>

<template>
  <div class="min-h-screen bg-white font-[var(--font-sans)] text-[#191f1c] flex flex-col">
    <!-- Success state -->
    <Transition name="fade">
      <div v-if="submitted" class="flex-1 flex flex-col items-center justify-center px-6">
        <div class="w-16 h-16 rounded-full bg-[#2b8659] flex items-center justify-center mb-5">
          <svg class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-xl font-bold mb-1">Thanks for rating</h2>
        <p class="text-[#191f1c]/50 text-sm">Returning to dashboard...</p>
      </div>
    </Transition>

    <!-- Rating form -->
    <div v-if="!submitted" class="flex-1 flex flex-col max-w-lg mx-auto w-full">
      <!-- Top bar -->
      <div class="flex items-center px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4">
        <button @click="skip" class="w-10 h-10 flex items-center justify-center">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Rider avatar -->
      <div class="flex flex-col items-center mt-6 mb-6 px-6">
        <div class="w-20 h-20 rounded-full bg-[#191f1c]/[0.06] flex items-center justify-center mb-5">
          <svg class="w-10 h-10 text-[#191f1c]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>

        <h1 class="text-xl font-bold mb-1 text-center">Rate your rider</h1>
        <p class="text-[#191f1c]/50 text-sm text-center">How was this passenger?</p>
      </div>

      <!-- Stars -->
      <div class="flex justify-center mb-8">
        <StarRating v-model="rating" size="lg" />
      </div>

      <!-- Comment -->
      <Transition name="fade">
        <div v-if="rating > 0" class="px-6 mb-6">
          <textarea
            v-model="comment"
            rows="3"
            placeholder="Add a comment (optional)"
            class="w-full bg-[#191f1c]/[0.03] border border-[#191f1c]/[0.06] rounded-2xl px-4 py-3.5 text-sm placeholder:text-[#191f1c]/30 resize-none focus:outline-none focus:border-[#2b8659]/40 transition-colors"
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
              : 'bg-[#191f1c]/[0.06] text-[#191f1c]/30 cursor-not-allowed',
          ]"
        >
          {{ submitting ? 'Submitting...' : 'Submit Rating' }}
        </button>
        <button
          @click="skip"
          class="w-full py-3 mt-2 text-sm text-[#191f1c]/40 font-medium"
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
