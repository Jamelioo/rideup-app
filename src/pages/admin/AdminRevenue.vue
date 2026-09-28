<template>
  <div>
    <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-6">Revenue</h1>

    <!-- Big number cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
      <div v-for="card in revenueCards" :key="card.label" class="bg-[var(--color-surface)] rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
        <p class="text-sm text-gray-500 mb-1">{{ card.label }}</p>
        <p class="text-2xl font-bold text-[var(--color-text-primary)]">{{ card.value }}</p>
      </div>
    </div>

    <!-- 30-day bar chart -->
    <div class="bg-[var(--color-surface)] rounded-xl border border-gray-200 p-5 mb-8">
      <h2 class="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Daily Revenue — Last 30 Days</h2>
      <div class="flex items-end gap-[3px] h-44 overflow-x-auto pb-2">
        <div
          v-for="(day, i) in dailyRevenue"
          :key="i"
          class="flex flex-col items-center gap-1 min-w-[14px]"
        >
          <div
            class="w-full rounded-t bg-[#2b8659] hover:bg-[#236e49] transition-colors cursor-default"
            :style="{ height: (day.amount / maxRevenue) * 140 + 'px' }"
            :title="`${day.label}: $${day.amount.toLocaleString()}`"
          />
        </div>
      </div>
      <div class="flex justify-between mt-2 text-xs text-gray-400">
        <span>{{ dailyRevenue[0]?.label }}</span>
        <span>{{ dailyRevenue[dailyRevenue.length - 1]?.label }}</span>
      </div>
    </div>

    <!-- Stats row -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="bg-[var(--color-surface)] rounded-xl border border-gray-200 p-5">
        <p class="text-sm text-gray-500 mb-1">Average Fare</p>
        <p class="text-xl font-bold text-[var(--color-text-primary)]">$22.35</p>
      </div>
      <div class="bg-[var(--color-surface)] rounded-xl border border-gray-200 p-5">
        <p class="text-sm text-gray-500 mb-1">Total Rides (All Time)</p>
        <p class="text-xl font-bold text-[var(--color-text-primary)]">12,847</p>
      </div>
      <div class="bg-[var(--color-surface)] rounded-xl border border-gray-200 p-5">
        <p class="text-sm text-gray-500 mb-1">Active Drivers</p>
        <p class="text-xl font-bold text-[var(--color-text-primary)]">38</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'

const revenueCards = ref([
  { label: 'Today', value: '$0.00' },
  { label: 'This Week', value: '$0.00' },
  { label: 'This Month', value: '$0.00' },
  { label: 'All Time', value: '$0.00' },
])

// Generate default 30 days of empty data
function generateDailyRevenue() {
  const days = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const label = `${d.getMonth() + 1}/${d.getDate()}`
    days.push({ label, amount: 0 })
  }
  return days
}

const dailyRevenue = ref(generateDailyRevenue())
const maxRevenue = computed(() => Math.max(1, ...dailyRevenue.value.map(d => d.amount)))

onMounted(async () => {
  if (!supabaseConfigured) return
  try {
    const { data, error } = await supabase
      .from('rides')
      .select('fare_cents, created_at')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })

    if (!error && data) {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekStart = new Date(todayStart)
      weekStart.setDate(weekStart.getDate() - 7)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      let todayRev = 0, weekRev = 0, monthRev = 0, allTimeRev = 0
      const dailyMap = {}

      data.forEach(r => {
        const cents = r.fare_cents || 0
        const date = new Date(r.created_at)
        allTimeRev += cents
        if (date >= todayStart) todayRev += cents
        if (date >= weekStart) weekRev += cents
        if (date >= monthStart) monthRev += cents

        const dayKey = date.toISOString().split('T')[0]
        dailyMap[dayKey] = (dailyMap[dayKey] || 0) + cents
      })

      const fmt = (c) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      revenueCards.value = [
        { label: 'Today', value: fmt(todayRev) },
        { label: 'This Week', value: fmt(weekRev) },
        { label: 'This Month', value: fmt(monthRev) },
        { label: 'All Time', value: fmt(allTimeRev) },
      ]

      // Last 30 days chart
      const chartData = []
      for (let i = 29; i >= 0; i--) {
        const d = new Date(todayStart)
        d.setDate(d.getDate() - i)
        const key = d.toISOString().split('T')[0]
        const label = `${d.getMonth() + 1}/${d.getDate()}`
        chartData.push({ label, amount: (dailyMap[key] || 0) / 100 })
      }
      dailyRevenue.value = chartData
    }
  } catch (e) { /* keep defaults */ }
})
</script>
