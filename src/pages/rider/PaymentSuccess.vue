<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/useAuth'
import { formatFare } from '../../lib/pricing'
import { DEMO_MODE } from '../../lib/demoMode'

const route = useRoute()
const router = useRouter()
const { user } = useAuth()

const sessionId = ref(route.query.session_id || '')
const fareAmount = ref('')
const pickup = ref('')
const dropoff = ref('')
const rideId = ref(null)
const showCheck = ref(false)
const loading = ref(true)

const verified = ref(false)

onMounted(async () => {
  setTimeout(() => { showCheck.value = true }, 300)

  if (DEMO_MODE) {
    fareAmount.value = '$12.50'
    pickup.value = 'Bahamar Resort'
    dropoff.value = 'Downtown Nassau'
    verified.value = true
    loading.value = false
    return
  }

  // Server-side payment verification
  if (sessionId.value) {
    try {
      const res = await fetch('/api/verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId.value }),
      })
      const data = await res.json()
      if (data.paid) {
        verified.value = true
        if (data.rideId) rideId.value = data.rideId
        if (data.amount) fareAmount.value = formatFare(data.amount)
      }
    } catch (e) { /* fall through to DB lookup */ }
  }

  if (!user.value) { loading.value = false; return }

  try {
    const { data: rider } = await supabase
      .from('riders')
      .select('id')
      .eq('auth_user_id', user.value.id)
      .maybeSingle()

    if (rider) {
      const { data: ride } = await supabase
        .from('rides')
        .select('*')
        .eq('rider_id', rider.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (ride) {
        if (!rideId.value) rideId.value = ride.id
        if (!fareAmount.value) fareAmount.value = formatFare(ride.fare_cents)
        pickup.value = ride.pickup_address || 'Pickup'
        dropoff.value = ride.dropoff_address || 'Dropoff'
        verified.value = true
      }
    }
  } catch (e) {
    // Keep defaults
  }
  loading.value = false
})

function findDriver() {
  if (rideId.value) {
    router.push({ name: 'active-ride', params: { rideId: rideId.value } })
  } else {
    router.push('/book')
  }
}

function viewReceipt() {
  if (rideId.value) {
    router.push(`/receipt/${rideId.value}`)
  } else {
    router.push('/my-rides')
  }
}

function goHome() {
  router.push('/book')
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-[var(--color-surface-secondary)] px-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
    <!-- Animated Checkmark -->
    <div class="relative mb-8 flex h-24 w-24 items-center justify-center">
      <svg
        class="checkmark-circle"
        :class="{ 'animate-in': showCheck }"
        viewBox="0 0 96 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          class="checkmark-circle__bg"
          cx="48"
          cy="48"
          r="44"
          stroke="#2b8659"
          stroke-width="4"
          fill="none"
        />
        <path
          class="checkmark-circle__check"
          d="M28 50 L42 64 L68 34"
          stroke="#2b8659"
          stroke-width="5"
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="none"
        />
      </svg>
    </div>

    <!-- Heading -->
    <h1 class="mb-2 text-center text-2xl font-bold text-[var(--color-text-primary)]">Payment successful</h1>
    <p class="mb-8 text-center text-sm text-[var(--color-text-muted)]">Your ride has been paid. Thank you.</p>

    <!-- Fare Amount -->
    <div class="mb-8 text-center">
      <span class="text-5xl font-bold text-[var(--color-text-primary)]">{{ fareAmount }}</span>
    </div>

    <!-- Trip Summary -->
    <div class="mb-10 w-full max-w-sm rounded-2xl bg-[var(--color-surface)] p-5 shadow-sm">
      <p class="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Trip summary</p>

      <div class="flex gap-3">
        <!-- Timeline dots -->
        <div class="flex flex-col items-center pt-0.5">
          <div class="h-3 w-3 rounded-full border-2 border-[#2b8659] bg-[var(--color-surface)]"></div>
          <div class="my-1 h-8 w-0.5 bg-[#2b8659]/30"></div>
          <div class="h-3 w-3 rounded-full bg-[#2b8659]"></div>
        </div>

        <!-- Addresses -->
        <div class="flex flex-col justify-between">
          <div>
            <p class="text-sm font-semibold text-[var(--color-text-primary)]">{{ pickup }}</p>
          </div>
          <div class="mt-4">
            <p class="text-sm font-semibold text-[var(--color-text-primary)]">{{ dropoff }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Buttons -->
    <div class="flex w-full max-w-sm flex-col gap-3">
      <button
        v-if="rideId"
        @click="findDriver"
        class="flex h-12 w-full items-center justify-center rounded-xl bg-[#2b8659] text-base font-semibold text-white transition-colors active:bg-[#236e49]"
      >
        Find my driver
      </button>
      <button
        @click="viewReceipt"
        class="flex h-12 w-full items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-base font-semibold text-[var(--color-text-primary)] transition-colors active:bg-[var(--color-surface-secondary)]"
      >
        View receipt
      </button>
      <button
        @click="goHome"
        class="flex h-12 w-full items-center justify-center text-sm font-medium text-[var(--color-text-muted)] transition-colors"
      >
        Back to home
      </button>
    </div>

    <!-- Auto-redirect notice -->
    <p class="mt-6 text-xs text-[var(--color-text-muted)]">
      Thank you for riding with RideUp
    </p>
  </div>
</template>

<style scoped>
/* Checkmark circle animation */
.checkmark-circle {
  width: 96px;
  height: 96px;
}

.checkmark-circle__bg {
  stroke-dasharray: 276;
  stroke-dashoffset: 276;
  transition: none;
}

.checkmark-circle__check {
  stroke-dasharray: 80;
  stroke-dashoffset: 80;
  transition: none;
}

.checkmark-circle.animate-in .checkmark-circle__bg {
  animation: circle-draw 0.6s ease-out forwards;
}

.checkmark-circle.animate-in .checkmark-circle__check {
  animation: check-draw 0.4s 0.45s ease-out forwards;
}

@keyframes circle-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes check-draw {
  to {
    stroke-dashoffset: 0;
  }
}
</style>
