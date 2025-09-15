import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Dynamic base path - use environment variable for HTTPS compatibility
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    react({
      // Keep React plugin working normally
      include: "**/*.{jsx,tsx}",
    }),
    // SURGICAL plugin to fix ONLY virtual module MIME types
    {
      name: 'fix-virtual-module-mime-type',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // ONLY target the exact problematic virtual modules
          if (req.url === '/@vite/client' || req.url === '/@react-refresh') {
            // Override setHeader ONLY for these specific requests
            const originalSetHeader = res.setHeader;
            res.setHeader = function(name, value) {
              if (name.toLowerCase() === 'content-type' && value === 'text/html') {
                return originalSetHeader.call(this, name, 'application/javascript');
              }
              return originalSetHeader.call(this, name, value);
            };
          }
          next();
        });
      }
    }
  ],
  server: {
    host: true,
    port: 5173,
    // Proxy API requests to backend server
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true
      }
    },
    // Configure HMR to work through nginx direct proxy WebSocket
    hmr: {
      clientPort: 80,  // Client connects to nginx
      host: 'EC2_HOST_PLACEHOLDER',
      // Use nginx direct proxy path for WebSocket connections
      path: '/preview/TEAM_ID_PLACEHOLDER/',
      overlay: true
    },
    cors: true,
    allowedHosts: "all",
    // Ensure proper file serving
    fs: {
      strict: false,
      allow: ['..']
    }
  }
})
