<template>
  <div>
    <h1 class="text-2xl font-bold text-[#191f1c] mb-6">Revenue</h1>

    <!-- Big number cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
      <div v-for="card in revenueCards" :key="card.label" class="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
        <p class="text-sm text-gray-500 mb-1">{{ card.label }}</p>
        <p class="text-2xl font-bold text-[#191f1c]">{{ card.value }}</p>
      </div>
    </div>

    <!-- 30-day bar chart -->
    <div class="bg-white rounded-xl border border-gray-200 p-5 mb-8">
      <h2 class="text-sm font-semibold text-[#191f1c] mb-4">Daily Revenue — Last 30 Days</h2>
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
      <div class="bg-white rounded-xl border border-gray-200 p-5">
        <p class="text-sm text-gray-500 mb-1">Average Fare</p>
        <p class="text-xl font-bold text-[#191f1c]">$22.35</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-5">
        <p class="text-sm text-gray-500 mb-1">Total Rides (All Time)</p>
        <p class="text-xl font-bold text-[#191f1c]">12,847</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-5">
        <p class="text-sm text-gray-500 mb-1">Active Drivers</p>
        <p class="text-xl font-bold text-[#191f1c]">38</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'

const revenueCards = ref([
  { label: 'All-Time Revenue', value: '$287,430.00' },
  { label: 'This Month', value: '$42,680.50' },
  { label: 'This Week', value: '$11,245.75' },
  { label: 'Today', value: '$4,280.50' },
])

// Generate 30 days of mock revenue data
function generateDailyRevenue() {
  const days = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const label = `${d.getMonth() + 1}/${d.getDate()}`
    // Realistic-ish revenue with weekday/weekend variance
    const isWeekend = d.getDay() === 0 || d.getDay() === 6
    const base = isWeekend ? 5200 : 3800
    const amount = Math.round(base + Math.random() * 2000)
    days.push({ label, amount })
  }
  return days
}

const dailyRevenue = ref(generateDailyRevenue())
const maxRevenue = computed(() => Math.max(...dailyRevenue.value.map(d => d.amount)))

onMounted(async () => {
  if (!supabaseConfigured) return
  try {
    const { data, error } = await supabase.from('rides').select('fare, created_at').eq('status', 'Completed')
    if (!error && data && data.length > 0) {
      const allTime = data.reduce((sum, r) => sum + (r.fare || 0), 0)
      revenueCards.value[0].value = `$${allTime.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    }
  } catch (e) { /* keep placeholder data */ }
})
</script>
