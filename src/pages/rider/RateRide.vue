<script setup>
import DotMascot from '../../components/DotMascot.vue'
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StarRating from '../../components/StarRating.vue'
import AccountConversionCard from '../../components/AccountConversionCard.vue'
import ReportSafety from '../../components/ReportSafety.vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { formatFare } from '../../lib/pricing'
import { chargeOf } from '../../lib/discounts'
import { isCashRide } from '../../lib/cash'
import { useAuth } from '../../lib/useAuth'
import { DEMO_MODE } from '../../lib/demoMode'

const route = useRoute()
const router = useRouter()
const rideId = computed(() => route.params.rideId)
const { user, needsLogin } = useAuth()

const STAR_LABELS = ['', 'Terrible', 'Bad', 'OK', 'Good', 'Great']
const COMPLIMENTS = ['Great conversation', 'Clean car', 'Smooth driving', 'Good music', 'Safe driving', 'Friendly']
const ISSUES = ['Late pickup', 'Unsafe driving', 'Rude', 'Car not clean', 'Wrong route', 'Other']

const loading = ref(true)
const loadError = ref('')
const ride = ref(null)
const driver = ref(null)

const rating = ref(0)
const tags = ref([])
const feedback = ref('')

const ratingSaved = ref(false)
const submitting = ref(false)
const error = ref('')
const step = ref('rate') // rate | thanks
const showReport = ref(false)

const DEMO_RIDE = {
  id: 'demo', status: 'completed', fare_cents: 1375, pickup_address: 'Cable Beach', dropoff_address: 'Lynden Pindling Intl Airport',
  completed_at: new Date().toISOString(), rider_rating: null, payment_method: 'cash', payment_status: 'cash_collected',
}

onMounted(async () => {
  if (DEMO_MODE || !supabaseConfigured) {
    ride.value = DEMO_RIDE
    driver.value = { name: 'Marcus', vehicle_make: 'Toyota', vehicle_model: 'Corolla', vehicle_color: 'Silver', license_plate: 'TX 4471', rating: 4.9 }
    loading.value = false
    return
  }
  const { data, error: err } = await supabase
    .from('rides')
    .select('*')
    .eq('id', rideId.value)
    .maybeSingle()
  if (err || !data) {
    loadError.value = 'We couldn’t find this trip.'
    loading.value = false
    return
  }
  ride.value = data
  if (data.rider_rating) {
    ratingSaved.value = true
    rating.value = data.rider_rating
  }

  const { data: d } = await supabase.rpc('get_ride_driver', { p_ride_id: rideId.value })
  driver.value = Array.isArray(d) ? d[0] : d
  loading.value = false
})

const driverName = computed(() => driver.value?.name || 'your driver')
const vehicle = computed(() => [driver.value?.vehicle_color, driver.value?.vehicle_make, driver.value?.vehicle_model].filter(Boolean).join(' '))
const completed = computed(() => ride.value?.status === 'completed')
const canRate = computed(() => completed.value && !ratingSaved.value)
const tagOptions = computed(() => (rating.value > 0 && rating.value <= 3 ? ISSUES : COMPLIMENTS))
const tripDate = computed(() => {
  const d = ride.value?.completed_at ? new Date(ride.value.completed_at) : null
  return d ? d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''
})
const canSubmit = computed(() => canRate.value && rating.value > 0)
// How the fare was paid, next to the amount.
const paidNote = computed(() => {
  if (!isCashRide(ride.value)) return ''
  return ride.value.payment_status === 'cash_unpaid' ? 'cash not paid' : 'paid in cash'
})

function setRating(value) {
  // Switching between a low and a high rating swaps the chip set.
  if ((value <= 3) !== (rating.value <= 3)) tags.value = []
  rating.value = value
}

function toggleTag(tag) {
  const i = tags.value.indexOf(tag)
  if (i >= 0) tags.value.splice(i, 1)
  else tags.value.push(tag)
}

