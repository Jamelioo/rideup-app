<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDriver } from '../../lib/useDriver'
import { useAuth } from '../../lib/useAuth'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { DEMO_MODE } from '../../lib/demoMode'

const router = useRouter()
const { driver } = useDriver()
const { user } = useAuth()

const toast = ref('')
const uploading = ref('')

const documents = ref([
  {
    key: 'drivers_license',
    label: "Driver's License",
    description: 'Government-issued photo ID',
    status: DEMO_MODE ? 'approved' : 'pending',
    fileName: null,
  },
  {
    key: 'vehicle_registration',
    label: 'Vehicle Registration',
    description: 'Current vehicle registration document',
    status: DEMO_MODE ? 'approved' : 'pending',
    fileName: null,
  },
  {
    key: 'insurance',
    label: 'Insurance',
    description: 'Valid auto insurance certificate',
    status: DEMO_MODE ? 'uploaded' : 'pending',
    fileName: null,
  },
  {
    key: 'vehicle_photo',
    label: 'Vehicle Photo',
    description: 'Clear photo of your vehicle exterior',
    status: 'pending',
    fileName: null,
  },
])

function showToast(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 3000)
}

function statusColor(status) {
  return {
    pending: 'text-[#191f1c]/40 bg-[#191f1c]/5',
    uploaded: 'text-amber-600 bg-amber-50',
    approved: 'text-[#2b8659] bg-[#2b8659]/10',
    rejected: 'text-red-500 bg-red-50',
  }[status] || 'text-[#191f1c]/40 bg-[#191f1c]/5'
}

function statusLabel(status) {
  return {
    pending: 'Not uploaded',
    uploaded: 'Under review',
    approved: 'Approved',
    rejected: 'Rejected',
  }[status] || 'Pending'
}

function statusIcon(status) {
  return {
    pending: 'upload',
    uploaded: 'clock',
    approved: 'check',
    rejected: 'x',
  }[status] || 'upload'
}

async function handleFileUpload(doc, event) {
  const file = event.target.files?.[0]
  if (!file) return

  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
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
    doc.status = 'uploaded'
    doc.fileName = file.name
    uploading.value = ''
    showToast(`${doc.label} uploaded successfully`)
    return
  }

  try {
    if (!supabaseConfigured) {
      throw new Error('Storage not configured')
    }

    const userId = user.value?.id || 'anonymous'
    const ext = file.name.split('.').pop()
    const path = `driver-documents/${userId}/${doc.key}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(path, file, { upsert: true })

    if (uploadError) throw uploadError

    doc.status = 'uploaded'
    doc.fileName = file.name
    showToast(`${doc.label} uploaded successfully`)
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
  <div class="min-h-screen bg-white text-[#191f1c]">
    <!-- Top bar -->
    <div class="flex items-center justify-between px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4 max-w-lg mx-auto w-full">
      <button @click="goBack" class="w-10 h-10 flex items-center justify-center rounded-full active:bg-[#191f1c]/5">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-[17px] font-bold">Documents</h1>
      <div class="w-10 h-10"></div>
    </div>

    <div class="max-w-lg mx-auto px-5 pb-8">
      <p class="text-[14px] text-[#191f1c]/50 mb-6">Upload your documents to get approved for driving. All documents are securely stored and reviewed within 24 hours.</p>

      <!-- Document list -->
      <div class="space-y-3">
        <div v-for="doc in documents" :key="doc.key"
             class="bg-[#f5f5f5] rounded-2xl p-4">
          <div class="flex items-start justify-between mb-2">
            <div class="flex-1">
              <div class="text-[15px] font-semibold">{{ doc.label }}</div>
              <div class="text-[12px] text-[#191f1c]/40 mt-0.5">{{ doc.description }}</div>
            </div>
            <span class="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ml-3"
                  :class="statusColor(doc.status)">
              {{ statusLabel(doc.status) }}
            </span>
          </div>

          <!-- File name if uploaded -->
          <div v-if="doc.fileName" class="text-[12px] text-[#191f1c]/40 mb-2 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            {{ doc.fileName }}
          </div>

          <!-- Upload button -->
          <label class="relative cursor-pointer">
            <input type="file" accept="image/*,.pdf" class="sr-only"
                   @change="handleFileUpload(doc, $event)"
                   :disabled="uploading === doc.key" />
            <div class="flex items-center justify-center gap-2 py-2.5 border-2 border-dashed rounded-xl transition-colors"
                 :class="uploading === doc.key
                   ? 'border-[#191f1c]/10 text-[#191f1c]/30'
                   : doc.status === 'rejected'
                     ? 'border-red-200 text-red-500 active:bg-red-50'
                     : 'border-[#191f1c]/10 text-[#191f1c]/50 active:bg-[#191f1c]/5'">
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
                {{ uploading === doc.key ? 'Uploading...' : doc.status === 'pending' ? 'Upload file' : 'Replace file' }}
              </span>
            </div>
          </label>
        </div>
      </div>

      <!-- Info note -->
      <div class="mt-6 bg-[#f0fdf4] rounded-2xl p-4">
        <p class="text-[13px] text-[#2b8659] font-medium mb-1">Required for approval</p>
        <p class="text-[12px] text-[#2b8659]/70 leading-relaxed">All four documents must be uploaded and approved before you can start accepting rides. Documents are typically reviewed within 24 hours.</p>
      </div>

      <!-- Back to profile -->
      <button @click="router.push('/driver/profile')"
              class="w-full py-3.5 mt-6 border-2 border-[#191f1c]/10 text-[14px] font-semibold rounded-2xl active:bg-[#191f1c]/5 transition-colors">
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
