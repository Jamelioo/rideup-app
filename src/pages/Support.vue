<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const faqs = ref([
  {
    question: 'How do I request a ride?',
    answer: 'Tap "Where to?" on the home screen, enter your destination, and confirm your pickup location. You\'ll see available drivers nearby. Tap "Request Ride" to confirm — a driver will be matched with you within moments.',
    open: false,
  },
  {
    question: 'How much does a ride cost?',
    answer: 'Pricing is based on distance and estimated travel time. Before you confirm your ride, you\'ll see the fare estimate on screen so there are no surprises. The final fare may adjust slightly if the route changes during the trip.',
    open: false,
  },
  {
    question: 'How do I pay?',
    answer: 'RideUp accepts debit and credit card payments. Your card on file is charged automatically at the end of your ride. You\'ll always see the fare upfront before confirming.',
    open: false,
  },
  {
    question: 'Is RideUp safe?',
    answer: 'Every driver applies and is approved by RideUp before they can accept rides. You can see your driver\'s name, vehicle and plate once they accept, follow your trip live on the map, and share it with trusted contacts. In an emergency, call the local emergency number first.',
    open: false,
  },
  {
    question: 'How do I cancel a ride?',
    answer: 'You can cancel a ride at any time before the trip starts. Tap "Cancel ride" on your ride screen. Any hold on your card is released, and we don\'t currently charge a cancellation fee.',
    open: false,
  },
  {
    question: 'How do I contact my driver?',
    answer: 'After you\'re matched with a driver, a call button will appear on the ride screen. Tap it to call your driver directly — useful for coordinating the exact pickup spot.',
    open: false,
  },
])

function toggleFaq(index) {
  faqs.value[index].open = !faqs.value[index].open
}

function close() {
  router.back()
}
</script>

<template>
  <div class="min-h-dvh bg-[var(--color-surface)] text-[var(--color-text-primary)]">

    <!-- Top bar -->
    <div class="sticky top-0 z-40 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
      <div class="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <button
          @click="close"
          class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-secondary)] transition-colors"
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
      <h1 class="text-[28px] font-bold leading-tight mb-8">
        How can we help?
      </h1>

      <!-- Emergency contact -->
      <div class="mb-8">
        <h2 class="text-[13px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
          Emergency
        </h2>
        <a
          href="tel:+12424529911"
          class="w-full flex items-center gap-4 px-4 py-4 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
        >
          <div class="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </div>
          <div>
            <div class="text-[15px] font-semibold text-red-700">Emergency? Call us now</div>
            <div class="text-[13px] text-red-600/70 mt-0.5">(242) 452-9911</div>
          </div>
        </a>
      </div>

      <!-- FAQ section -->
      <div class="mb-8">
        <h2 class="text-[13px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
          Frequently asked questions
        </h2>
        <div class="flex flex-col gap-2">
          <div
            v-for="(faq, index) in faqs"
            :key="index"
            class="rounded-xl bg-[var(--color-surface-secondary)] overflow-hidden transition-colors"
          >
            <button
              @click="toggleFaq(index)"
              class="w-full flex items-center justify-between px-4 py-4 hover:bg-[var(--color-surface-secondary)] transition-colors"
            >
              <span class="text-[15px] font-semibold text-left pr-3">{{ faq.question }}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-5 h-5 text-[var(--color-text-muted)] shrink-0 transition-transform duration-300"
                :class="{ 'rotate-90': faq.open }"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <Transition name="expand">
              <div v-if="faq.open" class="px-4 pb-4">
                <p class="text-[14px] text-[var(--color-text-secondary)] leading-relaxed">
                  {{ faq.answer }}
                </p>
              </div>
            </Transition>
          </div>
        </div>
      </div>

      <!-- Contact methods -->
      <div>
        <h2 class="text-[13px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
          Contact us
        </h2>
        <div class="flex flex-col gap-2">

          <!-- Call -->
          <a
            href="tel:+12424529911"
            class="w-full flex items-center gap-4 px-4 py-4 bg-[var(--color-surface-secondary)] rounded-xl hover:bg-[var(--color-surface-secondary)] transition-colors"
          >
            <div class="w-10 h-10 rounded-full bg-[#2b8659]/10 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[var(--color-brand)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <div>
              <div class="text-[15px] font-semibold">Call us</div>
              <div class="text-[13px] text-[var(--color-text-muted)] mt-0.5">(242) 452-9911</div>
            </div>
          </a>

          <!-- WhatsApp -->
          <a
            href="https://wa.me/12424529911"
            target="_blank"
            rel="noopener noreferrer"
            class="w-full flex items-center gap-4 px-4 py-4 bg-[var(--color-surface-secondary)] rounded-xl hover:bg-[var(--color-surface-secondary)] transition-colors"
          >
            <div class="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
              </svg>
            </div>
            <div>
              <div class="text-[15px] font-semibold">WhatsApp</div>
              <div class="text-[13px] text-[var(--color-text-muted)] mt-0.5">Message us anytime</div>
            </div>
          </a>

          <!-- Email -->
          <a
            href="mailto:support@rideupnassau.com"
            class="w-full flex items-center gap-4 px-4 py-4 bg-[var(--color-surface-secondary)] rounded-xl hover:bg-[var(--color-surface-secondary)] transition-colors"
          >
            <div class="w-10 h-10 rounded-full bg-[#2b8659]/10 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[var(--color-brand)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <div>
              <div class="text-[15px] font-semibold">Email</div>
              <div class="text-[13px] text-[var(--color-text-muted)] mt-0.5">support@rideupnassau.com</div>
            </div>
          </a>

        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 200px;
}
</style>
