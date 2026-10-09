<template>
  <div class="flex h-dvh bg-[var(--color-surface-secondary)] font-sans">
    <!-- Mobile overlay -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 bg-[var(--color-overlay)] z-40 lg:hidden"
      @click="sidebarOpen = false"
    />

    <!-- Sidebar -->
    <aside
      :class="[
        'fixed lg:static inset-y-0 left-0 z-50 flex flex-col w-64 bg-[#191f1c] text-white transition-transform duration-200',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      ]"
    >
      <!-- Logo -->
      <div class="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <BrandLogo on-dark class="h-7" />
        <span class="text-sm font-semibold text-white/70 mt-1">Admin</span>
      </div>

      <!-- Nav -->
      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <router-link
          v-for="item in visibleNav"
          :key="item.to"
          :to="item.to"
          @click="sidebarOpen = false"
          :class="[
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            isActive(item.to)
              ? 'bg-[#2b8659] text-white'
              : 'text-white/65 hover:text-white hover:bg-white/5'
          ]"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 flex-shrink-0" aria-hidden="true">
            <path v-for="(path, i) in item.paths" :key="i" :d="path.d" :fill-rule="path.fillRule" :clip-rule="path.clipRule" />
          </svg>
          {{ item.label }}
          <span v-if="item.to === '/admin/live'" class="ml-auto w-2 h-2 rounded-full bg-[#34d399] animate-pulse" aria-hidden="true"></span>
        </router-link>
      </nav>

      <!-- Back to App -->
      <div class="px-3 py-3 border-t border-white/10">
        <router-link
          to="/book"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-surface)]/5 transition-colors"
        >
          <svg class="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to App
        </router-link>
      </div>
    </aside>

    <!-- Main content -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <!-- Top bar -->
      <header class="flex items-center justify-between px-4 lg:px-8 py-4 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
        <button
          class="lg:hidden p-2.5 -ml-2.5 text-[var(--color-text-secondary)] hover:text-gray-900 rounded-lg hover:bg-[var(--color-surface-secondary)]"
          @click="sidebarOpen = !sidebarOpen"
         aria-label="Toggle navigation menu" :aria-expanded="String(sidebarOpen)">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
        <div class="text-sm text-[var(--color-text-muted)]">Nassau, Bahamas</div>
        <div class="flex items-center gap-2">
          <span v-if="role === 'support'" class="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">Support</span>
          <div class="w-8 h-8 rounded-full bg-[#2b8659] flex items-center justify-center text-white text-xs font-semibold" :title="user?.email || ''" aria-hidden="true">{{ initial }}</div>
        </div>
      </header>

      <!-- Page content -->
      <div tabindex="0" class="flex-1 overflow-y-auto p-4 lg:p-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2b8659]/40">
        <div v-if="jobWarning" role="alert" class="mb-4 rounded-xl border border-red-300 bg-red-50 text-red-800 px-4 py-3 text-sm">
          <strong>Background job {{ jobWarning }}.</strong> Scheduled rides, missed card charges, stuck-payment clean-up and trip check-ins
          are paused until it runs again. It must call <code>/api/dispatch-scheduled</code> every minute (see README › Background job).
        </div>
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup>
import BrandLogo from '../../components/BrandLogo.vue'
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { DEMO_MODE } from '../../lib/demoMode'
import { useAuth } from '../../lib/useAuth'
import { useStaffRole, canOpenAdminPage } from '../../lib/staff'

const route = useRoute()
const sidebarOpen = ref(false)
const { user } = useAuth()
const { role } = useStaffRole()
const initial = computed(() => (user.value?.email || 'A').charAt(0).toUpperCase())

