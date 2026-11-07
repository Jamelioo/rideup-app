<template>
  <div class="max-w-3xl">
    <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-2">Promo codes</h1>
    <p class="text-sm text-[var(--color-text-secondary)] mb-6">
      Riders enter codes in Promotions or on the booking screen. Each rider can use a code once; it counts as used when the ride is completed.
      Discounts come out of RideUp’s share: drivers are always paid on the full fare, and riders always pay at least $1.
    </p>

    <!-- The code every new visitor gets automatically (app_settings.landing_promo, src/lib/landingOffer.js) -->
    <section class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 mb-8 text-sm" aria-labelledby="landing-offer-title">
      <h2 id="landing-offer-title" class="text-base font-bold mb-1">Landing page offer</h2>
      <p class="text-[var(--color-text-secondary)] mb-3">
        New visitors get this code automatically on the home, airport and booking pages, without typing it. Riders who’ve taken a trip don’t see a first-ride offer.
        Changes show on the site within 5 minutes.
      </p>
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span class="font-bold tracking-wide">{{ featured || 'No landing offer' }}</span>
        <span :class="featuredStatus.ok ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-danger)]'">{{ featuredStatus.text }}</span>
        <button v-if="featured" type="button" @click="setFeatured('')" :disabled="featureSaving"
                class="sm:ml-auto text-xs font-semibold px-3 py-2 rounded-lg border border-[var(--color-border)] disabled:opacity-50">No landing offer</button>
      </div>
      <p v-if="featureError" class="mt-2 text-[var(--color-danger)]" role="alert">{{ featureError }}</p>
      <!-- A real deadline is the only honest urgency: the pages say "ends …" once it's 30 days away or less. -->
      <form v-if="featuredCodeRow && featuredStatus.ok" @submit.prevent="setFeaturedEnd" class="mt-4 pt-4 border-t border-[var(--color-border)]">
        <p class="text-[var(--color-text-secondary)] mb-2">
          <template v-if="featuredCodeRow.expires_at">Ends {{ new Date(featuredCodeRow.expires_at).toLocaleDateString('en-US', { timeZone: 'America/Nassau', month: 'long', day: 'numeric', year: 'numeric' }) }}. The landing pages say so in the last 30 days.</template>
          <template v-else>No end date. Add one and the landing pages will say when the offer ends (in its last 30 days), which gives visitors a real reason to book now.</template>
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <label class="sr-only" for="featured-end">End date</label>
          <input id="featured-end" v-model="featuredEnd" type="date" :min="todayIso" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
          <button type="submit" :disabled="!featuredEnd || featureSaving" class="text-xs font-semibold px-3 py-2 rounded-lg bg-[#2b8659] text-white disabled:opacity-50">{{ featuredCodeRow.expires_at ? 'Change end date' : 'Set end date' }}</button>
        </div>
      </form>
    </section>

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
      <label class="flex items-center gap-3 min-h-[44px] sm:col-span-2">
        <input v-model="form.firstRideOnly" type="checkbox" class="w-5 h-5 accent-[#2b8659]" /> First ride only (new riders)
      </label>
      <p v-if="formError" class="sm:col-span-2 text-[var(--color-danger)]" role="alert">{{ formError }}</p>
      <div class="sm:col-span-2">
        <button type="submit" :disabled="saving" class="px-4 py-2 rounded-lg bg-[#2b8659] text-white font-semibold disabled:opacity-50">{{ saving ? 'Saving…' : 'Create code' }}</button>
      </div>
    </form>

    <p v-if="error" class="mb-4 text-sm text-[var(--color-danger)]" role="alert">{{ error }}</p>
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
            <td data-label="Expires" class="px-4 py-3">{{ c.expires_at ? new Date(c.expires_at).toLocaleDateString('en-US', { timeZone: 'America/Nassau' }) : '—' }}</td>
            <td data-label="Status" class="px-4 py-3">
              <div class="flex flex-wrap items-center gap-2">
                <button @click="toggle(c)" class="text-xs font-semibold px-3 py-1.5 rounded-lg border"
                        :class="c.active ? 'border-[#2b8659] text-[var(--color-brand)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)]'">
                  {{ c.active ? 'Active · turn off' : 'Off · turn on' }}
                </button>
                <span v-if="c.code === featured" class="text-xs font-semibold text-[var(--color-brand)]">On landing page</span>
                <button v-else-if="c.active" type="button" @click="setFeatured(c.code)" :disabled="featureSaving"
                        class="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] disabled:opacity-50">Show on landing page</button>
              </div>
            </td>
          </tr>
          <tr v-if="!loading && codes.length === 0"><td colspan="5" class="px-4 py-8 text-center text-[var(--color-text-muted)]">No promo codes yet.</td></tr>
          <tr v-if="loading"><td colspan="5" class="px-4 py-8 text-center text-[var(--color-text-muted)]">Loading…</td></tr>
        </tbody>
      </table>
    </div>
    <p class="text-xs text-[var(--color-text-muted)] mt-4">Referral rewards ($5 off a friend’s first ride, $5 credit to the referrer) run automatically and don’t need a code here.</p>

    <!-- Rider quotes (migration 022): shared by riders after a 5-star trip, shown on the website once approved. -->
    <section class="mt-10" aria-labelledby="quotes-title">
      <h2 id="quotes-title" class="text-base font-bold mb-1">Rider quotes for the website</h2>
      <p class="text-sm text-[var(--color-text-secondary)] mb-4">
        After a 5-star trip, riders can let RideUp show their comment with their first name and last initial. Approve the ones to show on the
        home, airport and About pages (newest three); hide one at any time. Changes show within 10 minutes.
      </p>
      <p v-if="quotesError" class="text-sm text-[var(--color-danger)] mb-3" role="alert">{{ quotesError }}</p>
      <p v-else-if="!quotesLoading && !quotes.length" class="text-sm text-[var(--color-text-muted)]">No quotes yet. They appear here as riders share them.</p>
      <ul class="space-y-3">
        <li v-for="q in quotes" :key="q.id" class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm">
          <p class="text-[15px] text-[var(--color-text-primary)]">“{{ q.quote }}”</p>
          <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span class="font-semibold">{{ q.display_name }}</span>
            <span class="text-xs text-[var(--color-text-muted)]">{{ new Date(q.created_at).toLocaleDateString('en-US', { timeZone: 'America/Nassau' }) }}</span>
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full" :class="q.status === 'approved' ? 'bg-[#2b8659]/10 text-[var(--color-brand)]' : q.status === 'hidden' ? 'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]' : 'bg-amber-500/15 text-[var(--color-text-primary)]'">{{ { pending: 'Waiting for review', approved: 'On the website', hidden: 'Hidden' }[q.status] }}</span>
            <span class="sm:ml-auto flex gap-2">
              <button v-if="q.status !== 'approved'" type="button" @click="review(q, 'approved')" :disabled="q.busy" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#2b8659] text-white disabled:opacity-50">Approve</button>
              <button v-if="q.status !== 'hidden'" type="button" @click="review(q, 'hidden')" :disabled="q.busy" class="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-border)] disabled:opacity-50">Hide</button>
            </span>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { formatFare, formatAmount } from '../../lib/pricing'
