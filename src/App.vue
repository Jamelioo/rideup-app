<script setup>
import { onMounted } from 'vue'
import { DEMO_MODE } from './lib/demoMode'
import { useAuth } from './lib/useAuth'
import BottomNav from './components/BottomNav.vue'

const { init } = useAuth()
onMounted(() => init())
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
