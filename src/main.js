import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import { inject } from '@vercel/analytics'
import { injectSpeedInsights } from '@vercel/speed-insights'

import { useDarkMode } from './lib/useDarkMode'
import { useAuth } from './lib/useAuth'
import { installMonitoring } from './lib/monitoring'

inject()
injectSpeedInsights()
useDarkMode() // Initialize theme on load
useAuth().init() // Subscribe before mounting so a password-reset link's event isn't missed

const app = createApp(App)
installMonitoring(app) // error reports to Sentry when VITE_SENTRY_DSN is set
app.use(router).mount('#app')
