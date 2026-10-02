<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { apiPost } from '../lib/api'
import { supabase } from '../lib/supabase'
import { DEMO_MODE } from '../lib/demoMode'

// In-app account deletion, as the App Store and Google Play require. Checks first whether the account can
// be deleted (no trip in progress, nothing unpaid, no driver earnings owed), then asks the person to type DELETE.
const props = defineProps({ open: Boolean, role: { type: String, default: 'rider' } })
const emit = defineEmits(['close'])
const router = useRouter()

const checking = ref(false)
const blocker = ref('')
const typed = ref('')
const busy = ref(false)
const error = ref('')

watch(() => props.open, async (open) => {
  if (!open) return
  typed.value = ''
  error.value = ''
  blocker.value = ''
  if (DEMO_MODE) return
  checking.value = true
  try {
    const res = await apiPost('/api/delete-account', { check: true })
    if (!res.ok) blocker.value = (await res.json().catch(() => ({}))).error || 'Your account can’t be deleted right now.'
  } catch (err) {
    blocker.value = err.message
  } finally {
    checking.value = false
  }
})

async function confirmDelete() {
  if (typed.value.trim().toUpperCase() !== 'DELETE' || busy.value) return
  if (DEMO_MODE) { error.value = 'Account deletion works once the app is connected.'; return }
  busy.value = true
  error.value = ''
  try {
    const res = await apiPost('/api/delete-account', { confirm: 'DELETE' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || 'Something went wrong. Please try again.')
    // The login no longer exists; clear the local session without asking the server.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    try { localStorage.removeItem('rideup_promo'); localStorage.removeItem('rideup_ref') } catch { /* private mode */ }
    router.replace({ path: '/', query: { deleted: '1' } })
  } catch (err) {
    error.value = err.message
    busy.value = false
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center bg-[var(--color-overlay)]" @click.self="emit('close')">
      <div role="dialog" aria-modal="true" aria-labelledby="delete-title"
           class="w-full max-w-md bg-[var(--color-surface)] text-[var(--color-text-primary)] rounded-t-3xl px-6 pt-8 pb-[max(2.5rem,env(safe-area-inset-bottom))] shadow-xl">
        <h3 id="delete-title" class="text-lg font-bold mb-2">Delete your account?</h3>
        <p v-if="checking" class="text-[14px] text-[var(--color-text-muted)] mb-6" aria-live="polite">Checking your account…</p>
        <template v-else-if="blocker">
          <p class="text-[14px] text-red-600 mb-6" role="alert">{{ blocker }}</p>
          <button @click="emit('close')" class="w-full py-3.5 bg-[var(--color-surface-secondary)] font-bold rounded-xl text-[14px]">OK</button>
        </template>
        <template v-else>
          <ul class="text-[14px] text-[var(--color-text-secondary)] space-y-1.5 mb-4 list-disc pl-5">
            <li>Your login, name, phone, email, photo and saved cards are deleted.</li>
            <li v-if="role === 'driver'">Your documents are deleted and you won’t get trip requests.</li>
            <li v-else>Any ride credit and promo codes are lost.</li>
            <li>Past trips and payments are kept without your name, for tax and safety records.</li>
            <li>This can’t be undone.</li>
          </ul>
          <label for="delete-confirm" class="block text-[13px] font-semibold mb-1.5">Type DELETE to confirm</label>
          <input id="delete-confirm" v-model="typed" autocomplete="off" autocapitalize="characters" spellcheck="false"
                 class="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[16px] mb-3" />
          <p v-if="error" class="text-[13px] text-red-600 mb-3" role="alert">{{ error }}</p>
          <button @click="confirmDelete" :disabled="typed.trim().toUpperCase() !== 'DELETE' || busy"
                  class="w-full py-3.5 bg-red-600 text-white font-bold rounded-xl text-[14px] mb-3 disabled:opacity-40">
            {{ busy ? 'Deleting…' : 'Delete my account' }}
          </button>
          <button @click="emit('close')" class="w-full py-3 text-[14px] text-[var(--color-text-muted)] font-medium">Cancel</button>
        </template>
      </div>
    </div>
  </Transition>
</template>
