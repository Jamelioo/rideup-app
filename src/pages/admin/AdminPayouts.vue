<template>
  <div>
    <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-2">Driver Payouts</h1>
    <p class="text-sm text-[var(--color-text-secondary)] mb-6">
      What each driver has earned (their 70% of paid trips, their share of cancellation and no-show fees, and 100% of tips) minus what you’ve already paid them.
      Pay drivers by bank transfer, cash or mobile money, then record it here so balances and the driver’s earnings page stay correct.
    </p>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <p class="text-sm text-[var(--color-text-muted)]">Owed to drivers</p>
        <p class="text-2xl font-bold">{{ formatFare(totalOwed) }}</p>
      </div>
      <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <p class="text-sm text-[var(--color-text-muted)]">Paid out (all time)</p>
        <p class="text-2xl font-bold">{{ formatFare(totalPaid) }}</p>
      </div>
      <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <p class="text-sm text-[var(--color-text-muted)]">Drivers with a balance</p>
        <p class="text-2xl font-bold">{{ balances.filter((b) => b.balance_cents > 0).length }}</p>
      </div>
    </div>

    <p v-if="error" class="mb-4 text-sm text-[var(--color-danger)]" role="alert">{{ error }}</p>

    <div class="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden mb-8">
      <table class="w-full text-sm stack-table">
        <thead>
          <tr class="text-left text-[var(--color-text-muted)] text-xs uppercase tracking-wider bg-[var(--color-surface-secondary)]">
            <th class="px-4 py-3 font-medium">Driver</th>
            <th class="px-4 py-3 font-medium">Paid trips</th>
            <th class="px-4 py-3 font-medium">Earned</th>
            <th class="px-4 py-3 font-medium">Paid out</th>
            <th class="px-4 py-3 font-medium">Balance</th>
            <th class="px-4 py-3 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in balances" :key="b.driver_id" class="border-t border-[var(--color-border)]">
            <td data-label="Driver" class="px-4 py-3 font-medium">{{ b.name }}<div class="text-xs text-[var(--color-text-muted)]">{{ b.phone }}</div></td>
            <td data-label="Paid trips" class="px-4 py-3">{{ b.paid_trips }}</td>
            <td data-label="Earned" class="px-4 py-3">{{ formatFare(b.earned_cents) }}</td>
            <td data-label="Paid out" class="px-4 py-3">{{ formatFare(b.paid_out_cents) }}</td>
            <td data-label="Balance" class="px-4 py-3 font-bold" :class="b.balance_cents > 0 ? 'text-[var(--color-brand)]' : ''">{{ formatFare(b.balance_cents) }}</td>
            <td data-label="Action" class="px-4 py-3">
              <button @click="openPay(b)" :disabled="b.balance_cents <= 0" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#2b8659] text-white disabled:opacity-40">Record payout</button>
            </td>
          </tr>
          <tr v-if="!loading && balances.length === 0"><td colspan="6" class="px-4 py-8 text-center text-[var(--color-text-muted)]">No drivers yet.</td></tr>
          <tr v-if="loading"><td colspan="6" class="px-4 py-8 text-center text-[var(--color-text-muted)]">Loading…</td></tr>
        </tbody>
      </table>
    </div>

    <h2 class="text-lg font-bold mb-3">Payout history</h2>
    <div class="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <table class="w-full text-sm stack-table">
        <thead>
          <tr class="text-left text-[var(--color-text-muted)] text-xs uppercase tracking-wider bg-[var(--color-surface-secondary)]">
            <th class="px-4 py-3 font-medium">Date</th>
            <th class="px-4 py-3 font-medium">Driver</th>
            <th class="px-4 py-3 font-medium">Amount</th>
            <th class="px-4 py-3 font-medium">Method</th>
            <th class="px-4 py-3 font-medium">Reference</th>
            <th class="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in history" :key="p.id" class="border-t border-[var(--color-border)]" :class="p.status === 'void' && 'opacity-50'">
            <td data-label="Date" class="px-4 py-3">{{ new Date(p.created_at).toLocaleDateString() }}</td>
            <td data-label="Driver" class="px-4 py-3">{{ nameFor(p.driver_id) }}</td>
            <td data-label="Amount" class="px-4 py-3 font-semibold">{{ formatFare(p.amount_cents) }}</td>
            <td data-label="Method" class="px-4 py-3">{{ METHODS[p.method] || p.method }}</td>
            <td data-label="Reference" class="px-4 py-3">{{ p.reference || '—' }}</td>
            <td data-label="Status" class="px-4 py-3">
              <span v-if="p.status === 'void'">Voided</span>
              <button v-else @click="voidPayout(p)" class="text-xs text-[var(--color-danger)] underline">Void</button>
            </td>
          </tr>
          <tr v-if="history.length === 0"><td colspan="6" class="px-4 py-8 text-center text-[var(--color-text-muted)]">No payouts recorded yet.</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Record payout -->
    <div v-if="paying" v-modal="() => (paying = null)" class="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center px-4" @click.self="paying = null" role="dialog" aria-modal="true" aria-labelledby="pay-title">
      <form @submit.prevent="submitPayout" class="w-full max-w-md rounded-2xl bg-[var(--color-surface)] text-[var(--color-text-primary)] p-6">
        <h2 id="pay-title" class="text-lg font-bold mb-1">Record payout to {{ paying.name }}</h2>
        <p class="text-sm text-[var(--color-text-secondary)] mb-4">Balance owed: {{ formatFare(paying.balance_cents) }}. Record the payout after you’ve sent the money.</p>
        <label class="block text-sm mb-3">Amount ($)
          <input v-model="payForm.amount" type="number" step="0.01" min="0.01" :max="(paying.balance_cents / 100).toFixed(2)" required class="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
        </label>
        <label class="block text-sm mb-3">Method
          <select v-model="payForm.method" class="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <option v-for="(label, value) in METHODS" :key="value" :value="value">{{ label }}</option>
          </select>
        </label>
        <label class="block text-sm mb-3">Reference (bank ref / receipt #)
          <input v-model="payForm.reference" type="text" maxlength="100" class="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
        </label>
        <label class="block text-sm mb-4">Note
          <input v-model="payForm.note" type="text" maxlength="200" class="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
        </label>
        <p v-if="payError" class="mb-3 text-sm text-[var(--color-danger)]" role="alert">{{ payError }}</p>
        <div class="flex gap-2">
          <button type="submit" :disabled="saving" class="flex-1 py-2.5 rounded-lg bg-[#2b8659] text-white font-semibold disabled:opacity-50">{{ saving ? 'Saving…' : 'Record payout' }}</button>
          <button type="button" @click="paying = null" class="px-4 py-2.5 rounded-lg border border-[var(--color-border)]">Cancel</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { formatFare } from '../../lib/pricing'
import { DEMO_MODE } from '../../lib/demoMode'

const METHODS = { bank_transfer: 'Bank transfer', cash: 'Cash', mobile_money: 'Mobile money', other: 'Other' }
const balances = ref(DEMO_MODE ? [{ driver_id: 'd1', name: 'Deon Rolle', phone: '(242) 555-0100', paid_trips: 12, earned_cents: 14420, paid_out_cents: 9600, balance_cents: 4820 }] : [])
const history = ref([])
const loading = ref(!DEMO_MODE)
const error = ref('')

const totalOwed = computed(() => balances.value.reduce((s, b) => s + Math.max(0, Number(b.balance_cents) || 0), 0))
const totalPaid = computed(() => balances.value.reduce((s, b) => s + (Number(b.paid_out_cents) || 0), 0))
const nameFor = (id) => balances.value.find((b) => b.driver_id === id)?.name || 'Driver'

async function load() {
  if (!supabaseConfigured || DEMO_MODE) return
  loading.value = true
  const [{ data: bal, error: e1 }, { data: hist }] = await Promise.all([
    supabase.rpc('admin_driver_balances'),
    supabase.from('driver_payouts').select('*').order('created_at', { ascending: false }).limit(200),
  ])
  if (e1) error.value = 'Could not load balances. Run migration 006 and check that your account has the admin role.'
  balances.value = (bal || []).map((b) => ({ ...b, earned_cents: Number(b.earned_cents), paid_out_cents: Number(b.paid_out_cents), balance_cents: Number(b.balance_cents), paid_trips: Number(b.paid_trips) }))
  history.value = hist || []
  loading.value = false
}

const paying = ref(null)
const saving = ref(false)
const payError = ref('')
const payForm = reactive({ amount: '', method: 'bank_transfer', reference: '', note: '' })

function openPay(b) {
  paying.value = b
  payError.value = ''
  Object.assign(payForm, { amount: (b.balance_cents / 100).toFixed(2), method: 'bank_transfer', reference: '', note: '' })
}

async function submitPayout() {
  const cents = Math.round(Number(payForm.amount) * 100)
  if (!cents || cents <= 0) { payError.value = 'Enter an amount.'; return }
  if (cents > paying.value.balance_cents) { payError.value = 'That’s more than the driver is owed.'; return }
  saving.value = true
  payError.value = ''
  if (!DEMO_MODE) {
    const { error: err } = await supabase.from('driver_payouts').insert({
      driver_id: paying.value.driver_id, amount_cents: cents, method: payForm.method,
      reference: payForm.reference.trim() || null, note: payForm.note.trim() || null,
    })
    if (err) { payError.value = err.message; saving.value = false; return }
  }
  saving.value = false
  paying.value = null
  await load()
}

async function voidPayout(p) {
  if (!window.confirm(`Void this ${formatFare(p.amount_cents)} payout? The amount goes back onto the driver’s balance.`)) return
  const { error: err } = await supabase.from('driver_payouts').update({ status: 'void' }).eq('id', p.id)
  if (err) { error.value = err.message; return }
  await load()
}

onMounted(load)
</script>
