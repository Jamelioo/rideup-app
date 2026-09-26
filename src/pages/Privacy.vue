<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
function goBack() {
  window.history.length > 1 ? router.back() : router.push('/')
}
</script>

<template>
  <div class="min-h-screen bg-white text-[#1a1a1a]">
    <div class="sticky top-0 z-40 bg-white border-b border-[#1a1a1a]/8">
      <div class="flex items-center px-4 py-3.5 max-w-2xl mx-auto">
        <button @click="goBack" class="w-10 h-10 flex items-center justify-center rounded-full active:bg-[#1a1a1a]/5">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 class="flex-1 text-center text-[17px] font-bold font-serif">Privacy Policy</h1>
        <div class="w-10"></div>
      </div>
    </div>

    <div class="max-w-2xl mx-auto px-5 py-8 space-y-6 text-[15px] leading-relaxed text-[#1a1a1a]/80">
      <p class="text-[13px] text-[#1a1a1a]/50">Last updated: September 1, 2025</p>

      <section>
        <h2 class="text-[18px] font-bold text-[#1a1a1a] mb-2">Information We Collect</h2>
        <p>When you use RideUp, we collect information you provide directly, including your name, email address, phone number, and payment information. We also collect location data when you request or take a ride.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[#1a1a1a] mb-2">How We Use Your Information</h2>
        <p>We use your information to provide and improve our ride services, process payments, communicate with you about your rides, and ensure the safety of our platform.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[#1a1a1a] mb-2">Data Sharing</h2>
        <p>We share your pickup location and name with drivers when you request a ride. We do not sell your personal information to third parties.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[#1a1a1a] mb-2">Data Security</h2>
        <p>We use industry-standard encryption and security measures to protect your personal information. Your payment data is processed securely and never stored on our servers.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[#1a1a1a] mb-2">Your Rights</h2>
        <p>You can request access to, correction of, or deletion of your personal data at any time by contacting us at <a href="tel:+12424529911" class="text-[#58cc02] font-semibold">(242) 452-9911</a>.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[#1a1a1a] mb-2">Contact Us</h2>
        <p>If you have questions about this privacy policy, contact us at <a href="tel:+12424529911" class="text-[#58cc02] font-semibold">(242) 452-9911</a> or email <a href="mailto:support@rideupnassau.com" class="text-[#58cc02] font-semibold">support@rideupnassau.com</a>.</p>
      </section>
    </div>
  </div>
</template>
