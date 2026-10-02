<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDriver } from '../../lib/useDriver'
import { useAuth } from '../../lib/useAuth'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { DRIVER_DOCS, docPath, listDriverDocs, expiryState } from '../../lib/driverDocs'
import { DEMO_MODE } from '../../lib/demoMode'

const router = useRouter()
const { driver } = useDriver()
const { user } = useAuth()

const toast = ref('')
const uploading = ref('')
const loading = ref(!DEMO_MODE)
const loadError = ref('')
const files = ref(DEMO_MODE ? { drivers_license: { name: 'licence.jpg' }, vehicle_registration: { name: 'registration.pdf' }, insurance: { name: 'insurance.pdf' } } : {})

const EXPIRY_FIELD = { drivers_license: 'license_expires_on', insurance: 'insurance_expires_on' }

const documents = computed(() => DRIVER_DOCS.map((d) => {
  const file = files.value[d.key]
  const expires = EXPIRY_FIELD[d.key] ? driver.value?.[EXPIRY_FIELD[d.key]] : null
  const expiry = expiryState(expires)
  let status = 'missing'
  if (file) status = expiry === 'expired' ? 'expired' : driver.value?.approved ? 'approved' : 'review'
  return { ...d, file, status, expires, expiry }
}))
const missingCount = computed(() => documents.value.filter((d) => d.status === 'missing' || d.status === 'expired').length)

onMounted(async () => {
  if (DEMO_MODE || !supabaseConfigured || !user.value) {
    loading.value = false
    return
  }
  try {
    files.value = await listDriverDocs(user.value.id)
  } catch (err) {
    loadError.value = 'We couldn’t load your documents. Pull to refresh or try again later.'
  }
  loading.value = false
})

function showToast(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 3000)
}

const STATUS = {
  missing: { label: 'Not uploaded', cls: 'text-[var(--color-text-muted)] bg-[var(--color-surface)]' },
  review: { label: 'Under review', cls: 'text-[var(--color-warning)] bg-amber-500/15' },
  approved: { label: 'Approved', cls: 'text-[var(--color-brand)] bg-[#2b8659]/10' },
  expired: { label: 'Expired', cls: 'text-[var(--color-danger)] bg-red-500/15' },
}

