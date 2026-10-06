<template>
  <div>
    <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-2">Safety Reports</h1>
    <p class="text-sm text-[var(--color-text-secondary)] mb-6">Every report from the in-trip safety toolkit lands here. Review open reports first; contact the reporter and the other party as needed.</p>

    <div class="flex gap-1 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-1 mb-4 w-fit" role="group" aria-label="Filter reports">
      <button v-for="tab in tabs" :key="tab.value" @click="filter = tab.value" :aria-pressed="filter === tab.value"
              :class="['px-3.5 py-2 min-w-[44px] text-sm font-medium rounded-md', filter === tab.value ? 'bg-[#2b8659] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]']">
        {{ tab.label }} <span v-if="counts[tab.value]" class="ml-1">({{ counts[tab.value] }})</span>
      </button>
    </div>

    <p v-if="error" class="mb-4 text-sm text-[var(--color-danger)]" role="alert">{{ error }}</p>
    <p v-if="loading" class="text-sm text-[var(--color-text-muted)]">Loading…</p>
    <p v-else-if="visible.length === 0" class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center text-sm text-[var(--color-text-muted)]">No {{ filter === 'all' ? '' : filter }} reports.</p>

    <div class="space-y-3">
      <article v-for="r in visible" :key="r.id" class="rounded-xl border bg-[var(--color-surface)] p-5"
               :class="r.status === 'open' ? 'border-red-200' : 'border-[var(--color-border)]'">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div class="flex items-center gap-2">
            <span :class="badge(r.status)">{{ labelFor(r.status) }}</span>
            <span class="font-semibold text-[var(--color-text-primary)]">{{ r.category || 'Report' }}</span>
          </div>
          <span class="text-xs text-[var(--color-text-muted)]">{{ new Date(r.created_at).toLocaleString() }}</span>
        </div>
        <p class="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap mb-3">{{ r.description || 'No description provided.' }}</p>
        <dl class="text-xs text-[var(--color-text-secondary)] mb-3 grid gap-1">
          <div>
            <dt class="inline font-semibold text-[var(--color-text-primary)]">Reported by:</dt>{{ ' ' }}
            <dd class="inline">
              <template v-if="r.reporter">{{ r.reporter.name || 'Unnamed' }} ({{ r.reporter.role }})<template v-if="r.reporter.phone"> · <a :href="`tel:${r.reporter.phone}`" class="text-[var(--color-brand)] font-semibold">{{ r.reporter.phone }}</a></template><template v-if="r.reporter.email"> · {{ r.reporter.email }}</template></template>
              <code v-else>{{ r.reporter_id || 'unknown' }}</code>
            </dd>
          </div>
          <div v-if="r.trip">
            <dt class="inline font-semibold text-[var(--color-text-primary)]">Trip:</dt>
            <dd class="inline">{{ new Date(r.trip.created_at).toLocaleString() }} · {{ r.trip.pickup_address }} → {{ r.trip.dropoff_address }} · {{ r.trip.status }}</dd>
          </div>
          <div v-if="r.trip">
            <dt class="inline font-semibold text-[var(--color-text-primary)]">People:</dt>
            <dd class="inline">
              Rider {{ r.trip.rider_name || '—' }}<template v-if="r.trip.rider_phone"> (<a :href="`tel:${r.trip.rider_phone}`" class="text-[var(--color-brand)]">{{ r.trip.rider_phone }}</a>)</template>
              · Driver {{ r.trip.driver_name || '—' }}<template v-if="r.trip.driver_phone"> (<a :href="`tel:${r.trip.driver_phone}`" class="text-[var(--color-brand)]">{{ r.trip.driver_phone }}</a>)</template>
            </dd>
          </div>
          <div v-else-if="r.ride_id"><dt class="inline font-semibold">Ride:</dt> <dd class="inline"><code>{{ r.ride_id }}</code></dd></div>
        </dl>
        <label class="block text-xs font-semibold text-[var(--color-text-muted)] mb-1" :for="`note-${r.id}`">Internal note</label>
        <textarea :id="`note-${r.id}`" v-model="r.admin_note" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] mb-3"></textarea>
        <div class="flex flex-wrap gap-2">
          <button v-for="s in statuses" :key="s" @click="save(r, s)" :disabled="r._saving"
                  :class="['text-xs font-semibold px-3 py-1.5 rounded-lg border', r.status === s ? 'bg-[#2b8659] text-white border-[#2b8659]' : 'border-[var(--color-border)] text-[var(--color-text-primary)]']">
            {{ r.status === s ? `✓ ${labelFor(s)}` : `Mark ${labelFor(s).toLowerCase()}` }}
          </button>
          <span v-if="r._saved" class="text-xs text-[var(--color-brand)] self-center">Saved</span>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { DEMO_MODE } from '../../lib/demoMode'

