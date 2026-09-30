<script setup>
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

const emit = defineEmits(['converted', 'skipped'])

const email = ref('')
const password = ref('')
const submitting = ref(false)
const error = ref(null)
const success = ref(false)

async function handleConvert() {
  if (!email.value.trim() || password.value.length < 6) {
    error.value = 'Please enter a valid email and password (6+ characters).'
    return
  }
  submitting.value = true
  error.value = null

  try {
    const { error: updateErr } = await supabase.auth.updateUser({
      email: email.value.trim(),
      password: password.value,
    })
    if (updateErr) {
      if (updateErr.message.includes('already registered')) {
        error.value = 'This email is already registered. Try logging in instead.'
      } else {
        error.value = updateErr.message
      }
      submitting.value = false
      return
    }

    // Update rider record
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('riders').update({ is_guest: false, email: email.value.trim() }).eq('auth_user_id', user.id)
    }

    success.value = true
    setTimeout(() => emit('converted'), 1500)
  } catch (err) {
    error.value = 'Something went wrong. Please try again.'
    submitting.value = false
  }
}
</script>

<template>
  <div class="bg-[var(--color-surface-secondary)] rounded-2xl p-5 mx-6 mb-4">
    <div v-if="success" class="text-center py-2">
      <div class="text-[var(--color-brand)] text-[15px] font-bold">Account created!</div>
      <div class="text-[12px] text-[var(--color-text-muted)] mt-1">You can now log in anytime.</div>
    </div>
    <template v-else>
      <h3 class="text-[16px] font-bold mb-1">Save your account</h3>
      <p class="text-[12px] text-[var(--color-text-muted)] mb-4">Keep your ride history and book faster next time.</p>

      <div v-if="error" class="bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] px-3 py-2 rounded-xl mb-3">{{ error }}</div>

      <input v-model="email" type="email" placeholder="Email address"
             class="w-full bg-[var(--color-surface)] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#2b8659] transition-all min-h-[44px] mb-2" />
      <input v-model="password" type="password" placeholder="Create a password"
             class="w-full bg-[var(--color-surface)] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#2b8659] transition-all min-h-[44px] mb-4" />

      <button @click="handleConvert" :disabled="submitting"
              class="w-full py-3 bg-[#2b8659] text-white font-bold rounded-2xl text-[14px] transition-all active:scale-[0.98] disabled:opacity-50">
        {{ submitting ? 'Creating...' : 'Create Account' }}
      </button>
      <button @click="emit('skipped')" class="w-full text-center text-[13px] text-[var(--color-text-muted)] mt-3 py-2">Skip</button>
    </template>
  </div>
</template>
