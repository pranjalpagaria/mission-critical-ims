import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true, // Listens on all addresses (0.0.0.0), making it visible to your laptop
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true, // Necessary for hot-reload to work on WSL/Windows
    },
  },
})
