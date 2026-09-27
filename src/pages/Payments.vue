<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const showCardModal = ref(false)
</script>

<template>
  <div class="min-h-screen bg-white text-[#191f1c]">

    <!-- Top bar -->
    <div class="sticky top-0 z-40 bg-white border-b border-[#191f1c]/8">
      <div class="flex items-center px-4 py-3.5">
        <button
          @click="router.back()"
          class="w-9 h-9 flex items-center justify-center rounded-full active:bg-[#191f1c]/5 transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#191f1c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
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
        <h2 class="text-[13px] font-semibold text-[#191f1c]/50 uppercase tracking-wide mb-3">Payment method</h2>

        <div class="bg-white rounded-2xl border border-[#191f1c]/8 overflow-hidden">

          <!-- Card payment — default selected -->
          <div class="flex items-center gap-4 px-5 py-4">
            <!-- Card icon -->
            <div class="w-10 h-10 rounded-full bg-[#2b8659]/10 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2b8659" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            </div>
            <!-- Label -->
            <div class="flex-1">
              <span class="text-[15px] font-medium text-[#191f1c]">Debit/Credit Card</span>
              <p class="text-[13px] text-[#191f1c]/45 mt-0.5">Charged automatically after your ride</p>
            </div>
            <!-- Green checkmark -->
            <div class="w-6 h-6 rounded-full bg-[#2b8659] flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>

          <!-- Divider -->
          <div class="mx-5 border-t border-[#191f1c]/8"></div>

          <!-- Add another card -->
          <button @click="showCardModal = true" class="w-full flex items-center gap-4 px-5 py-4 active:bg-[#191f1c]/3 transition-colors">
            <!-- Plus icon -->
            <div class="w-10 h-10 rounded-full bg-[#191f1c]/5 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#191f1c" stroke-opacity="0.4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <!-- Label -->
            <span class="flex-1 text-left text-[15px] font-medium text-[#191f1c]/50">Add another card</span>
            <!-- Chevron right -->
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#191f1c" stroke-opacity="0.3" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#191f1c" stroke-opacity="0.35" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <div>
              <p class="text-[14px] font-semibold text-[#191f1c] leading-snug">Card payments in Nassau</p>
              <p class="text-[13px] text-[#191f1c]/55 mt-1.5 leading-relaxed">
                All RideUp rides in Nassau are charged to your card on file at the end of your trip. You'll see the fare upfront before you confirm.
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
          <div class="w-10 h-1 rounded-full bg-[#191f1c]/15 mx-auto mb-5"></div>
          <!-- Icon -->
          <div class="w-14 h-14 rounded-2xl bg-[#2b8659]/10 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2b8659" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
          <!-- Text -->
          <h3 class="text-[17px] font-bold text-center text-[#191f1c]">Add a card</h3>
          <p class="text-[14px] text-[#191f1c]/55 text-center mt-2 leading-relaxed">
            Card management will be available in the next update. Your existing card on file will be used for all rides.
          </p>
          <!-- Button -->
          <button
            @click="showCardModal = false"
            class="mt-6 w-full py-3.5 bg-[#2b8659] text-white text-[15px] font-bold rounded-xl active:bg-[#236e49] transition-colors"
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
