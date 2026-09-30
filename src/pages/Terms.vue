<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
function goBack() {
  router.back()
}
</script>

<template>
  <div class="min-h-dvh bg-[var(--color-surface)] text-[var(--color-text-primary)]">
    <div class="sticky top-0 z-40 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
      <div class="flex items-center px-4 pt-[max(0.875rem,env(safe-area-inset-top))] pb-3.5 max-w-2xl mx-auto">
        <button @click="goBack" class="w-10 h-10 flex items-center justify-center rounded-full active:bg-[var(--color-surface-secondary)]" aria-label="Back">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 class="flex-1 text-center text-[17px] font-bold font-serif">Terms of Service</h1>
        <div class="w-10"></div>
      </div>
    </div>

    <div class="max-w-2xl mx-auto px-5 py-8 space-y-6 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
      <p class="text-[13px] text-[var(--color-text-muted)]">Last updated: September 30, 2026</p>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Acceptance of Terms</h2>
        <p>By using the RideUp website or app, you agree to these Terms of Service. If you do not agree, please do not use the service.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">The Service</h2>
        <p>RideUp is a technology platform that connects riders with independent drivers across New Providence, Nassau, Bahamas. RideUp does not provide transportation itself, and drivers are independent and not employees of RideUp.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Accounts and Guest Booking</h2>
        <p>You must be at least 18 to use RideUp and must give accurate information. You can book as a guest with a name, phone number and payment card, or create a full account. You are responsible for keeping your login details secure and for activity on your account.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Fares and Payment</h2>
        <p>Your fare is calculated from distance and time and shown before you request a ride. A valid payment card is required to request a ride. When a driver accepts, we place a temporary hold for the fare on your card. When the trip is completed the hold is converted into the charge for that fare. If the ride is cancelled before the trip starts, the hold is released. Payments are processed by Stripe; RideUp does not store your full card number.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Cancellations</h2>
        <p>You can cancel a ride request at any time before the trip starts. We do not currently charge a cancellation fee. If that changes, we will tell you clearly before it applies to you.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Drivers</h2>
        <p>Drivers must apply and be approved before accepting rides, and must keep their documents and vehicle information accurate. Drivers keep 80% of each fare; RideUp retains a 20% platform fee. RideUp may suspend or remove drivers who break these terms or the law.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Safety</h2>
        <p>Features such as sharing your trip with trusted contacts and reporting a problem are provided to help, but they are not a substitute for emergency services. In an emergency, call the local emergency number first.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Conduct</h2>
        <p>You agree to treat drivers and riders with respect, not damage vehicles, and follow applicable laws. RideUp may suspend or close accounts that violate these terms.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Limitation of Liability</h2>
        <p>To the extent permitted by law, RideUp is not liable for indirect, incidental or consequential damages arising from use of the service, and our total liability for any ride is limited to the amount you paid for that ride.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Changes</h2>
        <p>We may update these terms from time to time. If we make a material change we will update the date above and, where appropriate, notify you in the app.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Contact</h2>
        <p>Questions about these terms? Contact us at <a href="tel:+12424529911" class="text-[#2b8659] font-semibold">(242) 452-9911</a> or <a href="mailto:support@rideupnassau.com" class="text-[#2b8659] font-semibold">support@rideupnassau.com</a>.</p>
      </section>
    </div>
  </div>
</template>
