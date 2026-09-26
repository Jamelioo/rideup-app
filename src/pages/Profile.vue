<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../lib/useAuth'

const router = useRouter()
const { user, signOut } = useAuth()

const toast = ref('')
function showToast(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2500)
}

const displayName = computed(() => user.value?.user_metadata?.name || 'Rider')
const displayEmail = computed(() => user.value?.email || '')
const initials = computed(() =>
  displayName.value
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
)

async function handleLogout() {
  await signOut()
  router.push('/welcome')
}
</script>

<template>
  <div class="min-h-screen bg-white font-[var(--font-sans)] text-[#1a1a1a] flex flex-col">
    <!-- Top Bar -->
    <div class="flex items-center justify-between px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4 max-w-lg mx-auto w-full">
      <button @click="window.history.length > 1 ? router.back() : router.push('/')" class="w-10 h-10 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button @click="showToast('Coming soon')" class="w-10 h-10 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
    </div>

    <!-- Avatar & Name -->
    <div class="flex flex-col items-center mt-4 mb-6 max-w-lg mx-auto w-full">
      <div class="w-20 h-20 rounded-full bg-[#58cc02] flex items-center justify-center mb-4">
        <span class="text-white text-2xl font-bold font-serif">{{ initials }}</span>
      </div>
      <h1 class="text-2xl font-bold font-serif">{{ displayName }}</h1>
    </div>

    <!-- Email -->
    <div class="flex items-center justify-center gap-2 mb-8">
      <span class="text-[#1a1a1a]/50 text-sm">{{ displayEmail }}</span>
    </div>

    <!-- Favorite Locations -->
    <div class="px-5 max-w-lg mx-auto w-full">
      <h2 class="text-xs font-semibold text-[#1a1a1a]/40 uppercase tracking-wider mb-3">Favorite locations</h2>

      <div class="flex items-center justify-between py-4 border-b border-[#1a1a1a]/8">
        <div class="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#1a1a1a]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
          </svg>
          <span class="text-base">Home</span>
        </div>
        <button @click="showToast('Coming soon')" class="text-[#58cc02] text-sm font-bold uppercase tracking-wide">Add</button>
      </div>

      <div class="flex items-center justify-between py-4 border-b border-[#1a1a1a]/8">
        <div class="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#1a1a1a]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0H8m8 0a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2" />
          </svg>
          <span class="text-base">Work</span>
        </div>
        <button @click="showToast('Coming soon')" class="text-[#58cc02] text-sm font-bold uppercase tracking-wide">Add</button>
      </div>
    </div>

    <!-- Communication Preferences -->
    <div class="px-5 mt-2">
      <button @click="showToast('Coming soon')" class="w-full flex items-center justify-between py-4">
        <span class="text-base">Communication Preferences</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#1a1a1a]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <!-- Divider -->
    <div class="border-t border-[#1a1a1a]/10 mx-5 mt-2"></div>

    <!-- Log Out -->
    <div class="px-5 mt-4">
      <button @click="handleLogout" class="text-red-500 text-base font-medium">Log out</button>
    </div>

    <!-- Delete Account -->
    <div class="px-5 mt-3 mb-8">
      <button @click="showToast('Coming soon')" class="text-[#1a1a1a]/40 text-sm">Delete account</button>
    </div>

    <!-- Toast -->
    <Transition name="fade">
      <div v-if="toast" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a1a] text-white text-[13px] font-medium px-5 py-3 rounded-full shadow-lg">
        {{ toast }}
      </div>
    </Transition>
  </div>
</template>
