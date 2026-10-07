<script setup>
// The RideUp wordmark (see docs/BRAND.md). Colours come from --logo-ride / --logo-up, which switch for dark mode;
// on-dark forces the white + gold version for green or dark backgrounds. It scales with the font size, or takes a height class.
defineProps({
  onDark: { type: Boolean, default: false },
  // Leave the label on unless the surrounding link or heading already says "RideUp".
  decorative: { type: Boolean, default: false },
})
const RIDE = 'M60 0H245V-222H310L436 0H648L494 -255Q552 -285 586 -339Q620 -393 620 -462Q620 -532 585.5 -585.5Q551 -639 490 -669.5Q429 -700 350 -700H60ZM1149 12Q1195 12 1229.5 -5.5Q1264 -23 1286 -56L1291 0H1462V-700H1282V-449Q1260 -480 1226.5 -496Q1193 -512 1149 -512Q1078 -512 1027.5 -481Q977 -450 950 -391.5Q923 -333 923 -250Q923 -168 950 -109Q977 -50 1027.5 -19Q1078 12 1149 12ZM1780 12Q1827 12 1875.5 -1.5Q1924 -15 1963.5 -46.5Q2003 -78 2021 -130L1863 -179Q1857 -156 1832.5 -140.5Q1808 -125 1775 -125Q1738 -125 1715.5 -146.5Q1693 -168 1688 -205H2038Q2038 -309 2004.5 -377Q1971 -445 1912.5 -478.5Q1854 -512 1777 -512Q1696 -512 1634 -479Q1572 -446 1537 -387Q1502 -328 1502 -250Q1502 -172 1537.5 -113Q1573 -54 1636 -21Q1699 12 1780 12ZM693 0H873V-500H693ZM1197 -154Q1173 -154 1153.5 -166.5Q1134 -179 1122.5 -200.5Q1111 -222 1111 -250Q1111 -278 1122 -299.5Q1133 -321 1152.5 -333Q1172 -345 1196 -345Q1219 -345 1237.5 -335Q1256 -325 1267.5 -307Q1279 -289 1282 -266V-234Q1279 -211 1267.5 -192.5Q1256 -174 1238 -164Q1220 -154 1197 -154ZM245 -392V-531H340Q378 -531 401.5 -511.5Q425 -492 425 -462Q425 -442 414 -426Q403 -410 384 -401Q365 -392 340 -392ZM1689 -315Q1694 -343 1707 -359Q1720 -375 1737 -381.5Q1754 -388 1772 -388Q1790 -388 1807 -381.5Q1824 -375 1837 -359Q1850 -343 1855 -315Z'
const UP = 'M2778 160H2958V-52Q2981 -21 3014 -4.5Q3047 12 3092 12Q3163 12 3213.5 -19Q3264 -50 3291 -109Q3318 -168 3318 -250Q3318 -333 3291 -391.5Q3264 -450 3213.5 -481Q3163 -512 3092 -512Q3046 -512 3011.5 -494.5Q2977 -477 2954 -443L2948 -500H2778ZM2401 12Q2496 12 2563.5 -22Q2631 -56 2667 -119.5Q2703 -183 2703 -271V-700H2518V-271Q2518 -236 2504.5 -211Q2491 -186 2465 -173Q2439 -160 2403 -160Q2367 -160 2341.5 -173Q2316 -186 2302 -211Q2288 -236 2288 -271V-700H2103V-271Q2103 -183 2138.5 -119.5Q2174 -56 2241 -22Q2308 12 2401 12ZM783 -548Q824 -548 853.5 -578Q883 -608 883 -648Q883 -689 853.5 -718.5Q824 -748 783 -748Q743 -748 713 -718.5Q683 -689 683 -648Q683 -608 713 -578Q743 -548 783 -548ZM3044 -154Q3019 -154 2999.5 -166.5Q2980 -179 2969 -200.5Q2958 -222 2958 -250Q2958 -278 2969 -299.5Q2980 -321 3000 -333Q3020 -345 3045 -345Q3070 -345 3089 -333Q3108 -321 3119 -299.5Q3130 -278 3130 -250Q3130 -222 3118.5 -200.5Q3107 -179 3088 -166.5Q3069 -154 3044 -154Z'
</script>

<template>
  <svg viewBox="60 -748 3258 908" class="brand-logo" :class="{ 'brand-logo--on-dark': onDark }"
    :role="decorative ? undefined : 'img'" :aria-label="decorative ? undefined : 'RideUp'" :aria-hidden="decorative ? 'true' : undefined" focusable="false">
    <path :d="RIDE" class="brand-logo__ride" />
    <path :d="UP" class="brand-logo__up" />
  </svg>
</template>

<style>
/* Zero-specificity defaults so height/display utility classes win. By default the logo sits on the text baseline
   and scales with the surrounding font size, so it can replace a typed "RideUp" without layout changes. */
:where(.brand-logo) { display: inline-block; height: 1.05em; width: auto; vertical-align: -0.185em; flex: none; }
</style>

<style scoped>
.brand-logo__ride { fill: var(--logo-ride); }
.brand-logo__up { fill: var(--logo-up); }
.brand-logo--on-dark .brand-logo__ride { fill: #ffffff; }
.brand-logo--on-dark .brand-logo__up { fill: #ffc83d; }
</style>
