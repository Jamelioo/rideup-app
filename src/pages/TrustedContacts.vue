<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../lib/useAuth'
import { supabase, supabaseConfigured } from '../lib/supabase'

const router = useRouter()
const { user } = useAuth()

const contacts = ref([])
const newName = ref('')
const newPhone = ref('')
const saving = ref(false)
const toast = ref('')

function showToast(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2500)
}

onMounted(() => {
  loadContacts()
})

function loadContacts() {
  const stored = user.value?.user_metadata?.trusted_contacts
  if (Array.isArray(stored)) {
    contacts.value = stored
  }
}

async function saveContacts(list) {
  if (!supabaseConfigured) return
  await supabase.auth.updateUser({
    data: { trusted_contacts: list },
  })
}

async function addContact() {
  if (!newName.value.trim() || !newPhone.value.trim()) return

  saving.value = true
  const updated = [
    ...contacts.value,
    { id: Date.now().toString(), name: newName.value.trim(), phone: newPhone.value.trim() },
  ]

  try {
    await saveContacts(updated)
    contacts.value = updated
    newName.value = ''
    newPhone.value = ''
    showToast('Contact added')
  } catch {
    showToast('Failed to save contact')
  } finally {
    saving.value = false
  }
}

async function removeContact(id) {
  const updated = contacts.value.filter((c) => c.id !== id)
  try {
    await saveContacts(updated)
    contacts.value = updated
    showToast('Contact removed')
  } catch {
    showToast('Failed to remove contact')
  }
}

function goBack() {
  router.back()
}
</script>

<template>
  <div class="min-h-screen bg-[var(--color-surface)] font-[var(--font-sans)] text-[var(--color-text-primary)] flex flex-col">
    <!-- Top Bar -->
    <div class="flex items-center gap-3 px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4 max-w-lg mx-auto w-full">
      <button @click="goBack" class="w-10 h-10 flex items-center justify-center rounded-full active:bg-[var(--color-surface-secondary)]">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-lg font-bold">Trusted Contacts</h1>
    </div>

    <div class="px-5 max-w-lg mx-auto w-full flex-1">
      <!-- Add Contact Form -->
      <div class="bg-[var(--color-surface-secondary)] rounded-2xl p-4 mb-6">
        <p class="text-[13px] font-semibold text-[#2b8659] mb-3">Add a contact</p>
        <input
          v-model="newName"
          type="text"
          placeholder="Name"
          class="w-full px-4 py-3 bg-[var(--color-surface)] rounded-xl text-[14px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] mb-2 focus:outline-none focus:ring-2 focus:ring-[#2b8659]/30"
        />
        <input
          v-model="newPhone"
          type="tel"
          placeholder="Phone number"
          class="w-full px-4 py-3 bg-[var(--color-surface)] rounded-xl text-[14px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] mb-3 focus:outline-none focus:ring-2 focus:ring-[#2b8659]/30"
        />
        <button
          @click="addContact"
          :disabled="!newName.trim() || !newPhone.trim() || saving"
          :class="[
            'w-full py-3 font-semibold text-[14px] rounded-xl transition-colors',
            newName.trim() && newPhone.trim() && !saving
              ? 'bg-[#2b8659] text-white active:bg-[#236e49]'
              : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)] cursor-not-allowed'
          ]"
        >
          {{ saving ? 'Saving...' : 'Add contact' }}
        </button>
      </div>

      <!-- Contacts List -->
      <div v-if="contacts.length > 0">
        <p class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Your contacts</p>
        <div
          v-for="contact in contacts"
          :key="contact.id"
          class="flex items-center justify-between py-3.5 border-b border-[var(--color-border)]"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-full bg-[#2b8659]/10 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#2b8659]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div class="min-w-0">
              <p class="text-[14px] font-medium text-[var(--color-text-primary)] truncate">{{ contact.name }}</p>
              <p class="text-xs text-[var(--color-text-muted)]">{{ contact.phone }}</p>
            </div>
          </div>
          <button
            @click="removeContact(contact.id)"
            class="w-9 h-9 flex items-center justify-center rounded-full active:bg-red-50 shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="flex flex-col items-center py-12">
        <div class="w-16 h-16 rounded-full bg-[var(--color-surface-secondary)] flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <p class="text-[14px] text-[var(--color-text-muted)] text-center max-w-[240px]">Add trusted contacts to quickly share your trips</p>
      </div>
    </div>

    <!-- Toast -->
    <Transition name="fade">
      <div v-if="toast" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--color-text-primary)] text-white text-[13px] font-medium px-5 py-3 rounded-full shadow-lg">
        {{ toast }}
      </div>
    </Transition>
  </div>
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
</style>
