<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StarRating from '../../components/StarRating.vue'
import ReportSafety from '../../components/ReportSafety.vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { formatFare, driverPayout } from '../../lib/pricing'
import { DEMO_MODE } from '../../lib/demoMode'

const route = useRoute()
const router = useRouter()
const rideId = computed(() => route.params.rideId)

const STAR_LABELS = ['', 'Terrible', 'Bad', 'OK', 'Good', 'Great']
const POSITIVE = ['Respectful', 'On time', 'Good conversation', 'Clean', 'Easy to find']
const ISSUES = ['Late to pickup', 'Rude', 'Left a mess', 'Wrong pickup spot', 'Unsafe behaviour', 'Other']

const loading = ref(true)
const ride = ref(null)
const riderName = ref('your rider')
const rating = ref(0)
const tags = ref([])
const comment = ref('')
const alreadyRated = ref(false)
const submitting = ref(false)
const submitted = ref(false)
const error = ref('')
const showReport = ref(false)

onMounted(async () => {
  if (DEMO_MODE || !supabaseConfigured || rideId.value === 'demo') {
    ride.value = { id: 'demo', status: 'completed', fare_cents: 1375, driver_payout_cents: 1100, pickup_address: 'Cable Beach', dropoff_address: 'Downtown Nassau' }
    riderName.value = 'Ann'
    loading.value = false
    return
  }
  const [{ data }, { data: rider }] = await Promise.all([
    supabase.from('rides').select('id, status, driver_rating, fare_cents, driver_payout_cents, pickup_address, dropoff_address, completed_at').eq('id', rideId.value).maybeSingle(),
    supabase.rpc('get_ride_rider', { p_ride_id: rideId.value }),
  ])
  ride.value = data
  const r = Array.isArray(rider) ? rider[0] : rider
  if (r?.first_name) riderName.value = r.first_name
  if (data?.driver_rating) {
    alreadyRated.value = true
    rating.value = data.driver_rating
  }
  loading.value = false
})

const earnings = computed(() => ride.value ? driverPayout(ride.value) : 0)
const tagOptions = computed(() => (rating.value > 0 && rating.value <= 3 ? ISSUES : POSITIVE))

function setRating(value) {
  if ((value <= 3) !== (rating.value <= 3)) tags.value = []
  rating.value = value
}

function toggleTag(tag) {
  const i = tags.value.indexOf(tag)
  if (i >= 0) tags.value.splice(i, 1)
  else tags.value.push(tag)
}

async function submitRating() {
  if (rating.value === 0 || submitting.value) return
  error.value = ''
  submitting.value = true
  const note = [tags.value.length ? `${rating.value <= 3 ? 'Issues' : 'Liked'}: ${tags.value.join(', ')}` : '', comment.value.trim()].filter(Boolean).join('. ')
  if (!DEMO_MODE && supabaseConfigured && ride.value?.id !== 'demo') {
    const { error: err } = await supabase
      .from('rides')
      .update({ driver_rating: rating.value, driver_feedback: note.slice(0, 1000) || null })
      .eq('id', rideId.value)
    if (err) {
      submitting.value = false
      if (/once/i.test(err.message || '')) {
        alreadyRated.value = true
        error.value = 'You’ve already rated this rider.'
      } else {
        error.value = 'We couldn’t save your rating. Check your connection and try again.'
      }
      return
    }
  }
  submitting.value = false
  submitted.value = true
  setTimeout(() => router.push('/driver/dashboard'), 1800)
}

function skip() {
  router.push('/driver/dashboard')
}
</script>

