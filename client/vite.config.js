import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    hmr: {
      // CORRECT FIX: Use same port as server but let nginx proxy handle WebSocket
      port: 5173
    }
  }
})
