<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../lib/useAuth'
import ThemeToggle from '../components/ThemeToggle.vue'
import AccountConversionCard from '../components/AccountConversionCard.vue'
import { supabase } from '../lib/supabase'
import { formatPhone } from '../lib/phone'
import { useSettings } from '../lib/settings'
import { pushStatus, enablePushNotifications } from '../lib/push'

const router = useRouter()
const { user, signOut, needsLogin, isGuest } = useAuth()
const settings = useSettings()

const toast = ref('')
function showToast(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2500)
}

const riderName = ref('')
const riderPhone = ref('')
const displayName = computed(() => user.value?.user_metadata?.name || riderName.value || (isGuest.value ? 'Guest' : 'Rider'))
const displayEmail = computed(() => user.value?.email || (needsLogin.value ? 'Guest account: add your email to keep it' : ''))
const phoneVerified = computed(() => !!user.value?.phone_confirmed_at)
const displayPhone = computed(() => formatPhone(user.value?.phone ? `+${user.value.phone.replace(/^\+/, '')}` : riderPhone.value))

// Trip alerts on this device (only offered once web push keys are configured).
const push = ref('unavailable')
const pushBusy = ref(false)
async function turnOnPush() {
  pushBusy.value = true
  const ok = await enablePushNotifications()
  push.value = await pushStatus()
  pushBusy.value = false
  if (!ok && push.value === 'blocked') showToast('Notifications are blocked. Allow them in your browser settings.')
}
const initials = computed(() =>
  displayName.value
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
)

function goBack() {
  router.back()
}

function goToSavedPlaces() {
  router.push('/saved-places')
}

const savedPlaces = computed(() => {
  const meta = user.value?.user_metadata
  return Array.isArray(meta?.saved_places) ? meta.saved_places : []
})
const homeAddress = computed(() => savedPlaces.value.find((p) => p.label === 'Home')?.address || '')
const workAddress = computed(() => savedPlaces.value.find((p) => p.label === 'Work')?.address || '')

const riderRating = ref(null)
const riderTotalRides = ref(0)

onMounted(async () => {
  pushStatus().then((status) => { push.value = status })
  if (!user.value) return
  try {
    const { data } = await supabase
      .from('riders')
      .select('rating, total_rides, name, phone')
      .eq('auth_user_id', user.value.id)
      .maybeSingle()
    if (data) {
      riderRating.value = data.rating
      riderTotalRides.value = data.total_rides || 0
      riderName.value = data.name || ''
      riderPhone.value = data.phone || ''
    }
  } catch (e) { /* keep defaults */ }
})

const showDeleteConfirm = ref(false)

function handleDeleteAccount() {
  showDeleteConfirm.value = true
}

async function handleLogout() {
  if (needsLogin.value && !window.confirm('You’re using a guest account. If you log out you won’t be able to get back to your trips and receipts. Log out anyway?')) return
  await signOut()
  router.push('/welcome')
}
</script>

