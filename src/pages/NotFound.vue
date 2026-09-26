<template>
  <div class="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center px-6 text-center">
    <h1 class="text-[120px] font-bold text-[#58cc02] leading-none mb-2">404</h1>
    <p class="text-white/60 text-lg mb-8">Page not found</p>
    <router-link
      to="/welcome"
      class="px-8 py-3 bg-[#58cc02] text-white font-bold rounded-xl text-sm active:bg-[#4ab300] transition-colors"
    >
      Go home
    </router-link>
  </div>
</template>
