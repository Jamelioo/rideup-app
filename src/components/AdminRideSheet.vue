<script setup>
import { ref, watch, computed } from 'vue'
import { apiPost } from '../lib/api'
import { formatFare } from '../lib/pricing'
import { chargeOf } from '../lib/discounts'
import { DEMO_MODE } from '../lib/demoMode'

// Admin › Rides › a ride: details, earlier refunds and the refund / credit form.
const props = defineProps({ ride: { type: Object, default: null } })
const emit = defineEmits(['close'])

const limits = ref(null)
const loading = ref(false)
const form = ref({ target: 'fare', method: 'card', amount: '', reason: '', chargeDriver: false })
const busy = ref(false)
const error = ref('')
const notice = ref('')

const REASONS = ['Driver took a longer route', 'Driver didn’t show up / wrong car', 'Charged by mistake', 'Rider had a safety concern', 'Cancellation fee waived', 'Goodwill']
const left = computed(() => (!limits.value ? 0 : form.value.target === 'tip' ? limits.value.tip_left_cents : limits.value.fare_left_cents))

async function load() {
  error.value = ''
  notice.value = ''
  limits.value = null
  form.value = { target: 'fare', method: 'card', amount: '', reason: '', chargeDriver: false }
  if (!props.ride || DEMO_MODE) return
  loading.value = true
  const res = await apiPost('/api/admin-refund', { rideId: props.ride.id, preview: true })
  const body = await res.json().catch(() => ({}))
  loading.value = false
  if (res.ok) limits.value = body
  else error.value = body.error || 'Could not load payment details.'
}
watch(() => props.ride?.id, load, { immediate: true })

