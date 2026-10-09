<template>
  <div>
    <p v-if="actionError && !open" class="mb-4 text-sm text-[var(--color-danger)]" role="alert">{{ actionError }}</p>
    <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-6">User Management</h1>

    <!-- Search + filter -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
      <div class="flex flex-wrap gap-1 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-1">
        <button
          v-for="tab in filterTabs"
          :key="tab"
          @click="activeFilter = tab"
          :aria-pressed="activeFilter === tab"
          :class="[
            'px-3.5 py-2 min-w-[44px] text-sm font-medium rounded-md transition-colors',
            activeFilter === tab
              ? 'bg-[#2b8659] text-white'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]'
          ]"
        >
          {{ tab }}<span v-if="tab === 'Never booked' && neverBookedCount" class="ml-1 opacity-80">({{ neverBookedCount }})</span>
        </button>
      </div>
      <input
        v-model="search"
        type="search"
        placeholder="Search users…"
        aria-label="Search users"
        class="px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[#2b8659]/30 focus:border-[#2b8659] w-full sm:w-64"
      />
    </div>
    <p v-if="activeFilter === 'Never booked'" class="mb-3 text-[13px] text-[var(--color-text-secondary)]">
      Signed up but haven't requested a ride yet. Open someone to send them a welcome offer.
    </p>

    <!-- Table -->
    <div class="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm stack-table">
          <thead>
            <tr class="text-left text-[var(--color-text-muted)] text-xs uppercase tracking-wider bg-[var(--color-surface-secondary)]">
              <th class="px-4 py-3 font-medium">Name</th>
              <th class="px-4 py-3 font-medium">Email</th>
              <th class="px-4 py-3 font-medium">Phone</th>
              <th class="px-4 py-3 font-medium">Rides</th>
              <th class="px-4 py-3 font-medium">Rating</th>
              <th class="px-4 py-3 font-medium">Joined</th>
              <th class="px-4 py-3 font-medium">Status</th>
              <th class="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="user in filteredUsers"
              :key="user.id"
              class="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-secondary)] transition-colors"
            >
              <td data-label="Name" class="px-4 py-3 text-[var(--color-text-primary)] font-medium">
                <button @click="openUser(user)" class="font-medium text-left hover:underline">{{ user.name }}</button>
                <span v-if="user.guest" class="ml-1 text-xs font-medium px-1.5 py-0.5 rounded bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">Guest</span>
              </td>
              <td data-label="Email" class="px-4 py-3 text-[var(--color-text-muted)]">{{ user.email || '—' }}</td>
              <td data-label="Phone" class="px-4 py-3 text-[var(--color-text-muted)]">{{ user.phoneText || '—' }}</td>
              <td data-label="Rides" class="px-4 py-3 text-[var(--color-text-primary)]">{{ user.rides }}</td>
              <td data-label="Rating" class="px-4 py-3 text-[var(--color-text-primary)]">{{ user.rating.toFixed(1) }}</td>
              <td data-label="Joined" class="px-4 py-3 text-[var(--color-text-muted)] text-xs">{{ user.joined }}</td>
              <td data-label="Status" class="px-4 py-3">
                <span :class="statusClass(user.status)" class="text-xs font-medium px-2 py-0.5 rounded-full">{{ user.status }}</span>
              </td>
              <td data-label="Action" class="px-4 py-3">
                <button @click="openUser(user)" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-surface-secondary)] hover:bg-[var(--color-border)] transition-colors">Details</button>
              </td>
            </tr>
            <tr v-if="filteredUsers.length === 0">
              <td colspan="8" class="px-4 py-8 text-center text-[var(--color-text-muted)]">No users found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Rider detail panel -->
    <div v-if="open" v-modal="close" class="fixed inset-0 z-[200] flex justify-end bg-black/40" @click.self="close" role="dialog" aria-modal="true" aria-labelledby="rider-title">
      <div class="w-full max-w-md h-full overflow-y-auto bg-[var(--color-surface)] text-[var(--color-text-primary)] p-6">
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 id="rider-title" class="text-xl font-bold">{{ open.name }}</h2>
            <div class="mt-1 flex flex-wrap gap-1.5">
              <span :class="statusClass(open.status)" class="text-xs font-medium px-2 py-0.5 rounded-full">{{ open.status }}</span>
              <span v-if="open.guest" class="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">Guest</span>
              <span v-if="!open.booked" class="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">Never booked</span>
            </div>
          </div>
          <button @click="close" class="w-11 h-11 shrink-0 rounded-full hover:bg-[var(--color-surface-secondary)]" aria-label="Close">✕</button>
        </div>

        <p v-if="actionError" class="mb-4 text-sm text-[var(--color-danger)]" role="alert">{{ actionError }}</p>
        <p v-if="notice" class="mb-4 text-sm text-[var(--color-brand)]" role="status">{{ notice }}</p>

        <!-- Contact -->
        <div class="grid grid-cols-3 gap-2 mb-2">
          <a :href="open.phone ? `tel:${open.phone}` : undefined" :aria-disabled="!open.phone" :class="contactClass(open.phone)">📞 Call</a>
          <a :href="openWhatsApp || undefined" target="_blank" rel="noopener noreferrer" :aria-disabled="!openWhatsApp" :class="contactClass(openWhatsApp)">💬 WhatsApp</a>
          <a :href="open.email ? `mailto:${open.email}` : undefined" :aria-disabled="!open.email" :class="contactClass(open.email)">✉️ Email</a>
        </div>
        <div v-if="!open.booked && (openWhatsApp || open.email)" class="mb-5">
          <a v-if="openWhatsApp" :href="whatsappUrl(open.phone, welcomeText(open))" target="_blank" rel="noopener noreferrer"
             class="flex items-center justify-center h-11 rounded-xl bg-[#2b8659] text-white text-sm font-semibold">Send welcome offer on WhatsApp (WELCOME5)</a>
          <a v-if="openWhatsApp && open.email" :href="welcomeMail(open)" class="mt-1 flex items-center justify-center min-h-[44px] text-sm font-semibold text-[var(--color-brand)]">Or send it by email</a>
          <a v-else-if="open.email" :href="welcomeMail(open)" class="flex items-center justify-center h-11 rounded-xl bg-[#2b8659] text-white text-sm font-semibold">Send welcome offer (WELCOME5)</a>
        </div>
        <div v-else class="mb-5"></div>

        <!-- Account -->
        <section class="rounded-2xl bg-[var(--color-surface-secondary)] p-4 mb-5 text-sm">
          <h3 class="font-semibold mb-2">Account</h3>
          <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            <dt class="text-[var(--color-text-muted)]">Email</dt><dd class="break-all">{{ open.email || '—' }}</dd>
            <dt class="text-[var(--color-text-muted)]">Phone</dt><dd>{{ open.phoneText || '—' }}</dd>
            <dt class="text-[var(--color-text-muted)]">Joined</dt><dd>{{ open.joinedLong }}</dd>
            <dt class="text-[var(--color-text-muted)]">Came from</dt><dd>{{ open.source }}</dd>
            <dt class="text-[var(--color-text-muted)]">Card</dt><dd>{{ open.card || 'No card saved' }}</dd>
            <dt class="text-[var(--color-text-muted)]">Credit</dt><dd class="font-semibold">{{ formatFare(open.creditCents) }}</dd>
            <dt class="text-[var(--color-text-muted)]">Referral code</dt><dd>{{ open.referralCode || '—' }}</dd>
            <dt class="text-[var(--color-text-muted)]">Referred by</dt><dd>{{ open.referredBy || '—' }}</dd>
            <dt class="text-[var(--color-text-muted)]">Rating</dt><dd>{{ open.rating.toFixed(1) }} ★</dd>
          </dl>
        </section>

        <AdminNotes subject-type="rider" :subject-id="open.id" />

        <!-- Credit -->
        <section v-if="isAdmin" class="rounded-2xl border border-[var(--color-border)] p-4 mb-5">
          <h3 class="font-semibold text-sm mb-1">Add RideUp credit</h3>
          <p class="text-[12px] text-[var(--color-text-muted)] mb-3">Used automatically on their next rides. To refund a specific trip, open it in Rides.</p>
          <div class="flex gap-2 mb-2">
            <button v-for="d in [5, 10, 20]" :key="d" @click="credit.amount = String(d)" :aria-pressed="credit.amount === String(d)"
                    :class="['flex-1 h-10 rounded-lg text-sm font-semibold border', credit.amount === String(d) ? 'bg-[#2b8659] text-white border-[#2b8659]' : 'border-[var(--color-border)]']">${{ d }}</button>
            <label class="sr-only" for="credit-amount">Amount in dollars</label>
            <input id="credit-amount" v-model="credit.amount" inputmode="decimal" placeholder="Other" class="w-20 h-10 px-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm" />
          </div>
          <label class="sr-only" for="credit-reason">Reason</label>
          <input id="credit-reason" v-model="credit.reason" maxlength="300" placeholder="Reason, e.g. Welcome gift" class="w-full h-10 px-3 mb-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm" />
          <button @click="addCredit" :disabled="busy" class="w-full h-10 rounded-lg bg-[var(--color-text-primary)] text-[var(--color-surface)] text-sm font-semibold disabled:opacity-50">
            {{ busy ? 'Adding…' : 'Add credit' }}
          </button>
        </section>

        <!-- Rides -->
        <section class="mb-6">
          <h3 class="font-semibold text-sm mb-2">Rides</h3>
          <p v-if="ridesLoading" class="text-sm text-[var(--color-text-muted)]">Loading…</p>
          <p v-else-if="!rides.length" class="text-sm text-[var(--color-text-muted)]">No rides yet.</p>
          <ul v-else class="space-y-2">
            <li v-for="r in rides" :key="r.id" class="rounded-xl border border-[var(--color-border)] p-3 text-sm">
              <div class="flex justify-between gap-2">
                <span class="text-[var(--color-text-muted)] text-xs">{{ when(r.created_at) }}</span>
                <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-surface-secondary)]">{{ rideStatus(r.status) }}</span>
              </div>
              <div class="mt-1 truncate">{{ short(r.pickup_address) }} → {{ short(r.dropoff_address) }}</div>
              <div class="mt-0.5 font-semibold">{{ formatFare(r.fare_cents || 0) }}</div>
            </li>
          </ul>
          <router-link v-if="rides.length" to="/admin/rides" class="mt-2 inline-block text-sm font-semibold text-[var(--color-brand)]">Open Rides to refund or see details →</router-link>
        </section>

        <!-- Suspend -->
        <template v-if="isAdmin">
        <button
          @click="toggleUserStatus(open)"
          :class="['w-full h-11 rounded-xl text-sm font-semibold', open.status === 'Active' ? 'text-red-700 bg-red-50 hover:bg-red-100' : 'text-[var(--color-brand)] bg-green-50 hover:bg-green-100']"
        >
          {{ open.status === 'Active' ? 'Suspend rider' : 'Unsuspend rider' }}
        </button>
        <p class="mt-2 text-[12px] text-[var(--color-text-muted)]">Suspended riders can't request rides. Use this for abuse, and for old test accounts you want out of the way.</p>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { apiPost } from '../../lib/api'