<template>
  <div class="min-h-dvh bg-[var(--color-surface)] font-[var(--font-sans)] text-[var(--color-text-primary)] flex flex-col">
    <p v-if="loading" class="flex-1 flex items-center justify-center text-[var(--color-text-secondary)]" role="status">Loading…</p>

    <div v-else-if="submitted" class="flex-1 flex flex-col items-center justify-center px-6">
      <div class="w-16 h-16 rounded-full bg-[#2b8659] flex items-center justify-center mb-5" aria-hidden="true">
        <svg class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 class="text-xl font-bold mb-1" aria-live="polite">Thanks for rating</h2>
      <p class="text-[var(--color-text-muted)] text-sm">Back to your dashboard…</p>
    </div>

    <div v-else class="flex-1 flex flex-col max-w-lg mx-auto w-full">
      <div class="flex items-center px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-2">
        <button @click="skip" class="w-11 h-11 flex items-center justify-center rounded-full active:bg-[var(--color-surface-secondary)]" aria-label="Close">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Trip summary: what the driver made on this trip, the same number the earnings page shows -->
      <div class="mx-6 mb-6 rounded-2xl bg-[var(--color-surface-secondary)] p-4 text-center">
        <p class="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">You earned</p>
        <p class="text-[32px] font-bold text-[var(--color-brand)] leading-tight">{{ formatFare(earnings) }}</p>
        <p v-if="ride" class="text-[12px] text-[var(--color-text-muted)] mt-1 truncate">{{ ride.pickup_address }} → {{ ride.dropoff_address }}</p>
      </div>

      <div class="flex flex-col items-center mb-5 px-6 text-center">
        <div class="w-16 h-16 rounded-full bg-gradient-to-br from-[#2b8659] to-[#191f1c] flex items-center justify-center mb-3 text-white text-xl font-bold" aria-hidden="true">{{ riderName.charAt(0).toUpperCase() }}</div>
        <h1 class="text-xl font-bold mb-1">{{ alreadyRated ? `You rated ${riderName}` : `How was ${riderName}?` }}</h1>
      </div>

      <div class="flex flex-col items-center mb-5">
        <StarRating v-if="!alreadyRated" :model-value="rating" @update:model-value="setRating" size="lg" />
        <StarRating v-else :model-value="rating" size="md" readonly />
        <p v-if="!alreadyRated" class="h-5 mt-2 text-[14px] font-semibold text-[var(--color-text-secondary)]" aria-live="polite">{{ STAR_LABELS[rating] }}</p>
      </div>

      <template v-if="!alreadyRated && rating > 0">
        <div class="px-6 mb-4 flex flex-wrap gap-2 justify-center">
          <button v-for="t in tagOptions" :key="t" @click="toggleTag(t)" :aria-pressed="tags.includes(t)"
                  :class="['px-4 py-2.5 rounded-full text-sm font-medium transition-colors',
                           tags.includes(t) ? 'bg-[#2b8659] text-white' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]']">
            {{ t }}
          </button>
        </div>
        <div class="px-6 mb-4">
          <label class="sr-only" for="rider-comment">Comment</label>
          <textarea id="rider-comment" v-model="comment" rows="2" maxlength="500" placeholder="Add a comment (optional)"
                    class="w-full bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded-2xl px-4 py-3 text-sm placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none focus:border-[#2b8659]"></textarea>
        </div>
        <div v-if="rating <= 2" class="px-6 mb-4">
          <button @click="showReport = true" class="w-full py-3 rounded-xl border border-[var(--color-border)] text-[14px] font-semibold text-[var(--color-danger)]">Report a safety issue</button>
        </div>
      </template>

      <div class="flex-1"></div>

      <div class="sticky bottom-0 px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] bg-[var(--color-surface)]">
        <p v-if="error" class="text-[13px] text-[var(--color-danger)] text-center mb-2" role="alert">{{ error }}</p>
        <button v-if="!alreadyRated" @click="submitRating" :disabled="rating === 0 || submitting"
                :class="['w-full py-4 rounded-2xl font-bold text-[15px] transition-colors',
                         rating > 0 ? 'bg-[#2b8659] text-white active:bg-[#237a4d]' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)] cursor-not-allowed']">
          {{ submitting ? 'Submitting…' : 'Submit rating' }}
        </button>
        <button @click="skip" class="w-full py-3 mt-1 text-sm text-[var(--color-text-muted)] font-medium">{{ alreadyRated ? 'Back to dashboard' : 'Skip' }}</button>
      </div>
    </div>

    <div v-if="showReport" v-modal="() => (showReport = false)" class="fixed inset-0 z-[100] bg-[var(--color-overlay)] flex items-end justify-center" @click.self="showReport = false" role="dialog" aria-modal="true" aria-label="Report a safety issue">
      <div class="w-full max-w-lg bg-[var(--color-surface)] rounded-t-3xl max-h-[90dvh] overflow-y-auto">
        <ReportSafety :ride="ride" role="driver" @back="showReport = false" @close="showReport = false" />
      </div>
    </div>
  </div>
</template>
