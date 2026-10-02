<template>
  <div class="max-w-3xl">
    <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-2">Promo codes</h1>
    <p class="text-sm text-[var(--color-text-secondary)] mb-6">
      Riders enter codes in Promotions or on the booking screen. Each rider can use a code once; it counts as used when the ride is completed.
      Discounts come out of RideUp’s share: drivers are always paid on the full fare, and riders always pay at least $1.
    </p>

    <form @submit.prevent="createCode" class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 mb-8 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
      <h2 class="sm:col-span-2 text-base font-bold">New code</h2>
      <label class="flex flex-col gap-1">Code
        <input v-model="form.code" required maxlength="20" placeholder="WELCOME5" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] uppercase" />
      </label>
      <label class="flex flex-col gap-1">Amount off ($)
        <input v-model="form.amount" required type="number" min="1" max="100" step="0.5" placeholder="5" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
      </label>
      <label class="flex flex-col gap-1">Total uses (blank = unlimited)
        <input v-model="form.maxUses" type="number" min="1" placeholder="100" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
      </label>
      <label class="flex flex-col gap-1">Expires (optional)
        <input v-model="form.expires" type="date" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
      </label>
      <label class="flex flex-col gap-1 sm:col-span-2">Description (shown to riders)
        <input v-model="form.description" maxlength="120" placeholder="$5 off your first RideUp ride" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
      </label>
      <label class="flex items-center gap-2 sm:col-span-2">
        <input v-model="form.firstRideOnly" type="checkbox" class="w-4 h-4" /> First ride only (new riders)
      </label>
      <p v-if="formError" class="sm:col-span-2 text-red-600" role="alert">{{ formError }}</p>
      <div class="sm:col-span-2">
        <button type="submit" :disabled="saving" class="px-4 py-2 rounded-lg bg-[#2b8659] text-white font-semibold disabled:opacity-50">{{ saving ? 'Saving…' : 'Create code' }}</button>
      </div>
    </form>

    <p v-if="error" class="mb-4 text-sm text-red-600" role="alert">{{ error }}</p>
    <div class="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <table class="w-full text-sm stack-table">
        <thead>
          <tr class="text-left text-[var(--color-text-muted)] text-xs uppercase tracking-wider bg-[var(--color-surface-secondary)]">
            <th class="px-4 py-3 font-medium">Code</th>
            <th class="px-4 py-3 font-medium">Off</th>
            <th class="px-4 py-3 font-medium">Used</th>
            <th class="px-4 py-3 font-medium">Expires</th>
            <th class="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in codes" :key="c.code" class="border-t border-[var(--color-border)]">
            <td data-label="Code" class="px-4 py-3 font-bold tracking-wide">{{ c.code }}<div class="text-xs font-normal text-[var(--color-text-muted)]">{{ c.first_ride_only ? 'First ride only' : 'Any ride' }}<span v-if="c.description"> · {{ c.description }}</span></div></td>
            <td data-label="Off" class="px-4 py-3">{{ formatFare(c.amount_cents) }}</td>
            <td data-label="Used" class="px-4 py-3">{{ c.uses }}{{ c.max_uses ? ` / ${c.max_uses}` : '' }}</td>
            <td data-label="Expires" class="px-4 py-3">{{ c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—' }}</td>
            <td data-label="Status" class="px-4 py-3">
              <button @click="toggle(c)" class="text-xs font-semibold px-3 py-1.5 rounded-lg border"
                      :class="c.active ? 'border-[#2b8659] text-[var(--color-brand)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)]'">
                {{ c.active ? 'Active · turn off' : 'Off · turn on' }}
              </button>
            </td>
          </tr>
          <tr v-if="!loading && codes.length === 0"><td colspan="5" class="px-4 py-8 text-center text-[var(--color-text-muted)]">No promo codes yet.</td></tr>
          <tr v-if="loading"><td colspan="5" class="px-4 py-8 text-center text-[var(--color-text-muted)]">Loading…</td></tr>
        </tbody>
      </table>
    </div>
    <p class="text-xs text-[var(--color-text-muted)] mt-4">Referral rewards ($5 off a friend’s first ride, $5 credit to the referrer) run automatically and don’t need a code here.</p>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { formatFare } from '../../lib/pricing'
import { DEMO_MODE } from '../../lib/demoMode'

const codes = ref(DEMO_MODE ? [{ code: 'WELCOME5', amount_cents: 500, uses: 12, max_uses: 100, first_ride_only: true, active: true, description: '$5 off your first ride' }] : [])
const loading = ref(!DEMO_MODE)
const error = ref('')
const saving = ref(false)
const formError = ref('')
const form = reactive({ code: '', amount: '', maxUses: '', expires: '', description: '', firstRideOnly: true })

async function load() {
  if (!supabaseConfigured || DEMO_MODE) return
  loading.value = true
  const { data, error: err } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false })
  if (err) error.value = 'Could not load promo codes. Run migration 009 and check your account has the admin role.'
  codes.value = data || []
  loading.value = false
}

async function createCode() {
  formError.value = ''
  const code = form.code.trim().toUpperCase()
  const cents = Math.round(Number(form.amount) * 100)
  if (!/^[A-Z0-9-]{3,20}$/.test(code) || code === 'REFERRAL') { formError.value = 'Use 3–20 letters, numbers or dashes.'; return }
  if (!(cents >= 100 && cents <= 10000)) { formError.value = 'Amount must be between $1 and $100.'; return }
  saving.value = true
  if (!DEMO_MODE) {
    const { error: err } = await supabase.from('promo_codes').insert({
      code, amount_cents: cents,
      max_uses: form.maxUses ? Number(form.maxUses) : null,
      expires_at: form.expires ? new Date(`${form.expires}T23:59:59-05:00`).toISOString() : null,
      description: form.description.trim() || null,
      first_ride_only: form.firstRideOnly,
    })
    if (err) {
      saving.value = false
      formError.value = err.code === '23505' ? 'That code already exists.' : err.message
      return
    }
  }
  Object.assign(form, { code: '', amount: '', maxUses: '', expires: '', description: '', firstRideOnly: true })
  saving.value = false
  await load()
}

async function toggle(c) {
  if (DEMO_MODE) { c.active = !c.active; return }
  const { error: err } = await supabase.from('promo_codes').update({ active: !c.active }).eq('code', c.code)
  if (err) { error.value = err.message; return }
  c.active = !c.active
}

onMounted(load)
</script>