import { DEMO_MODE } from '../../lib/demoMode'
import { featuredCode } from '../../lib/landingOfferRules'
import { nassauMidnight } from '../../lib/nassauTime'
import { useAuth } from '../../lib/useAuth'

const { user } = useAuth()

const codes = ref(DEMO_MODE ? [{ code: 'WELCOME5', amount_cents: 500, uses: 12, max_uses: 100, first_ride_only: true, active: true, description: '$5 off your first ride' }] : [])
const loading = ref(!DEMO_MODE)
const error = ref('')
const saving = ref(false)
const formError = ref('')
const form = reactive({ code: '', amount: '', maxUses: '', expires: '', description: '', firstRideOnly: true })

// The landing page offer: WELCOME5 until an admin picks another code, '' for none.
const featured = ref(featuredCode(null))
const featureSaving = ref(false)
const featureError = ref('')
const featuredStatus = computed(() => {
  if (!featured.value) return { ok: true, text: 'Visitors see no offer.' }
  if (loading.value) return { ok: true, text: '' }
  const c = codes.value.find((x) => x.code === featured.value)
  if (!c) return { ok: false, text: 'This code doesn’t exist yet. Create it below, or show another code.' }
  if (!c.active) return { ok: false, text: 'This code is turned off, so visitors see no offer.' }
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) return { ok: false, text: 'This code has expired, so visitors see no offer.' }
  if (c.max_uses != null && c.uses >= c.max_uses) return { ok: false, text: 'This code is fully used, so visitors see no offer.' }
  return { ok: true, text: `Shown as “${c.first_ride_only ? `First ride ${formatAmount(c.amount_cents)} off` : `${formatAmount(c.amount_cents)} off your next ride`}” and applied for them.` }
})

