<script setup>
import { onMounted } from 'vue'
import { DEMO_MODE } from './lib/demoMode'
import { useAuth } from './lib/useAuth'

const { init } = useAuth()
onMounted(() => init())
</script>

<template>
  <div v-if="DEMO_MODE" class="bg-[#58cc02] text-white text-xs font-bold px-4 py-2 text-center relative z-50">
    Demo mode — sample data, no backend connected. Add real keys in .env to go live.
  </div>
  <router-view />
</template>
