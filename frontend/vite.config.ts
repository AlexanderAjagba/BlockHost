import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Enables listening on all interfaces (required for Docker)
    port: 5173,
    watch: {
      usePolling: true, // Another layer of insurance for file changes
    },
  },
})