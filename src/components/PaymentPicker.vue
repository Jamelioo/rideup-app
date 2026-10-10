<script setup>
import { ref, computed } from 'vue'
import { formatFare } from '../lib/pricing'

// How the rider pays, shown above the request button: their card, or cash to the driver at drop-off while RideUp
// accepts cash (Admin › Settings). `cash` is null when cash isn't offered, otherwise cashOption() from lib/cash.js.
const model = defineModel({ type: String, default: 'card' }) // 'card' | 'cash'
const props = defineProps({
  cardLabel: { type: String, default: '' },   // "Visa •••• 4242", or what happens when there's no card yet
  manageCards: { type: Boolean, default: false },
  cash: { type: Object, default: null },        // { ok, reason, action? }
  chargeCents: { type: Number, default: null }, // what the rider pays, after promos and credit
})

const open = ref(false)
const choice = ref('card')
const payingCash = computed(() => model.value === 'cash' && !!props.cash?.ok)
const rowLabel = computed(() => (payingCash.value ? 'Cash' : props.cardLabel || 'Card'))

function show() {
  choice.value = payingCash.value ? 'cash' : 'card'
  open.value = true
}
function done() {
  model.value = choice.value === 'cash' && props.cash?.ok ? 'cash' : 'card'
  open.value = false
}
</script>

<template>
  <!-- Cash not offered: the card on file, as before. -->
  <component v-if="!cash" :is="manageCards ? 'router-link' : 'div'" :to="manageCards ? '/payments' : undefined"
             class="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)] mb-2.5 px-1">
    <svg class="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
    <span class="flex-1 truncate">{{ cardLabel || 'Card' }}</span>
    <span v-if="manageCards" class="text-[var(--color-brand)] font-semibold">Change</span>
  </component>

  <template v-else>
    <button type="button" @click="show" class="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)] mb-2.5 px-1 w-full text-left"
            :aria-label="`Paying with ${rowLabel}. Change`">
      <svg v-if="payingCash" class="w-4 h-4 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>
      <svg v-else class="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
      <span class="flex-1 truncate" :class="payingCash && 'text-[var(--color-text-primary)] font-semibold'">{{ rowLabel }}<span v-if="payingCash && chargeCents" class="font-normal text-[var(--color-text-muted)]"> · pay {{ formatFare(chargeCents) }} at drop-off</span></span>
      <span class="text-[var(--color-brand)] font-semibold">Change</span>
    </button>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="open" class="fixed inset-0 z-[120] flex items-end md:items-center justify-center bg-[var(--color-overlay)]" @click.self="open = false">
          <div v-modal="() => (open = false)" role="dialog" aria-modal="true" aria-labelledby="pay-title"
               class="w-full max-w-md bg-[var(--color-surface)] text-[var(--color-text-primary)] rounded-t-3xl md:rounded-3xl px-6 pt-7 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-xl">
            <h3 id="pay-title" class="text-lg font-bold mb-4">How will you pay?</h3>
            <div class="space-y-2 mb-3" role="radiogroup" aria-labelledby="pay-title">
              <label class="flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer" :class="choice === 'card' ? 'border-[#2b8659]' : 'border-[var(--color-border)]'">
                <input type="radio" v-model="choice" value="card" class="w-4 h-4 accent-[#2b8659]" />
                <span class="flex-1 min-w-0">
                  <span class="block font-semibold text-[15px]">Card</span>
                  <span class="block text-[13px] text-[var(--color-text-muted)] truncate">{{ cardLabel || 'Added at the next step' }}</span>
                </span>
              </label>
              <label class="flex items-center gap-3 rounded-xl border-2 px-4 py-3" :class="[choice === 'cash' ? 'border-[#2b8659]' : 'border-[var(--color-border)]', cash.ok ? 'cursor-pointer' : 'opacity-60']">
                <input type="radio" v-model="choice" value="cash" :disabled="!cash.ok" class="w-4 h-4 accent-[#2b8659]" aria-describedby="cash-note" />
                <span class="flex-1 min-w-0">
                  <span class="block font-semibold text-[15px]">Cash</span>
                  <span class="block text-[13px] text-[var(--color-text-muted)]">Pay your driver at drop-off</span>
                </span>
              </label>
            </div>
            <p id="cash-note" class="text-[13px] text-[var(--color-text-secondary)] mb-4">
              <template v-if="!cash.ok">
                {{ cash.reason }}
                <router-link v-if="cash.action" :to="cash.action.to" class="text-[var(--color-brand)] font-semibold" @click="open = false">{{ cash.action.label }}</router-link>
              </template>
              <template v-else>Have {{ chargeCents ? formatFare(chargeCents) : 'the fare' }} ready for your driver; exact change helps. Missed pickups and late cancellations can turn cash off on your account.</template>
            </p>
            <button type="button" @click="done" class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-xl text-[15px]">Done</button>
            <router-link v-if="manageCards" to="/payments" class="block mt-2 text-center text-[14px] font-semibold text-[var(--color-brand)] py-2" @click="open = false">Manage cards</router-link>
          </div>
        </div>
      </Transition>
    </Teleport>
  </template>
</template>