import { formatFare } from '../../lib/pricing'
import { formatPhone, whatsappUrl } from '../../lib/phone'
import { useStaffRole } from '../../lib/staff'
import AdminNotes from '../../components/AdminNotes.vue'

const { isAdmin } = useStaffRole()

const filterTabs = ['All', 'Never booked', 'Active', 'Suspended']
const activeFilter = ref('All')
const search = ref('')
const users = ref([])
const actionError = ref('')
const notice = ref('')

const neverBookedCount = computed(() => users.value.filter((u) => !u.booked && u.status === 'Active').length)

const filteredUsers = computed(() => {
  let list = users.value
  if (activeFilter.value === 'Never booked') list = list.filter((u) => !u.booked && u.status === 'Active')
  else if (activeFilter.value !== 'All') list = list.filter((u) => u.status === activeFilter.value)
  const q = search.value.trim().toLowerCase()
  if (q) {
    const digits = q.replace(/\D/g, '')
    list = list.filter((u) =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (digits && (u.phone || '').replace(/\D/g, '').includes(digits))
    )
  }
  return list
})

const statusClass = (s) => (s === 'Active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')
const contactClass = (ok) => [
  'flex items-center justify-center h-11 rounded-xl text-sm font-semibold border border-[var(--color-border)]',
  ok ? 'hover:bg-[var(--color-surface-secondary)]' : 'opacity-40 pointer-events-none',
]

