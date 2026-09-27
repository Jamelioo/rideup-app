<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { formatFare } from '../../lib/pricing'
import { generateFakeEarnings } from '../../lib/demoDriverMode'
import { DEMO_MODE } from '../../lib/demoMode'

const router = useRouter()
const activeTab = ref('today')

const earnings = ref(DEMO_MODE ? generateFakeEarnings() : { today: [], weeklyTotals: [0,0,0,0,0,0,0], weeklyTrips: [0,0,0,0,0,0,0] })

const todayTotal = computed(() => earnings.value.today.reduce((s, t) => s + t.fare_cents, 0))
const weeklyTotal = computed(() => earnings.value.weeklyTotals.reduce((s, v) => s + v, 0))
const weeklyTripsTotal = computed(() => earnings.value.weeklyTrips.reduce((s, v) => s + v, 0))
const maxDailyEarning = computed(() => Math.max(...earnings.value.weeklyTotals, 1))

onMounted(async () => {
  if (DEMO_MODE) return
  // Real earnings will come from Supabase rides table
  // For now, show empty state until backend queries are built
})
const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  return `${hrs}h ago`
}

function goBack() {
  router.back()
}
</script>

<template>
  <div class="min-h-screen bg-white text-[#191f1c]">
    <!-- Top bar -->
    <div class="flex items-center justify-between px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4">
      <button @click="goBack" class="w-10 h-10 flex items-center justify-center rounded-full active:bg-[#191f1c]/5">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-[17px] font-bold">Earnings</h1>
      <div class="w-10 h-10"></div>
    </div>

    <div class="max-w-lg mx-auto px-5 pb-8">
      <!-- Tab toggle -->
      <div class="flex bg-[#f5f5f5] rounded-xl p-1 mb-6">
        <button @click="activeTab = 'today'"
                class="flex-1 py-2.5 rounded-lg text-[14px] font-semibold transition-all"
                :class="activeTab === 'today' ? 'bg-white text-[#191f1c] shadow-sm' : 'text-[#191f1c]/40'">
          Today
        </button>
        <button @click="activeTab = 'week'"
                class="flex-1 py-2.5 rounded-lg text-[14px] font-semibold transition-all"
                :class="activeTab === 'week' ? 'bg-white text-[#191f1c] shadow-sm' : 'text-[#191f1c]/40'">
          This Week
        </button>
      </div>

      <!-- TODAY TAB -->
      <div v-if="activeTab === 'today'">
        <div class="text-center mb-6">
          <div class="text-[36px] font-bold font-serif">{{ formatFare(todayTotal) }}</div>
          <div class="text-[13px] text-[#191f1c]/50 mt-1">{{ earnings.today.length }} trips</div>
        </div>

        <p class="text-[11px] font-semibold text-[#191f1c]/40 uppercase tracking-wider mb-3 px-1">Completed trips</p>
        <div class="space-y-2">
          <div v-for="trip in earnings.today" :key="trip.id"
               class="bg-[#f5f5f5] rounded-2xl px-4 py-3.5 flex items-center justify-between">
            <div>
              <div class="text-[14px] font-semibold">{{ trip.pickup_address.split(',')[0] }} → {{ trip.dropoff_address.split(',')[0] }}</div>
              <div class="text-[11px] text-[#191f1c]/40 mt-0.5">{{ timeAgo(trip.completed_at) }} · {{ trip.distance_miles.toFixed(1) }} mi</div>
            </div>
            <div class="text-[15px] font-bold text-[#2b8659]">+{{ formatFare(trip.fare_cents) }}</div>
          </div>
        </div>

        <div v-if="earnings.today.length === 0" class="text-center text-[13px] text-[#191f1c]/40 py-10">
          No trips today yet
        </div>
      </div>

      <!-- WEEK TAB -->
      <div v-else>
        <div class="text-center mb-6">
          <div class="text-[36px] font-bold font-serif">{{ formatFare(weeklyTotal) }}</div>
          <div class="text-[13px] text-[#191f1c]/50 mt-1">{{ weeklyTripsTotal }} trips this week</div>
        </div>

        <!-- Bar chart -->
        <div class="bg-[#f5f5f5] rounded-2xl p-5 mb-6">
          <div class="flex items-end justify-between gap-2 h-[120px]">
            <div v-for="(total, i) in earnings.weeklyTotals" :key="i" class="flex-1 flex flex-col items-center gap-1">
              <div class="w-full rounded-lg transition-all"
                   :style="{ height: (total / maxDailyEarning * 100) + '%', minHeight: total > 0 ? '8px' : '2px' }"
                   :class="total > 0 ? 'bg-[#2b8659]' : 'bg-[#191f1c]/10'">
              </div>
            </div>
          </div>
          <div class="flex justify-between mt-2">
            <div v-for="(label, i) in dayLabels" :key="label" class="flex-1 text-center text-[10px] font-medium"
                 :class="earnings.weeklyTotals[i] > 0 ? 'text-[#191f1c]/60' : 'text-[#191f1c]/25'">
              {{ label }}
            </div>
          </div>
        </div>

        <!-- Daily breakdown -->
        <p class="text-[11px] font-semibold text-[#191f1c]/40 uppercase tracking-wider mb-3 px-1">Daily breakdown</p>
        <div class="space-y-2">
          <div v-for="(total, i) in earnings.weeklyTotals" :key="i"
               class="flex items-center justify-between px-4 py-3 bg-[#f5f5f5] rounded-xl">
            <div class="flex items-center gap-3">
              <span class="text-[13px] font-semibold w-8">{{ dayLabels[i] }}</span>
              <span class="text-[12px] text-[#191f1c]/40">{{ earnings.weeklyTrips[i] }} trips</span>
            </div>
            <span class="text-[14px] font-bold font-serif" :class="total > 0 ? '' : 'text-[#191f1c]/25'">{{ formatFare(total) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
