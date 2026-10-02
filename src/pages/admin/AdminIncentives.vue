<template>
  <div class="max-w-3xl">
    <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-2">Driver incentives</h1>
    <p class="text-sm text-[var(--color-text-secondary)] mb-6">
      “Complete 15 trips this weekend, get $20.” Drivers see their progress on the dashboard. The reward is added to the driver’s
      balance automatically when they finish the trip that hits the target, and you pay it with their next payout.
    </p>

    <form @submit.prevent="createQuest" class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 mb-8 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
      <h2 class="sm:col-span-2 text-base font-bold">New incentive</h2>
      <label class="flex flex-col gap-1 sm:col-span-2">Title (drivers see this)
        <input v-model="form.title" required maxlength="80" placeholder="Weekend boost" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
      </label>
      <label class="flex flex-col gap-1">Trips to complete
        <input v-model="form.trips" required type="number" min="1" max="200" placeholder="15" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
      </label>
      <label class="flex flex-col gap-1">Reward ($)
        <input v-model="form.reward" required type="number" min="1" max="500" step="1" placeholder="20" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
      </label>
      <label class="flex flex-col gap-1">Starts
        <input v-model="form.starts" required type="datetime-local" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
      </label>
      <label class="flex flex-col gap-1">Ends
        <input v-model="form.ends" required type="datetime-local" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
      </label>
      <p class="sm:col-span-2 text-xs text-[var(--color-text-muted)]">Times are Nassau time. Every approved driver can earn it once. Tip: target busy times (Friday evening to Sunday night) so more drivers are online when riders need them.</p>
      <p v-if="formError" class="sm:col-span-2 text-red-600" role="alert">{{ formError }}</p>
      <div class="sm:col-span-2">
        <button type="submit" :disabled="saving" class="px-4 py-2 rounded-lg bg-[#2b8659] text-white font-semibold disabled:opacity-50">{{ saving ? 'Saving…' : 'Create incentive' }}</button>
      </div>
    </form>

    <p v-if="error" class="mb-4 text-sm text-red-600" role="alert">{{ error }}</p>
    <div class="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <table class="w-full text-sm stack-table">
        <thead>
          <tr class="text-left text-[var(--color-text-muted)] text-xs uppercase tracking-wider bg-[var(--color-surface-secondary)]">
            <th class="px-4 py-3 font-medium">Incentive</th>
            <th class="px-4 py-3 font-medium">When</th>
            <th class="px-4 py-3 font-medium">Earned</th>
            <th class="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="q in quests" :key="q.id" class="border-t border-[var(--color-border)]">
            <td data-label="Incentive" class="px-4 py-3 font-semibold">{{ q.title }}<div class="text-xs font-normal text-[var(--color-text-muted)]">{{ q.trips_required }} trips → {{ formatFare(q.reward_cents) }}</div></td>
            <td data-label="When" class="px-4 py-3">{{ fmt(q.starts_at) }} – {{ fmt(q.ends_at) }}</td>
            <td data-label="Earned" class="px-4 py-3">{{ q.earned }} driver{{ q.earned === 1 ? '' : 's' }}<div class="text-xs text-[var(--color-text-muted)]">{{ formatFare(q.earned * q.reward_cents) }}</div></td>
            <td data-label="Status" class="px-4 py-3">
              <button @click="toggle(q)" class="text-xs font-semibold px-3 py-1.5 rounded-lg border"
                      :class="q.active ? 'border-[#2b8659] text-[var(--color-brand)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)]'">
                {{ q.active ? (new Date(q.ends_at) < new Date() ? 'Ended' : 'Active · turn off') : 'Off · turn on' }}
              </button>
            </td>
          </tr>
          <tr v-if="!loading && quests.length === 0"><td colspan="4" class="px-4 py-8 text-center text-[var(--color-text-muted)]">No incentives yet.</td></tr>
          <tr v-if="loading"><td colspan="4" class="px-4 py-8 text-center text-[var(--color-text-muted)]">Loading…</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { formatFare } from '../../lib/pricing'
import { DEMO_MODE } from '../../lib/demoMode'

const quests = ref([])
const loading = ref(!DEMO_MODE)
const error = ref('')
const saving = ref(false)
const formError = ref('')
const form = reactive({ title: '', trips: '', reward: '', starts: '', ends: '' })

const fmt = (iso) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Nassau' })
// datetime-local has no time zone; the business runs on Nassau time (UTC−5, UTC−4 in summer).
function nassauToIso(local) {
  const guess = new Date(`${local}:00Z`)
  const offsetMin = (new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' })) - new Date(guess.toLocaleString('en-US', { timeZone: 'America/Nassau' }))) / 60000
  return new Date(guess.getTime() + offsetMin * 60000).toISOString()
}

async function load() {
  if (!supabaseConfigured || DEMO_MODE) return
  loading.value = true
  const [{ data, error: err }, { data: rewards }] = await Promise.all([
    supabase.from('driver_quests').select('*').order('starts_at', { ascending: false }),
    supabase.from('driver_quest_rewards').select('quest_id'),
  ])
  if (err) error.value = 'Could not load incentives. Run migration 010 and check your account has the admin role.'
  const counts = {}
  for (const r of rewards || []) counts[r.quest_id] = (counts[r.quest_id] || 0) + 1
  quests.value = (data || []).map((q) => ({ ...q, earned: counts[q.id] || 0 }))
  loading.value = false
}

async function createQuest() {
  formError.value = ''
  const trips = Number(form.trips)
  const cents = Math.round(Number(form.reward) * 100)
  if (!(trips >= 1 && trips <= 200)) { formError.value = 'Trips must be between 1 and 200.'; return }
  if (!(cents >= 100 && cents <= 50000)) { formError.value = 'Reward must be between $1 and $500.'; return }
  const startsAt = nassauToIso(form.starts)
  const endsAt = nassauToIso(form.ends)
  if (new Date(endsAt) <= new Date(startsAt)) { formError.value = 'The end must be after the start.'; return }
  if (new Date(endsAt) <= new Date()) { formError.value = 'The end time has already passed.'; return }
  saving.value = true
  if (!DEMO_MODE) {
    const { error: err } = await supabase.from('driver_quests').insert({
      title: form.title.trim(), trips_required: trips, reward_cents: cents, starts_at: startsAt, ends_at: endsAt,
    })
    if (err) { saving.value = false; formError.value = err.message; return }
  }
  Object.assign(form, { title: '', trips: '', reward: '', starts: '', ends: '' })
  saving.value = false
  await load()
}

async function toggle(q) {
  if (DEMO_MODE) { q.active = !q.active; return }
  const { error: err } = await supabase.from('driver_quests').update({ active: !q.active }).eq('id', q.id)
  if (err) { error.value = err.message; return }
  q.active = !q.active
}

onMounted(load)
</script>
