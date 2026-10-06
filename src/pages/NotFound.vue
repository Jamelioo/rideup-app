<template>
  <div class="min-h-dvh bg-[#191f1c] flex flex-col items-center justify-center px-6 pt-[max(1.5rem,env(safe-area-inset-top))] text-center">
    <p class="text-[96px] sm:text-[120px] font-bold text-[#4cc48a] leading-none mb-3" aria-hidden="true">404</p>
    <h1 class="text-white text-[24px] font-bold mb-2">We can’t find that page</h1>
    <p class="text-white/75 text-[16px] mb-8 max-w-sm">The link may be old or mistyped. You can still book a ride or get help from here.</p>
    <div class="flex flex-wrap items-center justify-center gap-3">
      <router-link to="/book" class="px-8 py-3.5 bg-[#2b8659] text-white font-bold rounded-xl text-[16px] hover:bg-[#236e49] transition-colors">Book a ride</router-link>
      <router-link to="/" class="px-6 py-3.5 text-white font-semibold text-[16px] rounded-xl border border-white/25 hover:bg-white/10 transition-colors">Go home</router-link>
    </div>
    <router-link to="/support" class="mt-6 inline-flex items-center min-h-[44px] text-white/75 text-[14px] underline underline-offset-4 hover:text-white">Get help</router-link>
  </div>
</template>
