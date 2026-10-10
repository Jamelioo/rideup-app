<script setup>
import { ref, computed, watch } from 'vue'
import { apiPost } from '../lib/api'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { DEMO_MODE } from '../lib/demoMode'

// What the team can do with a live ride: give a waiting request to a driver, cancel it (no charge), or end a
// trip that's under way but stuck (charges the fare). Used on Admin › Live and in the ride panel.
const props = defineProps({ ride: { type: Object, required: true } })
const emit = defineEmits(['done'])

const ACTIVE = ['pending_driver_response', 'accepted', 'driver_arrived', 'in_progress']
const busy = ref(false)
const error = ref('')
const notice = ref('')
const picking = ref(false)
const drivers = ref([])
const chosen = ref('')

const canAssign = computed(() => props.ride.status === 'requested' && !props.ride.driver_id)
const canCancel = computed(() => props.ride.status === 'requested' || ACTIVE.includes(props.ride.status))
const canComplete = computed(() => props.ride.status === 'in_progress')
const CLASSES_FOR = { standard: ['standard', 'xl', 'premium'], xl: ['xl'], premium: ['premium'] }

watch(() => props.ride.id, () => { error.value = ''; notice.value = ''; picking.value = false })

const ago = (iso) => {
  if (!iso) return 'never'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  return min < 1 ? 'just now' : min < 60 ? `${min} min ago` : `${Math.round(min / 60)} h ago`
}

async function openPicker() {
  picking.value = true
  chosen.value = ''
  error.value = ''
  if (DEMO_MODE || !supabaseConfigured) {
    drivers.value = [{ id: 'demo', name: 'Deon Rolle', vehicle_type: 'standard', status: 'online', last_seen_at: new Date().toISOString(), busy: false }]
    return
  }
  const [{ data: list }, { data: active }] = await Promise.all([
    supabase.from('drivers').select('id, name, phone, vehicle_type, status, last_seen_at').eq('approved', true).is('deleted_at', null).order('name'),
    supabase.from('rides').select('driver_id').in('status', ACTIVE).not('driver_id', 'is', null),
  ])
  const busyIds = new Set((active || []).map((r) => r.driver_id))
  const classes = CLASSES_FOR[props.ride.vehicle_type] || CLASSES_FOR.standard
  drivers.value = (list || [])
    .filter((d) => classes.includes(d.vehicle_type || 'standard'))
    .map((d) => ({ ...d, busy: busyIds.has(d.id) }))
    .sort((a, b) => Number(a.busy) - Number(b.busy) || Number(b.status === 'online') - Number(a.status === 'online'))
}

async function call(path, body, okText) {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    if (DEMO_MODE) { notice.value = okText; picking.value = false; emit('done'); return }
    const res = await apiPost(path, body)
    const out = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(out.error || 'That didn’t work. Try again.')
    notice.value = okText
    picking.value = false
    emit('done')
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

function assign() {
  const d = drivers.value.find((x) => x.id === chosen.value)
  if (!d) { error.value = 'Choose a driver.'; return }
  if (!window.confirm(`Give this trip to ${d.name}? The rider’s card is held now and ${d.name.split(' ')[0]} gets a notification to head to the pickup.`)) return
  call('/api/admin-assign', { rideId: props.ride.id, driverId: d.id }, `Assigned to ${d.name}. The rider and driver were notified.`)
}
function cancel() {
  const what = props.ride.status === 'requested' ? 'this request' : 'this trip'
  if (!window.confirm(`Cancel ${what}? The rider isn’t charged and any card hold is released. The rider and driver are both told.`)) return
  call('/api/cancel-ride', { rideId: props.ride.id }, 'Cancelled. Nobody was charged.')
}
function complete() {
  const cash = props.ride.payment_method === 'cash'
  if (!window.confirm(cash
    ? 'End this cash trip now? Use this when the trip is over but the driver couldn’t complete it (phone died, no signal). The cash counts as collected and the rider gets their receipt.'
    : 'End this trip now and charge the fare? Use this when the trip is over but the driver couldn’t complete it (phone died, no signal). The rider gets their receipt.')) return
  call('/api/admin-complete', { rideId: props.ride.id }, cash ? 'Trip completed; cash counted as collected.' : 'Trip completed and the fare charged.')
}
</script>

<template>
  <div v-if="canAssign || canCancel || canComplete || notice" class="space-y-2">
    <div class="flex flex-wrap gap-2">
      <button v-if="canAssign && !picking" @click="openPicker" :disabled="busy" class="h-9 px-3 rounded-lg bg-[#2b8659] text-white text-sm font-semibold disabled:opacity-50">Assign driver</button>
      <button v-if="canComplete" @click="complete" :disabled="busy" class="h-9 px-3 rounded-lg bg-[var(--color-text-primary)] text-[var(--color-surface)] text-sm font-semibold disabled:opacity-50">{{ ride.payment_method === 'cash' ? 'Complete' : 'Complete &amp; charge' }}</button>
      <button v-if="canCancel" @click="cancel" :disabled="busy" class="h-9 px-3 rounded-lg text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50">
        {{ ride.status === 'requested' ? 'Cancel request' : 'Cancel trip' }}
      </button>
    </div>

    <div v-if="picking" class="rounded-xl border border-[var(--color-border)] p-3">
      <p class="text-sm font-semibold mb-2">Give this trip to</p>
      <p v-if="!drivers.length" class="text-sm text-[var(--color-text-muted)]">No approved drivers for this trip type.</p>
      <ul v-else class="max-h-56 overflow-y-auto space-y-1" role="radiogroup" aria-label="Driver">
        <li v-for="d in drivers" :key="d.id">
          <label :class="['flex items-center gap-2 rounded-lg px-2 py-2 text-sm', d.busy ? 'opacity-50' : 'hover:bg-[var(--color-surface-secondary)] cursor-pointer']">
            <input type="radio" name="assign-driver" :value="d.id" v-model="chosen" :disabled="d.busy" />
            <span class="font-medium">{{ d.name }}</span>
            <span class="ml-auto text-xs text-[var(--color-text-muted)]">
              {{ d.busy ? 'On a trip' : d.status === 'online' ? `Online · ${ago(d.last_seen_at)}` : 'Offline' }}
            </span>
          </label>
        </li>
      </ul>
      <p class="mt-2 text-xs text-[var(--color-text-muted)]">An offline driver gets the trip when they next open RideUp, so call them first.</p>
      <div class="mt-2 flex gap-2">
        <button @click="assign" :disabled="busy || !chosen" class="h-9 px-3 rounded-lg bg-[#2b8659] text-white text-sm font-semibold disabled:opacity-50">{{ busy ? 'Assigning…' : 'Assign' }}</button>
        <button @click="picking = false" class="h-9 px-3 rounded-lg border border-[var(--color-border)] text-sm font-semibold">Back</button>
      </div>
    </div>

    <p v-if="error" class="text-sm text-[var(--color-danger)]" role="alert">{{ error }}</p>
    <p v-if="notice" class="text-sm text-[var(--color-brand)]" role="status">{{ notice }}</p>
  </div>
</template>
