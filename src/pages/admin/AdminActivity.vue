<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { DEMO_MODE } from '../../lib/demoMode'

// Admin › Activity: who on the team did what, and when. Refunds, credit, cancellations, assignments,
// broadcasts and team changes come from the server; edits made on the admin pages (suspensions, approvals,
// promos, settings, payouts, tickets, reports) are recorded by the database.
const PAGE = 100
const entries = ref([])
const loading = ref(true)
const more = ref(false)
const error = ref('')
const who = ref('')
const kind = ref('')
const open = ref(null)

const NOUN = {
  riders: 'rider', drivers: 'driver', rides: 'ride', promo_codes: 'promo code', app_settings: 'setting',
  driver_payouts: 'driver payout', driver_quests: 'incentive', support_tickets: 'support ticket', safety_reports: 'safety report',
}
const KINDS = {
  trips: { label: 'Trips', test: (a) => /^ride\.(cancel|assign|complete)|^rides\./.test(a.action) },
  money: { label: 'Money', test: (a) => /refund|credit|driver_payouts/.test(a.action) },
  people: { label: 'Riders & drivers', test: (a) => /^(riders|drivers)\./.test(a.action) },
  team: { label: 'Team', test: (a) => a.action.startsWith('team.') },
  messages: { label: 'Messages', test: (a) => a.action === 'broadcast' },
  setup: { label: 'Promos, incentives & settings', test: (a) => /^(promo_codes|driver_quests|app_settings)\./.test(a.action) },
  support: { label: 'Support & safety', test: (a) => /^(support_tickets|safety_reports)\./.test(a.action) },
}
const ACTION = {
  'ride.cancel': 'Cancelled a trip', 'ride.assign': 'Assigned a trip', 'ride.complete': 'Completed a trip',
  'ride.refund': 'Refunded a trip', 'ride.credit': 'Gave credit for a trip', 'rider.credit': 'Gave a rider credit',
  broadcast: 'Sent a broadcast', 'team.add': 'Added a team member', 'team.role': 'Changed a team member’s access', 'team.remove': 'Removed a team member',
}

function describe(a) {
  if (ACTION[a.action]) return ACTION[a.action]
  const [table, op] = a.action.split('.')
  const noun = NOUN[table] || table
  const d = a.details || {}
  const after = (k) => (Array.isArray(d[k]) ? d[k][1] : undefined)
  if (op === 'insert') return `Created a ${noun}`
  if (op === 'delete') return `Deleted a ${noun}`
  if (table === 'riders' && 'suspended' in d) return after('suspended') ? 'Suspended a rider' : 'Unsuspended a rider'
  if (table === 'drivers' && 'approved' in d) return after('approved') ? 'Approved a driver' : 'Removed a driver’s approval'
  if ((table === 'support_tickets' || table === 'safety_reports') && 'status' in d) return `Marked a ${noun} “${after('status')}”`
  if (table === 'app_settings') return `Changed the “${a.target_id}” setting`
  if (table === 'promo_codes' && 'active' in d) return after('active') ? 'Turned a promo code on' : 'Turned a promo code off'
  return `Edited a ${noun}`
}
const fields = (a) => Object.keys(a.details || {}).filter((k) => Array.isArray(a.details[k]))
const show = (v) => (v == null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v))
const when = (iso) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const person = (a) => (a.actor_email ? a.actor_email.split('@')[0] : 'RideUp')

const people = computed(() => [...new Set(entries.value.map((a) => a.actor_email).filter(Boolean))].sort())
const shown = computed(() => entries.value.filter((a) => (!who.value || a.actor_email === who.value) && (!kind.value || KINDS[kind.value].test(a))))

async function load(append = false) {
  error.value = ''
  if (DEMO_MODE || !supabaseConfigured) {
    const t = (m) => new Date(Date.now() - m * 60_000).toISOString()
    entries.value = [
      { id: 3, created_at: t(4), actor_email: 'owner@rideupnassau.com', action: 'ride.refund', target_type: 'ride', target_id: 'r1', summary: '$5.00 refunded to card: Driver took a longer route' },
      { id: 2, created_at: t(40), actor_email: 'owner@rideupnassau.com', action: 'riders.update', target_type: 'riders', target_id: 'u1', details: { suspended: [false, true] } },
      { id: 1, created_at: t(90), actor_email: 'owner@rideupnassau.com', action: 'broadcast', target_type: 'riders', summary: '“$5 off this weekend 🎉” to 3 of 7 riders' },
    ]
    loading.value = false
    return
  }
  loading.value = true
  let q = supabase.from('admin_actions').select('*').order('id', { ascending: false }).limit(PAGE)
  if (append && entries.value.length) q = q.lt('id', entries.value[entries.value.length - 1].id)
  const { data, error: err } = await q
  loading.value = false
  if (err) { error.value = /admin_actions/.test(err.message) ? 'Run database update 016 to see activity.' : 'Couldn’t load activity.'; return }
  entries.value = append ? [...entries.value, ...(data || [])] : data || []
  more.value = (data || []).length === PAGE
}
onMounted(() => load())
</script>

<template>
  <div class="max-w-4xl">
    <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Activity</h1>
    <p class="text-sm text-[var(--color-text-secondary)] mb-5">Everything the team changed: refunds, credit, cancellations, approvals, settings and more.</p>

    <div class="flex flex-wrap gap-2 mb-4">
      <label class="sr-only" for="act-who">Person</label>
      <select id="act-who" v-model="who" class="h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm">
        <option value="">Everyone</option>
        <option v-for="p in people" :key="p" :value="p">{{ p }}</option>
      </select>
      <label class="sr-only" for="act-kind">Type</label>
      <select id="act-kind" v-model="kind" class="h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm">
        <option value="">All activity</option>
        <option v-for="(k, id) in KINDS" :key="id" :value="id">{{ k.label }}</option>
      </select>
    </div>

    <p v-if="error" class="mb-4 text-sm text-[var(--color-danger)]" role="alert">{{ error }}</p>
    <div class="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
      <ul class="divide-y divide-[var(--color-border)]">
        <li v-for="a in shown" :key="a.id" class="px-4 py-3 text-sm">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <div><span class="font-semibold">{{ person(a) }}</span> · {{ describe(a) }}</div>
            <span class="text-xs text-[var(--color-text-muted)]">{{ when(a.created_at) }}</span>
          </div>
          <p v-if="a.summary" class="text-[var(--color-text-secondary)] mt-0.5 break-words">{{ a.summary }}</p>
          <button v-if="fields(a).length" @click="open = open === a.id ? null : a.id" :aria-expanded="String(open === a.id)" class="mt-1 text-xs font-semibold text-[var(--color-brand)]">
            {{ open === a.id ? 'Hide changes' : `Show changes (${fields(a).length})` }}
          </button>
          <table v-if="open === a.id" class="mt-2 w-full text-xs">
            <tr v-for="k in fields(a)" :key="k" class="align-top">
              <td class="py-1 pr-3 text-[var(--color-text-muted)] whitespace-nowrap">{{ k.replace(/_/g, ' ') }}</td>
              <td class="py-1 break-all"><span class="line-through text-[var(--color-text-muted)]">{{ show(a.details[k][0]) }}</span> → {{ show(a.details[k][1]) }}</td>
            </tr>
          </table>
        </li>
        <li v-if="!loading && !shown.length" class="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">Nothing yet.</li>
      </ul>
    </div>
    <p v-if="loading" class="mt-3 text-sm text-[var(--color-text-muted)]">Loading…</p>
    <button v-else-if="more" @click="load(true)" class="mt-3 h-10 px-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-semibold">Load older</button>
  </div>
</template>
