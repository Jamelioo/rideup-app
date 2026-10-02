<script setup>
import { ref, onMounted } from 'vue'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { authRedirectUrl, friendlyAuthError, MIN_PASSWORD } from '../lib/useAuth'
import { DEMO_MODE } from '../lib/demoMode'

// Turns a guest (anonymous) session into a real account without losing its trips.
// Supabase requires the email to be confirmed before a password can be set, so:
// email → (confirmation link → /set-password) → password. If the project auto-confirms emails,
// the password step happens right here.
defineProps({
  showSkip: { type: Boolean, default: true },
  title: { type: String, default: 'Save your account' },
  subtitle: { type: String, default: 'Keep your trips and receipts, and book faster next time.' },
})
const emit = defineEmits(['converted', 'skipped'])

const step = ref('email') // email | sent | password | done
const email = ref('')
const password = ref('')
const submitting = ref(false)
const error = ref('')
const notice = ref('')
let riderName = ''

onMounted(async () => {
  if (DEMO_MODE || !supabaseConfigured) return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  // Already asked for a link earlier in this session.
  if (user.new_email) {
    email.value = user.new_email
    step.value = 'sent'
  }
  const { data } = await supabase.from('riders').select('name').eq('auth_user_id', user.id).maybeSingle()
  riderName = data?.name || ''
})

async function sendLink() {
  error.value = ''
  notice.value = ''
  const value = email.value.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    error.value = 'Please enter a valid email address.'
    return
  }
  submitting.value = true
  if (DEMO_MODE || !supabaseConfigured) {
    submitting.value = false
    step.value = 'sent'
    return
  }
  const data = { needs_password: true }
  if (riderName) data.name = riderName
  const { data: result, error: err } = await supabase.auth.updateUser({ email: value, data }, { emailRedirectTo: authRedirectUrl('/set-password') })
  submitting.value = false
  if (err) {
    const msg = friendlyAuthError(err)
    error.value = /already exists/i.test(msg)
      ? 'That email already has a RideUp account. Log out, then log in with it to book on that account.'
      : msg
    return
  }
  // Auto-confirm projects change the email immediately; otherwise it waits in new_email until the link is tapped.
  step.value = result?.user?.email?.toLowerCase() === value.toLowerCase() ? 'password' : 'sent'
}

async function resend() {
  await sendLink()
  if (!error.value && step.value === 'sent') notice.value = 'Sent again. It can take a minute; check spam too.'
}

async function savePassword() {
  error.value = ''
  if (password.value.length < MIN_PASSWORD) {
    error.value = `Use at least ${MIN_PASSWORD} characters.`
    return
  }
  submitting.value = true
  const { data, error: err } = await supabase.auth.updateUser({ password: password.value, data: { needs_password: null } })
  if (err) {
    submitting.value = false
    error.value = friendlyAuthError(err)
    return
  }
  if (data?.user) {
    await supabase.from('riders').update({ is_guest: false, email: data.user.email }).eq('auth_user_id', data.user.id)
  }
  submitting.value = false
  step.value = 'done'
  emit('converted')
}

const inputClass = 'w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[15px] outline-none focus:border-[#2b8659] transition-colors min-h-[48px] placeholder:text-[var(--color-text-muted)]'
</script>

<template>
  <section class="bg-[var(--color-surface-secondary)] rounded-2xl p-5" aria-live="polite">
    <div v-if="step === 'done'" class="text-center py-2">
      <div class="text-[var(--color-brand)] text-[16px] font-bold">Your account is saved</div>
      <div class="text-[13px] text-[var(--color-text-muted)] mt-1">Log in with {{ email }} and your password next time.</div>
    </div>

    <div v-else-if="step === 'sent'">
      <h3 class="text-[16px] font-bold mb-1">Check your email</h3>
      <p class="text-[13px] text-[var(--color-text-secondary)] mb-3">
        We sent a link to <strong class="text-[var(--color-text-primary)]">{{ email }}</strong>. Tap it on this phone to confirm your email and choose a password. Your trips stay with your account.
      </p>
      <p v-if="notice" class="text-[12px] text-[var(--color-brand)] mb-2" role="status">{{ notice }}</p>
      <p v-if="error" class="text-[12px] text-[var(--color-danger)] mb-2" role="alert">{{ error }}</p>
      <div class="flex gap-4">
        <button @click="resend" :disabled="submitting" class="text-[13px] font-semibold text-[var(--color-brand)] py-2 disabled:opacity-50">{{ submitting ? 'Sending…' : 'Resend link' }}</button>
        <button @click="step = 'email'; notice = ''; error = ''" class="text-[13px] font-semibold text-[var(--color-text-muted)] py-2">Use a different email</button>
      </div>
    </div>

    <form v-else-if="step === 'password'" @submit.prevent="savePassword" novalidate>
      <h3 class="text-[16px] font-bold mb-1">Choose a password</h3>
      <p class="text-[13px] text-[var(--color-text-muted)] mb-3">You’ll log in with {{ email }}.</p>
      <p v-if="error" class="text-[12px] text-[var(--color-danger)] mb-2" role="alert">{{ error }}</p>
      <label class="block mb-3">
        <span class="sr-only">Password</span>
        <input v-model="password" type="password" autocomplete="new-password" :placeholder="`Password (at least ${MIN_PASSWORD} characters)`" :class="inputClass" />
      </label>
      <button type="submit" :disabled="submitting" class="w-full py-3 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px] active:scale-[0.98] disabled:opacity-50">
        {{ submitting ? 'Saving…' : 'Save account' }}
      </button>
    </form>

    <form v-else @submit.prevent="sendLink" novalidate>
      <h3 class="text-[16px] font-bold mb-1">{{ title }}</h3>
      <p class="text-[13px] text-[var(--color-text-muted)] mb-4">{{ subtitle }}</p>
      <p v-if="error" class="text-[12px] text-[var(--color-danger)] mb-2" role="alert">{{ error }}</p>
      <label class="block mb-3">
        <span class="sr-only">Email address</span>
        <input v-model="email" type="email" inputmode="email" autocomplete="email" placeholder="Email address" :class="inputClass" />
      </label>
      <button type="submit" :disabled="submitting" class="w-full py-3 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px] active:scale-[0.98] disabled:opacity-50">
        {{ submitting ? 'Sending…' : 'Continue' }}
      </button>
      <button v-if="showSkip" type="button" @click="emit('skipped')" class="w-full text-center text-[13px] text-[var(--color-text-muted)] mt-2 py-2">Not now</button>
    </form>
  </section>
</template>
