<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '../lib/useAuth'

const route = useRoute()
const { user } = useAuth()

const tabs = [
  { label: 'Home', route: '/book', icon: 'home' },
  { label: 'Activity', route: '/my-rides', icon: 'activity' },
  { label: 'Account', route: '/profile', icon: 'account' },
]

const activeTab = computed(() => {
  const path = route.path
  if (path === '/book' || path === '/') return '/book'
  if (path === '/my-rides' || path === '/scheduled-rides') return '/my-rides'
  if (['/profile', '/edit-profile', '/payments', '/saved-places', '/promotions', '/referrals', '/trusted-contacts'].includes(path)) return '/profile'
  return null
})

const isVisible = computed(() => {
  if (!user.value) return false
  const path = route.path
  const hiddenPrefixes = ['/driver', '/admin', '/ride/', '/rate/', '/login', '/signup', '/welcome', '/drive', '/receipt']
  const hiddenExact = ['/', '/about', '/privacy', '/terms', '/payment-success']
  if (hiddenExact.includes(path)) return false
  if (hiddenPrefixes.some(p => path.startsWith(p))) return false
  return true
})
</script>

<template>
  <div v-if="isVisible" class="fixed bottom-0 left-0 right-0 z-[100] bg-[var(--color-surface)] border-t border-[var(--color-border)] pb-[env(safe-area-inset-bottom)]">
    <nav class="flex items-center justify-around max-w-lg mx-auto">
      <router-link
        v-for="tab in tabs"
        :key="tab.route"
        :to="tab.route"
        :class="[
          'flex flex-col items-center gap-0.5 py-2.5 px-4 min-w-[64px] min-h-[48px] transition-colors',
          activeTab === tab.route ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-muted)]'
        ]"
      >
        <!-- Home icon -->
        <svg v-if="tab.icon === 'home'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
        </svg>
        <!-- Activity icon -->
        <svg v-else-if="tab.icon === 'activity'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <!-- Account icon -->
        <svg v-else-if="tab.icon === 'account'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span class="text-[10px] font-medium">{{ tab.label }}</span>
      </router-link>
    </nav>
  </div>
</template>
