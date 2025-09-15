/**
 * Dedicated Preview Proxy Service
 * 
 * Creates dedicated proxy servers for each team preview, like the Caddy MVP.
 * Each preview gets its own port with a pure reverse proxy to the Vite container.
 */

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { Server } from 'http';

// Get the base host from environment - FAIL if not configured
const BASE_HOST = process.env['BASE_HOST'];
if (!BASE_HOST) {
  throw new Error('BASE_HOST environment variable is required. Set it to your production domain.');
}

interface PreviewProxy {
  teamId: string;
  proxyPort: number;
  vitePort: number;
  server: Server;
  app: express.Application;
}

class DedicatedPreviewProxyService {
  private proxies: Map<string, PreviewProxy> = new Map();
  private baseProxyPort = 7174; // Start from same port as MVP

  /**
   * Find an available proxy port
   */
  private findAvailablePort(): number {
    const usedPorts = new Set(Array.from(this.proxies.values()).map(p => p.proxyPort));
    let port = this.baseProxyPort;
    while (usedPorts.has(port)) {
      port++;
    }
    return port;
  }

  /**
   * Create a dedicated proxy server for a team's preview
   */
  async createProxy(teamId: string, vitePort: number, existingProxyPort?: number): Promise<number> {
    // If proxy already exists, return its port
    if (this.proxies.has(teamId)) {
      return this.proxies.get(teamId)!.proxyPort;
    }

    // Use existing proxy port from database if provided, otherwise find next available
    const proxyPort = existingProxyPort || this.findAvailablePort();
    const app = express();

    // Calculate backend port (it's always vitePort - 3171 based on our container setup)
    const backendPort = vitePort - 3171;

    // API proxy for backend requests
    const apiProxy = createProxyMiddleware({
      target: `http://localhost:${backendPort}`,  // Backend on port 3002 (if vite is 5173)
      changeOrigin: true,
      ws: false,
      pathRewrite: {
        '^/api/preview/proxy/[^/]+/[^/]+/api': '/api'  // Strip proxy prefix from API paths
      }
    });

    // Pure reverse proxy with HTML rewriting for base tag fix
    const proxy = createProxyMiddleware({
      target: `http://localhost:${vitePort}`,  // Docker maps container:5173 -> host:vitePort
      changeOrigin: true,
      ws: true, // WebSocket support for HMR
      selfHandleResponse: true, // Handle response manually for HTML rewriting
      on: {
        proxyReq: (_proxyReq: any, req: any, _res: any) => {
          console.log(`🔧 [DEDICATED-PROXY] Proxying ${req.method} ${req.url} for team ${teamId}`);
        },
        proxyRes: async (proxyRes: any, _req: any, res: any) => {
          // Headers for iframe embedding and CORS (like Caddy MVP)
          res.setHeader('x-frame-options', 'ALLOWALL');
          res.setHeader('content-security-policy', 'frame-ancestors *');
          res.setHeader('access-control-allow-origin', '*');
          res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
          res.setHeader('access-control-allow-headers', 'Content-Type, Authorization');
          res.setHeader('access-control-allow-credentials', 'true');

          // Copy status and headers
          res.statusCode = proxyRes.statusCode || 200;
          Object.keys(proxyRes.headers).forEach(key => {
            res.setHeader(key, proxyRes.headers[key]);
          });

          // CRITICAL FIX: HTML path rewriting for MIME type errors
          const isHTML = proxyRes.headers['content-type']?.includes('text/html');
          if (isHTML) {
            console.log(`🔧 [DEDICATED-PROXY] Applying HTML base tag fix for team ${teamId}`);
            
            let body = '';
            proxyRes.on('data', (chunk: Buffer) => {
              body += chunk.toString();
            });

            proxyRes.on('end', () => {
              // Add base tag to fix absolute path resolution
              const baseTag = `<base href="/api/preview/proxy/${teamId}/main/">`;
              if (body.includes('<head>')) {
                body = body.replace('<head>', `<head>\n    ${baseTag}`);
                console.log(`✅ [DEDICATED-PROXY] Added base tag for team ${teamId}`);
              }
              
              // Fix absolute paths
              body = body.replace(/src="\//g, `src="/api/preview/proxy/${teamId}/main/`);
              body = body.replace(/href="\//g, `href="/api/preview/proxy/${teamId}/main/`);
              
              res.end(body);
            });
          } else {
            // Non-HTML: pipe response directly
            proxyRes.pipe(res);
          }
        }
      },
      logger: console
    });

    // Apply API proxy for backend requests
    app.use('/api', apiProxy);

    // Apply general proxy for all other routes (frontend assets)
    app.use('/', proxy);

    // Start the dedicated proxy server
    const server = app.listen(proxyPort, () => {
      console.log(`🚀 Preview proxy for team ${teamId} running on port ${proxyPort} -> ${vitePort}`);
    });

    // Handle WebSocket upgrade for HMR
    server.on('upgrade', proxy.upgrade);

    // Store the proxy
    this.proxies.set(teamId, {
      teamId,
      proxyPort,
      vitePort,
      server,
      app
    });

    return proxyPort;
  }

  /**
   * Get the proxy port for a team
   */
  getProxyPort(teamId: string): number | null {
    const proxy = this.proxies.get(teamId);
    return proxy ? proxy.proxyPort : null;
  }

  /**
   * Stop and remove a team's proxy
   */
  async stopProxy(teamId: string): Promise<void> {
    const proxy = this.proxies.get(teamId);
    if (proxy) {
      proxy.server.close();
      this.proxies.delete(teamId);
      console.log(`🛑 Stopped preview proxy for team ${teamId} on port ${proxy.proxyPort}`);
    }
  }

  /**
   * Stop all proxies
   */
  async stopAll(): Promise<void> {
    for (const [teamId] of this.proxies) {
      await this.stopProxy(teamId);
    }
  }

  /**
   * Get status of all proxies
   */
  getStatus(): Array<{ teamId: string; proxyPort: number; vitePort: number }> {
    return Array.from(this.proxies.values()).map(proxy => ({
      teamId: proxy.teamId,
      proxyPort: proxy.proxyPort,
      vitePort: proxy.vitePort
    }));
  }
}

export const dedicatedPreviewProxy = new DedicatedPreviewProxyService();