async function submit() {
  error.value = ''
  if (!canSubmit.value || submitting.value) return
  submitting.value = true

  const low = rating.value <= 3
  const note = [low && tags.value.length ? `Issues: ${tags.value.join(', ')}` : '', feedback.value.trim()].filter(Boolean).join('. ')
  if (!DEMO_MODE && supabaseConfigured) {
    const { error: err } = await supabase
      .from('rides')
      .update({
        rider_rating: rating.value,
        rider_feedback: note.slice(0, 1000) || null,
        rider_compliments: !low && tags.value.length ? tags.value : null,
      })
      .eq('id', rideId.value)
    if (err) {
      submitting.value = false
      if (/once/i.test(err.message || '')) {
        ratingSaved.value = true
        error.value = 'You’ve already rated this trip.'
      } else {
        error.value = 'We couldn’t save your rating. Check your connection and try again.'
      }
      return
    }
  }
  ratingSaved.value = true

  submitting.value = false
  step.value = 'thanks'
  if (!needsLogin.value) setTimeout(done, 2500)
}

function done() {
  if (route.name === 'rate-ride') router.push('/book')
}
</script>

<template>
  <div class="min-h-dvh bg-[var(--color-surface)] font-[var(--font-sans)] text-[var(--color-text-primary)] flex flex-col">
    <p v-if="loading" class="flex-1 flex items-center justify-center text-[var(--color-text-secondary)]" role="status">Loading your trip…</p>

    <div v-else-if="loadError" class="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <p class="text-lg font-bold mb-2">{{ loadError }}</p>
      <button @click="router.push('/book')" class="mt-4 px-6 py-3 bg-[#2b8659] text-white font-bold rounded-xl">Back to booking</button>
    </div>

    <!-- Thanks -->
    <div v-else-if="step === 'thanks'" class="flex-1 flex flex-col items-center justify-center px-6 max-w-lg mx-auto w-full">
      <DotMascot pose="arrived" class="w-32 h-32 mb-4" />
      <h2 class="text-xl font-bold mb-1" aria-live="polite">Thanks for your feedback</h2>
      <p class="text-[var(--color-text-muted)] text-sm text-center mb-6">
        Ratings help keep RideUp safe and friendly.
      </p>
      <div v-if="needsLogin" class="w-full mb-4">
        <AccountConversionCard :show-skip="false" subtitle="Keep this trip’s receipt and book faster next time." />
      </div>
      <button @click="router.push('/book')" class="w-full py-3.5 rounded-2xl font-bold text-[15px] bg-[#2b8659] text-white">Done</button>
    </div>

    <!-- Rate -->
    <div v-else class="flex-1 flex flex-col max-w-lg mx-auto w-full">
      <div class="flex items-center justify-between px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-2">
        <button @click="router.push('/book')" class="w-11 h-11 flex items-center justify-center rounded-full active:bg-[var(--color-surface-secondary)]" aria-label="Close">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <router-link v-if="ride?.id !== 'demo'" :to="`/receipt/${rideId}`" class="text-[14px] font-semibold text-[var(--color-brand)] px-2 py-2">View receipt</router-link>
      </div>

      <div class="flex flex-col items-center mt-2 mb-5 px-6 text-center">
        <div class="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-[#2b8659] to-[#191f1c] flex items-center justify-center mb-3 text-white text-2xl font-bold">
          <img v-if="driver?.photo_url" :src="driver.photo_url" :alt="`Photo of ${driverName}`" class="w-full h-full object-cover" />
          <span v-else aria-hidden="true">{{ (driver?.name || 'D').charAt(0) }}</span>
        </div>
        <h1 class="text-xl font-bold mb-1">{{ completed ? `How was your trip with ${driverName}?` : 'This trip was cancelled' }}</h1>
        <p class="text-[13px] text-[var(--color-text-muted)]">
          <span v-if="vehicle">{{ vehicle }}<span v-if="driver?.license_plate"> · {{ driver.license_plate }}</span> · </span>{{ tripDate }}
        </p>
        <p class="text-[13px] text-[var(--color-text-secondary)] mt-1 truncate max-w-full">{{ ride.pickup_address }} → {{ ride.dropoff_address }}</p>
        <p v-if="completed" class="text-[15px] font-bold mt-1">{{ formatFare(chargeOf(ride)) }}<span v-if="paidNote" class="font-medium text-[var(--color-text-secondary)]"> · {{ paidNote }}</span></p>
      </div>

      <template v-if="completed">
        <!-- Stars -->
        <div class="flex flex-col items-center mb-5">
          <StarRating v-if="canRate" :model-value="rating" @update:model-value="setRating" size="lg" />
          <template v-else>
            <StarRating :model-value="rating" size="md" readonly />
            <p class="text-[13px] text-[var(--color-text-muted)] mt-2">You rated this trip.</p>
          </template>
          <p v-if="canRate" class="h-5 mt-2 text-[14px] font-semibold text-[var(--color-text-secondary)]" aria-live="polite">{{ STAR_LABELS[rating] }}</p>
        </div>

        <template v-if="canRate && rating > 0">
          <p class="px-6 text-[13px] font-semibold text-center text-[var(--color-text-secondary)] mb-2">{{ rating <= 3 ? 'What went wrong?' : 'What went well?' }}</p>
          <div class="px-6 mb-4 flex flex-wrap gap-2 justify-center">
            <button v-for="t in tagOptions" :key="t" @click="toggleTag(t)" :aria-pressed="tags.includes(t)"
                    :class="['px-4 py-2.5 rounded-full text-sm font-medium transition-colors',
                             tags.includes(t) ? 'bg-[#2b8659] text-white' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]']">
              {{ t }}
            </button>
          </div>
          <div class="px-6 mb-4">
            <label class="sr-only" for="rate-feedback">Comments</label>
            <textarea id="rate-feedback" v-model="feedback" rows="2" maxlength="500" :placeholder="rating <= 3 ? 'Tell us more (optional)' : 'Add a comment (optional)'"
                      class="w-full bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded-2xl px-4 py-3 text-sm placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none focus:border-[#2b8659]"></textarea>
          </div>
          <div v-if="rating <= 2" class="px-6 mb-4">
            <button @click="showReport = true" class="w-full py-3 rounded-xl border border-[var(--color-border)] text-[14px] font-semibold text-[var(--color-danger)]">Report a safety issue</button>
          </div>
        </template>

        <p class="px-6 mb-4 text-center text-[12px] text-[var(--color-text-muted)]">Want to tip {{ driverName }}? Tips are welcome in cash and go 100% to your driver.</p>
      </template>

      <div class="flex-1"></div>

      <div class="sticky bottom-0 px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] bg-[var(--color-surface)]">
        <p v-if="error" class="text-[13px] text-[var(--color-danger)] text-center mb-2" role="alert">{{ error }}</p>
        <button v-if="completed && canRate" @click="submit" :disabled="!canSubmit || submitting"
                :class="['w-full py-4 rounded-2xl font-bold text-[15px] transition-colors',
                         canSubmit ? 'bg-[#2b8659] text-white active:bg-[#237a4d]' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)] cursor-not-allowed']">
          {{ submitting ? 'Submitting…' : 'Submit' }}
        </button>
        <button @click="router.push('/book')" class="w-full py-3 mt-1 text-sm text-[var(--color-text-muted)] font-medium">
          {{ completed && canRate ? 'Skip' : 'Done' }}
        </button>
      </div>
    </div>

    <!-- Safety report sheet -->
    <div v-if="showReport" v-modal="() => (showReport = false)" class="fixed inset-0 z-[100] bg-[var(--color-overlay)] flex items-end justify-center" @click.self="showReport = false" role="dialog" aria-modal="true" aria-label="Report a safety issue">
      <div class="w-full max-w-lg bg-[var(--color-surface)] rounded-t-3xl max-h-[90dvh] overflow-y-auto">
        <ReportSafety :ride="ride" role="rider" @back="showReport = false" @close="showReport = false" />
      </div>
    </div>
  </div>
</template>