function formatDate(d) {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function handleFileUpload(doc, event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  if (file.size > 10 * 1024 * 1024) {
    showToast('File too large. Maximum size is 10MB.')
    return
  }
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  if (!allowed.includes(file.type)) {
    showToast('Please upload a JPG, PNG, WebP, or PDF file.')
    return
  }

  uploading.value = doc.key
  if (DEMO_MODE) {
    await new Promise(r => setTimeout(r, 1200))
    files.value = { ...files.value, [doc.key]: { name: file.name } }
    uploading.value = ''
    showToast(`${doc.label} uploaded`)
    return
  }

  try {
    if (!supabaseConfigured || !user.value) throw new Error('Storage not configured')
    // One file per document (no extension), so a replacement always overwrites the old one.
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(docPath(user.value.id, doc.key), file, { upsert: true, contentType: file.type })
    if (uploadError) throw uploadError
    files.value = { ...files.value, [doc.key]: { name: file.name, uploadedAt: Date.now() } }
    showToast(`${doc.label} uploaded. We’ll review it shortly.`)
  } catch (err) {
    console.error('Upload failed:', err)
    showToast(`Upload failed: ${err.message}`)
  } finally {
    uploading.value = ''
  }
}

function goBack() {
  router.back()
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
      <h1 class="text-[17px] font-bold">Documents</h1>
      <div class="w-10 h-10"></div>
    </div>

    <div class="max-w-lg mx-auto px-5 pb-8">
      <p class="text-[14px] text-[var(--color-text-muted)] mb-4">Upload clear photos or PDFs. Our team reviews every document before you can drive, and again when one is renewed.</p>

      <div v-if="driver?.review_note && !driver?.approved" class="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-[13px] text-[var(--color-text-primary)]" role="alert">
        <p class="font-semibold mb-1">Message from our review team</p>
        <p>{{ driver.review_note }}</p>
      </div>
      <p v-if="loadError" class="mb-4 text-[13px] text-[var(--color-danger)]" role="alert">{{ loadError }}</p>
      <p v-else-if="!loading && missingCount" class="mb-4 text-[13px] font-semibold text-[var(--color-warning)]">{{ missingCount }} document{{ missingCount === 1 ? '' : 's' }} still needed.</p>
      <p v-if="loading" class="text-[13px] text-[var(--color-text-muted)] mb-4" role="status">Loading your documents…</p>

      <!-- Document list -->
      <div class="space-y-3">
        <div v-for="doc in documents" :key="doc.key"
             class="bg-[var(--color-surface-secondary)] rounded-2xl p-4">
          <div class="flex items-start justify-between mb-2">
            <div class="flex-1">
              <div class="text-[15px] font-semibold">{{ doc.label }}</div>
              <div class="text-[12px] text-[var(--color-text-muted)] mt-0.5">{{ doc.description }}</div>
            </div>
            <span class="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ml-3"
                  :class="STATUS[doc.status].cls">
              {{ STATUS[doc.status].label }}
            </span>
          </div>

          <p v-if="doc.expires" class="text-[12px] mb-2" :class="doc.expiry === 'expired' ? 'text-[var(--color-danger)] font-semibold' : doc.expiry === 'soon' ? 'text-[var(--color-warning)] font-semibold' : 'text-[var(--color-text-muted)]'">
            {{ doc.expiry === 'expired' ? `Expired ${formatDate(doc.expires)}. Upload the renewed document to keep driving.` : doc.expiry === 'soon' ? `Expires ${formatDate(doc.expires)}. Upload the renewal soon.` : `Valid until ${formatDate(doc.expires)}` }}
          </p>

          <!-- File name if uploaded -->
          <div v-if="doc.file?.name" class="text-[12px] text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            {{ doc.file.name }}
          </div>

          <!-- Upload button -->
          <label class="relative cursor-pointer">
            <input type="file" accept="image/*,.pdf" class="sr-only"
                   @change="handleFileUpload(doc, $event)"
                   :disabled="uploading === doc.key" />
            <div class="flex items-center justify-center gap-2 py-2.5 border-2 border-dashed rounded-xl transition-colors"
                 :class="uploading === doc.key
                   ? 'border-[var(--color-border)] text-[var(--color-text-muted)]'
                   : doc.status === 'expired'
                     ? 'border-red-200 text-red-500 active:bg-red-50'
                     : 'border-[var(--color-border)] text-[var(--color-text-muted)] active:bg-[var(--color-surface-secondary)]'">
              <!-- Loading spinner -->
              <svg v-if="uploading === doc.key" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <!-- Upload icon -->
              <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span class="text-[13px] font-semibold">
                {{ uploading === doc.key ? 'Uploading…' : doc.status === 'missing' ? 'Upload file' : 'Replace file' }}
              </span>
            </div>
          </label>
        </div>
      </div>

      <!-- Info note -->
      <div class="mt-6 bg-[var(--color-surface-secondary)] rounded-2xl p-4">
        <p class="text-[13px] text-[var(--color-brand)] font-medium mb-1">Required for approval</p>
        <p class="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">All four documents must be uploaded and approved before you can accept rides. With an expired licence or insurance you can’t go online until the renewal is approved.</p>
      </div>

      <!-- Back to profile -->
      <button @click="router.push('/driver/profile')"
              class="w-full py-3.5 mt-6 border-2 border-[var(--color-border)] text-[14px] font-semibold rounded-2xl active:bg-[var(--color-surface-secondary)] transition-colors">
        Back to Profile
      </button>
    </div>

    <!-- Toast -->
    <Transition name="fade">
      <div v-if="toast" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#191f1c] text-white text-[13px] font-medium px-5 py-3 rounded-full shadow-lg">
        {{ toast }}
      </div>
    </Transition>
  </div>
</template>
