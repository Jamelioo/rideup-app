<script setup>
import { useRouter } from 'vue-router'
import { ref, computed } from 'vue'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

const router = useRouter()
const { user } = useAuth()

const fullName = user.value?.user_metadata?.name || ''
const nameParts = fullName.split(' ')

const firstName = ref(nameParts[0] || '')
const lastName = ref(nameParts.slice(1).join(' ') || '')
const email = ref(user.value?.email || '')
const phoneNumber = ref(user.value?.user_metadata?.phone || '')

const saving = ref(false)
const saveMessage = ref('')
const saveError = ref(false)

function cancel() {
  window.history.length > 1 ? router.back() : router.push('/')
}

async function handleSave() {
  saving.value = true
  saveMessage.value = ''
  saveError.value = false

  const { error } = await supabase.auth.updateUser({
    data: {
      name: (firstName.value + ' ' + lastName.value).trim(),
      phone: phoneNumber.value,
    },
  })

  saving.value = false

  if (error) {
    saveMessage.value = error.message
    saveError.value = true
  } else {
    saveMessage.value = 'Profile saved!'
    saveError.value = false
    setTimeout(() => { saveMessage.value = '' }, 2000)
  }
}
</script>

<template>
  <div class="min-h-screen bg-white font-[var(--font-sans)] text-[#1a1a1a] flex flex-col">
    <!-- Top Bar -->
    <div class="flex items-center justify-between px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4 max-w-lg mx-auto w-full">
      <button @click="cancel" class="text-[#58cc02] text-base font-medium">Cancel</button>
      <h1 class="text-base font-bold font-serif">Edit profile</h1>
      <button @click="handleSave" :disabled="saving" class="text-[#58cc02] text-base font-semibold disabled:opacity-50">{{ saving ? 'Saving...' : 'Save' }}</button>
    </div>

    <!-- Avatar Placeholder -->
    <div class="flex justify-center mt-6 mb-8">
      <div class="w-24 h-24 rounded-full bg-[#1a1a1a]/[0.06] flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-[#1a1a1a]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
    </div>

    <!-- Form Fields -->
    <div class="px-5 flex-1 max-w-lg mx-auto w-full">
      <!-- First Name -->
      <div class="mb-5">
        <label class="block text-xs text-[#1a1a1a]/40 mb-1">First name</label>
        <input
          v-model="firstName"
          type="text"
          autocomplete="given-name"
          class="w-full bg-transparent text-base text-[#1a1a1a] pb-2 border-b border-[#1a1a1a]/10 outline-none focus:border-[#58cc02] transition-colors"
        />
      </div>

      <!-- Last Name -->
      <div class="mb-5">
        <label class="block text-xs text-[#1a1a1a]/40 mb-1">Last name</label>
        <input
          v-model="lastName"
          type="text"
          autocomplete="family-name"
          class="w-full bg-transparent text-base text-[#1a1a1a] pb-2 border-b border-[#1a1a1a]/10 outline-none focus:border-[#58cc02] transition-colors"
        />
      </div>

      <!-- Email (read-only) -->
      <div class="mb-5">
        <label class="block text-xs text-[#1a1a1a]/40 mb-1">Email</label>
        <input
          v-model="email"
          type="email"
          readonly
          class="w-full bg-transparent text-base text-[#1a1a1a]/40 pb-2 border-b border-[#1a1a1a]/10 outline-none cursor-not-allowed"
        />
      </div>

      <!-- Phone Number -->
      <div class="mb-2">
        <label class="block text-xs text-[#1a1a1a]/40 mb-1">Phone number</label>
        <input
          v-model="phoneNumber"
          type="tel"
          autocomplete="tel"
          class="w-full bg-transparent text-base text-[#1a1a1a] pb-2 border-b border-[#1a1a1a]/10 outline-none focus:border-[#58cc02] transition-colors"
        />
      </div>

      <!-- Save feedback -->
      <p v-if="saveMessage" :class="saveError ? 'text-red-500' : 'text-[#58cc02]'" class="text-sm mt-4">
        {{ saveMessage }}
      </p>
    </div>
  </div>
</template>
