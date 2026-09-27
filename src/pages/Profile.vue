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

function goBack() {
  router.back()
}

function goToBooking() {
  router.push('/book')
}

const showDeleteConfirm = ref(false)

function handleDeleteAccount() {
  showDeleteConfirm.value = true
}

async function handleLogout() {
  await signOut()
  router.push('/welcome')
}
</script>

<template>
  <div class="min-h-screen bg-white font-[var(--font-sans)] text-[#191f1c] flex flex-col">
    <!-- Top Bar -->
    <div class="flex items-center justify-between px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4 max-w-lg mx-auto w-full">
      <button @click="goBack" class="w-10 h-10 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button @click="router.push('/edit-profile')" class="w-10 h-10 flex items-center justify-center rounded-full active:bg-[#191f1c]/5">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
    </div>

    <!-- Avatar & Name -->
    <div class="flex flex-col items-center mt-4 mb-6 max-w-lg mx-auto w-full">
      <div class="w-20 h-20 rounded-full bg-[#2b8659] flex items-center justify-center mb-4">
        <span class="text-white text-2xl font-bold">{{ initials }}</span>
      </div>
      <h1 class="text-2xl font-bold">{{ displayName }}</h1>

      <!-- Rating display -->
      <div class="flex items-center gap-1.5 mt-2">
        <svg class="w-4 h-4 text-[#2b8659]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        <span class="text-[15px] font-bold">4.9</span>
        <span class="text-[13px] text-[#191f1c]/40">(28 rides)</span>
      </div>
    </div>

    <!-- Email -->
    <div class="flex items-center justify-center gap-2 mb-8">
      <span class="text-[#191f1c]/50 text-sm">{{ displayEmail }}</span>
    </div>

    <!-- Favorite Locations -->
    <div class="px-5 max-w-lg mx-auto w-full">
      <h2 class="text-xs font-semibold text-[#191f1c]/40 uppercase tracking-wider mb-3">Favorite locations</h2>

      <div class="flex items-center justify-between py-4 border-b border-[#191f1c]/8">
        <div class="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#191f1c]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
          </svg>
          <span class="text-base">Home</span>
        </div>
        <button @click="goToBooking" class="text-[#2b8659] text-sm font-bold uppercase tracking-wide">Add</button>
      </div>

      <div class="flex items-center justify-between py-4 border-b border-[#191f1c]/8">
        <div class="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#191f1c]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0H8m8 0a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2" />
          </svg>
          <span class="text-base">Work</span>
        </div>
        <button @click="goToBooking" class="text-[#2b8659] text-sm font-bold uppercase tracking-wide">Add</button>
      </div>
    </div>

    <!-- Safety -->
    <div class="px-5 mt-2">
      <button @click="router.push('/trusted-contacts')" class="w-full flex items-center justify-between py-4 border-b border-[#191f1c]/8">
        <div class="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span class="text-base">Safety</span>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#191f1c]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <!-- Communication Preferences -->
    <div class="px-5">
      <button @click="router.push('/support')" class="w-full flex items-center justify-between py-4">
        <span class="text-base">Communication Preferences</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#191f1c]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <!-- Divider -->
    <div class="border-t border-[#191f1c]/10 mx-5 mt-2"></div>

    <!-- Log Out -->
    <div class="px-5 mt-4">
      <button @click="handleLogout" class="text-red-500 text-base font-medium">Log out</button>
    </div>

    <!-- Delete Account -->
    <div class="px-5 mt-3 mb-8">
      <button @click="handleDeleteAccount" class="text-[#191f1c]/40 text-sm">Delete account</button>
    </div>

    <!-- Delete Account Confirmation -->
    <Transition name="fade">
      <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-end justify-center bg-black/40" @click.self="showDeleteConfirm = false">
        <div class="w-full max-w-md bg-white rounded-t-3xl px-6 pt-8 pb-10 shadow-xl">
          <h3 class="text-lg font-bold mb-2">Delete your account?</h3>
          <p class="text-[14px] text-[#191f1c]/50 mb-6">To delete your account, please contact our support team. They'll process your request and remove all your data.</p>
          <a href="tel:+12424529911" class="block w-full py-3.5 bg-red-500 text-white font-bold rounded-xl text-[14px] text-center mb-3">
            Call Support (242) 452-9911
          </a>
          <a href="https://wa.me/12424529911?text=I%20would%20like%20to%20delete%20my%20RideUp%20account" target="_blank" class="block w-full py-3.5 bg-[#191f1c]/[0.04] text-[#191f1c] font-bold rounded-xl text-[14px] text-center mb-3">
            WhatsApp Support
          </a>
          <button @click="showDeleteConfirm = false" class="w-full py-3 text-[14px] text-[#191f1c]/50 font-medium">Cancel</button>
        </div>
      </div>
    </Transition>

    <!-- Toast -->
    <Transition name="fade">
      <div v-if="toast" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#191f1c] text-white text-[13px] font-medium px-5 py-3 rounded-full shadow-lg">
        {{ toast }}
      </div>
    </Transition>
  </div>
</template>
