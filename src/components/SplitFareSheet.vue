<script setup>
import { ref, watch, computed } from 'vue'
import { apiPost } from '../lib/api'
import { formatFare } from '../lib/pricing'
import { MAX_SPLIT_FRIENDS } from '../lib/discounts'
import { DEMO_MODE } from '../lib/demoMode'

// Rider who booked: invite up to 3 RideUp riders to split the fare. Everyone who accepts pays an equal share
// when the trip ends; anyone whose card fails is covered by the rider.
const props = defineProps({ open: Boolean, rideId: { type: String, required: true } })
const emit = defineEmits(['close'])

const contact = ref('')
const splits = ref([])
const shares = ref({ total_cents: 0, ownerShare: 0, friendShare: 0, friends: 0 })
const busy = ref(false)
const error = ref('')
const notice = ref('')

const STATUS = { invited: 'Invited', accepted: 'Joined', paid: 'Paid', declined: 'Declined', expired: 'Expired', failed: 'Card failed' }
const activeInvites = computed(() => splits.value.filter((s) => s.status !== 'declined').length)

async function load() {
  if (DEMO_MODE) return
  const res = await apiPost('/api/split-fare', { action: 'list', rideId: props.rideId })
  const body = await res.json().catch(() => ({}))
  if (res.ok) { splits.value = body.splits || []; shares.value = body }
}
watch(() => props.open, (open) => { if (open) { error.value = ''; notice.value = ''; load() } })

async function invite() {
  const value = contact.value.trim()
  if (!value || busy.value) return
  if (DEMO_MODE) { error.value = 'Split fare works once the app is connected.'; return }
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    const res = await apiPost('/api/split-fare', { action: 'invite', rideId: props.rideId, contact: value })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || 'Couldn’t send the invite. Please try again.')
    contact.value = ''
    notice.value = `Invite sent to ${body.name}.`
    await load()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center bg-[var(--color-overlay)]" @click.self="emit('close')">
      <div role="dialog" aria-modal="true" aria-labelledby="split-title"
           class="w-full max-w-md bg-[var(--color-surface)] text-[var(--color-text-primary)] rounded-t-3xl px-6 pt-7 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-xl">
        <h3 id="split-title" class="text-lg font-bold mb-1">Split fare</h3>
        <p class="text-[13px] text-[var(--color-text-secondary)] mb-4">
          Invite up to {{ MAX_SPLIT_FRIENDS }} friends with RideUp accounts. Everyone who accepts pays an equal share when the trip ends.
        </p>

        <form v-if="activeInvites < MAX_SPLIT_FRIENDS" @submit.prevent="invite" class="flex gap-2 mb-3">
          <label for="split-contact" class="sr-only">Friend’s phone number or email</label>
          <input id="split-contact" v-model="contact" type="text" inputmode="email" autocomplete="off" placeholder="Friend’s phone or email"
                 class="flex-1 min-w-0 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[16px]" />
          <button type="submit" :disabled="busy || !contact.trim()" class="px-4 rounded-xl bg-[#2b8659] text-white font-bold text-[14px] disabled:opacity-40">
            {{ busy ? '…' : 'Invite' }}
          </button>
        </form>
        <p v-if="error" class="text-[13px] text-red-600 mb-3" role="alert">{{ error }}</p>
        <p v-if="notice" class="text-[13px] text-[var(--color-brand)] mb-3" aria-live="polite">{{ notice }}</p>

        <ul v-if="splits.length" class="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)] mb-3">
          <li v-for="s in splits" :key="s.id" class="flex items-center justify-between py-2.5 text-[14px]">
            <span class="font-semibold">{{ s.name }}</span>
            <span :class="['accepted', 'paid'].includes(s.status) ? 'text-[var(--color-brand)] font-semibold' : 'text-[var(--color-text-muted)]'">{{ STATUS[s.status] || s.status }}</span>
          </li>
        </ul>
        <p v-if="shares.friends" class="text-[13px] text-[var(--color-text-secondary)] mb-4">
          Split {{ shares.friends + 1 }} ways: your share is about <strong>{{ formatFare(shares.ownerShare) }}</strong> of {{ formatFare(shares.total_cents) }}.
        </p>

        <button @click="emit('close')" class="w-full py-3.5 bg-[var(--color-surface-secondary)] font-bold rounded-xl text-[14px]">Done</button>
      </div>
    </div>
  </Transition>
</template>
