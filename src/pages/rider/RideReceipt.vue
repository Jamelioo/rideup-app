<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '../../lib/supabase'

const router = useRouter()
const route = useRoute()
const rideId = route.params.rideId

const loading = ref(true)
const shareLabel = ref('Share receipt')

// Placeholder receipt data — replaced by Supabase query when available
const receipt = ref({
  date: 'Sep 27, 2026',
  time: '2:45 PM',
  pickup: 'Bahamar Resort',
  dropoff: 'Downtown Nassau',
  baseFare: 250,
  distanceMiles: 4.2,
  ratePerMile: 165,
  distanceCharge: 693,
  durationMinutes: 12,
  ratePerMinute: 20,
  timeCharge: 240,
  subtotal: 1183,
  promoDiscount: 0,
  total: 1183,
  paymentLast4: '4242',
  paymentBrand: 'Visa',
  driverName: 'Marcus Thompson',
  driverRating: 4.92,
})

function formatCents(cents) {
  return '$' + (cents / 100).toFixed(2)
}

onMounted(async () => {
  try {
    const { data, error } = await supabase
      .from('rides')
      .select('*, driver:drivers(full_name, rating)')
      .eq('id', rideId)
      .single()

    if (!error && data) {
      const d = new Date(data.created_at)
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      receipt.value = {
        date: `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
        time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        pickup: data.pickup_address || 'Pickup',
        dropoff: data.dropoff_address || 'Dropoff',
        baseFare: data.base_fare || 250,
        distanceMiles: data.distance_miles || 0,
        ratePerMile: data.rate_per_mile || 165,
        distanceCharge: data.distance_charge || 0,
        durationMinutes: data.duration_minutes || 0,
        ratePerMinute: data.rate_per_minute || 20,
        timeCharge: data.time_charge || 0,
        subtotal: data.subtotal || data.fare_cents || 0,
        promoDiscount: data.promo_discount || 0,
        total: data.fare_cents || 0,
        paymentLast4: data.payment_last4 || '4242',
        paymentBrand: data.payment_brand || 'Visa',
        driverName: data.driver?.full_name || 'Your driver',
        driverRating: data.driver?.rating || 4.9,
      }
    }
  } catch (err) {
    console.error('Failed to load receipt:', err)
    // Keep placeholder data
  } finally {
    loading.value = false
  }
})

async function shareReceipt() {
  const text = `RideUp Receipt\n${receipt.value.date} at ${receipt.value.time}\n${receipt.value.pickup} -> ${receipt.value.dropoff}\nTotal: ${formatCents(receipt.value.total)}`

  if (navigator.share) {
    try {
      await navigator.share({ title: 'RideUp Receipt', text })
    } catch {
      // User cancelled
    }
  } else {
    try {
      await navigator.clipboard.writeText(text)
      shareLabel.value = 'Copied to clipboard'
      setTimeout(() => { shareLabel.value = 'Share receipt' }, 2000)
    } catch {
      // Clipboard not available
    }
  }
}
</script>

<template>
  <div class="min-h-screen bg-[var(--color-surface-secondary)] px-4 py-6">
    <!-- Top Bar -->
    <div class="mb-4 flex items-center">
      <button
        class="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-[#191f1c]/5"
        @click="router.back()"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-[var(--color-text-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <svg class="h-8 w-8 animate-spin text-[#2b8659]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
    </div>

    <!-- Receipt Card -->
    <div v-else class="mx-auto max-w-md">
      <div class="rounded-2xl bg-[var(--color-surface)] px-6 py-8 shadow-sm">
        <!-- Logo -->
        <div class="mb-6 text-center">
          <span class="text-xl font-bold text-[#2b8659]">RideUp</span>
          <p class="mt-1 text-xs text-[var(--color-text-muted)]">Nassau, Bahamas</p>
        </div>

        <!-- Divider -->
        <div class="mb-6 border-b border-dashed border-[var(--color-border)]"></div>

        <!-- Date & Time -->
        <div class="mb-6 flex items-center justify-between">
          <span class="text-sm text-[var(--color-text-muted)]">{{ receipt.date }}</span>
          <span class="text-sm text-[var(--color-text-muted)]">{{ receipt.time }}</span>
        </div>

        <!-- Route -->
        <div class="mb-6 flex gap-3">
          <div class="flex flex-col items-center pt-0.5">
            <div class="h-3 w-3 rounded-full border-2 border-[#2b8659] bg-[var(--color-surface)]"></div>
            <div class="my-1 h-10 w-0.5 bg-[#2b8659]/30"></div>
            <div class="h-3 w-3 rounded-full bg-[#2b8659]"></div>
          </div>
          <div class="flex flex-col justify-between">
            <p class="text-sm font-semibold text-[var(--color-text-primary)]">{{ receipt.pickup }}</p>
            <p class="mt-5 text-sm font-semibold text-[var(--color-text-primary)]">{{ receipt.dropoff }}</p>
          </div>
        </div>

        <!-- Divider -->
        <div class="mb-5 border-b border-[var(--color-border)]"></div>

        <!-- Fare Breakdown -->
        <div class="mb-5 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-[#191f1c]/60">Base fare</span>
            <span class="text-sm text-[var(--color-text-primary)]">{{ formatCents(receipt.baseFare) }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-[#191f1c]/60">Distance ({{ receipt.distanceMiles }} mi x {{ formatCents(receipt.ratePerMile) }}/mi)</span>
            <span class="text-sm text-[var(--color-text-primary)]">{{ formatCents(receipt.distanceCharge) }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-[#191f1c]/60">Time ({{ receipt.durationMinutes }} min x {{ formatCents(receipt.ratePerMinute) }}/min)</span>
            <span class="text-sm text-[var(--color-text-primary)]">{{ formatCents(receipt.timeCharge) }}</span>
          </div>

          <div class="border-b border-[var(--color-border)]"></div>

          <div class="flex items-center justify-between">
            <span class="text-sm text-[#191f1c]/60">Subtotal</span>
            <span class="text-sm text-[var(--color-text-primary)]">{{ formatCents(receipt.subtotal) }}</span>
          </div>

          <div v-if="receipt.promoDiscount > 0" class="flex items-center justify-between">
            <span class="text-sm text-[#2b8659]">Promo discount</span>
            <span class="text-sm font-medium text-[#2b8659]">-{{ formatCents(receipt.promoDiscount) }}</span>
          </div>

          <div class="border-b border-[var(--color-border)]"></div>

          <div class="flex items-center justify-between">
            <span class="text-base font-bold text-[var(--color-text-primary)]">Total</span>
            <span class="text-base font-bold text-[var(--color-text-primary)]">{{ formatCents(receipt.total) }}</span>
          </div>
        </div>

        <!-- Divider -->
        <div class="mb-5 border-b border-dashed border-[var(--color-border)]"></div>

        <!-- Payment Method -->
        <div class="mb-5 flex items-center justify-between">
          <span class="text-sm text-[var(--color-text-muted)]">Payment method</span>
          <div class="flex items-center gap-2">
            <!-- Card icon -->
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span class="text-sm font-medium text-[var(--color-text-primary)]">{{ receipt.paymentBrand }} ---- {{ receipt.paymentLast4 }}</span>
          </div>
        </div>

        <!-- Driver -->
        <div class="flex items-center justify-between">
          <span class="text-sm text-[var(--color-text-muted)]">Driver</span>
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-[var(--color-text-primary)]">{{ receipt.driverName }}</span>
            <div class="flex items-center gap-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-[var(--color-text-primary)]" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span class="text-xs font-medium text-[#191f1c]/60">{{ receipt.driverRating }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions below card -->
      <div class="mt-5 flex flex-col gap-3">
        <button
          @click="shareReceipt"
          class="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2b8659] text-base font-semibold text-white transition-colors active:bg-[#236e49]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {{ shareLabel }}
        </button>

        <router-link
          to="/support"
          class="flex h-12 w-full items-center justify-center rounded-xl text-sm font-medium text-[var(--color-text-muted)] transition-colors active:text-[#191f1c]/70"
        >
          Report an issue
        </router-link>
      </div>
    </div>
  </div>
</template>
