<template>
  <div class="min-h-dvh bg-[#191f1c] flex flex-col items-center justify-center px-6 pt-[max(1.5rem,env(safe-area-inset-top))] text-center">
    <h1 class="text-[120px] font-bold text-[var(--color-brand)] leading-none mb-2">404</h1>
    <p class="text-white/60 text-lg mb-8">Page not found</p>
    <router-link
      to="/welcome"
      class="px-8 py-3 bg-[#2b8659] text-white font-bold rounded-xl text-sm active:bg-[#236e49] transition-colors"
    >
      Go home
    </router-link>
  </div>
</template>
