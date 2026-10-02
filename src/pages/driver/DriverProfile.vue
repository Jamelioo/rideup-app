<script setup>
import DeleteAccountSheet from '../../components/DeleteAccountSheet.vue'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDriver } from '../../lib/useDriver'
import { useAuth, friendlyAuthError } from '../../lib/useAuth'
import { DEMO_MODE } from '../../lib/demoMode'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { DRIVER_DOCS, listDriverDocs, expiryState } from '../../lib/driverDocs'

const router = useRouter()
const { driver, currentRide, applyDriverRow } = useDriver()
const { user, signOut, sendPasswordReset } = useAuth()

const toast = ref('')

function showToast(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 3000)
}

const initials = computed(() => {
  if (!driver.value?.name) return 'DR'
  return driver.value.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
})

const memberSince = computed(() => {
  if (!driver.value?.created_at) return ''
  return new Date(driver.value.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
})

const ratingText = computed(() => {
  const r = Number(driver.value?.rating)
  return driver.value?.total_trips > 0 && !Number.isNaN(r) ? r.toFixed(2) : 'New'
})

// ── Documents (real status from storage) ──
const docFiles = ref(DEMO_MODE ? { drivers_license: {}, vehicle_registration: {}, insurance: {}, vehicle_photo: {} } : {})
const docsLoaded = ref(DEMO_MODE)
const docRows = computed(() => DRIVER_DOCS.map((d) => {
  const field = { drivers_license: 'license_expires_on', insurance: 'insurance_expires_on' }[d.key]
  const expiry = field ? expiryState(driver.value?.[field]) : null
  const has = !!docFiles.value[d.key]
  return {
    label: d.label,
    text: !has ? 'Missing' : expiry === 'expired' ? 'Expired' : expiry === 'soon' ? 'Expires soon' : driver.value?.approved ? '✓ Approved' : 'Under review',
    tone: !has || expiry === 'expired' ? 'bad' : expiry === 'soon' || !driver.value?.approved ? 'warn' : 'ok',
  }
}))

// ── Cancellation rate (last 30 days): trips you cancelled ÷ trips you accepted ──
const stats = ref({ accepted: 0, driverCancelled: 0 })
const cancellationRate = computed(() => stats.value.accepted ? Math.round((stats.value.driverCancelled / stats.value.accepted) * 100) : null)

onMounted(async () => {
  if (DEMO_MODE || !supabaseConfigured || !user.value || !driver.value) return
  listDriverDocs(user.value.id).then((f) => { docFiles.value = f }).catch(() => {}).finally(() => { docsLoaded.value = true })
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data } = await supabase.from('rides').select('status, cancelled_by').eq('driver_id', driver.value.id).gte('created_at', since).limit(1000)
  const rows = data || []
  stats.value = { accepted: rows.length, driverCancelled: rows.filter((r) => r.status === 'cancelled' && r.cancelled_by === 'driver').length }
})

// ── Photo ──
const photoInput = ref(null)
const uploadingPhoto = ref(false)

function choosePhoto() {
  if (currentRide.value) {
    showToast('Finish your current trip before changing your photo.')
    return
  }
  photoInput.value?.click()
}

