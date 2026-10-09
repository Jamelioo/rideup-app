<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { DEMO_MODE } from '../../lib/demoMode'
import { formatFare } from '../../lib/pricing'
import { formatPhone } from '../../lib/phone'
import { nassauDayStart, elapsed } from '../../lib/nassauTime'
import AdminRideActions from '../../components/AdminRideActions.vue'
import AdminRideSheet from '../../components/AdminRideSheet.vue'
import AdminAlertsCard from '../../components/AdminAlertsCard.vue'

// Admin › Live: what's happening right now. Requests waiting for a driver, trips under way, requests nobody
// took today (call those riders back), and which drivers are online. Updates the moment a ride changes.
const ACTIVE = ['pending_driver_response', 'accepted', 'driver_arrived', 'in_progress']
const STAGE = {
  pending_driver_response: { label: 'Holding card', since: 'accepted_at', tone: 'bg-blue-50 text-blue-800' },
  accepted: { label: 'Driver on the way', since: 'accepted_at', tone: 'bg-amber-50 text-amber-800' },
  driver_arrived: { label: 'Driver at pickup', since: 'arrived_at', tone: 'bg-purple-50 text-purple-800' },
  in_progress: { label: 'On trip', since: 'started_at', tone: 'bg-green-50 text-green-800' },
}
const BACKGROUND_AFTER_MS = 3 * 60_000 // the app stopped checking in: in another app or the phone is asleep

const rides = ref([])
const drivers = ref([])
const loaded = ref(false)
const loadError = ref('')
const now = ref(Date.now())
const selected = ref(null)
const sound = ref(false)
let audio = null
let seenRequests = null
let channel = null
let refreshTimer = null
let pollTimer = null
let ticker = null

const waiting = computed(() => rides.value.filter((r) => r.status === 'requested').sort((a, b) => a.created_at.localeCompare(b.created_at)))
const underway = computed(() => rides.value.filter((r) => ACTIVE.includes(r.status)))
const missed = computed(() => rides.value.filter((r) => r.status === 'cancelled' && r.cancel_reason === 'no_drivers'))
const completedToday = computed(() => rides.value.filter((r) => r.status === 'completed').length)
const busyDriverIds = computed(() => new Set(underway.value.map((r) => r.driver_id)))
const driverState = (d) =>
  busyDriverIds.value.has(d.id) ? 'trip'
    : ['online', 'on_trip'].includes(d.status) ? (d.last_seen_at && now.value - new Date(d.last_seen_at).getTime() > BACKGROUND_AFTER_MS ? 'background' : 'online')
    : 'offline'
const onlineDrivers = computed(() => drivers.value.filter((d) => driverState(d) !== 'offline'))
const offlineDrivers = computed(() => drivers.value.filter((d) => driverState(d) === 'offline'))

const riderName = (r) => r.riders?.name || r.rider_name || 'Rider'
const riderPhone = (r) => r.riders?.phone || ''
const short = (a) => String(a || '—').split(',')[0]
const since = (r) => elapsed(r[STAGE[r.status]?.since] || r.created_at, now.value)
const ageSec = (r) => (now.value - new Date(r.created_at).getTime()) / 1000
const waitTone = (r) => (ageSec(r) > 90 ? 'text-[var(--color-danger)]' : ageSec(r) > 45 ? 'text-amber-700' : 'text-[var(--color-text-secondary)]')
const timeOf = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const tel = (p) => `tel:${String(p).replace(/[^\d+]/g, '')}`

async function load() {
  if (DEMO_MODE || !supabaseConfigured) { demo(); return }
  const fields = '*, riders:rider_id(name, phone), drivers:driver_id(name, phone)'
  const [active, today, team] = await Promise.all([
    supabase.from('rides').select(fields).in('status', ['requested', ...ACTIVE]).order('created_at').limit(200),
    supabase.from('rides').select(fields).in('status', ['completed', 'cancelled']).gte('created_at', nassauDayStart()).order('created_at', { ascending: false }).limit(500),
    supabase.from('drivers').select('id, name, phone, status, last_seen_at, vehicle_type').eq('approved', true).is('deleted_at', null).order('name'),
  ])
  if (active.error || today.error || team.error) {
    loadError.value = 'Couldn’t load live data. It retries every 15 seconds.'
    return
  }
  loadError.value = ''
  rides.value = [...(active.data || []), ...(today.data || [])]
  drivers.value = team.data || []
  loaded.value = true
  announceNewRequests()
  if (selected.value) selected.value = rides.value.find((r) => r.id === selected.value.id) || selected.value
}