// Warn the admin when the every-minute job has stopped (Uber-style ops: problems should be visible, not silent).
const jobWarning = ref('')
onMounted(async () => {
  if (DEMO_MODE || !supabaseConfigured || role.value !== 'admin') return
  const { data, error } = await supabase.from('system_heartbeats').select('last_run_at, last_ok').eq('name', 'dispatch').maybeSingle()
  if (error) return // migration 011 not run yet
  if (!data) { jobWarning.value = 'has never run'; return }
  const minutes = Math.round((Date.now() - new Date(data.last_run_at).getTime()) / 60000)
  if (minutes > 5) jobWarning.value = `hasn’t run for ${minutes} minutes`
  else if (!data.last_ok) jobWarning.value = 'is failing'
})

const navItems = [
  {
    label: 'Live',
    to: '/admin/live',
    paths: [
      { fillRule: 'evenodd', d: 'M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z', clipRule: 'evenodd' },
    ]
  },
  {
    label: 'Dashboard',
    to: '/admin',
    paths: [
      { d: 'M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z' },
    ]
  },
  {
    label: 'Rides',
    to: '/admin/rides',
    paths: [
      { d: 'M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0h2.1a2.5 2.5 0 014.9 0H17a1 1 0 001-1V5a1 1 0 00-1-1H3z' },
    ]
  },
  {
    label: 'Users',
    to: '/admin/users',
    paths: [
      { d: 'M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z' },
    ]
  },
  {
    label: 'Drivers',
    to: '/admin/drivers',
    paths: [
      { fillRule: 'evenodd', d: 'M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z', clipRule: 'evenodd' },
    ]
  },
  {
    label: 'Money',
    to: '/admin/revenue',
    paths: [
      { d: 'M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z' },
      { fillRule: 'evenodd', d: 'M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z', clipRule: 'evenodd' },
    ]
  },
  {
    label: 'Safety',
    to: '/admin/safety',
    paths: [
      { fillRule: 'evenodd', d: 'M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z', clipRule: 'evenodd' },
    ]
  },
  {
    label: 'Payouts',
    to: '/admin/payouts',
    paths: [
      { d: 'M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z' },
      { fillRule: 'evenodd', d: 'M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z', clipRule: 'evenodd' },
    ]
  },
  {
    label: 'Promos',
    to: '/admin/promos',
    paths: [
      { fillRule: 'evenodd', d: 'M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z', clipRule: 'evenodd' },
    ]
  },
  {
    label: 'Incentives',
    to: '/admin/incentives',
    paths: [
      { fillRule: 'evenodd', d: 'M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm4.707 3.707a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L8.414 9H10a3 3 0 013 3v1a1 1 0 102 0v-1a5 5 0 00-5-5H8.414l1.293-1.293z', clipRule: 'evenodd' },
    ]
  },
  {
    label: 'Messages',
    to: '/admin/messages',
    paths: [
      { fillRule: 'evenodd', d: 'M18 3a1 1 0 00-1.447-.894L8.763 6H5a3 3 0 000 6h.28l1.771 5.316A1 1 0 008 18h1a1 1 0 001-1v-4.382l6.553 3.276A1 1 0 0018 15V3z', clipRule: 'evenodd' },
    ]
  },
  {
    label: 'Team',
    to: '/admin/team',
    paths: [
      { d: 'M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z' },
    ]
  },
  {
    label: 'Activity',
    to: '/admin/activity',
    paths: [
      { d: 'M9 2a1 1 0 000 2h2a1 1 0 100-2H9z' },
      { fillRule: 'evenodd', d: 'M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z', clipRule: 'evenodd' },
    ]
  },
  {
    label: 'Settings',
    to: '/admin/settings',
    paths: [
      { fillRule: 'evenodd', d: 'M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z', clipRule: 'evenodd' },
    ]
  },
  {
    label: 'Support',
    to: '/admin/support',
    paths: [
      { fillRule: 'evenodd', d: 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z', clipRule: 'evenodd' },
    ]
  },
]

// Support staff only see the pages they can open.
const visibleNav = computed(() => navItems.filter((item) => canOpenAdminPage(role.value, item.to)))

function isActive(path) {
  if (path === '/admin') return route.path === '/admin'
  return route.path.startsWith(path)
}
</script>
