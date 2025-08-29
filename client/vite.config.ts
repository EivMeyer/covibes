import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables based on mode
  const env = loadEnv(mode, process.cwd(), '')
  
  // Determine backend URL based on environment
  // Priority: VITE_BACKEND_URL > VITE_API_URL > default local URL
  const backendUrl = env.VITE_BACKEND_URL || env.VITE_API_URL || 'http://localhost:3001'
  
  // Determine frontend URL for CORS
  const frontendUrl = env.VITE_FRONTEND_URL || 'http://localhost:3000'
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@/components': path.resolve(__dirname, './src/components'),
        '@/services': path.resolve(__dirname, './src/services'),
        '@/hooks': path.resolve(__dirname, './src/hooks'),
        '@/types': path.resolve(__dirname, './src/types'),
        '@/utils': path.resolve(__dirname, './src/utils'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0', // Allow external connections (needed for Docker)
      strictPort: true, // Fail if port is already in use
      allowedHosts: ['ec2-13-60-242-174.eu-north-1.compute.amazonaws.com'],
      cors: {
        origin: true, // Allow all origins for development
        credentials: true
      },
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.log('Proxy error:', err);
            });
            proxy.on('proxyReq', (proxyReq, req) => {
              console.log(`Proxying ${req.method} ${req.url} to ${backendUrl}`);
            });
          },
        },
        '/socket.io': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          ws: true,
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.log('WebSocket proxy error:', err);
            });
          },
        },
      },
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
    },
    // Define environment variables to be exposed to the client
    define: {
      __BACKEND_URL__: JSON.stringify(backendUrl),
    },
  }
})
