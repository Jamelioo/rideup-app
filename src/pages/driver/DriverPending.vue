<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { useAuth } from '../../lib/useAuth'
import { DEMO_MODE } from '../../lib/demoMode'

const router = useRouter()
const { user } = useAuth()

const checking = ref(false)
const statusMessage = ref('')

async function checkStatus() {
  if (DEMO_MODE) {
    router.push('/driver/dashboard')
    return
  }
  if (!supabaseConfigured || !user.value) return

  checking.value = true
  statusMessage.value = ''

  const { data, error } = await supabase
    .from('drivers')
    .select('approved')
    .eq('auth_user_id', user.value.id)
    .single()

  checking.value = false

  if (error || !data) {
    statusMessage.value = 'Could not check status. Please try again.'
    return
  }
  if (data.approved) {
    router.push('/driver/dashboard')
  } else {
    statusMessage.value = 'Your application is still under review.'
  }
}
</script>

<template>
  <div class="min-h-screen bg-white text-[#191f1c] flex flex-col items-center justify-center px-6">
    <div class="max-w-sm w-full text-center">
      <!-- Logo -->
      <div class="text-2xl font-bold mb-10">Ride<span class="text-[#2b8659]">Up</span></div>

      <!-- Icon -->
      <div class="w-20 h-20 rounded-full bg-[#2b8659]/10 flex items-center justify-center mx-auto mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <h1 class="text-[26px] font-bold mb-3">Application Under Review</h1>
      <p class="text-[#191f1c]/50 text-[14px] leading-relaxed mb-8">
        We're reviewing your application. You'll receive an email when you're approved to start driving.
      </p>

      <p v-if="statusMessage" class="text-[13px] mb-4" :class="statusMessage.includes('still') ? 'text-[#191f1c]/50' : 'text-red-500'">
        {{ statusMessage }}
      </p>

      <button @click="checkStatus" :disabled="checking"
              class="w-full py-4 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px] transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(88,204,2,0.3)] disabled:opacity-50">
        {{ checking ? 'Checking...' : 'Check Status' }}
      </button>

      <button v-if="DEMO_MODE" @click="router.push('/driver/dashboard')"
              class="w-full py-3 mt-3 text-[#2b8659] font-semibold text-[14px]">
        Skip to Dashboard (Demo)
      </button>

      <router-link to="/welcome" class="block mt-6 text-[14px] text-[#191f1c]/40 hover:text-[#191f1c]/60">
        Back to Home
      </router-link>
    </div>
  </div>
</template>
