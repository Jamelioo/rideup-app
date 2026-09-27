import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5176',
    headless: true,
  },
  webServer: {
    command: 'npx vite --port 5176',
    port: 5176,
    reuseExistingServer: true,
  },
})
