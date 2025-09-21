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
        changeOrigin: true,
        secure: false
      }
    },
    // Configure HMR to work through nginx proxy
    hmr: {
      port: 5173,
      clientPort: 443,
      host: 'ec2-13-48-135-139.eu-north-1.compute.amazonaws.com',
      protocol: 'wss',
      path: '/hmr'
    },
    cors: true,
    allowedHosts: ["ec2-13-48-135-139.eu-north-1.compute.amazonaws.com", "localhost", "127.0.0.1"],
    // Ensure proper file serving
    fs: {
      strict: false,
      allow: ['..']
    }
  }
})
