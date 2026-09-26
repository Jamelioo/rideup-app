<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const toast = ref('')
function showToast(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2500)
}
</script>

<template>
  <div class="min-h-screen bg-white text-[#1a1a1a]">

    <!-- Top bar -->
    <div class="sticky top-0 z-40 bg-white border-b border-[#1a1a1a]/8">
      <div class="flex items-center px-4 py-3.5">
        <button
          @click="window.history.length > 1 ? router.back() : router.push('/')"
          class="w-9 h-9 flex items-center justify-center rounded-full active:bg-[#1a1a1a]/5 transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 class="flex-1 text-center text-[17px] font-bold font-serif">Payments</h1>
        <div class="w-9"></div>
      </div>
    </div>

    <div class="px-5 pt-6 pb-10 max-w-lg mx-auto">

      <!-- RideUp balance section -->
      <section>
        <h2 class="text-[13px] font-semibold text-[#1a1a1a]/50 uppercase tracking-wide mb-3">RideUp balance</h2>

        <div class="bg-white rounded-2xl border border-[#1a1a1a]/8 overflow-hidden">
          <!-- Balance amount -->
          <div class="px-5 pt-5 pb-4">
            <p class="text-[32px] font-bold font-serif text-[#1a1a1a] leading-tight">$0.00</p>
            <p class="text-[13px] text-[#1a1a1a]/45 mt-1.5 leading-snug">
              RideUp balance is not available with this payment method
            </p>
            <button @click="showToast('Coming soon')" class="mt-3 text-[14px] font-semibold text-[#58cc02] active:text-[#4ab300] transition-colors">
              What is RideUp balance?
            </button>
          </div>

          <!-- Divider -->
          <div class="mx-5 border-t border-[#1a1a1a]/8"></div>

          <!-- See transactions -->
          <button @click="showToast('Coming soon')" class="w-full px-5 py-4 text-left active:bg-[#1a1a1a]/3 transition-colors">
            <span class="text-[14px] font-semibold text-[#58cc02]">See transactions</span>
          </button>
        </div>
      </section>

      <!-- Payment methods section -->
      <section class="mt-8">
        <h2 class="text-[13px] font-semibold text-[#1a1a1a]/50 uppercase tracking-wide mb-3">Payment methods</h2>

        <div class="bg-white rounded-2xl border border-[#1a1a1a]/8 overflow-hidden">

          <!-- Add debit/credit card -->
          <button @click="showToast('Coming soon')" class="w-full flex items-center gap-4 px-5 py-4 active:bg-[#1a1a1a]/3 transition-colors">
            <!-- Card icon -->
            <div class="w-10 h-10 rounded-full bg-[#1a1a1a]/5 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            </div>
            <!-- Label -->
            <span class="flex-1 text-left text-[15px] font-medium text-[#1a1a1a]">Add debit/credit card</span>
            <!-- Chevron right -->
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-opacity="0.3" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          <!-- Divider -->
          <div class="mx-5 border-t border-[#1a1a1a]/8"></div>

          <!-- Set up work profile -->
          <button @click="showToast('Coming soon')" class="w-full flex items-center gap-4 px-5 py-4 active:bg-[#1a1a1a]/3 transition-colors">
            <!-- Briefcase icon -->
            <div class="w-10 h-10 rounded-full bg-[#1a1a1a]/5 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <!-- Label -->
            <span class="flex-1 text-left text-[15px] font-medium text-[#1a1a1a]">Set up work profile</span>
            <!-- Chevron right -->
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-opacity="0.3" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

        </div>
      </section>

    </div>

    <!-- Toast -->
    <Transition name="fade">
      <div v-if="toast" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a1a] text-white text-[13px] font-medium px-5 py-3 rounded-full shadow-lg">
        {{ toast }}
      </div>
    </Transition>
  </div>
</template>