// A short chime and a count in the tab title when a new request arrives (sound only after it's switched on:
// browsers block audio until someone taps the page).
function announceNewRequests() {
  const ids = waiting.value.map((r) => r.id)
  const fresh = seenRequests ? ids.filter((id) => !seenRequests.has(id)) : []
  seenRequests = new Set(ids)
  document.title = ids.length ? `(${ids.length}) Live — RideUp Admin` : 'Live — RideUp Admin'
  if (fresh.length && sound.value && audio) {
    const t = audio.currentTime
    for (const [i, freq] of [880, 1320].entries()) {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t + i * 0.18)
      gain.gain.exponentialRampToValueAtTime(0.25, t + i * 0.18 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.16)
      osc.connect(gain).connect(audio.destination)
      osc.start(t + i * 0.18)
      osc.stop(t + i * 0.18 + 0.17)
    }
  }
}

// Browsers only allow sound after a tap, so the chime is switched on each visit.
function toggleSound() {
  sound.value = !sound.value
  if (sound.value && !audio) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    audio = Ctx ? new Ctx() : null
  }
}

function scheduleRefresh() {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(load, 400)
}

function demo() {
  const ago = (s) => new Date(Date.now() - s * 1000).toISOString()
  rides.value = [
    { id: 'd1', status: 'requested', created_at: ago(38), pickup_address: 'Lynden Pindling International Airport, Nassau', dropoff_address: 'Baha Mar, Cable Beach', fare_cents: 1955, vehicle_type: 'standard', riders: { name: 'Ienka Johnson', phone: '+12425550141' } },
    { id: 'd2', status: 'accepted', created_at: ago(400), accepted_at: ago(300), pickup_address: 'Downtown Nassau, Bay St', dropoff_address: 'Paradise Island', fare_cents: 1308, vehicle_type: 'standard', driver_id: 'dd1', riders: { name: 'Oneal Humes', phone: '+12425550133' }, drivers: { name: 'Deon Rolle', phone: '+12425550100' } },
    { id: 'd3', status: 'cancelled', cancel_reason: 'no_drivers', created_at: ago(5400), pickup_address: 'Cable Beach', dropoff_address: 'Downtown Nassau', fare_cents: 1868, vehicle_type: 'standard', riders: { name: 'Chyna Williams', phone: '+12425550122' } },
    { id: 'd4', status: 'completed', created_at: ago(9000), pickup_address: 'Fox Hill', dropoff_address: 'Airport', fare_cents: 2400 },
  ]
  drivers.value = [
    { id: 'dd1', name: 'Deon Rolle', phone: '+12425550100', status: 'on_trip', last_seen_at: ago(5) },
    { id: 'dd2', name: 'Kendra Ferguson', phone: '+12425550177', status: 'online', last_seen_at: ago(400) },
    { id: 'dd3', name: 'Marcus Taylor', phone: '+12425550188', status: 'offline', last_seen_at: ago(90000) },
  ]
  loaded.value = true
}

