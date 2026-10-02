<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { formatFare } from '../lib/pricing'
import { DEMO_MODE } from '../lib/demoMode'

// Driver incentives with live progress ("9 of 15 trips · $20"). Hidden when there are none.
const quests = ref(DEMO_MODE
  ? [{ id: 'demo', title: 'Weekend boost', trips_required: 15, trips_done: 9, reward_cents: 2000, starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 2 * 86_400_000).toISOString(), earned: false }]
  : [])

const visible = computed(() => quests.value.filter((q) => q.earned || new Date(q.ends_at) > new Date()))

function timeLeft(q) {
  const start = new Date(q.starts_at)
  if (start > new Date()) return `Starts ${start.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Nassau' })}`
  const ms = new Date(q.ends_at) - Date.now()
  if (ms <= 0) return 'Ended'
  const h = Math.floor(ms / 3_600_000)
  return h >= 48 ? `${Math.floor(h / 24)} days left` : h >= 1 ? `${h} h left` : `${Math.max(1, Math.round(ms / 60000))} min left`
}

onMounted(async () => {
  if (DEMO_MODE || !supabaseConfigured) return
  const { data } = await supabase.rpc('my_quests')
  quests.value = (data || []).map((q) => ({ ...q, trips_done: Number(q.trips_done) || 0 }))
})
</script>

<template>
  <div v-if="visible.length" class="space-y-2 mb-4">
    <div v-for="q in visible" :key="q.id" class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div class="flex items-start justify-between gap-3 mb-2">
        <div class="min-w-0">
          <p class="text-[15px] font-bold truncate">{{ q.title }}</p>
          <p class="text-[12px] text-[var(--color-text-muted)]">{{ q.earned ? 'Earned · added to your balance' : timeLeft(q) }}</p>
        </div>
        <span class="text-[15px] font-bold text-[var(--color-brand)] whitespace-nowrap">{{ formatFare(q.reward_cents) }}</span>
      </div>
      <div class="h-2 rounded-full bg-[var(--color-surface-secondary)] overflow-hidden" role="progressbar"
           :aria-valuenow="Math.min(q.trips_done, q.trips_required)" aria-valuemin="0" :aria-valuemax="q.trips_required"
           :aria-label="`${q.title}: ${Math.min(q.trips_done, q.trips_required)} of ${q.trips_required} trips`">
        <div class="h-full rounded-full bg-[#2b8659]" :style="{ width: Math.min(100, (q.trips_done / q.trips_required) * 100) + '%' }"></div>
      </div>
      <p class="text-[12px] text-[var(--color-text-secondary)] mt-1.5">{{ Math.min(q.trips_done, q.trips_required) }} of {{ q.trips_required }} trips</p>
    </div>
  </div>
</template>
