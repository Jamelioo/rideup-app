<template>
  <div>
    <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-6">Driver Management</h1>

    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
      <div class="flex flex-wrap gap-1 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-1" role="group" aria-label="Filter drivers">
        <button v-for="tab in filterTabs" :key="tab" @click="activeFilter = tab" :aria-pressed="activeFilter === tab"
                :class="['px-3.5 py-2 min-w-[44px] text-sm font-medium rounded-md transition-colors whitespace-nowrap',
                         activeFilter === tab ? 'bg-[#2b8659] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]']">
          {{ tab }}
          <span v-if="tab === 'Pending' && pendingCount > 0" class="ml-1 bg-yellow-400 text-yellow-900 text-xs px-1.5 py-0.5 rounded-full">{{ pendingCount }}</span>
        </button>
      </div>
      <input v-model="search" type="search" placeholder="Search name, plate, phone…" aria-label="Search drivers"
             class="px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[#2b8659]/30 w-full sm:w-64" />
    </div>

    <p v-if="loadError" class="mb-4 text-sm text-[var(--color-danger)]" role="alert">{{ loadError }}</p>

    <div class="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm stack-table">
          <thead>
            <tr class="text-left text-[var(--color-text-muted)] text-xs uppercase tracking-wider bg-[var(--color-surface-secondary)]">
              <th class="px-4 py-3 font-medium">Name</th>
              <th class="px-4 py-3 font-medium">Vehicle</th>
              <th class="px-4 py-3 font-medium">Status</th>
              <th class="px-4 py-3 font-medium">Rating</th>
              <th class="px-4 py-3 font-medium">Trips</th>
              <th class="px-4 py-3 font-medium">Balance owed</th>
              <th class="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in filteredDrivers" :key="d.id" class="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-secondary)]">
              <td data-label="Name" class="px-4 py-3 text-[var(--color-text-primary)] font-medium">{{ d.name }}</td>
              <td data-label="Vehicle" class="px-4 py-3 text-[var(--color-text-secondary)]">{{ d.vehicle }} <span v-if="d.plate" class="font-semibold text-[var(--color-text-primary)]">· {{ d.plate }}</span></td>
              <td data-label="Status" class="px-4 py-3">
                <span :class="badge(d.status)">{{ d.status }}</span>
                <span v-if="d.expired" class="ml-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700">Docs expired</span>
              </td>
              <td data-label="Rating" class="px-4 py-3 text-[var(--color-text-primary)]">
                {{ d.trips > 0 ? Number(d.rating).toFixed(2) : '--' }}
                <span v-if="d.trips >= 10 && Number(d.rating) < LOW_RATING" class="ml-1 text-[11px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-700" title="Average of recent ratings is below the review threshold">Review</span>
              </td>
              <td data-label="Trips" class="px-4 py-3 text-[var(--color-text-primary)]">{{ d.trips }}</td>
              <td data-label="Balance owed" class="px-4 py-3 text-[var(--color-text-primary)] font-medium">{{ isAdmin ? formatFare(d.balance) : '—' }}</td>
              <td data-label="Actions" class="px-4 py-3">
                <button @click="openReview(d)" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#2b8659] text-white hover:bg-[#236e49]">
                  {{ d.status === 'Pending' ? 'Review' : 'Details' }}
                </button>
              </td>
            </tr>
            <tr v-if="!loading && filteredDrivers.length === 0">
              <td colspan="7" class="px-4 py-8 text-center text-[var(--color-text-muted)]">No drivers found.</td>
            </tr>
            <tr v-if="loading">
              <td colspan="7" class="px-4 py-8 text-center text-[var(--color-text-muted)]">Loading…</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Review drawer -->
    <div v-if="review" v-modal="() => (review = null)" class="fixed inset-0 z-[200] flex justify-end bg-black/40" @click.self="review = null" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <div class="w-full max-w-lg h-full overflow-y-auto bg-[var(--color-surface)] text-[var(--color-text-primary)] p-6">
        <div class="flex items-center justify-between mb-5">
          <h2 id="review-title" class="text-xl font-bold">{{ review.name }}</h2>
          <button @click="review = null" class="w-11 h-11 rounded-full hover:bg-[var(--color-surface-secondary)]" aria-label="Close">✕</button>
        </div>

        <div class="flex items-center gap-4 mb-5">
          <div class="w-16 h-16 rounded-full overflow-hidden bg-[var(--color-surface-secondary)] flex items-center justify-center text-lg font-bold">
            <img v-if="review.raw.photo_url" :src="review.raw.photo_url" :alt="`Photo of ${review.name}`" class="w-full h-full object-cover" />
            <span v-else>{{ review.name.charAt(0) }}</span>
          </div>
          <div class="text-sm space-y-0.5">
            <div><span :class="badge(review.status)">{{ review.status }}</span></div>
            <div class="text-[var(--color-text-secondary)]">{{ formatPhone(review.raw.phone) || 'No phone' }} · {{ review.raw.email || 'No email' }}</div>
            <div class="text-[var(--color-text-secondary)]">{{ review.vehicle }} · {{ review.raw.vehicle_type === 'xl' ? 'XL' : 'Standard' }}</div>
            <div class="text-[var(--color-text-secondary)]">Plate <strong>{{ review.raw.license_plate || '—' }}</strong> · Licence # {{ review.raw.license_number || '—' }}</div>
          </div>
        </div>

        <h3 class="text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">Approval checklist</h3>
        <ul class="mb-5 space-y-1.5 text-sm">
          <li v-for="item in checklist" :key="item.label" class="flex items-center gap-2">
            <span :class="item.ok ? 'text-[var(--color-brand)]' : 'text-[var(--color-danger)]'" aria-hidden="true">{{ item.ok ? '✓' : '✗' }}</span>
            <span>{{ item.label }}</span>
          </li>
        </ul>

        <AdminNotes subject-type="driver" :subject-id="review.id" />
        <p v-if="!isAdmin" class="text-sm text-[var(--color-text-muted)]">Only admins can see documents, edit, approve or suspend drivers.</p>

        <template v-if="isAdmin">
        <h3 class="text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">Documents</h3>
        <div class="mb-5 space-y-2 text-sm">
          <div v-for="doc in DOCS" :key="doc.key" class="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2">
            <span>{{ doc.label }}</span>
            <a v-if="docs[doc.key]" :href="docs[doc.key]" target="_blank" rel="noopener" class="font-semibold text-[var(--color-brand)]">View</a>
            <span v-else class="text-[var(--color-text-muted)]">{{ docsLoading ? 'Checking…' : 'Not uploaded' }}</span>
          </div>
        </div>

        <h3 class="text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">Driver and vehicle</h3>
        <p class="text-[12px] text-[var(--color-text-muted)] mb-2">What riders see when this driver is on the way. Your changes don’t send the driver back for review.</p>
        <div class="grid grid-cols-2 gap-3 mb-5 text-sm">
          <label class="flex flex-col gap-1 col-span-2">Name
            <input v-model="form.name" autocomplete="off" maxlength="80" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
          </label>
          <label class="flex flex-col gap-1">Phone
            <input v-model="form.phone" type="tel" inputmode="tel" autocomplete="off" placeholder="(242) 555-0100" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
          </label>
          <label class="flex flex-col gap-1">Licence number
            <input v-model="form.license_number" autocomplete="off" maxlength="40" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
          </label>
          <label class="flex flex-col gap-1">Make
            <input v-model="form.vehicle_make" autocomplete="off" maxlength="40" placeholder="Toyota" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
          </label>
          <label class="flex flex-col gap-1">Model
            <input v-model="form.vehicle_model" autocomplete="off" maxlength="40" placeholder="Corolla" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
          </label>
          <label class="flex flex-col gap-1">Year
            <input v-model="form.vehicle_year" type="number" inputmode="numeric" min="1990" :max="maxYear" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
          </label>
          <label class="flex flex-col gap-1">Colour
            <input v-model="form.vehicle_color" autocomplete="off" maxlength="30" placeholder="Grey" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
          </label>
          <label class="flex flex-col gap-1 col-span-2">Licence plate
            <input v-model="form.license_plate" autocomplete="off" maxlength="15" placeholder="NP 1234" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] uppercase" />
          </label>
        </div>

        <h3 class="text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">Verification</h3>
        <div class="grid grid-cols-2 gap-3 mb-3 text-sm">
          <label class="flex flex-col gap-1">Licence expires
            <input v-model="form.license_expires_on" type="date" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
          </label>
          <label class="flex flex-col gap-1">Insurance expires
            <input v-model="form.insurance_expires_on" type="date" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
          </label>
        </div>
        <label class="flex flex-col gap-1 text-sm mb-3">Vehicle class
          <select v-model="form.vehicle_type" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <option value="standard">Go (standard, 4 seats)</option>
            <option value="xl">XL (6+ seats)</option>
            <option value="premium">Premium (newer, high-end vehicle)</option>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-sm mb-3">Background check
          <select v-model="form.background_check_status" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <option value="not_started">Not started</option>
            <option value="pending">In progress</option>
            <option value="clear">Clear</option>
            <option value="failed">Failed</option>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-sm mb-4">Review note (shared with the driver if rejected)
          <textarea v-model="form.review_note" rows="3" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"></textarea>
        </label>

        <p v-if="actionError" class="mb-3 text-sm text-[var(--color-danger)]" role="alert">{{ actionError }}</p>
        <p v-if="actionDone" class="mb-3 text-sm text-[var(--color-brand)]" role="status">{{ actionDone }}</p>

        <div class="flex flex-wrap gap-2">
          <button @click="saveDetails" :disabled="saving" class="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-semibold disabled:opacity-50">Save details</button>
          <template v-if="review.status === 'Pending' || review.status === 'Rejected'">
            <button @click="approve" :disabled="saving" class="px-4 py-2 rounded-lg bg-[#2b8659] text-white text-sm font-semibold disabled:opacity-50">
              {{ checklistComplete ? 'Approve' : 'Approve anyway' }}
            </button>
            <button v-if="review.status === 'Pending'" @click="reject" :disabled="saving" class="px-4 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold disabled:opacity-50">Reject</button>
          </template>
          <button v-else-if="review.status === 'Approved'" @click="setStatus(false, 'suspended', 'Suspended')" :disabled="saving" class="px-4 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold disabled:opacity-50">Suspend</button>
          <button v-else-if="review.status === 'Suspended'" @click="setStatus(true, 'offline', 'Approved')" :disabled="saving" class="px-4 py-2 rounded-lg bg-green-50 text-[var(--color-brand)] text-sm font-semibold disabled:opacity-50">Reinstate</button>
        </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { apiPost } from '../../lib/api'
