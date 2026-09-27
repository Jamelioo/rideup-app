<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
function goBack() {
  router.back()
}
</script>

<template>
  <div class="min-h-screen bg-white text-[#191f1c]">
    <div class="sticky top-0 z-40 bg-white border-b border-[#191f1c]/8">
      <div class="flex items-center px-4 py-3.5 max-w-2xl mx-auto">
        <button @click="goBack" class="w-10 h-10 flex items-center justify-center rounded-full active:bg-[#191f1c]/5">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 class="flex-1 text-center text-[17px] font-bold font-serif">Terms of Service</h1>
        <div class="w-10"></div>
      </div>
    </div>

    <div class="max-w-2xl mx-auto px-5 py-8 space-y-6 text-[15px] leading-relaxed text-[#191f1c]/80">
      <p class="text-[13px] text-[#191f1c]/50">Last updated: September 1, 2025</p>

      <section>
        <h2 class="text-[18px] font-bold text-[#191f1c] mb-2">Acceptance of Terms</h2>
        <p>By using the RideUp application, you agree to be bound by these Terms of Service. If you do not agree, please do not use our service.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[#191f1c] mb-2">The Service</h2>
        <p>RideUp provides an on-demand ride-hailing platform connecting riders with independent drivers across New Providence, Nassau, Bahamas. We are a technology platform, not a transportation provider.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[#191f1c] mb-2">User Accounts</h2>
        <p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials. You must be at least 18 years old to use RideUp.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[#191f1c] mb-2">Payments</h2>
        <p>Fares are calculated upfront based on distance and time. By requesting a ride, you agree to pay the displayed fare. All payments are processed securely through our payment partner.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[#191f1c] mb-2">Cancellations</h2>
        <p>You may cancel a ride request before a driver is matched at no charge. Cancellations after a driver is matched may incur a cancellation fee.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[#191f1c] mb-2">User Conduct</h2>
        <p>You agree to treat drivers with respect, not damage vehicles, and comply with all applicable laws. RideUp reserves the right to suspend accounts that violate these terms.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[#191f1c] mb-2">Limitation of Liability</h2>
        <p>RideUp is not liable for any indirect, incidental, or consequential damages arising from use of the service. Our total liability is limited to the amount you paid for the ride in question.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[#191f1c] mb-2">Contact</h2>
        <p>Questions about these terms? Contact us at <a href="tel:+12424529911" class="text-[#2b8659] font-semibold">(242) 452-9911</a> or <a href="mailto:support@rideupnassau.com" class="text-[#2b8659] font-semibold">support@rideupnassau.com</a>.</p>
      </section>
    </div>
  </div>
</template>
