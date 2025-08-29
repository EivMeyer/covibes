/**
 * Dedicated Preview Proxy Service
 * 
 * Creates dedicated proxy servers for each team preview, like the Caddy MVP.
 * Each preview gets its own port with a pure reverse proxy to the Vite container.
 */

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { Server } from 'http';

// Get the base host from environment or default to localhost
const BASE_HOST = process.env['BASE_HOST'] || 'localhost';

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

    // Pure reverse proxy - exactly like Caddy MVP
    const proxy = createProxyMiddleware({
      target: `http://${BASE_HOST}:${vitePort}`,
      changeOrigin: true,
      ws: true, // WebSocket support for HMR
      // No pathRewrite - completely transparent
      on: {
        proxyRes: (proxyRes: any) => {
          // Headers for iframe embedding and CORS (like Caddy MVP)
          proxyRes.headers['x-frame-options'] = 'ALLOWALL';
          proxyRes.headers['content-security-policy'] = 'frame-ancestors *';
          proxyRes.headers['access-control-allow-origin'] = '*';
          proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
          proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization';
          proxyRes.headers['access-control-allow-credentials'] = 'true';
        }
      },
      logger: console
    });

    // Apply proxy to all routes
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