async function uploadPhoto(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type]
  if (!ext) { showToast('Please choose a JPG, PNG or WebP photo.'); return }
  if (file.size > 5 * 1024 * 1024) { showToast('Photo too large. Maximum size is 5MB.'); return }
  if (driver.value?.approved && !window.confirm('Riders use your photo to recognise you, so a new one needs a quick review. You can’t go online until it’s approved. Continue?')) return
  if (DEMO_MODE || !supabaseConfigured) { showToast('Photo upload is available once the app is connected.'); return }

  uploadingPhoto.value = true
  try {
    const path = `avatars/${user.value.id}.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) throw upErr
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
    const { data: row, error } = await supabase
      .from('drivers')
      .update({ photo_url: `${pub.publicUrl}?v=${Date.now()}` })
      .eq('id', driver.value.id)
      .select()
      .single()
    if (error) throw error
    applyDriverRow(row)
    showToast(row.approved ? 'Photo updated' : 'Photo uploaded. We’ll review it shortly.')
  } catch (err) {
    showToast(`Couldn’t upload photo: ${err.message}`)
  } finally {
    uploadingPhoto.value = false
  }
}

const showDelete = ref(false)

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

async function saveField(field, value, done) {
  if (!supabaseConfigured || !driver.value) return
  saving.value = true
  const { data: row, error } = await supabase
    .from('drivers')
    .update({ [field]: value })
    .eq('id', driver.value.id)
    .select()
    .single()
  saving.value = false
  if (error) { showToast('Couldn’t save. Try again.'); return }
  applyDriverRow(row)
  done()
}

function savePhone() {
  const value = editPhone.value.trim()
  if (value.replace(/\D/g, '').length < 7) { showToast('Enter a valid phone number.'); return }
  saveField('phone', value, () => { editingPhone.value = false; showToast('Phone updated') })
}

function saveEmail() {
  const value = editEmail.value.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { showToast('Enter a valid email address.'); return }
  saveField('email', value, () => { editingEmail.value = false; showToast('Contact email updated') })
}

async function changePassword() {
  const email = user.value?.email
  if (!email) { showToast('Add an email to your account first.'); return }
  const { error } = await sendPasswordReset(email)
  showToast(error ? friendlyAuthError(error) : `We emailed ${email} a link to set a new password.`)
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
        <button type="button" @click="choosePhoto" :disabled="uploadingPhoto" class="relative w-24 h-24 rounded-full mx-auto mb-3 block" :aria-label="driver?.photo_url ? 'Change your photo' : 'Add your photo'">
          <span class="w-24 h-24 rounded-full overflow-hidden bg-[#2b8659] flex items-center justify-center text-white text-2xl font-bold">
            <img v-if="driver?.photo_url" :src="driver.photo_url" alt="" class="w-full h-full object-cover" />
            <span v-else>{{ initials }}</span>
          </span>
          <span class="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center shadow" aria-hidden="true">
            <svg v-if="!uploadingPhoto" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
          </span>
        </button>
        <input ref="photoInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="uploadPhoto" />
        <p v-if="!driver?.photo_url" class="text-[12px] text-[var(--color-warning)] font-semibold mb-2">Add a clear photo of your face. Riders use it to recognise you.</p>
        <h2 class="text-xl font-bold">{{ driver?.name || 'Driver' }}</h2>
        <p class="text-[14px] text-[var(--color-text-muted)] mt-1">★ {{ ratingText }} · {{ driver?.total_trips || 0 }} trips</p>
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
            <span class="text-[13px] text-[var(--color-text-muted)]">Cancellation rate (30 days)</span>
            <span class="text-[14px] font-semibold">{{ cancellationRate != null ? cancellationRate + '%' : '—' }}</span>
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
          <p v-if="!docsLoaded" class="text-[13px] text-[var(--color-text-muted)]">Checking your documents…</p>
          <div v-else v-for="d in docRows" :key="d.label" class="flex items-center justify-between">
            <span class="text-[14px]">{{ d.label }}</span>
            <span class="text-[12px] font-semibold" :class="d.tone === 'ok' ? 'text-[var(--color-brand)]' : d.tone === 'warn' ? 'text-[var(--color-warning)]' : 'text-[var(--color-danger)]'">{{ d.text }}</span>
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
              <div class="text-[13px] text-[var(--color-text-muted)]">Contact email</div>
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
        <button @click="changePassword" class="text-[13px] text-[var(--color-brand)] font-semibold mt-2 px-1">Change password</button>
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
        <button @click="showDelete = true" class="w-full py-3 text-[var(--color-text-muted)] text-[13px]">Delete account</button>
      </div>
      <DeleteAccountSheet :open="showDelete" role="driver" @close="showDelete = false" />
    </div>

    <!-- Toast -->
    <Transition name="fade">
      <div v-if="toast" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#191f1c] text-white text-[13px] font-medium px-5 py-3 rounded-full shadow-lg">
        {{ toast }}
      </div>
    </Transition>
  </div>
</template>
