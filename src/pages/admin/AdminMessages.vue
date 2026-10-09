<script setup>
import { ref, computed } from 'vue'
import { apiPost } from '../../lib/api'
import { DEMO_MODE } from '../../lib/demoMode'

// Admin › Messages: a push notification to every rider, every driver, or both.
const audience = ref('riders')
const title = ref('')
const body = ref('')
const busy = ref(false)
const error = ref('')
const notice = ref('')
const tested = ref(false)

const AUDIENCES = [
  { id: 'riders', label: 'All riders', hint: 'Opens the booking screen' },
  { id: 'drivers', label: 'All drivers', hint: 'Opens the driver home screen' },
  { id: 'everyone', label: 'Everyone', hint: 'Riders and drivers' },
]
const IDEAS = {
  riders: [
    { title: '$5 off this weekend 🎉', body: 'Use code WELCOME5 on your next RideUp. See your price before you book.' },
    { title: 'Flying in or out?', body: 'Book your LPIA airport ride with RideUp. Upfront price, pay by card.' },
  ],
  drivers: [
    { title: 'Busy tonight 🚗', body: 'Lots of riders around Cable Beach and downtown. Go online to catch trips.' },
    { title: 'Airport rush this afternoon', body: 'Flights landing at LPIA from 2 to 6pm. Go online near the airport.' },
  ],
  everyone: [{ title: 'RideUp update', body: 'Thanks for riding and driving with RideUp in Nassau!' }],
}
const valid = computed(() => title.value.trim().length >= 3 && body.value.trim().length >= 3)

function useIdea(idea) {
  title.value = idea.title
  body.value = idea.body
  tested.value = false
}

async function send(test) {
  error.value = ''
  notice.value = ''
  if (!valid.value) { error.value = 'Add a title and a message.'; return }
  const who = AUDIENCES.find((a) => a.id === audience.value).label.toLowerCase()
  if (!test && !window.confirm(`Send “${title.value.trim()}” to ${who} now? This can’t be undone.`)) return
  busy.value = true
  try {
    if (DEMO_MODE) {
      notice.value = test ? 'Test sent to your devices.' : `Sent to ${who}.`
      if (test) tested.value = true
      return
    }
    const res = await apiPost('/api/admin-broadcast', { audience: audience.value, title: title.value.trim(), body: body.value.trim(), test })
    const out = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(out.error || 'Couldn’t send it.')
    if (test) {
      tested.value = true
      notice.value = out.sent ? 'Test sent to your devices. Check how it looks.' : 'Sent, but none of your devices have RideUp notifications on (Admin › Live › Ride alerts).'
    } else {
      notice.value = `Sent to ${out.reached} of ${out.people} ${who}. The rest haven’t turned on RideUp notifications.`
      title.value = ''
      body.value = ''
      tested.value = false
    }
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl">
    <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Messages</h1>
    <p class="text-sm text-[var(--color-text-secondary)] mb-6">Send a push notification to your riders or drivers. It reaches everyone who allowed RideUp notifications.</p>

    <div class="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 space-y-5">
      <fieldset>
        <legend class="text-sm font-semibold mb-2">Send to</legend>
        <div class="grid sm:grid-cols-3 gap-2">
          <label v-for="a in AUDIENCES" :key="a.id" :class="['rounded-lg border px-3 py-2 cursor-pointer text-sm focus-within:ring-2 focus-within:ring-[#2b8659]/40', audience === a.id ? 'border-[#2b8659] bg-[#2b8659]/5' : 'border-[var(--color-border)]']">
            <input type="radio" name="audience" :value="a.id" v-model="audience" class="sr-only" @change="tested = false" />
            <span class="font-semibold block">{{ a.label }}</span>
            <span class="text-xs text-[var(--color-text-muted)]">{{ a.hint }}</span>
          </label>
        </div>
      </fieldset>

      <div>
        <label for="msg-title" class="text-sm font-semibold">Title</label>
        <input id="msg-title" v-model="title" maxlength="60" @input="tested = false" class="mt-1 w-full h-11 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm" />
        <div class="text-xs text-right text-[var(--color-text-muted)]">{{ title.length }}/60</div>
      </div>
      <div>
        <label for="msg-body" class="text-sm font-semibold">Message</label>
        <textarea id="msg-body" v-model="body" maxlength="180" rows="3" @input="tested = false" class="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"></textarea>
        <div class="text-xs text-right text-[var(--color-text-muted)]">{{ body.length }}/180</div>
      </div>

      <div>
        <p class="text-xs font-semibold text-[var(--color-text-muted)] mb-1">Ideas</p>
        <div class="flex flex-wrap gap-2">
          <button v-for="idea in IDEAS[audience]" :key="idea.title" @click="useIdea(idea)" class="text-xs px-3 py-1.5 rounded-full border border-[var(--color-border)] hover:bg-[var(--color-surface-secondary)]">{{ idea.title }}</button>
        </div>
      </div>

      <!-- Preview -->
      <div v-if="title || body" class="rounded-2xl bg-[var(--color-surface-secondary)] p-3 flex gap-3" aria-label="Preview">
        <img src="/icon-192.png" alt="" class="w-10 h-10 rounded-xl" />
        <div class="min-w-0">
          <div class="text-sm font-semibold truncate">{{ title || 'Title' }}</div>
          <div class="text-sm text-[var(--color-text-secondary)] line-clamp-2">{{ body || 'Message' }}</div>
        </div>
      </div>

      <p v-if="error" class="text-sm text-[var(--color-danger)]" role="alert">{{ error }}</p>
      <p v-if="notice" class="text-sm text-[var(--color-brand)]" role="status">{{ notice }}</p>

      <div class="flex flex-wrap gap-2">
        <button @click="send(true)" :disabled="busy || !valid" class="h-11 px-4 rounded-lg border border-[var(--color-border)] text-sm font-semibold disabled:opacity-50">Send a test to me</button>
        <button @click="send(false)" :disabled="busy || !valid" class="h-11 px-5 rounded-lg bg-[#2b8659] text-white text-sm font-semibold disabled:opacity-50">
          {{ busy ? 'Sending…' : tested ? 'Looks good, send it' : 'Send now' }}
        </button>
      </div>
      <p class="text-xs text-[var(--color-text-muted)]">Keep it useful: offers, busy times, service updates. Too many messages and people turn notifications off. Every broadcast is recorded in Activity.</p>
    </div>
  </div>
</template>
