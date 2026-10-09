<script setup>
import { ref, onMounted } from 'vue'
import { apiPost } from '../../lib/api'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { DEMO_MODE } from '../../lib/demoMode'
import { useAuth } from '../../lib/useAuth'
import AdminAlertsCard from '../../components/AdminAlertsCard.vue'

// Admin › Team: who can use the admin, with what access, and who gets ride alerts.
const { user } = useAuth()
const team = ref([])
const loading = ref(true)
const error = ref('')
const notice = ref('')
const busy = ref(false)
const email = ref('')
const role = ref('support')

const ROLES = {
  admin: { label: 'Admin', desc: 'Everything, including money, payouts, promos, settings, refunds and the team.' },
  support: { label: 'Support', desc: 'Live, rides, riders, drivers, safety and support: cancel and assign trips, call people, add notes. No money, settings, approvals or refunds.' },
}

async function load() {
  loading.value = true
  if (DEMO_MODE || !supabaseConfigured) {
    team.value = [
      { user_id: 'me', email: 'owner@rideupnassau.com', name: 'Owner', role: 'admin', ride_alerts: true, created_at: new Date().toISOString() },
      { user_id: 's1', email: 'helper@rideupnassau.com', name: 'Helper', role: 'support', ride_alerts: false, created_at: new Date().toISOString() },
    ]
    loading.value = false
    return
  }
  await apiPost('/api/admin-team', { action: 'me' }).catch(() => {}) // make sure you're listed
  const { data, error: err } = await supabase.from('staff').select('*').order('created_at')
  loading.value = false
  if (err) { error.value = /staff/.test(err.message) ? 'Run database update 016 to manage the team.' : 'Couldn’t load the team.'; return }
  team.value = data || []
}
onMounted(load)

async function call(body, okText) {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    if (DEMO_MODE) { notice.value = okText; return true }
    const res = await apiPost('/api/admin-team', body)
    const out = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(out.error || 'That didn’t work.')
    notice.value = okText
    await load()
    return true
  } catch (err) {
    error.value = err.message
    return false
  } finally {
    busy.value = false
  }
}

async function add() {
  const e = email.value.trim()
  if (!e) { error.value = 'Enter their email.'; return }
  if (await call({ action: 'add', email: e, role: role.value }, `Added ${e} as ${ROLES[role.value].label}. They get access the next time they sign in.`)) email.value = ''
}
function changeRole(m, next) {
  if (next === m.role) return
  if (!window.confirm(`Make ${m.email} ${ROLES[next].label}?`)) return
  call({ action: 'role', userId: m.user_id, role: next }, `${m.email} is now ${ROLES[next].label}. It applies the next time they sign in (within the hour).`)
}
function remove(m) {
  if (!window.confirm(`Remove ${m.email} from the team? They lose admin access within the hour, or when they next sign in.`)) return
  call({ action: 'remove', userId: m.user_id }, `${m.email} was removed from the team.`)
}
</script>

<template>
  <div class="max-w-3xl">
    <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Team</h1>
    <p class="text-sm text-[var(--color-text-secondary)] mb-6">Give helpers access to the admin without sharing your login.</p>

    <AdminAlertsCard class="mb-6" />

    <section class="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] mb-6">
      <h2 class="font-semibold px-5 pt-4">People</h2>
      <p v-if="loading" class="px-5 py-4 text-sm text-[var(--color-text-muted)]">Loading…</p>
      <ul v-else class="divide-y divide-[var(--color-border)]">
        <li v-for="m in team" :key="m.user_id" class="px-5 py-4 flex flex-wrap items-center gap-3">
          <div class="flex-1 min-w-[12rem]">
            <div class="font-medium">{{ m.name || m.email }} <span v-if="m.user_id === user?.id || m.user_id === 'me'" class="text-xs text-[var(--color-text-muted)]">(you)</span></div>
            <div class="text-sm text-[var(--color-text-muted)]">{{ m.email }} · ride alerts {{ m.ride_alerts ? 'on' : 'off' }}</div>
          </div>
          <template v-if="m.user_id !== user?.id && m.user_id !== 'me'">
            <label class="sr-only" :for="`role-${m.user_id}`">Role for {{ m.email }}</label>
            <select :id="`role-${m.user_id}`" :value="m.role" @change="changeRole(m, $event.target.value)" :disabled="busy"
                    class="h-9 px-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm">
              <option value="admin">Admin</option>
              <option value="support">Support</option>
            </select>
            <button @click="remove(m)" :disabled="busy" class="h-9 px-3 rounded-lg text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100">Remove</button>
          </template>
          <span v-else class="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--color-surface-secondary)]">{{ ROLES[m.role]?.label }}</span>
        </li>
      </ul>
    </section>

    <section class="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
      <h2 class="font-semibold mb-1">Add someone</h2>
      <p class="text-sm text-[var(--color-text-muted)] mb-3">They need a RideUp account first: ask them to sign up at rideupnassau.com with this email.</p>
      <form @submit.prevent="add" class="space-y-3">
        <div>
          <label for="team-email" class="text-sm font-semibold">Email</label>
          <input id="team-email" v-model="email" type="email" autocomplete="off" class="mt-1 w-full h-11 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm" />
        </div>
        <fieldset>
          <legend class="text-sm font-semibold mb-1">Access</legend>
          <label v-for="(r, id) in ROLES" :key="id" :class="['flex gap-2 rounded-lg border px-3 py-2 mb-2 cursor-pointer text-sm', role === id ? 'border-[#2b8659] bg-[#2b8659]/5' : 'border-[var(--color-border)]']">
            <input type="radio" name="team-role" :value="id" v-model="role" class="mt-1" />
            <span><span class="font-semibold">{{ r.label }}</span><span class="block text-[var(--color-text-muted)]">{{ r.desc }}</span></span>
          </label>
        </fieldset>
        <p v-if="error" class="text-sm text-[var(--color-danger)]" role="alert">{{ error }}</p>
        <p v-if="notice" class="text-sm text-[var(--color-brand)]" role="status">{{ notice }}</p>
        <button type="submit" :disabled="busy" class="h-11 px-5 rounded-lg bg-[#2b8659] text-white text-sm font-semibold disabled:opacity-50">{{ busy ? 'Saving…' : 'Add to team' }}</button>
      </form>
    </section>
  </div>
</template>
