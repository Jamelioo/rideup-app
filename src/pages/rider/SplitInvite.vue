<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiPost } from '../../lib/api'
import { formatFare } from '../../lib/pricing'
import { DEMO_MODE } from '../../lib/demoMode'

// Invited rider: join or decline a friend's split fare (opened from the push notification or email).
const route = useRoute()
const router = useRouter()
const splitId = route.params.splitId

const loading = ref(true)
const invite = ref(null)
const error = ref('')
const busy = ref(false)
const done = ref('')

async function load() {
  if (DEMO_MODE) { loading.value = false; error.value = 'Split fare works once the app is connected.'; return }
  try {
    const res = await apiPost('/api/split-fare', { action: 'get', splitId })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || 'Couldn’t load this invite.')
    invite.value = body
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function respond(accept) {
  busy.value = true
  error.value = ''
  try {
    const res = await apiPost('/api/split-fare', { action: 'respond', splitId, accept })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (body.reason === 'no_card') invite.value.has_card = false
      throw new Error(body.error || 'Something went wrong. Please try again.')
    }
    done.value = body.status
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="min-h-dvh bg-[var(--color-surface)] text-[var(--color-text-primary)] flex flex-col">
    <div class="flex items-center gap-3 px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4 max-w-lg mx-auto w-full">
      <button @click="router.push('/book')" class="w-11 h-11 flex items-center justify-center" aria-label="Back">
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
      </button>
      <h1 class="text-xl font-bold">Split fare</h1>
    </div>

    <div class="px-5 max-w-lg mx-auto w-full">
      <p v-if="loading" class="text-[14px] text-[var(--color-text-muted)]" aria-live="polite">Loading…</p>

      <template v-else-if="invite">
        <div v-if="done" class="rounded-2xl bg-[#2b8659]/10 p-5" role="status">
          <p class="text-[17px] font-bold mb-1">{{ done === 'accepted' ? 'You’re in' : 'Invite declined' }}</p>
          <p class="text-[14px] text-[var(--color-text-secondary)]">
            {{ done === 'accepted'
              ? `We’ll charge your share to ${invite.card || 'your card'} when the trip ends and email you a receipt.`
              : `${invite.inviter} will pay for this trip.` }}
          </p>
        </div>

        <template v-else>
          <p class="text-[22px] font-bold leading-tight mb-2">{{ invite.inviter }} wants to split a ride with you</p>
          <div class="rounded-2xl border border-[var(--color-border)] p-4 mb-4 text-[14px] space-y-2">
            <p><span class="text-[var(--color-text-muted)]">From</span><br>{{ invite.pickup }}</p>
            <p><span class="text-[var(--color-text-muted)]">To</span><br>{{ invite.dropoff }}</p>
          </div>
          <p class="text-[14px] text-[var(--color-text-secondary)] mb-5">
            Your share: about <strong class="text-[var(--color-text-primary)]">{{ formatFare(invite.share_cents) }}</strong>.
            The fare is split equally between everyone who joins and charged when the trip ends.
          </p>

          <p v-if="!invite.open" class="text-[14px] text-[var(--color-text-muted)]">
            {{ invite.status === 'invited' ? 'This trip has ended, so the fare can’t be split any more.' : 'You’ve already answered this invite.' }}
          </p>
          <template v-else>
            <div v-if="!invite.has_card" class="rounded-xl bg-amber-500/15 px-4 py-3 text-[14px] mb-4">
              Add a card to your account to accept.
              <button @click="router.push('/payments')" class="font-bold text-[var(--color-brand)] ml-1">Add card</button>
            </div>
            <p v-else class="text-[13px] text-[var(--color-text-muted)] mb-4">Pay with {{ invite.card }}</p>
            <p v-if="error" class="text-[13px] text-[var(--color-danger)] mb-3" role="alert">{{ error }}</p>
            <button @click="respond(true)" :disabled="busy || !invite.has_card" class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-xl text-[15px] mb-2 disabled:opacity-40">Accept and split</button>
            <button @click="respond(false)" :disabled="busy" class="w-full py-3 text-[14px] text-[var(--color-text-secondary)] font-semibold">Decline</button>
          </template>
        </template>
      </template>

      <p v-else class="text-[14px] text-[var(--color-danger)]" role="alert">{{ error }}</p>
    </div>
  </div>
</template>