onMounted(() => {
  load()
  ticker = setInterval(() => { now.value = Date.now() }, 1000)
  if (DEMO_MODE || !supabaseConfigured) return
  pollTimer = setInterval(load, 15_000) // realtime can drop on bad connections
  channel = supabase.channel('admin-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, scheduleRefresh)
    .subscribe()
})

onUnmounted(() => {
  clearInterval(ticker)
  clearInterval(pollTimer)
  clearTimeout(refreshTimer)
  if (channel) supabase.removeChannel(channel)
  document.title = 'RideUp'
  audio?.close?.()
})
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div class="flex items-center gap-2">
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">Live</h1>
        <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-brand)]"><span class="w-2 h-2 rounded-full bg-[#34d399] animate-pulse" aria-hidden="true"></span>Updating live</span>
      </div>
      <button @click="toggleSound" :aria-pressed="String(sound)" class="h-9 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-semibold">
        {{ sound ? '🔔 Chime on new requests: on' : '🔕 Chime on new requests: off' }}
      </button>
    </div>
    <p v-if="loadError" class="mb-4 text-sm text-[var(--color-danger)]" role="alert">{{ loadError }}</p>

    <!-- Right now -->
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
      <div class="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3 lg:p-4">
        <div class="text-xs text-[var(--color-text-muted)]">Waiting for a driver</div>
        <div :class="['text-xl lg:text-2xl font-bold', waiting.length ? 'text-[var(--color-danger)]' : '']">{{ waiting.length }}</div>
      </div>
      <div class="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3 lg:p-4">
        <div class="text-xs text-[var(--color-text-muted)]">Trips under way</div>
        <div class="text-xl lg:text-2xl font-bold">{{ underway.length }}</div>
      </div>
      <div class="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3 lg:p-4">
        <div class="text-xs text-[var(--color-text-muted)]">Drivers online</div>
        <div class="text-xl lg:text-2xl font-bold">{{ onlineDrivers.length }}</div>
      </div>
      <div class="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3 lg:p-4">
        <div class="text-xs text-[var(--color-text-muted)]">Completed today</div>
        <div class="text-xl lg:text-2xl font-bold">{{ completedToday }}</div>
      </div>
      <div class="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3 lg:p-4 col-span-2 lg:col-span-1">
        <div class="text-xs text-[var(--color-text-muted)]">Missed today</div>
        <div :class="['text-xl lg:text-2xl font-bold', missed.length ? 'text-amber-700' : '']">{{ missed.length }}</div>
      </div>
    </div>

    <div class="grid lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">
        <!-- Waiting -->
        <section aria-labelledby="waiting-title">
          <h2 id="waiting-title" class="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Waiting for a driver</h2>
          <p v-if="loaded && !waiting.length" class="rounded-xl border border-dashed border-[var(--color-border)] p-5 text-sm text-[var(--color-text-muted)]">No one is waiting. New requests appear here instantly.</p>
          <ul class="space-y-3">
            <li v-for="r in waiting" :key="r.id" class="rounded-xl bg-[var(--color-surface)] border-2 border-[#2b8659]/40 p-4">
              <div class="flex flex-wrap items-start justify-between gap-2 mb-1">
                <div>
                  <div class="font-semibold">{{ riderName(r) }} <span v-if="r.passenger_name" class="font-normal text-[var(--color-text-muted)]">for {{ r.passenger_name }}</span></div>
                  <a v-if="riderPhone(r)" :href="tel(riderPhone(r))" class="text-sm text-[var(--color-brand)] font-medium">📞 {{ formatPhone(riderPhone(r)) || riderPhone(r) }}</a>
                </div>
                <div class="text-right">
                  <div class="font-bold">{{ formatFare(r.fare_cents) }}</div>
                  <div :class="['text-xs font-semibold', waitTone(r)]">Waiting {{ elapsed(r.created_at, now) }}</div>
                </div>
              </div>
              <p class="text-sm text-[var(--color-text-secondary)] mb-3">{{ short(r.pickup_address) }} → {{ short(r.dropoff_address) }} <span v-if="r.vehicle_type && r.vehicle_type !== 'standard'" class="ml-1 text-xs font-semibold uppercase">{{ r.vehicle_type }}</span></p>
              <div class="flex flex-wrap items-start gap-2">
                <AdminRideActions :ride="r" @done="load" class="flex-1" />
                <button @click="selected = r" class="h-9 px-3 rounded-lg border border-[var(--color-border)] text-sm font-semibold">Details</button>
              </div>
            </li>
          </ul>
        </section>

        <!-- Under way -->
        <section aria-labelledby="underway-title">
          <h2 id="underway-title" class="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Trips under way</h2>
          <p v-if="loaded && !underway.length" class="rounded-xl border border-dashed border-[var(--color-border)] p-5 text-sm text-[var(--color-text-muted)]">No trips right now.</p>
          <ul class="space-y-3">
            <li v-for="r in underway" :key="r.id" class="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4">
              <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span :class="['text-xs font-semibold px-2 py-0.5 rounded-full', STAGE[r.status].tone]">{{ STAGE[r.status].label }} · {{ since(r) }}</span>
                <span class="font-bold">{{ formatFare(r.fare_cents) }}</span>
              </div>
              <p class="text-sm mb-2">{{ short(r.pickup_address) }} → {{ short(r.dropoff_address) }}</p>
              <div class="grid sm:grid-cols-2 gap-2 text-sm mb-3">
                <div><span class="text-[var(--color-text-muted)]">Rider</span> {{ riderName(r) }}
                  <a v-if="riderPhone(r)" :href="tel(riderPhone(r))" class="ml-1 text-[var(--color-brand)] font-medium">Call</a></div>
                <div><span class="text-[var(--color-text-muted)]">Driver</span> {{ r.drivers?.name || '—' }}
                  <a v-if="r.drivers?.phone" :href="tel(r.drivers.phone)" class="ml-1 text-[var(--color-brand)] font-medium">Call</a></div>
              </div>
              <div class="flex flex-wrap items-start gap-2">
                <AdminRideActions :ride="r" @done="load" class="flex-1" />
                <button @click="selected = r" class="h-9 px-3 rounded-lg border border-[var(--color-border)] text-sm font-semibold">Details</button>
              </div>
            </li>
          </ul>
        </section>

        <!-- Missed -->
        <section aria-labelledby="missed-title">
          <h2 id="missed-title" class="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Missed today</h2>
          <p class="text-xs text-[var(--color-text-muted)] mb-2">Requests no driver took. The rider was told no cars were available. A quick call can still win the ride.</p>
          <p v-if="loaded && !missed.length" class="rounded-xl border border-dashed border-[var(--color-border)] p-5 text-sm text-[var(--color-text-muted)]">None today.</p>
          <ul class="space-y-2">
            <li v-for="r in missed" :key="r.id" class="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3 flex flex-wrap items-center gap-3 text-sm">
              <div class="flex-1 min-w-[12rem]">
                <div class="font-semibold">{{ riderName(r) }} <span class="font-normal text-[var(--color-text-muted)]">· {{ timeOf(r.created_at) }}</span></div>
                <div class="text-[var(--color-text-secondary)]">{{ short(r.pickup_address) }} → {{ short(r.dropoff_address) }} · {{ formatFare(r.fare_cents) }}</div>
              </div>
              <a v-if="riderPhone(r)" :href="tel(riderPhone(r))" class="h-9 px-3 inline-flex items-center rounded-lg bg-[#2b8659] text-white font-semibold">📞 Call back</a>
              <button @click="selected = r" class="h-9 px-3 rounded-lg border border-[var(--color-border)] font-semibold">Details</button>
            </li>
          </ul>
        </section>
      </div>

      <!-- Drivers + alerts -->
      <aside class="space-y-6" aria-label="Ride alerts and drivers">
        <AdminAlertsCard />
        <section aria-labelledby="drivers-title">
          <h2 id="drivers-title" class="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Drivers</h2>
          <ul class="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
            <li v-for="d in onlineDrivers" :key="d.id" class="flex items-center gap-3 p-3 text-sm">
              <span :class="['w-2.5 h-2.5 rounded-full shrink-0', driverState(d) === 'trip' ? 'bg-amber-500' : driverState(d) === 'online' ? 'bg-[#34d399]' : 'bg-[var(--color-text-muted)]']" aria-hidden="true"></span>
              <div class="flex-1 min-w-0">
                <div class="font-medium truncate">{{ d.name }}</div>
                <div class="text-xs text-[var(--color-text-muted)]">
                  {{ driverState(d) === 'trip' ? 'On a trip' : driverState(d) === 'online' ? 'Online, app open' : `In the background · seen ${elapsed(d.last_seen_at, now)} ago` }}
                </div>
              </div>
              <a v-if="d.phone" :href="tel(d.phone)" class="text-[var(--color-brand)] font-semibold">Call</a>
            </li>
            <li v-if="loaded && !onlineDrivers.length" class="p-3 text-sm text-[var(--color-text-muted)]">No drivers online. Riders see “No cars available”.</li>
          </ul>
          <details v-if="offlineDrivers.length" class="mt-2 text-sm">
            <summary class="cursor-pointer text-[var(--color-text-secondary)] py-1">{{ offlineDrivers.length }} offline</summary>
            <ul class="mt-1 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
              <li v-for="d in offlineDrivers" :key="d.id" class="flex items-center gap-3 p-3">
                <span class="flex-1 truncate">{{ d.name }}</span>
                <a v-if="d.phone" :href="tel(d.phone)" class="text-[var(--color-brand)] font-semibold">Call</a>
              </li>
            </ul>
          </details>
        </section>
      </aside>
    </div>

    <AdminRideSheet :ride="selected" @close="selected = null" @changed="load" />
  </div>
</template>
