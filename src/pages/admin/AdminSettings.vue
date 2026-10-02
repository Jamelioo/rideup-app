<template>
  <div class="max-w-2xl">
    <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-2">Settings</h1>
    <p class="text-sm text-[var(--color-text-secondary)] mb-6">Trip policies. Changes take effect for new trips immediately.</p>

    <p v-if="error" class="mb-4 text-sm text-red-600" role="alert">{{ error }}</p>

    <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
      <div v-for="item in toggles" :key="item.key" class="flex items-start justify-between gap-4 p-5">
        <div>
          <p class="font-semibold text-[var(--color-text-primary)]">{{ item.title }}</p>
          <p class="text-sm text-[var(--color-text-secondary)] mt-1">{{ item.description }}</p>
          <p v-if="item.note" class="text-xs text-[var(--color-text-muted)] mt-1">{{ item.note }}</p>
        </div>
        <button @click="toggle(item.key)" :disabled="saving === item.key" role="switch" :aria-checked="String(values[item.key])" :aria-label="item.title"
                class="relative w-12 h-7 rounded-full flex-shrink-0 transition-colors disabled:opacity-50"
                :class="values[item.key] ? 'bg-[#2b8659]' : 'bg-[var(--color-text-muted)]'">
          <span class="absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform" :class="values[item.key] && 'translate-x-5'"></span>
        </button>
      </div>
    </div>

    <h2 class="text-lg font-bold mt-8 mb-2">Fees and waiting time</h2>
    <p class="text-sm text-[var(--color-text-secondary)] mb-3">Set in Vercel environment variables (redeploy after changing). If you change the two timings, set <code>VITE_CANCEL_GRACE_SECONDS</code> and <code>VITE_FREE_WAIT_SECONDS</code> to the same values so the in-app timers match.</p>
    <ul class="text-sm space-y-1.5 text-[var(--color-text-primary)]">
      <li><code>CANCEL_FEE_CENTS</code>: cancellation and no-show fee, default <strong>500</strong> ($5.00). 0 turns fees off.</li>
      <li><code>CANCEL_GRACE_SECONDS</code>: free cancellation window after a driver accepts, default <strong>120</strong>.</li>
      <li><code>FREE_WAIT_SECONDS</code>: free waiting time at pickup before a driver can mark a no-show, default <strong>300</strong>.</li>
    </ul>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { DEMO_MODE } from '../../lib/demoMode'

const toggles = [
  {
    key: 'require_pickup_pin',
    title: 'Pickup PIN',
    description: 'Riders see a 4-digit PIN; the driver must enter it to start the trip. Confirms the right rider got into the right car.',
    note: 'Adds a step for every rider. Uber offers this as an option.',
  },
  {
    key: 'offer_xl',
    title: 'Offer RideUp XL',
    description: 'Shows the XL ride option (6+ seats) to riders. XL trips only go to drivers approved for XL.',
    note: 'Turn on once you have XL drivers, or riders will wait and get “no drivers available”.',
  },
  {
    key: 'offer_premium',
    title: 'Offer RideUp Premium',
    description: 'Shows the Premium ride option to riders. Premium trips only go to drivers whose vehicle you’ve approved as Premium (set it in Drivers → Review).',
    note: 'Turn on once you have enough Premium drivers, or riders will wait and get “no drivers available”.',
  },
  {
    key: 'require_verified_phone',
    title: 'Require verified phone numbers',
    description: 'Riders must confirm their phone number with an SMS code before requesting a ride.',
    note: 'Needs an SMS provider (e.g. Twilio) set up in Supabase → Authentication → Phone. Turn this on only after testing a code arrives.',
  },
]
const values = reactive({ require_pickup_pin: false, offer_xl: false, offer_premium: false, require_verified_phone: false })
const saving = ref('')
const error = ref('')

onMounted(async () => {
  if (!supabaseConfigured || DEMO_MODE) return
  const { data, error: err } = await supabase.from('app_settings').select('key, value')
  if (err) { error.value = 'Could not load settings. Run migration 006 first.'; return }
  for (const row of data || []) if (row.key in values) values[row.key] = row.value === true
})

async function toggle(key) {
  const next = !values[key]
  if (key === 'require_verified_phone' && next && !window.confirm('Only turn this on if SMS codes are working in Supabase. Riders without a verified phone will be unable to book. Continue?')) return
  saving.value = key
  error.value = ''
  if (!DEMO_MODE) {
    const { error: err } = await supabase.from('app_settings').upsert({ key, value: next, updated_at: new Date().toISOString() })
    if (err) { error.value = `Couldn’t save: ${err.message}`; saving.value = ''; return }
  }
  values[key] = next
  saving.value = ''
}
</script>
