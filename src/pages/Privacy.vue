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
      <p class="text-[13px] text-[var(--color-text-muted)]">Last updated: October 2, 2026</p>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Information We Collect</h2>
        <p>Information you give us: your name, email address, phone number, and (for drivers) a profile photo, licence, vehicle and document details. Ride information: pickup and drop-off locations, trip times, fares, tips, ratings, feedback and in-app messages. Location: your device location while you request or take a ride, and drivers' location while they are online or on a trip (while online we keep an approximate position, to about 100 metres, so we can alert nearby drivers to new requests). Payment: your card is entered directly with Stripe. We store Stripe customer and payment-method identifiers, plus the card brand and last four digits so we can show them on receipts. Guest bookings create a temporary account so your ride and receipt can be linked to you. If phone verification is turned on, we confirm your number with a one-time text-message code. If you turn on notifications, we store a technical address for your device so we can send trip alerts to it; it is removed when you log out.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">How We Use Your Information</h2>
        <p>To provide and improve rides, match riders with drivers (including automatically finding you a new driver if yours cancels), process payments and tips, send receipts, trip notifications and service messages, provide support, investigate safety reports, keep the platform safe and prevent fraud, and meet legal obligations.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Who We Share It With</h2>
        <p>Before accepting, a driver sees your first name, your rating, an approximate pickup area and the trip length. After accepting, your driver sees your first name, exact pickup and drop-off, and the messages you send; you see your driver's first name, photo, vehicle, plate and rating. Phone numbers are shared only while a trip is active, and in-app chat closes 30 minutes after drop-off. If you share your trip, anyone with the link can see your first name, your driver's first name and vehicle, the route and the car's live location until an hour after the trip ends. Our safety team can see trip details, messages and reports when investigating a safety concern. We do not sell your personal information.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Service Providers</h2>
        <p>We use Supabase (database, sign-in and, if phone verification is on, text-message codes through its SMS provider), Stripe (payments), Google Maps (maps, address search and routing), Vercel (hosting and privacy-friendly usage analytics), Resend (receipts and service emails) and your browser's push service (trip notifications). These providers process data for us under their own terms and privacy policies.</p>
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