import { formatFare } from '../../lib/pricing'
import { DEMO_MODE } from '../../lib/demoMode'
import { listDriverDocs } from '../../lib/driverDocs'
import { toE164, formatPhone } from '../../lib/phone'
import { useStaffRole } from '../../lib/staff'
import AdminNotes from '../../components/AdminNotes.vue'

const { isAdmin } = useStaffRole()

// Like Uber, a sustained low average (recent trips) flags a driver for a quality review.
const LOW_RATING = 4.6

const filterTabs = ['All', 'Pending', 'Approved', 'Rejected', 'Suspended']
const DOCS = [
  { key: 'drivers_license', label: 'Driver’s licence' },
  { key: 'vehicle_registration', label: 'Vehicle registration' },
  { key: 'insurance', label: 'Insurance certificate' },
  { key: 'vehicle_photo', label: 'Vehicle photo' },
]
const activeFilter = ref('All')
const search = ref('')
const loading = ref(!DEMO_MODE)
const loadError = ref('')

// Sample rows only in demo mode; a real backend never shows invented drivers.
const drivers = ref(DEMO_MODE ? [
  { id: 'd1', name: 'Deon Rolle', vehicle: '2024 Toyota Camry — White', plate: 'NP 2041', status: 'Approved', rating: 4.9, trips: 312, balance: 18450, expired: false, raw: { name: 'Deon Rolle', phone: '+12425550141', vehicle_year: 2024, vehicle_make: 'Toyota', vehicle_model: 'Camry', vehicle_color: 'White', license_plate: 'NP 2041', license_number: 'BH-448812', vehicle_type: 'standard' } },
  { id: 'd2', name: 'Terrence Knowles', vehicle: '2025 Kia K5 — Blue', plate: 'NP 7710', status: 'Pending', rating: 5, trips: 0, balance: 0, expired: false, raw: { name: 'Terrence Knowles', phone: '+12425550177', vehicle_year: 2025, vehicle_make: 'Kia', vehicle_model: 'K5', vehicle_color: 'Blue', license_plate: 'NP 7710', license_number: 'BH-902231', vehicle_type: 'standard' } },
  { id: 'd3', name: 'Lionel Forbes', vehicle: '2021 Nissan Sentra — Silver', plate: 'NP 1185', status: 'Suspended', rating: 3.1, trips: 42, balance: 2100, expired: true, raw: { name: 'Lionel Forbes', phone: '+12425550119', vehicle_year: 2021, vehicle_make: 'Nissan', vehicle_model: 'Sentra', vehicle_color: 'Silver', license_plate: 'NP 1185', license_number: 'BH-117450', vehicle_type: 'standard' } },
] : [])

