<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  show: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'confirm'])

// Generate next 7 days
const availableDates = computed(() => {
  const dates = []
  const now = new Date()
  for (let i = 0; i < 7; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    dates.push({
      value: d.toISOString().split('T')[0],
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: d.getDate(),
    })
  }
  return dates
})

// Generate 30-min time slots from current time (rounded up) through end of day
const availableTimes = computed(() => {
  const slots = []
  const now = new Date()
  const isToday = selectedDate.value === availableDates.value[0]?.value

  let startHour = isToday ? now.getHours() : 5
  let startMin = isToday ? (now.getMinutes() < 30 ? 30 : 0) : 0
  if (isToday && now.getMinutes() >= 30) startHour += 1

  // Add 30 min minimum buffer for scheduling
  if (isToday) {
    if (startMin === 0) { startMin = 30 } else { startMin = 0; startHour += 1 }
  }

  for (let h = startHour; h < 24; h++) {
    for (let m = (h === startHour ? startMin : 0); m < 60; m += 30) {
      const hour12 = h % 12 || 12
      const ampm = h < 12 ? 'AM' : 'PM'
      const minStr = m === 0 ? '00' : '30'
      slots.push({
        value: `${String(h).padStart(2, '0')}:${minStr}`,
        label: `${hour12}:${minStr} ${ampm}`,
      })
    }
  }
  return slots
})

const selectedDate = ref(availableDates.value[0]?.value || '')
const selectedTime = ref('')

const selectedSummary = computed(() => {
  if (!selectedDate.value || !selectedTime.value) return ''
  const dateObj = new Date(selectedDate.value + 'T' + selectedTime.value)
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }) + ' at ' + availableTimes.value.find(t => t.value === selectedTime.value)?.label
})

const canConfirm = computed(() => selectedDate.value && selectedTime.value)

function confirm() {
  if (!canConfirm.value) return
  emit('confirm', {
    date: selectedDate.value,
    time: selectedTime.value,
    summary: selectedSummary.value,
  })
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition name="fade">
      <div v-if="show" class="fixed inset-0 bg-black/50 z-[9998]" @click="emit('close')" />
    </Transition>

    <!-- Bottom sheet -->
    <Transition name="sheet">
      <div v-if="show" class="fixed inset-x-0 bottom-0 z-[9999] bg-white rounded-t-[28px] shadow-[0_-4px_40px_rgba(0,0,0,0.15)]" style="max-height: 85vh; padding-bottom: env(safe-area-inset-bottom, 0px);">
        <!-- Handle -->
        <div class="flex justify-center pt-3 pb-1">
          <div class="w-9 h-[5px] rounded-full bg-[#191f1c]/15"></div>
        </div>

        <div class="px-5 pb-6 overflow-y-auto" style="max-height: calc(85vh - 40px);">
          <!-- Header -->
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-[22px] font-bold text-[#191f1c] tracking-tight">Schedule ride</h2>
            <button @click="emit('close')" class="w-9 h-9 rounded-full hover:bg-[#191f1c]/5 flex items-center justify-center transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="#191f1c" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>

          <!-- Date picker -->
          <p class="text-[11px] font-semibold text-[#191f1c]/40 uppercase tracking-wider mb-2.5 px-1">Pick a date</p>
          <div class="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
            <button
              v-for="date in availableDates"
              :key="date.value"
              @click="selectedDate = date.value; selectedTime = ''"
              class="flex-shrink-0 w-[72px] py-3 rounded-2xl border-2 text-center transition-all duration-200"
              :class="selectedDate === date.value
                ? 'border-[#2b8659] bg-[#2b8659]/[0.06]'
                : 'border-transparent bg-[#f5f5f5] active:scale-[0.97]'"
            >
              <div class="text-[11px] font-semibold uppercase tracking-wider" :class="selectedDate === date.value ? 'text-[#2b8659]' : 'text-[#191f1c]/40'">
                {{ date.dayName }}
              </div>
              <div class="text-[20px] font-bold mt-0.5" :class="selectedDate === date.value ? 'text-[#2b8659]' : 'text-[#191f1c]'">
                {{ date.dayNum }}
              </div>
            </button>
          </div>

          <!-- Time picker -->
          <p class="text-[11px] font-semibold text-[#191f1c]/40 uppercase tracking-wider mb-2.5 px-1 mt-5">Pick a time</p>
          <div class="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
            <button
              v-for="time in availableTimes"
              :key="time.value"
              @click="selectedTime = time.value"
              class="py-3 rounded-xl border-2 text-[14px] font-semibold transition-all duration-200"
              :class="selectedTime === time.value
                ? 'border-[#2b8659] bg-[#2b8659]/[0.06] text-[#2b8659]'
                : 'border-transparent bg-[#f5f5f5] text-[#191f1c] active:scale-[0.97]'"
            >
              {{ time.label }}
            </button>
          </div>

          <!-- Summary -->
          <div v-if="selectedSummary" class="mt-5 flex items-center gap-2.5 bg-[#f0fdf4] rounded-xl px-4 py-3">
            <svg class="w-5 h-5 text-[#2b8659] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="text-[14px] font-semibold text-[#191f1c]">{{ selectedSummary }}</span>
          </div>

          <!-- Confirm button -->
          <button
            @click="confirm"
            :disabled="!canConfirm"
            class="w-full py-4 bg-[#2b8659] disabled:bg-[#191f1c]/8 disabled:text-[#191f1c]/25 text-white font-bold rounded-2xl text-[15px] mt-5 transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(43,134,89,0.3)] disabled:shadow-none"
          >
            Schedule ride
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.sheet-enter-active {
  transition: transform 0.35s cubic-bezier(0.25, 1, 0.5, 1);
}
.sheet-leave-active {
  transition: transform 0.25s ease-in;
}
.sheet-enter-from,
.sheet-leave-to {
  transform: translateY(100%);
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