const statuses = ['open', 'investigating', 'resolved']
const tabs = [
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
]
const filter = ref('open')
const reports = ref(DEMO_MODE ? [
  { id: 'demo1', status: 'open', category: 'Felt unsafe', description: 'Driver took an unexpected route.', created_at: new Date().toISOString(), reporter_id: 'demo', ride_id: null, admin_note: '' },
] : [])
const loading = ref(!DEMO_MODE)
const error = ref('')

const labelFor = (s) => ({ open: 'Open', investigating: 'Investigating', resolved: 'Resolved' }[s] || s)
const counts = computed(() => ({
  open: reports.value.filter((r) => r.status === 'open').length,
  investigating: reports.value.filter((r) => r.status === 'investigating').length,
}))
const visible = computed(() => filter.value === 'all' ? reports.value : reports.value.filter((r) => r.status === filter.value))

function badge(status) {
  const base = 'text-xs font-medium px-2 py-0.5 rounded-full'
  return { open: `${base} bg-red-50 text-red-700`, investigating: `${base} bg-yellow-50 text-yellow-800`, resolved: `${base} bg-green-50 text-green-700` }[status] || base
}

async function load() {
  if (!supabaseConfigured || DEMO_MODE) return
  loading.value = true
  const { data, error: err } = await supabase.from('safety_reports').select('*').order('created_at', { ascending: false }).limit(200)
  if (err) error.value = 'Could not load safety reports. Check that your account has the admin role.'
  const rows = (data || []).map((r) => ({ ...r, admin_note: r.admin_note || '' }))
  await attachContext(rows)
  reports.value = rows
  loading.value = false
}

// Who reported it and which trip, so the team can call the people involved straight away.
async function attachContext(rows) {
  const uniq = (list) => [...new Set(list.filter(Boolean))]
  const reporterIds = uniq(rows.map((r) => r.reporter_id))
  const rideIds = uniq(rows.map((r) => r.ride_id))
  const none = Promise.resolve({ data: [] })
  const [{ data: riderReporters }, { data: driverReporters }, { data: trips }] = await Promise.all([
    reporterIds.length ? supabase.from('riders').select('auth_user_id, name, phone, email').in('auth_user_id', reporterIds) : none,
    reporterIds.length ? supabase.from('drivers').select('auth_user_id, name, phone, email').in('auth_user_id', reporterIds) : none,
    rideIds.length ? supabase.from('rides').select('id, created_at, status, pickup_address, dropoff_address, rider_id, driver_id, rider_name').in('id', rideIds) : none,
  ])
  const riderIds = uniq((trips || []).map((t) => t.rider_id))
  const driverIds = uniq((trips || []).map((t) => t.driver_id))
  const [{ data: tripRiders }, { data: tripDrivers }] = await Promise.all([
    riderIds.length ? supabase.from('riders').select('id, name, phone').in('id', riderIds) : none,
    driverIds.length ? supabase.from('drivers').select('id, name, phone').in('id', driverIds) : none,
  ])
  const byKey = (list, key) => Object.fromEntries((list || []).map((x) => [x[key], x]))
  const riderBy = byKey(riderReporters, 'auth_user_id')
  const driverBy = byKey(driverReporters, 'auth_user_id')
  const tripBy = byKey(trips, 'id')
  const tripRiderBy = byKey(tripRiders, 'id')
  const tripDriverBy = byKey(tripDrivers, 'id')
  for (const r of rows) {
    const isDriver = (r.category || '').startsWith('[Driver]')
    const who = isDriver ? driverBy[r.reporter_id] || riderBy[r.reporter_id] : riderBy[r.reporter_id] || driverBy[r.reporter_id]
    if (who) r.reporter = { ...who, role: driverBy[r.reporter_id] === who ? 'driver' : 'rider' }
    const t = tripBy[r.ride_id]
    if (t) {
      r.trip = {
        ...t,
        rider_name: tripRiderBy[t.rider_id]?.name || t.rider_name,
        rider_phone: tripRiderBy[t.rider_id]?.phone || '',
        driver_name: tripDriverBy[t.driver_id]?.name || '',
        driver_phone: tripDriverBy[t.driver_id]?.phone || '',
      }
    }
  }
}

async function save(r, status) {
  r._saving = true
  r._saved = false
  error.value = ''
  if (!DEMO_MODE) {
    const { error: err } = await supabase.from('safety_reports').update({ status, admin_note: r.admin_note.trim() || null }).eq('id', r.id)
    if (err) { error.value = `Couldn’t save: ${err.message}`; r._saving = false; return }
  }
  r.status = status
  r._saving = false
  r._saved = true
}

onMounted(load)
</script>
