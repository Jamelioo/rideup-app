<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const toast = ref('')
function showToast(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2500)
}

function goBack() {
  window.history.length > 1 ? router.back() : router.push('/')
}

const menuItems = [
  {
    label: 'Rate the app',
    icon: 'star',
    hasChevron: true,
  },
  {
    label: 'Follow us on social media',
    icon: 'share',
    hasChevron: true,
  },
  {
    label: 'Careers at RideUp',
    icon: 'people',
    hasChevron: true,
  },
  {
    label: 'Legal',
    icon: 'document',
    hasChevron: true,
    route: '/terms',
  },
]
</script>

<template>
  <div class="min-h-screen bg-white text-[#1a1a1a] flex flex-col">
    <!-- Top Bar -->
    <div class="flex items-center justify-between px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4">
      <button @click="goBack" class="w-10 h-10 flex items-center justify-center text-[#1a1a1a]">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="w-10 h-10"></div>
    </div>

    <!-- Title -->
    <div class="px-5 mb-6">
      <h1 class="text-3xl font-bold font-serif">About</h1>
    </div>

    <!-- Spacer -->
    <div class="h-4"></div>

    <!-- Menu Items -->
    <div class="px-5 flex-1">
      <!-- Version -->
      <div class="flex items-center justify-between py-4 border-b border-[#1a1a1a]/10">
        <div class="flex items-center gap-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#1a1a1a]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-base">Version</span>
        </div>
        <span class="text-sm text-[#1a1a1a]/50">1.0.0</span>
      </div>

      <!-- Dynamic Menu Items -->
      <button
        v-for="(item, index) in menuItems"
        :key="index"
        class="w-full flex items-center justify-between py-4 border-b border-[#1a1a1a]/10 transition-colors duration-150 hover:bg-[#1a1a1a]/[0.03] active:bg-[#1a1a1a]/[0.06] rounded-sm"
        @click="item.route ? router.push(item.route) : showToast('Coming soon')"
      >
        <div class="flex items-center gap-4">
          <!-- Star Icon -->
          <svg v-if="item.icon === 'star'" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#1a1a1a]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>

          <!-- Share Icon -->
          <svg v-else-if="item.icon === 'share'" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#1a1a1a]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>

          <!-- People Icon -->
          <svg v-else-if="item.icon === 'people'" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#1a1a1a]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>

          <!-- Document Icon -->
          <svg v-else-if="item.icon === 'document'" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#1a1a1a]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>

          <span class="text-base text-[#1a1a1a]">{{ item.label }}</span>
        </div>

        <!-- Chevron Right -->
        <svg v-if="item.hasChevron" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#1a1a1a]/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <!-- Footer -->
    <div class="py-8 text-center">
      <p class="text-sm text-[#1a1a1a]/40">RideUp Nassau</p>
    </div>

    <!-- Toast -->
    <Transition name="fade">
      <div v-if="toast" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a1a] text-white text-[13px] font-medium px-5 py-3 rounded-full shadow-lg">
        {{ toast }}
      </div>
    </Transition>
  </div>
</template>
