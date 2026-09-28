<script setup>
import { ref } from 'vue'

const props = defineProps({
  rideId: String,
  minutesSinceRequest: { type: Number, default: 0 },
})

const emit = defineEmits(['cancel', 'close'])

const selectedReason = ref('')
const confirming = ref(false)

const reasons = [
  'Driver is taking too long',
  'Changed my plans',
  'Wrong pickup location',
  'Found another ride',
  'Other',
]

const freeCancelWindow = 2 // minutes
const cancelFee = 3.00 // BSD

const isFreeCancel = props.minutesSinceRequest <= freeCancelWindow

function confirmCancel() {
  confirming.value = true
}

function doCancel() {
  emit('cancel', {
    rideId: props.rideId,
    reason: selectedReason.value,
    fee: isFreeCancel ? 0 : cancelFee,
  })
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-end justify-center">
    <div class="absolute inset-0 bg-[var(--color-overlay)]" @click="emit('close')"></div>
    <div class="relative w-full max-w-lg bg-[var(--color-surface)] rounded-t-3xl z-10">
      <!-- Handle -->
      <div class="w-10 h-1 rounded-full bg-[#191f1c]/15 mx-auto mt-3 mb-2"></div>

      <!-- Not confirming yet — select reason -->
      <div v-if="!confirming" class="px-6 pb-8">
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-1">Cancel ride</h2>
        <p v-if="!isFreeCancel" class="text-[14px] text-red-500 mb-4">
          A ${{ cancelFee.toFixed(2) }} cancellation fee will apply
        </p>
        <p v-else class="text-[14px] text-[var(--color-text-muted)] mb-4">
          Free cancellation
        </p>

        <p class="text-[13px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Reason</p>
        <div class="space-y-2 mb-6">
          <button
            v-for="reason in reasons"
            :key="reason"
            @click="selectedReason = reason"
            :class="[
              'w-full text-left px-4 py-3.5 rounded-xl border text-[15px] transition-colors',
              selectedReason === reason
                ? 'border-[#2b8659] bg-[#2b8659]/5 text-[var(--color-text-primary)] font-medium'
                : 'border-[var(--color-border)] text-[#191f1c]/70'
            ]"
          >
            {{ reason }}
          </button>
        </div>

        <button
          @click="confirmCancel"
          :disabled="!selectedReason"
          class="w-full py-3.5 bg-red-500 text-white text-[15px] font-bold rounded-xl disabled:opacity-40 active:bg-red-600 transition-colors"
        >
          Cancel ride
        </button>
        <button
          @click="emit('close')"
          class="w-full py-3 text-[var(--color-text-muted)] text-[15px] font-medium mt-2"
        >
          Keep ride
        </button>
      </div>

      <!-- Confirming -->
      <div v-else class="px-6 pb-8 text-center">
        <div class="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4 mt-2">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h2 class="text-[18px] font-bold text-[var(--color-text-primary)] mb-1">Are you sure?</h2>
        <p v-if="!isFreeCancel" class="text-[14px] text-[var(--color-text-muted)] mb-6">
          You'll be charged a ${{ cancelFee.toFixed(2) }} cancellation fee
        </p>
        <p v-else class="text-[14px] text-[var(--color-text-muted)] mb-6">
          No fee will be charged
        </p>

        <button
          @click="doCancel"
          class="w-full py-3.5 bg-red-500 text-white text-[15px] font-bold rounded-xl active:bg-red-600 transition-colors"
        >
          Yes, cancel ride
        </button>
        <button
          @click="confirming = false"
          class="w-full py-3 text-[#2b8659] text-[15px] font-semibold mt-2"
        >
          No, keep ride
        </button>
      </div>
    </div>
  </div>
</template>