const today = () => new Date().toISOString().slice(0, 10)

function statusOf(d) {
  if (d.approved) return 'Approved'
  if (d.status === 'rejected') return 'Rejected'
  if (d.status === 'suspended') return 'Suspended'
  return 'Pending'
}

function toRow(d, balances) {
  return {
    id: d.id,
    name: d.name || 'Unknown',
    vehicle: [d.vehicle_year, d.vehicle_make, d.vehicle_model].filter(Boolean).join(' ') + (d.vehicle_color ? ` — ${d.vehicle_color}` : '') || 'N/A',
    plate: d.license_plate,
    status: statusOf(d),
    rating: d.rating ?? 5,
    trips: d.total_trips || d.total_rides || 0,
    balance: balances[d.id] ?? 0,
    expired: (d.license_expires_on && d.license_expires_on < today()) || (d.insurance_expires_on && d.insurance_expires_on < today()),
    raw: d,
  }
}

const pendingCount = computed(() => drivers.value.filter((d) => d.status === 'Pending').length)
const filteredDrivers = computed(() => {
  let list = drivers.value
  if (activeFilter.value !== 'All') list = list.filter((d) => d.status === activeFilter.value)
  const q = search.value.trim().toLowerCase()
  if (q) list = list.filter((d) => [d.name, d.plate, d.raw.phone, d.raw.email].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
  return list
})

function badge(status) {
  const base = 'text-xs font-medium px-2 py-0.5 rounded-full'
  return {
    Approved: `${base} bg-green-50 text-green-700`,
    Pending: `${base} bg-yellow-50 text-yellow-800`,
    Rejected: `${base} bg-red-50 text-red-700`,
  }[status] || `${base} bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]`
}

async function load() {
  if (!supabaseConfigured || DEMO_MODE) { loading.value = false; return }
  loading.value = true
  loadError.value = ''
  const [{ data, error }, { data: bal }] = await Promise.all([
    supabase.from('drivers').select('*').order('created_at', { ascending: false }),
    isAdmin.value ? supabase.rpc('admin_driver_balances') : { data: [] }, // money: admins only
  ])
  if (error) loadError.value = 'Could not load drivers. If you were just added to the team, sign out and back in.'
  const balances = Object.fromEntries((bal || []).map((b) => [b.driver_id, Number(b.balance_cents) || 0]))
  drivers.value = (data || []).map((d) => toRow(d, balances))
  loading.value = false
}
onMounted(load)

// ── Review drawer ──
const review = ref(null)
const docs = reactive({})
const docsLoading = ref(false)
const saving = ref(false)
const actionError = ref('')
const actionDone = ref('')
const form = reactive({
  license_expires_on: '', insurance_expires_on: '', background_check_status: 'not_started', review_note: '', vehicle_type: 'standard',
  name: '', phone: '', license_number: '', vehicle_make: '', vehicle_model: '', vehicle_year: '', vehicle_color: '', license_plate: '',
})
const maxYear = new Date().getFullYear() + 1

async function openReview(d) {
  review.value = d
  actionError.value = ''
  actionDone.value = ''
  Object.assign(form, {
    license_expires_on: d.raw.license_expires_on || '',
    insurance_expires_on: d.raw.insurance_expires_on || '',
    background_check_status: d.raw.background_check_status || 'not_started',
    review_note: d.raw.review_note || '',
    vehicle_type: d.raw.vehicle_type || 'standard',
    name: d.raw.name || d.name || '',
    phone: formatPhone(d.raw.phone) || '',
    license_number: d.raw.license_number || '',
    vehicle_make: d.raw.vehicle_make || '',
    vehicle_model: d.raw.vehicle_model || '',
    vehicle_year: d.raw.vehicle_year || '',
    vehicle_color: d.raw.vehicle_color || '',
    license_plate: d.raw.license_plate || d.plate || '',
  })
  for (const k of Object.keys(docs)) delete docs[k]
  if (DEMO_MODE || !d.raw.auth_user_id || !isAdmin.value) return
  docsLoading.value = true
  try {
    const files = await listDriverDocs(d.raw.auth_user_id)
    for (const [key, f] of Object.entries(files)) {
      const { data: signed } = await supabase.storage.from('documents').createSignedUrl(f.path, 600)
      if (signed?.signedUrl) docs[key] = signed.signedUrl
    }
  } catch (err) {
    actionError.value = `Couldn’t load documents: ${err.message}`
  }
  docsLoading.value = false
}

const checklist = computed(() => [
  { label: 'All four documents uploaded', ok: DOCS.every((d) => docs[d.key]) },
  { label: 'Driver photo on profile', ok: !!review.value?.raw.photo_url },
  { label: 'Licence expiry recorded and valid', ok: !!form.license_expires_on && form.license_expires_on >= today() },
  { label: 'Insurance expiry recorded and valid', ok: !!form.insurance_expires_on && form.insurance_expires_on >= today() },
  { label: 'Background check clear', ok: form.background_check_status === 'clear' },
])
const checklistComplete = computed(() => checklist.value.every((c) => c.ok))

async function update(fields) {
  if ('name' in fields) {
    const problem = detailsProblem()
    if (problem) { actionError.value = problem; return false }
  }
  if (DEMO_MODE) return true
  const { error } = await supabase.from('drivers').update(fields).eq('id', review.value.id)
  if (error) { actionError.value = error.message; return false }
  return true
}

// Checks the driver and vehicle fields; returns an error message or ''.
function detailsProblem() {
  if (!form.name.trim()) return 'Enter the driver’s name.'
  if (form.phone.trim() && !toE164(form.phone)) return 'Enter a valid phone number, for example (242) 555-0100.'
  const year = String(form.vehicle_year).trim()
  if (year && !(Number.isInteger(+year) && +year >= 1990 && +year <= maxYear)) return `Enter a vehicle year between 1990 and ${maxYear}.`
  return ''
}

const clean = (v) => String(v ?? '').trim() || null

function detailFields() {
  return {
    name: form.name.trim(),
    phone: form.phone.trim() ? toE164(form.phone) : null,
    license_number: clean(form.license_number),
    vehicle_make: clean(form.vehicle_make),
    vehicle_model: clean(form.vehicle_model),
    vehicle_year: String(form.vehicle_year).trim() ? +form.vehicle_year : null,
    vehicle_color: clean(form.vehicle_color),
    license_plate: clean(form.license_plate)?.toUpperCase().replace(/\s+/g, ' ') ?? null,
    license_expires_on: form.license_expires_on || null,
    insurance_expires_on: form.insurance_expires_on || null,
    background_check_status: form.background_check_status,
    review_note: form.review_note.trim() || null,
    vehicle_type: form.vehicle_type,
  }
}

async function saveDetails() {
  saving.value = true
  actionError.value = ''
  if (await update(detailFields())) { actionDone.value = 'Saved.'; await load() }
  saving.value = false
}

async function approve() {
  if (!checklistComplete.value && !window.confirm('Some checks are incomplete. Approve this driver anyway?')) return
  saving.value = true
  if (await update({ ...detailFields(), approved: true, status: 'offline' })) {
    apiPost('/api/notify-driver', { driverId: review.value.id, type: 'approved' }).catch(() => {})
    actionDone.value = 'Approved. The driver has been notified.'
    await load()
    review.value = drivers.value.find((d) => d.id === review.value.id) || null
  }
  saving.value = false
}

async function reject() {
  if (!form.review_note.trim() && !window.confirm('Reject without a note explaining why?')) return
  saving.value = true
  if (await update({ ...detailFields(), approved: false, status: 'rejected' })) {
    apiPost('/api/notify-driver', { driverId: review.value.id, type: 'rejected' }).catch(() => {})
    actionDone.value = 'Rejected. The driver has been notified.'
    await load()
    review.value = null
  }
  saving.value = false
}

async function setStatus(approved, status, label) {
  if (label === 'Suspended' && !window.confirm('Suspend this driver? They will be taken offline immediately.')) return
  saving.value = true
  if (await update({ approved, status })) {
    actionDone.value = `${label}.`
    await load()
    review.value = drivers.value.find((d) => d.id === review.value.id) || null
  }
  saving.value = false
}
</script>