// The landing offer's code row, for its end date.
const featuredCodeRow = computed(() => codes.value.find((x) => x.code === featured.value) || null)
const featuredEnd = ref('')
const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Nassau' })
async function setFeaturedEnd() {
  const c = featuredCodeRow.value
  if (!c || !featuredEnd.value) return
  featureError.value = ''
  featureSaving.value = true
  // The end of that day in Nassau, as for new codes.
  const expiresAt = new Date(Date.parse(nassauMidnight(featuredEnd.value, 1)) - 1000).toISOString()
  if (!DEMO_MODE) {
    const { error: err } = await supabase.from('promo_codes').update({ expires_at: expiresAt }).eq('code', c.code)
    if (err) { featureSaving.value = false; featureError.value = `Couldn’t save: ${err.message}`; return }
  }
  c.expires_at = expiresAt
  featuredEnd.value = ''
  featureSaving.value = false
}

// Rider quotes waiting for review first, then the rest, newest first.
const quotes = ref([])
const quotesLoading = ref(!DEMO_MODE)
const quotesError = ref('')
async function loadQuotes() {
  if (!supabaseConfigured || DEMO_MODE) { quotesLoading.value = false; return }
  const { data, error: err } = await supabase.from('testimonials').select('id, quote, display_name, status, created_at').order('created_at', { ascending: false })
  quotesLoading.value = false
  if (err) { quotesError.value = err.code === 'PGRST205' || err.code === '42P01' ? 'Run migration 022 to start collecting rider quotes.' : `Couldn’t load quotes: ${err.message}`; return }
  const order = { pending: 0, approved: 1, hidden: 2 }
  quotes.value = (data || []).sort((a, b) => order[a.status] - order[b.status])
}
async function review(q, status) {
  q.busy = true
  quotesError.value = ''
  const { error: err } = await supabase.from('testimonials').update({ status, reviewed_at: new Date().toISOString(), reviewed_by: user.value?.id || null }).eq('id', q.id)
  q.busy = false
  if (err) { quotesError.value = `Couldn’t save: ${err.message}`; return }
  q.status = status
}

async function setFeatured(code) {
  featureError.value = ''
  featureSaving.value = true
  if (!DEMO_MODE) {
    const { error: err } = await supabase.from('app_settings').upsert({ key: 'landing_promo', value: code, updated_at: new Date().toISOString() })
    if (err) { featureSaving.value = false; featureError.value = `Couldn’t save: ${err.message}`; return }
  }
  featured.value = code
  featureSaving.value = false
}

async function load() {
  if (!supabaseConfigured || DEMO_MODE) return
  loading.value = true
  const [{ data, error: err }, setting] = await Promise.all([
    supabase.from('promo_codes').select('*').order('created_at', { ascending: false }),
    supabase.from('app_settings').select('value').eq('key', 'landing_promo').maybeSingle(),
  ])
  if (err) error.value = 'Could not load promo codes. Run migration 009 and check your account has the admin role.'
  codes.value = data || []
  if (!setting.error) featured.value = featuredCode(setting.data)
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
      // The end of that day in Nassau, summer time included (a fixed −05:00 ran an hour into the next day).
      expires_at: form.expires ? new Date(Date.parse(nassauMidnight(form.expires, 1)) - 1000).toISOString() : null,
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
onMounted(loadQuotes)
</script>
