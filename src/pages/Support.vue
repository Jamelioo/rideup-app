<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const toast = ref('')
function showToast(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2500)
}

const recentRides = [
  { destination: 'Bahamar Resort', fare: '$12.98', date: '20 Oct, 2:00' },
  { destination: 'Downtown Nassau', fare: '$9.91', date: '15 Sept, 7:00' },
]

const faqCategories = [
  'About RideUp',
  'App and Features',
  'Account and data',
  'Payments and pricing',
  'Using RideUp',
]

function close() {
  window.history.length > 1 ? router.back() : router.push('/')
}
</script>

<template>
  <div class="min-h-screen bg-white text-[#1a1a1a]">

    <!-- Top bar -->
    <div class="sticky top-0 z-40 bg-white border-b border-[#1a1a1a]/8">
      <div class="flex items-center justify-between px-5 py-4">
        <button
          @click="close"
          class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#1a1a1a]/5 transition-colors"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <span class="text-[15px] font-semibold">Get Help</span>
        <div class="w-9"></div>
      </div>
    </div>

    <!-- Content -->
    <div class="max-w-lg mx-auto px-5 pt-8 pb-16">

      <!-- Main heading -->
      <h1 class="font-serif text-[28px] font-bold leading-tight mb-8">
        How can we help?
      </h1>

      <!-- Support cases -->
      <div class="mb-8">
        <h2 class="text-[13px] font-semibold text-[#1a1a1a]/50 uppercase tracking-wider mb-3">
          Support cases
        </h2>
        <button
          @click="showToast('Coming soon')"
          class="w-full flex items-center justify-between px-4 py-4 bg-[#1a1a1a]/[0.03] rounded-xl hover:bg-[#1a1a1a]/[0.05] transition-colors"
        >
          <div class="text-left">
            <div class="text-[15px] font-semibold">Inbox</div>
            <div class="text-[13px] text-[#1a1a1a]/50 mt-0.5">View open chats</div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#1a1a1a]/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      <!-- Recent rides -->
      <div class="mb-8">
        <h2 class="text-[13px] font-semibold text-[#1a1a1a]/50 uppercase tracking-wider mb-3">
          Get help with a recent ride
        </h2>
        <div class="flex flex-col gap-2">
          <button
            v-for="ride in recentRides"
            :key="ride.destination"
            class="w-full flex items-center justify-between px-4 py-4 bg-[#1a1a1a]/[0.03] rounded-xl hover:bg-[#1a1a1a]/[0.05] transition-colors"
            @click="showToast('Coming soon')"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-[#58cc02]/10 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#58cc02]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
              </div>
              <div class="text-left">
                <div class="text-[15px] font-semibold">{{ ride.destination }}</div>
                <div class="text-[13px] text-[#1a1a1a]/50 mt-0.5">{{ ride.date }}</div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[15px] font-semibold text-[#1a1a1a]/70">{{ ride.fare }}</span>
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#1a1a1a]/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </button>
        </div>
      </div>

      <!-- FAQ categories -->
      <div>
        <h2 class="text-[13px] font-semibold text-[#1a1a1a]/50 uppercase tracking-wider mb-3">
          Frequently asked questions
        </h2>
        <div class="flex flex-col gap-2">
          <button
            v-for="category in faqCategories"
            :key="category"
            class="w-full flex items-center justify-between px-4 py-4 bg-[#1a1a1a]/[0.03] rounded-xl hover:bg-[#1a1a1a]/[0.05] transition-colors"
            @click="showToast('Coming soon')"
          >
            <span class="text-[15px] font-semibold">{{ category }}</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#1a1a1a]/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
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
