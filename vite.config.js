import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { genererServiceWorker } from './pwa/plugin.js'

// https://vite.dev/config/
export default defineConfig({
  // Adresse de publication : maxlad47.github.io/MIND/ (GitHub Pages).
  base: '/MIND/',
  plugins: [react(), genererServiceWorker()],
  test: {
    environment: 'node',
  },
})
