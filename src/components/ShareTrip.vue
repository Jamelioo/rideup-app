<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  ride: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['back', 'close'])

const copied = ref(false)

const driverName = computed(() => props.ride?.driverName || 'Your driver')
const vehicleInfo = computed(() => props.ride?.vehicleInfo || 'Vehicle details unavailable')
const pickup = computed(() => props.ride?.pickup || 'Pickup location')
const dropoff = computed(() => props.ride?.dropoff || 'Dropoff location')

const shareText = computed(() =>
  `I'm on a RideUp ride\nFrom: ${pickup.value}\nTo: ${dropoff.value}`
)

function shareWhatsApp() {
  const encoded = encodeURIComponent(shareText.value)
  window.open(`https://wa.me/?text=${encoded}`, '_blank')
}

function shareSMS() {
  const encoded = encodeURIComponent(shareText.value)
  window.location.href = `sms:?body=${encoded}`
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareText.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = shareText.value
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}
</script>

<template>
  <div class="px-5 pt-2 pb-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-5">
      <button @click="emit('back')" class="w-8 h-8 flex items-center justify-center rounded-full active:bg-[#191f1c]/5">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#191f1c]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h2 class="text-lg font-bold text-[#191f1c]">Share my trip</h2>
      <button @click="emit('close')" class="w-8 h-8 flex items-center justify-center rounded-full active:bg-[#191f1c]/5">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#191f1c]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Trip Info Card -->
    <div class="bg-[#f0fdf4] rounded-2xl p-4 mb-6">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-9 h-9 rounded-full bg-[#2b8659] flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div>
          <p class="text-[14px] font-semibold text-[#191f1c]">{{ driverName }}</p>
          <p class="text-xs text-[#191f1c]/50">{{ vehicleInfo }}</p>
        </div>
      </div>

      <div class="space-y-2 ml-1">
        <div class="flex items-start gap-3">
          <div class="w-2 h-2 rounded-full bg-[#2b8659] mt-1.5 shrink-0" />
          <p class="text-[13px] text-[#191f1c]/70">{{ pickup }}</p>
        </div>
        <div class="flex items-start gap-3">
          <div class="w-2 h-2 rounded-full bg-[#191f1c] mt-1.5 shrink-0" />
          <p class="text-[13px] text-[#191f1c]/70">{{ dropoff }}</p>
        </div>
      </div>
    </div>

    <!-- Share Buttons -->
    <div class="space-y-3">
      <button
        @click="shareWhatsApp"
        class="w-full flex items-center justify-center gap-2.5 py-3.5 bg-[#25D366]/10 text-[#25D366] font-semibold text-[14px] rounded-xl active:bg-[#25D366]/20 transition-colors"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        WhatsApp
      </button>

      <button
        @click="shareSMS"
        class="w-full flex items-center justify-center gap-2.5 py-3.5 bg-[#191f1c]/[0.04] text-[#191f1c] font-semibold text-[14px] rounded-xl active:bg-[#191f1c]/[0.08] transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        SMS
      </button>

      <button
        @click="copyLink"
        class="w-full flex items-center justify-center gap-2.5 py-3.5 border border-[#191f1c]/10 text-[#191f1c] font-semibold text-[14px] rounded-xl active:bg-[#191f1c]/[0.03] transition-colors"
      >
        <svg v-if="!copied" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        {{ copied ? 'Copied!' : 'Copy link' }}
      </button>
    </div>
  </div>
</template>
