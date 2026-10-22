import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative base works on GitHub Pages (/2020builder/) and any static host.
  base: './',
  plugins: [react()],
  // three.js alone is ~600 kB; one chunk is fine for a single-page tool.
  build: { chunkSizeWarningLimit: 1500 },
})
