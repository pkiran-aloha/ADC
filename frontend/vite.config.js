import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './', // relative base allows hosting on GitHub Pages subfolder (/ADC/) and root without issues
  build: {
    // The fictional clinical fixture (~1.8 MB of JSON, ~200 kB gzipped) is bundled on purpose so the
    // demo works offline from GitHub Pages. It gets its own cacheable chunk that downloads in
    // parallel with the application code.
    chunkSizeWarningLimit: 2200,
    rolldownOptions: {
      output: { codeSplitting: { groups: [{ name: 'clinical-seed', test: /clinicalSeed\.json/ }] } }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true
  }
})
