<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDriver } from '../../lib/useDriver'
import { useAuth } from '../../lib/useAuth'
import { DEMO_MODE } from '../../lib/demoMode'
import { supabase, supabaseConfigured } from '../../lib/supabase'

const router = useRouter()
const { driver } = useDriver()
const { signOut } = useAuth()

const toast = ref('')

function showToast(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2500)
}

const initials = computed(() => {
  if (!driver.value?.name) return 'DR'
  return driver.value.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
})

const memberSince = computed(() => {
  if (!driver.value?.created_at) return ''
  return new Date(driver.value.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
})

async function handleLogout() {
  await signOut()
  router.push('/welcome')
}

function goBack() {
  router.back()
}

const editingPhone = ref(false)
const editingEmail = ref(false)
const editPhone = ref('')
const editEmail = ref('')
const saving = ref(false)

function startEditPhone() {
  editPhone.value = driver.value?.phone || ''
  editingPhone.value = true
}

function startEditEmail() {
  editEmail.value = driver.value?.email || ''
  editingEmail.value = true
}

async function savePhone() {
  if (!supabaseConfigured || !driver.value) return
  saving.value = true
  const { error } = await supabase
    .from('drivers')
    .update({ phone: editPhone.value.trim() })
    .eq('id', driver.value.id)
  saving.value = false
  if (error) { showToast('Failed to save'); return }
  driver.value.phone = editPhone.value.trim()
  editingPhone.value = false
  showToast('Phone updated')
}

async function saveEmail() {
  if (!supabaseConfigured || !driver.value) return
  saving.value = true
  const { error } = await supabase
    .from('drivers')
    .update({ email: editEmail.value.trim() })
    .eq('id', driver.value.id)
  saving.value = false
  if (error) { showToast('Failed to save'); return }
  driver.value.email = editEmail.value.trim()
  editingEmail.value = false
  showToast('Email updated')
}
</script>

<template>
  <div class="min-h-dvh bg-[var(--color-surface)] text-[var(--color-text-primary)]">
    <!-- Top bar -->
    <div class="flex items-center justify-between px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4 max-w-lg mx-auto w-full">
      <button @click="goBack" class="w-10 h-10 flex items-center justify-center rounded-full active:bg-[var(--color-surface-secondary)]" aria-label="Back">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-[17px] font-bold">Profile</h1>
      <div class="w-10 h-10"></div>
    </div>

    <div class="max-w-lg mx-auto px-5 pb-8">
      <!-- Avatar + name -->
      <div class="text-center mb-8">
        <div class="w-20 h-20 rounded-full bg-[#2b8659] flex items-center justify-center mx-auto mb-3 text-white text-2xl font-bold">
          {{ initials }}
        </div>
        <h2 class="text-xl font-bold">{{ driver?.name || 'Driver' }}</h2>
        <p class="text-[14px] text-[var(--color-text-muted)] mt-1">★ {{ driver?.rating || '5.0' }} · {{ driver?.total_trips || 0 }} trips</p>
      </div>

      <!-- Vehicle -->
      <div class="mb-6">
        <p class="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Vehicle</p>
        <div class="bg-[var(--color-surface-secondary)] rounded-2xl p-4 space-y-2">
          <div class="flex justify-between">
            <span class="text-[13px] text-[var(--color-text-muted)]">Vehicle</span>
            <span class="text-[14px] font-semibold">{{ driver?.vehicle_make }} {{ driver?.vehicle_model }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[13px] text-[var(--color-text-muted)]">Color</span>
            <span class="text-[14px] font-semibold">{{ driver?.vehicle_color || '—' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[13px] text-[var(--color-text-muted)]">Plate</span>
            <span class="text-[14px] font-semibold uppercase">{{ driver?.license_plate || '—' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[13px] text-[var(--color-text-muted)]">Type</span>
            <span class="text-[14px] font-semibold capitalize">{{ driver?.vehicle_type || 'standard' }}</span>
          </div>
        </div>
        <button @click="showToast('Contact support at (242) 452-9911')" class="text-[13px] text-[var(--color-brand)] font-semibold mt-2 px-1">Edit Vehicle</button>
      </div>

      <!-- Stats -->
      <div class="mb-6">
        <p class="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Stats</p>
        <div class="bg-[var(--color-surface-secondary)] rounded-2xl p-4 space-y-2">
          <div class="flex justify-between">
            <span class="text-[13px] text-[var(--color-text-muted)]">Acceptance rate</span>
            <span class="text-[14px] font-semibold">{{ driver?.acceptance_rate != null ? driver.acceptance_rate + '%' : '—' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[13px] text-[var(--color-text-muted)]">Cancellation rate</span>
            <span class="text-[14px] font-semibold">{{ driver?.cancellation_rate != null ? driver.cancellation_rate + '%' : '—' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[13px] text-[var(--color-text-muted)]">Member since</span>
            <span class="text-[14px] font-semibold">{{ memberSince }}</span>
          </div>
        </div>
      </div>

      <!-- Documents -->
      <div class="mb-6">
        <p class="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Documents</p>
        <div class="bg-[var(--color-surface-secondary)] rounded-2xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-[14px]">Driver's License</span>
            <span class="text-[12px] text-[var(--color-brand)] font-semibold">✓ On file</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[14px]">Insurance</span>
            <span class="text-[12px] text-[var(--color-brand)] font-semibold">✓ On file</span>
          </div>
        </div>
        <button @click="router.push('/driver/documents')" class="text-[13px] text-[var(--color-brand)] font-semibold mt-2 px-1">Upload / Update</button>
      </div>

      <!-- Account -->
      <div class="mb-6">
        <p class="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Account</p>
        <div class="bg-[var(--color-surface-secondary)] rounded-2xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-[13px] text-[var(--color-text-muted)]">Phone</div>
              <div v-if="editingPhone" class="flex items-center gap-2 mt-1">
                <input v-model="editPhone" type="tel" class="text-[14px] font-semibold bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-1.5 rounded-lg w-40 outline-none focus:ring-2 focus:ring-[#2b8659]/30" />
                <button @click="savePhone" :disabled="saving" class="text-[12px] text-[var(--color-brand)] font-semibold">Save</button>
                <button @click="editingPhone = false" class="text-[12px] text-[var(--color-text-muted)]">Cancel</button>
              </div>
              <div v-else class="text-[14px] font-semibold">{{ driver?.phone || '—' }}</div>
            </div>
            <button v-if="!editingPhone" @click="startEditPhone" class="text-[12px] text-[var(--color-brand)] font-semibold">Edit</button>
          </div>
          <div class="border-t border-[var(--color-border)]"></div>
          <div class="flex items-center justify-between">
            <div>
              <div class="text-[13px] text-[var(--color-text-muted)]">Email</div>
              <div v-if="editingEmail" class="flex items-center gap-2 mt-1">
                <input v-model="editEmail" type="email" class="text-[14px] font-semibold bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-1.5 rounded-lg w-40 outline-none focus:ring-2 focus:ring-[#2b8659]/30" />
                <button @click="saveEmail" :disabled="saving" class="text-[12px] text-[var(--color-brand)] font-semibold">Save</button>
                <button @click="editingEmail = false" class="text-[12px] text-[var(--color-text-muted)]">Cancel</button>
              </div>
              <div v-else class="text-[14px] font-semibold">{{ driver?.email || '—' }}</div>
            </div>
            <button v-if="!editingEmail" @click="startEditEmail" class="text-[12px] text-[var(--color-brand)] font-semibold">Edit</button>
          </div>
        </div>
        <button @click="showToast('Contact support at (242) 452-9911')" class="text-[13px] text-[var(--color-text-muted)] font-semibold mt-2 px-1 underline underline-offset-2">Change Password</button>
      </div>

      <!-- Switch + Logout -->
      <div class="space-y-2 mt-8">
        <button @click="router.push('/book')"
                class="w-full py-3.5 border-2 border-[var(--color-border)] text-[14px] font-semibold rounded-2xl active:bg-[var(--color-surface-secondary)] transition-colors">
          Switch to Rider
        </button>
        <button @click="handleLogout"
                class="w-full py-3.5 text-red-500 text-[14px] font-semibold rounded-2xl active:bg-red-50 transition-colors">
          Log Out
        </button>
      </div>
    </div>

    <!-- Toast -->
    <Transition name="fade">
      <div v-if="toast" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#191f1c] text-white text-[13px] font-medium px-5 py-3 rounded-full shadow-lg">
        {{ toast }}
      </div>
    </Transition>
  </div>
</template>
