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
        <h1 class="flex-1 text-center text-[17px] font-bold font-serif">Privacy Policy</h1>
        <div class="w-10"></div>
      </div>
    </div>

    <div class="max-w-2xl mx-auto px-5 py-8 space-y-6 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
      <p class="text-[13px] text-[var(--color-text-muted)]">Last updated: September 30, 2026</p>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Information We Collect</h2>
        <p>Information you give us: your name, email address, phone number, and (for drivers) license, vehicle and document details. Ride information: pickup and drop-off locations, trip times, fares, ratings and in-app messages. Location: your device location while you request or take a ride, and drivers' location while they are online or on a trip. Payment: your card is entered directly with Stripe. We store Stripe customer and payment-method identifiers, plus the card brand and last four digits so we can show them on receipts. Guest bookings create a temporary account so your ride and receipt can be linked to you.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">How We Use Your Information</h2>
        <p>To provide and improve rides, match riders with drivers, process payments, send receipts and service messages, provide support, keep the platform safe and prevent fraud, and meet legal obligations.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Who We Share It With</h2>
        <p>Drivers see your name, pickup and drop-off locations, and the messages you send them for your ride; you see your driver's name, vehicle, plate, rating and phone number. If you use trip sharing, the trusted contacts you choose can see your trip details. We do not sell your personal information.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Service Providers</h2>
        <p>We use Supabase (database and sign-in), Stripe (payments), Google Maps (maps, address search and routing), Vercel (hosting and privacy-friendly usage analytics), and Resend (service emails to drivers). These providers process data for us under their own terms and privacy policies.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Retention</h2>
        <p>We keep account, ride and payment records for as long as your account is active and as needed for accounting, safety, dispute resolution and legal requirements. You can ask us to delete your account and personal data; some records may be kept where the law requires it.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Security</h2>
        <p>We use encryption in transit and access controls to protect your information. No system is perfectly secure, so please use a strong, unique password.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Your Rights</h2>
        <p>You can ask to access, correct or delete your personal data at any time by contacting us at <a href="tel:+12424529911" class="text-[#2b8659] font-semibold">(242) 452-9911</a> or <a href="mailto:support@rideupnassau.com" class="text-[#2b8659] font-semibold">support@rideupnassau.com</a>.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Children</h2>
        <p>RideUp is not intended for people under 18 and we do not knowingly collect their information.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Changes</h2>
        <p>If we change this policy in a meaningful way we will update the date above and, where appropriate, tell you in the app.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Contact Us</h2>
        <p>Questions about this policy? Contact us at <a href="tel:+12424529911" class="text-[#2b8659] font-semibold">(242) 452-9911</a> or <a href="mailto:support@rideupnassau.com" class="text-[#2b8659] font-semibold">support@rideupnassau.com</a>.</p>
      </section>
    </div>
  </div>
</template>