async function submit() {
  error.value = ''
  notice.value = ''
  const cents = Math.round(Number(form.value.amount) * 100)
  if (!(cents > 0)) { error.value = 'Enter an amount.'; return }
  if (cents > left.value) { error.value = `At most ${formatFare(left.value)} can be refunded.`; return }
  if (form.value.reason.trim().length < 3) { error.value = 'Add a reason.'; return }
  const what = form.value.method === 'card' ? 'refund to the rider’s card' : 'add as RideUp credit'
  if (!window.confirm(`${formatFare(cents)}: ${what}?`)) return
  busy.value = true
  try {
    const res = await apiPost('/api/admin-refund', {
      rideId: props.ride.id, target: form.value.target, method: form.value.method, amountCents: cents,
      reason: form.value.reason.trim(), chargeDriver: form.value.chargeDriver,
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || 'Refund failed.')
    limits.value = body
    notice.value = `${formatFare(cents)} ${form.value.method === 'card' ? 'refunded to the card' : 'added as credit'}. The rider was notified.`
    form.value.amount = ''
    form.value.reason = ''
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="ride" class="fixed inset-0 z-50 flex justify-end bg-black/40" @click.self="emit('close')">
      <div v-modal="() => emit('close')" role="dialog" aria-modal="true" aria-labelledby="ride-sheet-title"
           class="w-full max-w-md h-full overflow-y-auto bg-[var(--color-surface)] text-[var(--color-text-primary)] p-6 shadow-xl">
        <div class="flex items-start justify-between mb-4">
          <div>
            <h2 id="ride-sheet-title" class="text-lg font-bold">Ride</h2>
            <p class="text-xs font-mono text-[var(--color-text-muted)]">{{ ride.id }}</p>
          </div>
          <button @click="emit('close')" class="w-11 h-11 flex items-center justify-center text-[var(--color-text-muted)]" aria-label="Close">✕</button>
        </div>

        <dl class="text-sm space-y-2 mb-5">
          <div class="flex justify-between gap-4"><dt class="text-[var(--color-text-muted)]">Rider</dt><dd>{{ ride.rider_name || 'Rider' }}</dd></div>
          <div class="flex justify-between gap-4"><dt class="text-[var(--color-text-muted)]">Status</dt><dd>{{ ride.status }} · {{ ride.payment_status || 'no payment' }}</dd></div>
          <div><dt class="text-[var(--color-text-muted)]">From</dt><dd>{{ ride.pickup_address }}</dd></div>
          <div v-if="ride.stop_address"><dt class="text-[var(--color-text-muted)]">Stop</dt><dd>{{ ride.stop_address }}</dd></div>
          <div><dt class="text-[var(--color-text-muted)]">To</dt><dd>{{ ride.dropoff_address }}</dd></div>
          <div class="flex justify-between gap-4"><dt class="text-[var(--color-text-muted)]">Fare</dt><dd>{{ formatFare(ride.fare_cents) }}<span v-if="Number(ride.surge_multiplier) > 1"> (busy {{ ride.surge_multiplier }}×)</span></dd></div>
          <div v-if="ride.promo_discount_cents || ride.credit_applied_cents" class="flex justify-between gap-4"><dt class="text-[var(--color-text-muted)]">Discounts</dt><dd>−{{ formatFare((ride.promo_discount_cents || 0) + (ride.credit_applied_cents || 0)) }}</dd></div>
          <div class="flex justify-between gap-4"><dt class="text-[var(--color-text-muted)]">Rider charged</dt><dd class="font-semibold">{{ formatFare(ride.status === 'cancelled' ? ride.cancel_fee_cents : chargeOf(ride)) }}</dd></div>
          <div v-if="ride.tip_payment_intent_id" class="flex justify-between gap-4"><dt class="text-[var(--color-text-muted)]">Tip</dt><dd>{{ formatFare(ride.tip_cents) }}</dd></div>
          <div class="flex justify-between gap-4"><dt class="text-[var(--color-text-muted)]">Driver earns</dt><dd>{{ formatFare(ride.driver_payout_cents) }}</dd></div>
          <div v-if="ride.safety_checkin_at" class="flex justify-between gap-4"><dt class="text-[var(--color-text-muted)]">Trip check-in</dt><dd>{{ ride.safety_checkin_reason }} · {{ ride.safety_checkin_ok_at ? 'answered OK' : 'no answer' }}</dd></div>
        </dl>

        <p v-if="loading" class="text-sm text-[var(--color-text-muted)]" aria-live="polite">Loading payment…</p>
        <template v-else-if="limits">
          <div v-if="limits.refunds.length" class="mb-5">
            <h3 class="text-sm font-semibold mb-2">Earlier refunds</h3>
            <ul class="text-sm space-y-1">
              <li v-for="(r, i) in limits.refunds" :key="i">{{ formatFare(r.amount_cents) }} · {{ r.target }} · {{ r.method === 'card' ? 'to card' : 'as credit' }}</li>
            </ul>
          </div>

          <form v-if="limits.fare_left_cents > 0 || limits.tip_left_cents > 0" @submit.prevent="submit" class="space-y-3 text-sm border-t border-[var(--color-border)] pt-4">
            <h3 class="font-semibold">Refund or credit</h3>
            <div class="flex gap-2" role="radiogroup" aria-label="What to refund">
              <label v-if="limits.fare_left_cents > 0" class="flex-1 flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2">
                <input type="radio" v-model="form.target" value="fare" /> {{ ride.status === 'cancelled' ? 'Cancellation fee' : 'Fare' }} ({{ formatFare(limits.fare_left_cents) }} left)
              </label>
              <label v-if="limits.tip_left_cents > 0" class="flex-1 flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2">
                <input type="radio" v-model="form.target" value="tip" /> Tip ({{ formatFare(limits.tip_left_cents) }} left)
              </label>
            </div>
            <div class="flex gap-2" role="radiogroup" aria-label="How">
              <label class="flex-1 flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2"><input type="radio" v-model="form.method" value="card" /> Back to card</label>
              <label class="flex-1 flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2"><input type="radio" v-model="form.method" value="credit" /> RideUp credit</label>
            </div>
            <label class="flex flex-col gap-1">Amount ($)
              <div class="flex gap-2">
                <input v-model="form.amount" type="number" min="0.01" step="0.01" :max="left / 100" class="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
                <button type="button" @click="form.amount = (left / 100).toFixed(2)" class="px-3 rounded-lg border border-[var(--color-border)] text-xs font-semibold">Full</button>
              </div>
            </label>
            <label class="flex flex-col gap-1">Reason (kept with the ride)
              <input v-model="form.reason" list="refund-reasons" maxlength="300" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
              <datalist id="refund-reasons"><option v-for="r in REASONS" :key="r" :value="r" /></datalist>
            </label>
            <label v-if="form.target === 'fare' && ride.driver_payout_cents > 0" class="flex items-start gap-2">
              <input type="checkbox" v-model="form.chargeDriver" class="mt-0.5" />
              <span>The driver was at fault: take the driver’s share of this refund out of their earnings.</span>
            </label>
            <p v-else-if="form.target === 'tip'" class="text-xs text-[var(--color-text-muted)]">Tips are 100% the driver’s, so a tip refund comes out of their earnings.</p>
            <p v-if="error" class="text-[var(--color-danger)]" role="alert">{{ error }}</p>
            <p v-if="notice" class="text-[var(--color-brand)]" aria-live="polite">{{ notice }}</p>
            <button type="submit" :disabled="busy" class="w-full py-2.5 rounded-lg bg-[#2b8659] text-white font-semibold disabled:opacity-50">{{ busy ? 'Working…' : 'Issue refund' }}</button>
          </form>
          <p v-else class="text-sm text-[var(--color-text-muted)]">Nothing left to refund on this ride.<span v-if="notice" class="block text-[var(--color-brand)] mt-1">{{ notice }}</span></p>
        </template>
        <p v-else-if="error" class="text-sm text-[var(--color-danger)]" role="alert">{{ error }}</p>
      </div>
    </div>
  </Transition>
</template>
