import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // reachable from a phone on the same Wi-Fi
    fs: { allow: ['..'] }, // demo/fallback/run.json lives outside frontend/
  },
})
