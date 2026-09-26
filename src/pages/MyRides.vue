<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const toast = ref('')
function showToast(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2500)
}

const ridesByMonth = [
  {
    label: 'Oct 2024',
    rides: [
      { location: 'Bahamar Resort', date: '20 Oct, 2:00', fare: '$12.98' },
      { location: 'Atlantis Paradise Island', date: '14 Oct, 11:30', fare: '$27.81' },
    ],
  },
  {
    label: 'Sept 2024',
    rides: [
      { location: 'Downtown Nassau', date: '28 Sept, 9:15', fare: '$9.91' },
      { location: 'Cable Beach', date: '12 Sept, 16:45', fare: '$13.56' },
    ],
  },
  {
    label: 'Aug 2024',
    rides: [
      { location: 'LPIA Airport', date: '25 Aug, 7:00', fare: '$19.37' },
      { location: 'Fish Fry Arawak Cay', date: '8 Aug, 19:20', fare: '$17.74' },
    ],
  },
  {
    label: 'July 2024',
    rides: [
      { location: "Potter's Cay Dock", date: '18 July, 13:10', fare: '$11.56' },
      { location: 'Fort Charlotte', date: '3 July, 10:45', fare: '$22.42' },
    ],
  },
]

const helpCategories = [
  'About RideUp',
  'App and Features',
  'Account and data',
  'Payments and pricing',
  'Using RideUp',
]
</script>

<template>
  <div class="min-h-screen bg-white text-[#1a1a1a]">
    <!-- Top Bar -->
    <div class="sticky top-0 z-10 flex items-center bg-white px-4 py-4">
      <button
        class="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-[#1a1a1a]/5"
        @click="window.history.length > 1 ? router.back() : router.push('/')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-[#1a1a1a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="flex-1 text-center text-xl font-bold text-[#1a1a1a] font-serif">My rides</h1>
      <div class="w-10"></div>
    </div>

    <!-- Ride Groups -->
    <div class="px-4 pb-4">
      <div v-for="group in ridesByMonth" :key="group.label" class="mb-6">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-[#1a1a1a]/40">
          {{ group.label }}
        </h2>

        <div
          v-for="(ride, idx) in group.rides"
          :key="idx"
          class="flex items-center justify-between border-b border-[#1a1a1a]/8 py-4 last:border-b-0"
        >
          <!-- Left: dot + info -->
          <div class="flex items-start gap-3">
            <div class="mt-1.5 h-3 w-3 shrink-0 rounded-full bg-[#58cc02]"></div>
            <div>
              <p class="text-base font-semibold text-[#1a1a1a]">{{ ride.location }}</p>
              <p class="mt-0.5 text-sm text-[#1a1a1a]/40">{{ ride.date }}</p>
            </div>
          </div>

          <!-- Right: fare -->
          <span class="text-base font-semibold text-[#1a1a1a]">{{ ride.fare }}</span>
        </div>
      </div>

      <!-- Older ride link -->
      <button @click="showToast('Coming soon')" class="mt-2 w-full text-center text-sm font-semibold text-[#58cc02] active:text-[#4ab300]">
        Select an older ride
      </button>
    </div>

    <!-- Divider -->
    <div class="h-2 bg-[#1a1a1a]/[0.03]"></div>

    <!-- Help Section -->
    <div class="px-4 py-6">
      <h2 class="mb-4 text-lg font-bold text-[#1a1a1a] font-serif">
        Get help with a recent ride
      </h2>

      <div>
        <button
          v-for="category in helpCategories"
          :key="category"
          class="flex w-full items-center justify-between border-b border-[#1a1a1a]/8 py-4 text-left last:border-b-0 active:bg-[#1a1a1a]/[0.03]"
          @click="showToast('Coming soon')"
        >
          <span class="text-base text-[#1a1a1a]">{{ category }}</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[#1a1a1a]/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Toast -->
    <Transition name="fade">
      <div v-if="toast" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a1a] text-white text-[13px] font-medium px-5 py-3 rounded-full shadow-lg">
        {{ toast }}
      </div>
    </Transition>
  </div>
</template>
