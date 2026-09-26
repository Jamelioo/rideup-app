<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const showCardModal = ref(false)
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

      <!-- Payment methods section -->
      <section>
        <h2 class="text-[13px] font-semibold text-[#1a1a1a]/50 uppercase tracking-wide mb-3">Payment method</h2>

        <div class="bg-white rounded-2xl border border-[#1a1a1a]/8 overflow-hidden">

          <!-- Cash — default selected -->
          <div class="flex items-center gap-4 px-5 py-4">
            <!-- Cash icon -->
            <div class="w-10 h-10 rounded-full bg-[#58cc02]/10 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#58cc02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <!-- Label -->
            <div class="flex-1">
              <span class="text-[15px] font-medium text-[#1a1a1a]">Cash</span>
              <p class="text-[13px] text-[#1a1a1a]/45 mt-0.5">Pay your driver directly</p>
            </div>
            <!-- Green checkmark -->
            <div class="w-6 h-6 rounded-full bg-[#58cc02] flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>

          <!-- Divider -->
          <div class="mx-5 border-t border-[#1a1a1a]/8"></div>

          <!-- Add debit/credit card -->
          <button @click="showCardModal = true" class="w-full flex items-center gap-4 px-5 py-4 active:bg-[#1a1a1a]/3 transition-colors">
            <!-- Card icon -->
            <div class="w-10 h-10 rounded-full bg-[#1a1a1a]/5 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-opacity="0.4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            </div>
            <!-- Label -->
            <span class="flex-1 text-left text-[15px] font-medium text-[#1a1a1a]/50">Add debit/credit card</span>
            <!-- Chevron right -->
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-opacity="0.3" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

        </div>
      </section>

      <!-- Info section -->
      <section class="mt-8">
        <div class="bg-[#f5f5f5] rounded-2xl px-5 py-5">
          <div class="flex gap-3.5">
            <div class="shrink-0 mt-0.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-opacity="0.35" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <div>
              <p class="text-[14px] font-semibold text-[#1a1a1a] leading-snug">Cash payments in Nassau</p>
              <p class="text-[13px] text-[#1a1a1a]/55 mt-1.5 leading-relaxed">
                All RideUp rides in Nassau are currently paid in cash directly to your driver at the end of your trip. Card and digital payment options are coming soon.
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>

    <!-- Card coming soon modal -->
    <Transition name="fade">
      <div v-if="showCardModal" class="fixed inset-0 z-50 flex items-end justify-center" @click.self="showCardModal = false">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/40" @click="showCardModal = false"></div>
        <!-- Sheet -->
        <div class="relative w-full max-w-lg bg-white rounded-t-3xl px-6 pt-6 pb-8 z-10">
          <!-- Handle -->
          <div class="w-10 h-1 rounded-full bg-[#1a1a1a]/15 mx-auto mb-5"></div>
          <!-- Icon -->
          <div class="w-14 h-14 rounded-2xl bg-[#58cc02]/10 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#58cc02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
          <!-- Text -->
          <h3 class="text-[17px] font-bold font-serif text-center text-[#1a1a1a]">Card payments coming soon</h3>
          <p class="text-[14px] text-[#1a1a1a]/55 text-center mt-2 leading-relaxed">
            We're working on adding debit and credit card support. For now, all rides are paid in cash directly to your driver.
          </p>
          <!-- Button -->
          <button
            @click="showCardModal = false"
            class="mt-6 w-full py-3.5 bg-[#58cc02] text-white text-[15px] font-bold rounded-xl active:bg-[#4ab300] transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