<template>
  <div class="min-h-dvh bg-[var(--color-surface)] font-[var(--font-sans)] text-[var(--color-text-primary)] flex flex-col">
    <!-- Top Bar -->
    <div class="flex items-center justify-between px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4 max-w-lg mx-auto w-full">
      <button @click="goBack" class="w-10 h-10 flex items-center justify-center" aria-label="Back">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button @click="router.push('/edit-profile')" class="w-10 h-10 flex items-center justify-center rounded-full active:bg-[var(--color-surface-secondary)]" aria-label="Edit profile">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
    </div>

    <!-- Avatar & Name -->
    <div class="flex flex-col items-center mt-4 mb-6 max-w-lg mx-auto w-full">
      <div class="w-20 h-20 rounded-full bg-[#2b8659] flex items-center justify-center mb-4">
        <span class="text-white text-2xl font-bold">{{ initials }}</span>
      </div>
      <h1 class="text-2xl font-bold">{{ displayName }}</h1>

      <!-- Rating display -->
      <div class="flex items-center gap-1.5 mt-2">
        <svg class="w-4 h-4 text-[var(--color-brand)]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        <span class="text-[15px] font-bold">{{ riderRating !== null ? Number(riderRating).toFixed(1) : '--' }}</span>
        <span class="text-[13px] text-[var(--color-text-muted)]">({{ riderTotalRides }} rides)</span>
      </div>
    </div>

    <!-- Email -->
    <div class="flex items-center justify-center gap-2 mb-6">
      <span class="text-[var(--color-text-muted)] text-sm">{{ displayEmail }}</span>
    </div>

    <!-- Guests: save the account so trips and receipts aren't lost -->
    <div v-if="needsLogin" class="px-5 mb-6 max-w-lg mx-auto w-full">
      <AccountConversionCard :show-skip="false" />
    </div>

    <!-- Account -->
    <div class="px-5 max-w-lg mx-auto w-full mb-2">
      <h2 class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Account</h2>
      <div class="flex items-center justify-between py-4 border-b border-[var(--color-border)]">
        <div class="min-w-0">
          <div class="text-base">Phone number</div>
          <div class="text-[13px] text-[var(--color-text-muted)] truncate">{{ displayPhone || 'Not added' }}</div>
        </div>
        <span v-if="phoneVerified" class="text-[13px] font-semibold text-[var(--color-brand)]">✓ Verified</span>
        <button v-else-if="settings.require_verified_phone" @click="router.push({ path: '/verify-phone', query: { redirect: '/profile' } })" class="text-[var(--color-brand)] text-sm font-bold uppercase tracking-wide">Verify</button>
      </div>
      <div v-if="push !== 'unavailable'" class="flex items-center justify-between py-4 border-b border-[var(--color-border)]">
        <div class="min-w-0 pr-3">
          <div class="text-base">Trip notifications</div>
          <div class="text-[13px] text-[var(--color-text-muted)]">
            {{ push === 'on' ? 'On for this device' : push === 'blocked' ? 'Blocked in your browser settings' : 'Get told when your driver arrives, even with the app closed' }}
          </div>
        </div>
        <button v-if="push === 'off'" @click="turnOnPush" :disabled="pushBusy" class="text-[var(--color-brand)] text-sm font-bold uppercase tracking-wide disabled:opacity-50">Turn on</button>
        <span v-else-if="push === 'on'" class="text-[13px] font-semibold text-[var(--color-brand)]">✓ On</span>
      </div>
    </div>

    <!-- Favorite Locations -->
    <div class="px-5 max-w-lg mx-auto w-full">
      <h2 class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Favorite locations</h2>

      <div class="flex items-center justify-between py-4 border-b border-[var(--color-border)]">
        <div class="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
          </svg>
          <div class="min-w-0">
            <div class="text-base">Home</div>
            <div v-if="homeAddress" class="text-[13px] text-[var(--color-text-muted)] truncate">{{ homeAddress }}</div>
          </div>
        </div>
        <button @click="goToSavedPlaces" class="text-[var(--color-brand)] text-sm font-bold uppercase tracking-wide flex-shrink-0 pl-3">{{ homeAddress ? 'Edit' : 'Add' }}</button>
      </div>

      <div class="flex items-center justify-between py-4 border-b border-[var(--color-border)]">
        <div class="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0H8m8 0a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2" />
          </svg>
          <div class="min-w-0">
            <div class="text-base">Work</div>
            <div v-if="workAddress" class="text-[13px] text-[var(--color-text-muted)] truncate">{{ workAddress }}</div>
          </div>
        </div>
        <button @click="goToSavedPlaces" class="text-[var(--color-brand)] text-sm font-bold uppercase tracking-wide flex-shrink-0 pl-3">{{ workAddress ? 'Edit' : 'Add' }}</button>
      </div>
    </div>

    <!-- Safety -->
    <div class="px-5 mt-2">
      <button @click="router.push('/trusted-contacts')" class="w-full flex items-center justify-between py-4 border-b border-[var(--color-border)]">
        <div class="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span class="text-base">Safety</span>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <!-- Promotions -->
    <div class="px-5">
      <button @click="router.push('/promotions')" class="w-full flex items-center justify-between py-4 border-b border-[var(--color-border)]">
        <div class="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <span class="text-base">Promotions</span>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <!-- Invite Friends -->
    <div class="px-5">
      <button @click="router.push('/referrals')" class="w-full flex items-center justify-between py-4 border-b border-[var(--color-border)]">
        <div class="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
          </svg>
          <span class="text-base">Invite Friends</span>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <!-- Appearance -->
    <div class="px-5 mt-4 mb-2">
      <p class="text-[13px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Appearance</p>
      <ThemeToggle />
    </div>

    <!-- Communication Preferences -->
    <div class="px-5 mt-4">
      <button @click="router.push('/support')" class="w-full flex items-center justify-between py-4">
        <span class="text-base">Communication Preferences</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <!-- Divider -->
    <div class="border-t border-[var(--color-border)] mx-5 mt-2"></div>

    <!-- Log Out -->
    <div class="px-5 mt-4">
      <button @click="handleLogout" class="text-red-500 text-base font-medium">Log out</button>
    </div>

    <!-- Delete Account -->
    <div class="px-5 mt-3 mb-8">
      <button @click="handleDeleteAccount" class="text-[var(--color-text-muted)] text-sm">Delete account</button>
    </div>

    <!-- Delete Account Confirmation -->
    <Transition name="fade">
      <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-end justify-center bg-[var(--color-overlay)]" @click.self="showDeleteConfirm = false">
        <div class="w-full max-w-md bg-[var(--color-surface)] rounded-t-3xl px-6 pt-8 pb-10 shadow-xl">
          <h3 class="text-lg font-bold mb-2">Delete your account?</h3>
          <p class="text-[14px] text-[var(--color-text-muted)] mb-6">To delete your account, please contact our support team. They'll process your request and remove all your data.</p>
          <a href="tel:+12424529911" class="block w-full py-3.5 bg-red-500 text-white font-bold rounded-xl text-[14px] text-center mb-3">
            Call Support (242) 452-9911
          </a>
          <a href="https://wa.me/12424529911?text=I%20would%20like%20to%20delete%20my%20RideUp%20account" target="_blank" class="block w-full py-3.5 bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] font-bold rounded-xl text-[14px] text-center mb-3">
            WhatsApp Support
          </a>
          <button @click="showDeleteConfirm = false" class="w-full py-3 text-[14px] text-[var(--color-text-muted)] font-medium">Cancel</button>
        </div>
      </div>
    </Transition>

    <!-- Toast -->
    <Transition name="fade">
      <div v-if="toast" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#191f1c] text-white text-[13px] font-medium px-5 py-3 rounded-full shadow-lg">
        {{ toast }}
      </div>
    </Transition>
  </div>
</template>
