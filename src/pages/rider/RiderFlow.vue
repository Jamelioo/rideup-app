<script setup>
import { ref } from 'vue'
import RiderBooking from './RiderBooking.vue'
import SearchingForDriver from './SearchingForDriver.vue'
import HarborBackdrop from '../../components/HarborBackdrop.vue'
import { DEMO_MODE } from '../../lib/demoMode'
import { formatFare } from '../../lib/pricing'

const step = ref('booking')
const activeRide = ref(null)
const matchInfo = ref(null)
const showChat = ref(false)
const messages = ref([
  { from: 'driver', text: "I'll be there in a few mins" },
])
const draft = ref('')

function handleRequested(ride) { activeRide.value = ride; step.value = 'searching' }
function handleMatched(rideOrMatch) { matchInfo.value = rideOrMatch; step.value = 'matched' }
function handleCancelled() { activeRide.value = null; matchInfo.value = null; step.value = 'booking' }
function startOver() { activeRide.value = null; matchInfo.value = null; step.value = 'booking'; showChat.value = false }

function sendMessage() {
  if (!draft.value.trim()) return
  messages.value.push({ from: 'me', text: draft.value.trim() })
  draft.value = ''
  setTimeout(() => messages.value.push({ from: 'driver', text: 'Got it, see you soon!' }), 1200)
}
</script>

<template>
  <RiderBooking v-if="step === 'booking'" @requested="handleRequested" />

  <SearchingForDriver v-else-if="step === 'searching'" :ride-id="activeRide.id" @matched="handleMatched" @cancelled="handleCancelled" />

  <div v-else-if="step === 'matched' && !showChat" class="relative min-h-screen bg-white text-[#191f1c] flex flex-col overflow-hidden">
    <HarborBackdrop show-route />

    <div class="relative px-6 pt-8 pb-4 flex items-center justify-between">
      <div class="text-lg font-semibold">Ride<span class="text-[#2b8659]">Up</span></div>
      <div class="w-8 h-8 rounded-full bg-[#191f1c]/5 border border-[#191f1c]/8"></div>
    </div>

    <div class="relative flex-1 flex flex-col justify-end px-6 pb-8">
      <div class="mb-5">
        <div class="text-2xl font-medium mb-1">You're matched</div>
        <div class="text-[#191f1c]/45 text-[13px]">{{ matchInfo.driver_name }} is {{ matchInfo.eta_minutes }} minutes away</div>
      </div>

      <div class="bg-white border border-[#191f1c]/8 rounded-3xl p-5 shadow-[0_20px_40px_rgba(0,0,0,0.08)]">
        <div class="flex items-center gap-3.5 mb-4">
          <div class="w-12 h-12 rounded-full bg-gradient-to-br from-[#2b8659] to-[#191f1c] flex-shrink-0"></div>
          <div class="flex-1">
            <div class="font-bold text-[15px]">{{ matchInfo.driver_name }}</div>
            <div class="text-[12px] text-[#191f1c]/50 mt-0.5">{{ matchInfo.vehicle }}</div>
          </div>
          <div class="flex items-center gap-1 text-[13px] font-bold text-amber-500">★ <span class="text-[#191f1c]">{{ matchInfo.rating }}</span></div>
        </div>

        <div class="flex gap-2 mb-4">
          <button @click="showChat = true" class="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#2b8659]/10 text-[#236e49] font-bold rounded-xl text-[13px]">
            💬 Message
          </button>
          <a :href="'tel:' + (matchInfo.phone || '+12424529911')" class="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#2b8659] text-white font-bold rounded-xl text-[13px]">
            📞 Call
          </a>
        </div>

        <div class="flex items-center justify-between py-3.5 border-t border-[#191f1c]/8">
          <span class="text-[12px] text-[#191f1c]/50 font-medium">Trip total</span>
          <span class="text-2xl font-semibold">{{ formatFare(activeRide.fare_cents) }}</span>
        </div>
      </div>


      <button @click="startOver" class="text-[#191f1c]/50 text-[13px] underline underline-offset-2 mt-5 text-center py-2">
        {{ DEMO_MODE ? 'Start another demo request' : 'Back' }}
      </button>
    </div>
  </div>

  <!-- In-app chat -->
  <div v-else-if="showChat" class="relative min-h-screen bg-white text-[#191f1c] flex flex-col">
    <div class="bg-[#2b8659] px-6 pt-8 pb-5 flex items-center gap-3">
      <button @click="showChat = false" class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-base text-white" aria-label="Back">←</button>
      <div class="w-9 h-9 rounded-full bg-white/25"></div>
      <div class="text-white font-bold text-[15px]">{{ matchInfo.driver_name }}</div>
    </div>

    <div class="flex-1 px-5 py-5 space-y-3 overflow-y-auto">
      <div v-for="(m, i) in messages" :key="i" class="flex" :class="m.from === 'me' ? 'justify-end' : 'justify-start'">
        <div class="max-w-[75%] px-4 py-2.5 rounded-2xl text-[13px]"
             :class="m.from === 'me' ? 'bg-[#2b8659] text-white rounded-br-sm' : 'bg-[#191f1c]/6 text-[#191f1c] rounded-bl-sm'">
          {{ m.text }}
        </div>
      </div>
    </div>

    <div class="px-4 pb-6 pt-3 border-t border-[#191f1c]/8 flex items-center gap-2">
      <input v-model="draft" @keyup.enter="sendMessage" type="text" placeholder="Type a message…"
             class="flex-1 bg-[#191f1c]/[0.04] rounded-full px-4 py-2.5 text-[13px] outline-none placeholder:text-[#191f1c]/35" />
      <button @click="sendMessage" class="w-10 h-10 rounded-full bg-[#2b8659] text-white flex items-center justify-center text-sm">➤</button>
    </div>
  </div>
</template>
