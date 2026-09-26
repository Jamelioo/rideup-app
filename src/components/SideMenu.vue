<script setup>
import { computed, watch, ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../lib/useAuth'

const router = useRouter()
const { user, signOut } = useAuth()
const drawerRef = ref(null)

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close'])

const isLoggedIn = computed(() => !!user.value)
const displayName = computed(() => user.value?.user_metadata?.name || 'Rider')
const displayEmail = computed(() => user.value?.email || '')
const initials = computed(() =>
  displayName.value
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
)

const menuItems = computed(() => {
  const items = [
    { label: 'Support', route: '/support', icon: 'chat', requiresAuth: false },
    { label: 'About', route: '/about', icon: 'info', requiresAuth: false },
  ]

  if (isLoggedIn.value) {
    items.unshift(
      { label: 'Payments', route: '/payments', icon: 'card', requiresAuth: true },
      { label: 'Promotions', subtitle: 'Enter Promo Code', route: '/payments', icon: 'tag', requiresAuth: true },
      { label: 'My Rides', route: '/my-rides', icon: 'history', requiresAuth: true },
    )
  }

  return items
})

function handleNavigate(route) {
  emit('close')
  router.push(route)
}

async function handleLogout() {
  emit('close')
  await signOut()
  router.push('/welcome')
}

function handleClose() {
  emit('close')
}

function handleKeydown(e) {
  if (e.key === 'Escape') {
    handleClose()
    return
  }
  if (e.key === 'Tab' && drawerRef.value) {
    const focusable = drawerRef.value.querySelectorAll('button, a, input, [tabindex]:not([tabindex="-1"])')
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

watch(() => props.isOpen, async (open) => {
  if (open) {
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeydown)
    await nextTick()
    drawerRef.value?.querySelector('button, a')?.focus()
  } else {
    document.body.style.overflow = ''
    document.removeEventListener('keydown', handleKeydown)
  }
})
</script>

<template>
  <Teleport to="body">
    <!-- Overlay -->
    <Transition name="fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 bg-black/50 z-[9998]"
        @click="handleClose"
      />
    </Transition>

    <!-- Drawer -->
    <Transition name="slide">
      <div
        v-if="isOpen"
        ref="drawerRef"
        class="fixed inset-y-0 left-0 z-[9999] w-[80%] max-w-[320px] bg-white flex flex-col shadow-2xl"
      >
        <!-- User Profile Section -->
        <div class="px-5 pt-14 pb-5">
          <div v-if="isLoggedIn" class="flex items-center gap-3.5">
            <div class="w-14 h-14 rounded-full bg-[#58cc02] flex items-center justify-center text-white text-lg font-semibold shrink-0">
              {{ initials }}
            </div>
            <div class="min-w-0">
              <p class="text-lg font-semibold text-[#1a1a1a] truncate">
                {{ displayName }}
              </p>
              <button
                class="text-sm font-medium text-[#58cc02] mt-0.5 hover:text-[#4ab300] transition-colors"
                @click="handleNavigate('/profile')"
              >
                Edit profile
              </button>
            </div>
          </div>
          <div v-else class="flex flex-col gap-3">
            <p class="text-lg font-semibold text-[#1a1a1a]">Welcome to RideUp</p>
            <div class="flex gap-3">
              <button
                @click="handleNavigate('/login')"
                class="flex-1 py-2.5 rounded-xl border border-[#1a1a1a]/10 text-[14px] font-semibold text-[#1a1a1a] active:bg-[#1a1a1a]/5 transition-colors"
              >
                Log in
              </button>
              <button
                @click="handleNavigate('/signup')"
                class="flex-1 py-2.5 rounded-xl bg-[#58cc02] text-[14px] font-semibold text-white active:bg-[#4ab300] transition-colors"
              >
                Sign up
              </button>
            </div>
          </div>
        </div>

        <!-- Divider -->
        <div class="h-px bg-[#1a1a1a]/8 mx-5" />

        <!-- Menu Items -->
        <nav class="flex-1 overflow-y-auto py-2" aria-label="Main navigation">
          <button
            v-for="item in menuItems"
            :key="item.label"
            class="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-[#1a1a1a]/[0.03] active:bg-[#1a1a1a]/[0.06] transition-colors text-left"
            @click="handleNavigate(item.route)"
          >
            <!-- Icon -->
            <div class="w-6 h-6 flex items-center justify-center shrink-0 text-[#1a1a1a]">
              <svg v-if="item.icon === 'card'" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              <svg v-else-if="item.icon === 'tag'" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
              <svg v-else-if="item.icon === 'history'" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <svg v-else-if="item.icon === 'chat'" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <svg v-else-if="item.icon === 'info'" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>

            <!-- Label + Subtitle -->
            <div class="flex-1 min-w-0">
              <p class="text-[15px] font-medium text-[#1a1a1a]">{{ item.label }}</p>
              <p v-if="item.subtitle" class="text-xs text-[#1a1a1a]/40 mt-0.5">{{ item.subtitle }}</p>
            </div>

            <!-- Chevron -->
            <svg class="w-5 h-5 text-[#1a1a1a]/25 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </nav>

        <!-- Divider -->
        <div class="h-px bg-[#1a1a1a]/8 mx-5" />

        <!-- Logout (when logged in) or Become a Driver CTA -->
        <div class="px-5 py-4">
          <button
            v-if="isLoggedIn"
            @click="handleLogout"
            class="w-full text-left text-red-500 text-[15px] font-medium py-2"
          >
            Log out
          </button>
          <a
            v-else
            href="https://wa.me/12424529911?text=Hi!%20I'd%20like%20to%20apply%20to%20drive%20for%20RideUp%20Nassau."
            target="_blank"
            class="block w-full rounded-2xl bg-[#58cc02] px-5 py-4 text-left transition-colors active:bg-[#4ab300]"
          >
            <p class="text-white text-[15px] font-semibold">Become a driver</p>
            <p class="text-white/80 text-xs mt-0.5">Earn money on your schedule</p>
          </a>
        </div>

        <!-- Home Indicator -->
        <div class="flex justify-center pb-2 pt-1">
          <div class="w-32 h-1 rounded-full bg-[#1a1a1a]/20" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active {
  transition: transform 0.3s ease-out;
}
.slide-leave-active {
  transition: transform 0.25s ease-in;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}
</style>
