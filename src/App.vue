<script setup>
import { onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { DEMO_MODE } from './lib/demoMode'
import { useAuth } from './lib/useAuth'
import BottomNav from './components/BottomNav.vue'
import { getPendingReferral, setPendingReferral, redeemReferral } from './lib/rewards'

const router = useRouter()
const route = useRoute()
const { init, pendingRoute, clearPendingRoute, user } = useAuth()
onMounted(() => init())

// Emailed links (password reset, guest email confirmation, driver email confirmation) can land on the
// home page if the exact path isn't in Supabase's redirect allow-list. Send people where they meant to go.
watch(pendingRoute, async (path) => {
  if (!path) return
  await router.isReady()
  clearPendingRoute()
  if (route.path !== path) router.replace(path)
}, { immediate: true })

// A friend's referral code from a /r/CODE link is applied as soon as this person has a rider profile.
watch(user, async (u) => {
  const code = getPendingReferral()
  if (!u || !code || DEMO_MODE) return
  const res = await redeemReferral(code)
  // Keep it for later only if there's no rider profile yet (e.g. a guest who hasn't booked).
  if (res.ok || !/sign in first/i.test(res.message || '')) setPendingReferral(null)
}, { immediate: true })
</script>

<template>
  <div v-if="DEMO_MODE" class="bg-[#2b8659] text-white text-xs font-bold px-4 py-2 text-center relative z-50">
    Demo mode — sample data, no backend connected. Add real keys in .env to go live.
  </div>
  <router-view v-slot="{ Component }">
    <KeepAlive include="RiderBooking">
      <component :is="Component" />
    </KeepAlive>
  </router-view>
  <BottomNav />
</template>
