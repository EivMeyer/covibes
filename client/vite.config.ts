import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables based on mode (VITE_ prefix)
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  
  // Determine if we're in production
  const isProduction = mode === 'production'
  
  // REQUIRED: Backend URL must be explicitly set - NO FALLBACKS
  const backendUrl = env.VITE_BACKEND_URL || env.VITE_API_URL
  if (!backendUrl) {
    throw new Error('VITE_BACKEND_URL or VITE_API_URL environment variable is required. No fallbacks allowed.')
  }
  
  // REQUIRED: Frontend URL must be explicitly set - NO FALLBACKS
  const frontendUrl = env.VITE_FRONTEND_URL
  if (!frontendUrl) {
    throw new Error('VITE_FRONTEND_URL environment variable is required. No fallbacks allowed.')
  }
  
  // Base path for deployment (can be overridden with VITE_BASE_PATH)
  const basePath = env.VITE_BASE_PATH || '/'
  
  return {
    base: basePath,
    plugins: [react()],
    
    // Environment variable handling
    envPrefix: 'VITE_',
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
      // HMR settings
      hmr: {
        port: 3000,
        // Use the actual hostname for WebSocket connections
        host: env.VITE_FRONTEND_URL ? 
          new URL(env.VITE_FRONTEND_URL).hostname : 
          'ec2-13-60-242-174.eu-north-1.compute.amazonaws.com'
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
    
    // Build configuration
    build: {
      outDir: 'dist',
      sourcemap: !isProduction,
      minify: isProduction ? 'esbuild' : false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            monaco: ['@monaco-editor/react'],
            socket: ['socket.io-client']
          }
        }
      }
    },
    
    // Define environment variables to be exposed to the client
    define: {
      __BACKEND_URL__: JSON.stringify(backendUrl),
      __FRONTEND_URL__: JSON.stringify(frontendUrl),
      __IS_PRODUCTION__: JSON.stringify(isProduction),
    },
  }
})
