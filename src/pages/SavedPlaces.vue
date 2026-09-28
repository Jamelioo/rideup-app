<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'
import SavedPlaceInput from '../components/SavedPlaceInput.vue'

const router = useRouter()
const { user } = useAuth()

const savedPlaces = ref([])
const loading = ref(true)
const saving = ref(false)

// Modal state
const showModal = ref(false)
const editingIndex = ref(null)
const presetLabel = ref('')

const toast = ref('')
function showToast(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2500)
}

onMounted(() => {
  loadPlaces()
})

function loadPlaces() {
  const meta = user.value?.user_metadata
  savedPlaces.value = Array.isArray(meta?.saved_places) ? [...meta.saved_places] : []
  loading.value = false
}

async function persistPlaces(places) {
  saving.value = true
  const { error } = await supabase.auth.updateUser({
    data: { saved_places: places },
  })
  saving.value = false

  if (error) {
    showToast('Failed to save: ' + error.message)
    return false
  }
  savedPlaces.value = places
  return true
}

// Find preset place by label
function findPresetIndex(label) {
  return savedPlaces.value.findIndex((p) => p.label === label)
}

const homePlace = computed(() => savedPlaces.value.find((p) => p.label === 'Home'))
const workPlace = computed(() => savedPlaces.value.find((p) => p.label === 'Work'))
const customPlaces = computed(() => savedPlaces.value.filter((p) => p.label !== 'Home' && p.label !== 'Work'))

function openAddPreset(label) {
  const idx = findPresetIndex(label)
  if (idx >= 0) {
    editingIndex.value = idx
    presetLabel.value = ''
  } else {
    editingIndex.value = null
    presetLabel.value = label
  }
  showModal.value = true
}

function openEditCustom(index) {
  // Index within customPlaces -- need to find in savedPlaces
  const place = customPlaces.value[index]
  const realIdx = savedPlaces.value.findIndex((p) => p === place)
  editingIndex.value = realIdx
  presetLabel.value = ''
  showModal.value = true
}

function openAddNew() {
  editingIndex.value = null
  presetLabel.value = ''
  showModal.value = true
}

async function handleSave(placeData) {
  const places = [...savedPlaces.value]

  if (editingIndex.value !== null) {
    // Editing existing
    places[editingIndex.value] = { ...places[editingIndex.value], ...placeData }
  } else if (presetLabel.value) {
    // Adding preset (Home/Work)
    places.push({ ...placeData, label: presetLabel.value })
  } else {
    // Adding new custom place
    places.push(placeData)
  }

  const ok = await persistPlaces(places)
  if (ok) {
    showModal.value = false
    showToast('Place saved')
  }
}

async function handleDelete() {
  if (editingIndex.value === null) return
  const places = savedPlaces.value.filter((_, i) => i !== editingIndex.value)
  const ok = await persistPlaces(places)
  if (ok) {
    showModal.value = false
    showToast('Place removed')
  }
}

function goBack() {
  router.back()
}

function getIcon(label) {
  if (label === 'Home') return 'home'
  if (label === 'Work') return 'work'
  return 'star'
}
</script>

<template>
  <div class="min-h-screen bg-white font-[var(--font-sans)] text-[#191f1c] flex flex-col">
    <!-- Top Bar -->
    <div class="flex items-center gap-3 px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4 max-w-lg mx-auto w-full">
      <button @click="goBack" class="w-10 h-10 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-lg font-bold">Saved places</h1>
    </div>

    <div class="px-5 flex-1 max-w-lg mx-auto w-full">
      <!-- Home -->
      <button @click="openAddPreset('Home')" class="w-full flex items-center justify-between py-4 border-b border-[#191f1c]/8 text-left">
        <div class="flex items-center gap-3 min-w-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#191f1c]/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
          </svg>
          <div class="min-w-0">
            <p class="text-base font-medium">Home</p>
            <p v-if="homePlace" class="text-sm text-[#191f1c]/50 truncate">{{ homePlace.address }}</p>
            <p v-else class="text-sm text-[#191f1c]/30">Add home address</p>
          </div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#191f1c]/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <!-- Work -->
      <button @click="openAddPreset('Work')" class="w-full flex items-center justify-between py-4 border-b border-[#191f1c]/8 text-left">
        <div class="flex items-center gap-3 min-w-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#191f1c]/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0H8m8 0a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2" />
          </svg>
          <div class="min-w-0">
            <p class="text-base font-medium">Work</p>
            <p v-if="workPlace" class="text-sm text-[#191f1c]/50 truncate">{{ workPlace.address }}</p>
            <p v-else class="text-sm text-[#191f1c]/30">Add work address</p>
          </div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#191f1c]/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <!-- Custom places -->
      <button
        v-for="(place, idx) in customPlaces"
        :key="place.label + idx"
        @click="openEditCustom(idx)"
        class="w-full flex items-center justify-between py-4 border-b border-[#191f1c]/8 text-left"
      >
        <div class="flex items-center gap-3 min-w-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#191f1c]/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <div class="min-w-0">
            <p class="text-base font-medium">{{ place.label }}</p>
            <p class="text-sm text-[#191f1c]/50 truncate">{{ place.address }}</p>
          </div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#191f1c]/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <!-- Add a place -->
      <button @click="openAddNew" class="w-full flex items-center gap-3 py-4 text-left">
        <div class="w-5 h-5 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <span class="text-base font-medium text-[#2b8659]">Add a place</span>
      </button>
    </div>

    <!-- Modal -->
    <SavedPlaceInput
      :visible="showModal"
      :place="editingIndex !== null ? savedPlaces[editingIndex] : null"
      :presetLabel="presetLabel"
      @close="showModal = false"
      @save="handleSave"
      @delete="handleDelete"
    />

    <!-- Toast -->
    <Transition name="fade">
      <div v-if="toast" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#191f1c] text-white text-[13px] font-medium px-5 py-3 rounded-full shadow-lg">
        {{ toast }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
