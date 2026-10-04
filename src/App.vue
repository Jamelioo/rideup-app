<script setup>
import { onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { DEMO_MODE } from './lib/demoMode'
import { useAuth } from './lib/useAuth'
import BottomNav from './components/BottomNav.vue'
import InstallPrompt from './components/InstallPrompt.vue'
import { getPendingReferral, setPendingReferral, redeemReferral, getPendingPromoCode, setPendingPromoCode, checkPromo, savePromo } from './lib/rewards'
import { initAdTracking, saveAttribution } from './lib/adTracking'
import { isNativeApp, initNativePush, refreshNativePush } from './lib/nativePush'
import { setMonitoringUser } from './lib/monitoring'

const router = useRouter()
const route = useRoute()
const { init, pendingRoute, clearPendingRoute, user } = useAuth()
// Ad links: remember a promo code from ?promo=CODE (or ?code=) until the visitor signs up.
try {
  const q = new URLSearchParams(location.search)
  const code = q.get('promo') || q.get('code')
  if (code && /^[A-Za-z0-9-]{3,20}$/.test(code)) setPendingPromoCode(code)
} catch { /* ignore */ }

onMounted(() => {
  init()
  if (!DEMO_MODE) initAdTracking(router)
  if (isNativeApp() && !DEMO_MODE) initNativePush(router).catch((err) => console.warn('Native push setup failed:', err.message))
})

// Emailed links (password reset, guest email confirmation, driver email confirmation) can land on the
// home page if the exact path isn't in Supabase's redirect allow-list. Send people where they meant to go.
watch(pendingRoute, async (path) => {
  if (!path) return
  await router.isReady()
  clearPendingRoute()
  if (route.path !== path) router.replace(path)
}, { immediate: true })

watch(() => user.value?.id, (id) => setMonitoringUser(id), { immediate: true })

// Store app: trip alerts follow whoever is signed in on this phone.
watch(() => user.value?.id, (id) => { if (id && isNativeApp()) refreshNativePush().catch(() => {}) })

// Once signed in: credit the ad that brought them, and apply a promo code from an ad link.
watch(() => user.value?.id, async (id) => {
  if (!id || DEMO_MODE) return
  saveAttribution().catch(() => {})
  const code = getPendingPromoCode()
  if (!code) return
  const res = await checkPromo(code)
  if (res.ok) savePromo(res.promo)
  // Keep it only while there's no rider profile yet (a brand-new sign-up); otherwise it's used or invalid.
  if (res.ok || !/sign in/i.test(res.message || '')) setPendingPromoCode(null)
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
  <!-- One main landmark for every page (display: contents, so it doesn't change any layout) -->
  <main id="main" class="contents">
    <router-view v-slot="{ Component }">
      <KeepAlive include="RiderBooking">
        <component :is="Component" />
      </KeepAlive>
    </router-view>
  </main>
  <BottomNav />
  <InstallPrompt v-if="!DEMO_MODE" />
</template>
