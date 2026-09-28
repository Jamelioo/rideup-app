import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import { inject } from '@vercel/analytics'
import { injectSpeedInsights } from '@vercel/speed-insights'

import { useDarkMode } from './lib/useDarkMode'

inject()
injectSpeedInsights()
useDarkMode() // Initialize theme on load

createApp(App).use(router).mount('#app')
