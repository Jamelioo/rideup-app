import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // What the first screen needs comes in two files instead of many small ones, so slow phone connections
        // make fewer requests: libraries (they rarely change, so browsers keep them cached across releases) and
        // app code. Everything else still loads per page.
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /[\\/]node_modules[\\/]/, tags: ['$initial'], priority: 2 },
            { name: 'app', tags: ['$initial'], priority: 1 },
          ],
        },
      },
    },
  },
})
