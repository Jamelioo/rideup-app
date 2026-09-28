<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDriver } from '../../lib/useDriver'
import { useAuth } from '../../lib/useAuth'
import { DEMO_MODE } from '../../lib/demoMode'

const router = useRouter()
const { driver } = useDriver()
const { signOut } = useAuth()

const toast = ref('')

function showToast(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2500)
}

const initials = computed(() => {
  if (!driver.value?.name) return 'DR'
  return driver.value.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
})

const memberSince = computed(() => {
  if (!driver.value?.created_at) return ''
  return new Date(driver.value.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
})

async function handleLogout() {
  await signOut()
  router.push('/welcome')
}

function goBack() {
  router.back()
}
</script>

<template>
  <div class="min-h-screen bg-white text-[#191f1c]">
    <!-- Top bar -->
    <div class="flex items-center justify-between px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4 max-w-lg mx-auto w-full">
      <button @click="goBack" class="w-10 h-10 flex items-center justify-center rounded-full active:bg-[#191f1c]/5">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-[17px] font-bold">Profile</h1>
      <div class="w-10 h-10"></div>
    </div>

    <div class="max-w-lg mx-auto px-5 pb-8">
      <!-- Avatar + name -->
      <div class="text-center mb-8">
        <div class="w-20 h-20 rounded-full bg-[#2b8659] flex items-center justify-center mx-auto mb-3 text-white text-2xl font-bold">
          {{ initials }}
        </div>
        <h2 class="text-xl font-bold">{{ driver?.name || 'Driver' }}</h2>
        <p class="text-[14px] text-[#191f1c]/50 mt-1">★ {{ driver?.rating || '5.0' }} · {{ driver?.total_trips || 0 }} trips</p>
      </div>

      <!-- Vehicle -->
      <div class="mb-6">
        <p class="text-[11px] font-semibold text-[#191f1c]/40 uppercase tracking-wider mb-3">Vehicle</p>
        <div class="bg-[#f5f5f5] rounded-2xl p-4 space-y-2">
          <div class="flex justify-between">
            <span class="text-[13px] text-[#191f1c]/50">Vehicle</span>
            <span class="text-[14px] font-semibold">{{ driver?.vehicle_make }} {{ driver?.vehicle_model }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[13px] text-[#191f1c]/50">Color</span>
            <span class="text-[14px] font-semibold">{{ driver?.vehicle_color || '—' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[13px] text-[#191f1c]/50">Plate</span>
            <span class="text-[14px] font-semibold uppercase">{{ driver?.vehicle_plate || '—' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[13px] text-[#191f1c]/50">Type</span>
            <span class="text-[14px] font-semibold capitalize">{{ driver?.vehicle_type || 'standard' }}</span>
          </div>
        </div>
        <button @click="showToast('Contact support at (242) 452-9911')" class="text-[13px] text-[#2b8659] font-semibold mt-2 px-1">Edit Vehicle</button>
      </div>

      <!-- Stats -->
      <div class="mb-6">
        <p class="text-[11px] font-semibold text-[#191f1c]/40 uppercase tracking-wider mb-3">Stats</p>
        <div class="bg-[#f5f5f5] rounded-2xl p-4 space-y-2">
          <div class="flex justify-between">
            <span class="text-[13px] text-[#191f1c]/50">Acceptance rate</span>
            <span class="text-[14px] font-semibold">{{ driver?.acceptance_rate != null ? driver.acceptance_rate + '%' : '—' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[13px] text-[#191f1c]/50">Cancellation rate</span>
            <span class="text-[14px] font-semibold">{{ driver?.cancellation_rate != null ? driver.cancellation_rate + '%' : '—' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[13px] text-[#191f1c]/50">Member since</span>
            <span class="text-[14px] font-semibold">{{ memberSince }}</span>
          </div>
        </div>
      </div>

      <!-- Documents -->
      <div class="mb-6">
        <p class="text-[11px] font-semibold text-[#191f1c]/40 uppercase tracking-wider mb-3">Documents</p>
        <div class="bg-[#f5f5f5] rounded-2xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-[14px]">Driver's License</span>
            <span class="text-[12px] text-[#2b8659] font-semibold">✓ On file</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[14px]">Insurance</span>
            <span class="text-[12px] text-[#2b8659] font-semibold">✓ On file</span>
          </div>
        </div>
        <button @click="router.push('/driver/documents')" class="text-[13px] text-[#2b8659] font-semibold mt-2 px-1">Upload / Update</button>
      </div>

      <!-- Account -->
      <div class="mb-6">
        <p class="text-[11px] font-semibold text-[#191f1c]/40 uppercase tracking-wider mb-3">Account</p>
        <div class="bg-[#f5f5f5] rounded-2xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-[13px] text-[#191f1c]/50">Phone</div>
              <div class="text-[14px] font-semibold">{{ driver?.phone || '—' }}</div>
            </div>
            <button @click="showToast('Contact support at (242) 452-9911')" class="text-[12px] text-[#2b8659] font-semibold">Edit</button>
          </div>
          <div class="border-t border-[#191f1c]/8"></div>
          <div class="flex items-center justify-between">
            <div>
              <div class="text-[13px] text-[#191f1c]/50">Email</div>
              <div class="text-[14px] font-semibold">{{ driver?.email || '—' }}</div>
            </div>
            <button @click="showToast('Contact support at (242) 452-9911')" class="text-[12px] text-[#2b8659] font-semibold">Edit</button>
          </div>
        </div>
        <button @click="showToast('Contact support at (242) 452-9911')" class="text-[13px] text-[#191f1c]/50 font-semibold mt-2 px-1 underline underline-offset-2">Change Password</button>
      </div>

      <!-- Switch + Logout -->
      <div class="space-y-2 mt-8">
        <button @click="router.push('/book')"
                class="w-full py-3.5 border-2 border-[#191f1c]/10 text-[14px] font-semibold rounded-2xl active:bg-[#191f1c]/5 transition-colors">
          Switch to Rider
        </button>
        <button @click="handleLogout"
                class="w-full py-3.5 text-red-500 text-[14px] font-semibold rounded-2xl active:bg-red-50 transition-colors">
          Log Out
        </button>
      </div>
    </div>

    <!-- Toast -->
    <Transition name="fade">
      <div v-if="toast" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#191f1c] text-white text-[13px] font-medium px-5 py-3 rounded-full shadow-lg">
        {{ toast }}
      </div>
    </Transition>
  </div>
</template>
