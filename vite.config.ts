import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// `base` must match the GitHub Pages sub-path (compforyou.github.io/offer-lab/),
// otherwise the deployed page loads blank because it looks for its files at the root.
export default defineConfig({
  base: '/offer-lab/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    // The library is pure functions with no shared module state, so test files
    // can share a worker instead of paying environment startup for each one.
    isolate: false,
  },
})
