<script setup>
import { ref } from 'vue'
import ShareTrip from './ShareTrip.vue'
import ReportSafety from './ReportSafety.vue'

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  ride: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['close'])

const activePanel = ref('main') // 'main' | 'share' | 'report'

function close() {
  activePanel.value = 'main'
  emit('close')
}

function openShare() {
  activePanel.value = 'share'
}

function openReport() {
  activePanel.value = 'report'
}

function backToMain() {
  activePanel.value = 'main'
}

function callEmergency() {
  window.location.href = 'tel:919'
}
</script>

<template>
  <Teleport to="body">
    <!-- Overlay -->
    <Transition name="fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 bg-[var(--color-overlay)] z-[9998]"
        @click="close"
      />
    </Transition>

    <!-- Bottom Sheet -->
    <Transition name="sheet">
      <div
        v-if="isOpen"
        class="fixed bottom-0 left-0 right-0 z-[9999] bg-[var(--color-surface)] rounded-t-3xl shadow-2xl max-w-lg mx-auto"
      >
        <!-- Handle -->
        <div class="flex justify-center pt-3 pb-1">
          <div class="w-10 h-1 rounded-full bg-[var(--color-surface-secondary)]" />
        </div>

        <!-- Main Safety Panel -->
        <div v-if="activePanel === 'main'" class="px-5 pt-2 pb-8">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-lg font-bold text-[var(--color-text-primary)]">Safety</h2>
            <button @click="close" class="w-8 h-8 flex items-center justify-center rounded-full active:bg-[var(--color-surface-secondary)]" aria-label="Close">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Share my trip -->
          <button
            @click="openShare"
            class="w-full flex items-center gap-4 py-4 border-b border-[var(--color-border)] active:bg-[var(--color-surface-secondary)] transition-colors"
          >
            <div class="w-11 h-11 rounded-full bg-[#2b8659]/10 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <div class="flex-1 text-left">
              <p class="text-[15px] font-semibold text-[var(--color-text-primary)]">Share my trip</p>
              <p class="text-xs text-[var(--color-text-muted)] mt-0.5">Let someone know where you are</p>
            </div>
            <svg class="w-5 h-5 text-[var(--color-text-muted)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          <!-- Emergency -->
          <button
            @click="callEmergency"
            class="w-full flex items-center gap-4 py-4 border-b border-[var(--color-border)] active:bg-[var(--color-surface-secondary)] transition-colors"
          >
            <div class="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div class="flex-1 text-left">
              <p class="text-[15px] font-semibold text-[var(--color-text-primary)]">Emergency (919)</p>
              <p class="text-xs text-[var(--color-text-muted)] mt-0.5">Call Bahamas emergency services</p>
            </div>
            <svg class="w-5 h-5 text-[var(--color-text-muted)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          <!-- Report safety issue -->
          <button
            @click="openReport"
            class="w-full flex items-center gap-4 py-4 active:bg-[var(--color-surface-secondary)] transition-colors"
          >
            <div class="w-11 h-11 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div class="flex-1 text-left">
              <p class="text-[15px] font-semibold text-[var(--color-text-primary)]">Report safety issue</p>
              <p class="text-xs text-[var(--color-text-muted)] mt-0.5">Let us know about a concern</p>
            </div>
            <svg class="w-5 h-5 text-[var(--color-text-muted)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <!-- Share Trip Sub-panel -->
        <ShareTrip
          v-if="activePanel === 'share'"
          :ride="ride"
          @back="backToMain"
          @close="close"
        />

        <!-- Report Safety Sub-panel -->
        <ReportSafety
          v-if="activePanel === 'report'"
          :ride="ride"
          @back="backToMain"
          @close="close"
        />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.sheet-enter-active {
  transition: transform 0.3s ease-out;
}
.sheet-leave-active {
  transition: transform 0.25s ease-in;
}
.sheet-enter-from,
.sheet-leave-to {
  transform: translateY(100%);
}
</style>