// Where the rider first came from (saved at sign-up from the ad link: utm_source, fbclid, gclid).
function sourceOf(a) {
  if (!a) return 'Direct or unknown'
  const src = String(a.utm_source || '').toLowerCase()
  if (a.fbclid || /facebook|fb|instagram|ig|meta/.test(src)) return /instagram|ig/.test(src) ? 'Instagram' : 'Facebook / Instagram'
  if (a.gclid || src === 'google') return 'Google'
  return a.utm_source ? `${a.utm_source}${a.utm_campaign ? ` · ${a.utm_campaign}` : ''}` : 'Direct or unknown'
}

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'there'
function welcomeMail(u) {
  const subject = 'Welcome to RideUp: $5 off your first ride'
  const body = `Hi ${firstName(u.name)},\n\nThanks for joining RideUp! Your first ride is $5 off with the code WELCOME5.\n\n` +
    'See your exact price before you book, pay by card, and ride with approved local drivers across Nassau.\n\n' +
    'Book here: https://www.rideupnassau.com/book\n\nLet’s ride,\nRideUp'
  return `mailto:${u.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
// Typed into WhatsApp for you to check and send.
const welcomeText = (u) => `Hi ${firstName(u.name)}, it's RideUp. Thanks for signing up! Your first ride is $5 off with the code WELCOME5. ` +
  'You see the price before you book and pay by card: https://www.rideupnassau.com/book'

const when = (iso) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const short = (address) => String(address || '—').split(',')[0]
const RIDE_STATUS = {
  requested: 'Searching', pending_driver_response: 'Confirming', accepted: 'Driver on the way', driver_arrived: 'Driver arrived',
  in_progress: 'On trip', completed: 'Completed', cancelled: 'Cancelled', scheduled: 'Scheduled',
}
const rideStatus = (s) => RIDE_STATUS[s] || s

// --- Detail panel ---------------------------------------------------------------------------------------------
const open = ref(null)
const openWhatsApp = computed(() => (open.value ? whatsappUrl(open.value.phone) : ''))
const rides = ref([])
const ridesLoading = ref(false)
const busy = ref(false)
const credit = reactive({ amount: '', reason: '' })

async function openUser(user) {
  open.value = user
  actionError.value = ''
  notice.value = ''
  credit.amount = ''
  credit.reason = ''
  rides.value = []
  if (!supabaseConfigured) return
  ridesLoading.value = true
  const { data } = await supabase
    .from('rides')
    .select('id, created_at, status, pickup_address, dropoff_address, fare_cents')
    .eq('rider_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)
  if (open.value?.id === user.id) rides.value = data || []
  ridesLoading.value = false
}

function close() {
  open.value = null
  actionError.value = ''
  notice.value = ''
}

async function addCredit() {
  const user = open.value
  const cents = Math.round(Number(String(credit.amount).replace(/[$\s]/g, '')) * 100)
  actionError.value = ''
  notice.value = ''
  if (!(cents > 0) || cents > 10_000) { actionError.value = 'Enter an amount between $0.01 and $100.'; return }
  if (credit.reason.trim().length < 3) { actionError.value = 'Add a short reason, for example "Welcome gift".'; return }
  busy.value = true
  try {
    const res = await apiPost('/api/admin-credit', { riderId: user.id, amountCents: cents, reason: credit.reason.trim() })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || 'Couldn’t add credit.')
    user.creditCents = body.credit_cents
    notice.value = `Added ${formatFare(cents)}. ${firstName(user.name)} now has ${formatFare(body.credit_cents)} credit.`
    credit.amount = ''
    credit.reason = ''
  } catch (err) {
    actionError.value = err.message
  } finally {
    busy.value = false
  }
}

// Suspension is enforced by the database: suspended riders can't request rides.
async function toggleUserStatus(user) {
  const suspend = user.status === 'Active'
  if (suspend && !window.confirm(`Suspend ${user.name}? They won't be able to request rides until you unsuspend them.`)) return
  actionError.value = ''
  if (supabaseConfigured) {
    const { error } = await supabase.from('riders').update({ suspended: suspend }).eq('id', user.id)
    if (error) { actionError.value = `Couldn't update ${user.name}: ${error.message}`; return }
  }
  user.status = suspend ? 'Suspended' : 'Active'
}

onMounted(async () => {
  if (!supabaseConfigured) return
  try {
    const [{ data, error }, { data: rideRows }] = await Promise.all([
      supabase.from('riders').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('rides').select('rider_id').limit(10000),
    ])
    if (error || !data) return
    const requested = new Set((rideRows || []).map((r) => r.rider_id))
    const names = new Map(data.map((r) => [r.id, r.name]))
    users.value = data.map((r) => ({
      id: r.id,
      name: r.name || 'Unknown',
      email: r.email || '',
      phone: r.phone || '',
      phoneText: r.phone ? formatPhone(r.phone) || r.phone : '',
      rides: r.total_rides || 0,
      booked: requested.has(r.id),
      rating: Number(r.rating) || 0,
      joined: r.created_at ? r.created_at.split('T')[0] : '-',
      joinedLong: r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—',
      status: r.suspended ? 'Suspended' : 'Active',
      guest: !!r.is_guest,
      card: r.card_last4 ? `${r.card_brand ? r.card_brand[0].toUpperCase() + r.card_brand.slice(1) : 'Card'} •••• ${r.card_last4}` : '',
      creditCents: r.credit_cents || 0,
      referralCode: r.referral_code || '',
      referredBy: r.referred_by ? names.get(r.referred_by) || 'Another rider' : '',
      source: sourceOf(r.acquisition),
    }))
  } catch { /* keep empty */ }
})
</script>
