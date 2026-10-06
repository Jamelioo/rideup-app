<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'

// Uber-style "Share trip status": a secret live link (/track/<token>) showing the driver, car, plate and
// live position until an hour after the trip ends. Anyone with the link can watch; nobody else can.
const props = defineProps({
  ride: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['back', 'close'])

const { user } = useAuth()
const link = ref('')
const loading = ref(true)
const error = ref('')
const copied = ref(false)

const driverName = computed(() => props.ride?.driverName || 'Your driver')
const vehicleInfo = computed(() => [props.ride?.vehicleInfo, props.ride?.plate].filter(Boolean).join(' · ') || 'Vehicle details on the way')
const trustedContacts = computed(() => {
  const list = user.value?.user_metadata?.trusted_contacts
  return Array.isArray(list) ? list.filter((c) => c?.phone) : []
})

const message = computed(() =>
  `I'm on a RideUp trip with ${driverName.value} (${vehicleInfo.value}). Follow my ride live: ${link.value}`
)

onMounted(async () => {
  if (!supabaseConfigured || !props.ride?.id || String(props.ride.id).startsWith('demo')) {
    link.value = `${location.origin}/track/demo`
    loading.value = false
    return
  }
  const { data, error: rpcErr } = await supabase.rpc('create_share_link', { p_ride_id: props.ride.id })
  if (rpcErr || !data) {
    error.value = 'Could not create a share link right now. You can still call 919 in an emergency.'
  } else {
    link.value = `${location.origin}/track/${data}`
  }
  loading.value = false
})

async function shareNative() {
  if (!navigator.share) return copyLink()
  try {
    await navigator.share({ title: 'My RideUp trip', text: message.value, url: link.value })
  } catch { /* user cancelled */ }
}

function shareWhatsApp() {
  window.open(`https://wa.me/?text=${encodeURIComponent(message.value)}`, '_blank', 'noopener')
}

function smsHref(phone = '') {
  return `sms:${phone.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(message.value)}`
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(message.value)
  } catch {
    const t = document.createElement('textarea')
    t.value = message.value
    document.body.appendChild(t)
    t.select()
    document.execCommand('copy')
    document.body.removeChild(t)
  }
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<template>
  <div class="px-5 pt-2 pb-8">
    <div class="flex items-center justify-between mb-5">
      <button @click="emit('back')" class="w-11 h-11 flex items-center justify-center rounded-full active:bg-[var(--color-surface-secondary)]" aria-label="Back">
        <svg class="w-5 h-5 text-[var(--color-text-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
      </button>
      <h2 class="text-lg font-bold text-[var(--color-text-primary)]">Share trip status</h2>
      <button @click="emit('close')" class="w-11 h-11 flex items-center justify-center rounded-full active:bg-[var(--color-surface-secondary)]" aria-label="Close">
        <svg class="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>

    <p class="text-[13px] text-[var(--color-text-secondary)] mb-4">
      People you share with can follow your ride live, see your driver and car, and know when you arrive. The link stops working an hour after the trip ends.
    </p>

    <div class="bg-[var(--color-surface-secondary)] rounded-2xl p-4 mb-5">
      <p class="text-[14px] font-semibold text-[var(--color-text-primary)]">{{ driverName }}</p>
      <p class="text-[13px] text-[var(--color-text-secondary)]">{{ vehicleInfo }}</p>
      <p v-if="loading" class="text-[12px] text-[var(--color-text-muted)] mt-2">Creating your live link…</p>
      <p v-else-if="link" class="text-[12px] text-[var(--color-brand)] mt-2 break-all">{{ link }}</p>
      <p v-if="error" class="text-[13px] text-[var(--color-danger)] mt-2" role="alert">{{ error }}</p>
    </div>

    <div v-if="trustedContacts.length && link" class="mb-5">
      <p class="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">Your trusted contacts</p>
      <a v-for="c in trustedContacts" :key="c.phone" :href="smsHref(c.phone)"
         class="flex items-center justify-between py-3 border-b border-[var(--color-border)] last:border-b-0">
        <span class="text-[15px] text-[var(--color-text-primary)]">{{ c.name || c.phone }}</span>
        <span class="text-[13px] font-semibold text-[var(--color-brand)]">Send link</span>
      </a>
    </div>
    <router-link v-else-if="!trustedContacts.length" to="/trusted-contacts" class="block text-[13px] text-[var(--color-brand)] font-semibold mb-5">
      Add trusted contacts to share in one tap →
    </router-link>

    <div class="space-y-3">
      <button @click="shareNative" :disabled="!link"
              class="w-full py-3.5 bg-[#2b8659] text-white font-semibold text-[15px] rounded-xl disabled:opacity-50">
        Share link
      </button>
      <div class="grid grid-cols-3 gap-2">
        <button @click="shareWhatsApp" :disabled="!link" class="py-3 rounded-xl bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] text-[13px] font-semibold disabled:opacity-50">WhatsApp</button>
        <a :href="link ? smsHref() : undefined" class="py-3 rounded-xl bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] text-[13px] font-semibold text-center" :class="!link && 'opacity-50 pointer-events-none'">SMS</a>
        <button @click="copyLink" :disabled="!link" class="py-3 rounded-xl bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] text-[13px] font-semibold disabled:opacity-50">{{ copied ? 'Copied!' : 'Copy' }}</button>
      </div>
    </div>
  </div>
</template>
