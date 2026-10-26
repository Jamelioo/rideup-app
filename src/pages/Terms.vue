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
        <button @click="goBack" class="w-11 h-11 flex items-center justify-center rounded-full active:bg-[var(--color-surface-secondary)]" aria-label="Back">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 class="flex-1 text-center text-[17px] font-bold font-serif">Terms of Service</h1>
        <div class="w-10"></div>
      </div>
    </div>

    <div class="max-w-2xl mx-auto px-5 py-8 space-y-6 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
      <p class="text-[13px] text-[var(--color-text-muted)]">Last updated: October 26, 2026</p>

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
        <p>You must be at least 18 to use RideUp and must give accurate information. You can book as a guest with your name and mobile number, or create a full account; a guest account can be saved by confirming an email address and choosing a password. Every booking needs a mobile number your driver can call or text at pickup. We may ask you to confirm your phone number with a text-message code before you ride. You are responsible for keeping your login details secure and for activity on your account.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Fares and Payment</h2>
        <p>Your fare is calculated from distance and the expected trip time (including current traffic), plus a $2.50 booking fee (and a $3.00 airport fee for pickups at Lynden Pindling International Airport), and is shown before you request a ride; that is the price you pay, even if the trip takes longer. When more riders are requesting than there are drivers nearby, the trip part of the fare may be higher (busy-time pricing, never more than 1.5× and never on the fees); the price shown before you book already includes it, and if it changes before you confirm we ask you to confirm the new price. You may book a ride for someone else; you remain responsible for the trip and its payment, and you confirm that the passenger agreed to share their name and phone number with the driver. You may add one stop on the way; the price covers the whole route and a short stop of about 3 minutes. Promo codes, referral discounts and RideUp credit are applied before you book; each promo code can be used once per rider, codes have no cash value, and RideUp may end a promotion or remove rewards obtained by abuse (such as self-referrals). Every trip is paid in cash to your driver at the end of the trip: you pay the amount shown in the app (the fare less any promo, referral discount or RideUp credit), and we email you a receipt once your driver confirms the cash, or, if they don’t, about 30 minutes after the trip. RideUp doesn’t take card payments and doesn’t ask for your card details. Tips are optional, paid in cash, and go entirely to your driver. If your driver reports within 24 hours that a fare wasn’t paid, we contact you, and booking is paused on your account (and on any other account with the same phone number) until it’s settled. If your driver cancels after accepting your ride, we automatically look for another driver at the same price and add $5 RideUp credit to your account (the RideUp guarantee; at most once every 24 hours, not when a driver marks a no-show, and RideUp may change or end it for future trips or remove credit obtained by abuse). If something went wrong with a trip, contact support: RideUp may refund all or part of a fare as RideUp credit, which is used automatically on your next rides and has no cash value.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Cancellations</h2>
        <p>You can cancel a ride request at any time before the trip starts, and cancelling never costs anything. Once your driver arrives, the first 5 minutes of waiting are free; if you still haven't arrived after that, the driver may cancel the ride as a no-show. Cancelling more than 2 minutes after a driver has accepted your ride counts as a late cancellation; two late cancellations or no-shows within 30 days pause booking on your account (and on any other account with the same phone number) until RideUp support turns it back on. Cancellations before a driver accepts, within those 2 minutes, or by your driver or RideUp don’t count. So that drivers aren’t sent requests that are cancelled straight away, after three cancellations within an hour you may need to wait a while before booking again. If you think a cancellation was counted in error, contact support and we'll review it.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Drivers</h2>
        <p>Drivers must apply and be approved before accepting rides, and must keep their photo, documents and vehicle information accurate; changing these sends the profile back for review, and expired licence or insurance documents must be renewed before going online. Drivers keep 70% of each fare (excluding the booking fee, and including any busy-time pricing) and 100% of tips; RideUp retains a 30% platform fee. Riders pay drivers in cash: the driver collects the fare shown in the app and keeps it, and RideUp’s platform fee for that trip is deducted from the driver’s balance. Promo codes, referral discounts and RideUp credit are paid for by RideUp, so when a rider pays less in cash than the fare, RideUp adds the difference to the driver’s balance. A driver who holds more of RideUp’s share than RideUp owes them must pay the difference to RideUp. A fare that wasn’t paid must be reported in the app within 24 hours of the trip; RideUp then follows up with the rider, and the driver owes nothing for that trip. Incentive rewards announced in the app are added to the driver’s balance once the stated number of trips is completed within the stated time; RideUp may withhold rewards earned through fraudulent trips. When a rider is refunded because of the driver’s conduct (for example, a much longer route than needed), RideUp may deduct the driver’s share of that refund from their balance. Ratings are averaged over recent trips, and a sustained low rating may lead to a quality review. RideUp may suspend or remove drivers who break these terms or the law.</p>
      </section>

      <section>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Safety</h2>
        <p>Features such as sharing your live trip, the optional pickup PIN, and reporting a problem are provided to help, but they are not a substitute for emergency services. Before you get in, check that the car's plate and the driver match the app. In an emergency, call 919 first.</p>
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
        <p>Questions about these terms? Contact us at <a href="tel:+12424529911" class="text-[var(--color-brand)] font-semibold">(242) 452-9911</a> or <a href="mailto:support@rideupnassau.com" class="text-[var(--color-brand)] font-semibold">support@rideupnassau.com</a>.</p>
      </section>
    </div>
  </div>
</template>
