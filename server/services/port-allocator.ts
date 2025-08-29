/**
 * Intelligent Port Allocator Service
 * 
 * Provides smart port allocation with:
 * - Real system-level port availability checking
 * - Random start probing to avoid conflicts
 * - Orphan process cleanup
 * - Load-aware allocation strategies
 */

import { createServer } from 'net';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface PortAllocationOptions {
  portStart?: number;
  portEnd?: number;
  maxRetries?: number;
  excludePorts?: number[];
}

export interface PortInfo {
  port: number;
  isSystemFree: boolean;
  isInternalFree: boolean;
  allocatedAt: Date;
}

export class IntelligentPortAllocator {
  private usedPorts = new Set<number>();
  private portStart: number;
  private portEnd: number;
  private maxRetries: number;
  private excludePorts: Set<number>;
  
  // Port allocation stats
  private allocationCount = 0;
  private conflictCount = 0;

  constructor(options: PortAllocationOptions = {}) {
    this.portStart = options.portStart || 4000;
    this.portEnd = options.portEnd || 8999;
    this.maxRetries = options.maxRetries || 50;
    this.excludePorts = new Set(options.excludePorts || []);
    
    console.log(`🔧 Intelligent Port Allocator initialized: ${this.portStart}-${this.portEnd}`);
    // DISABLED: Too aggressive, kills the main server process
    // this.cleanupOrphanedProcesses();
  }

  /**
   * Check if a port is actually free on the system
   */
  private async isPortFree(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer();
      
      server.listen(port, '0.0.0.0', () => {
        server.close(() => resolve(true));
      });
      
      server.on('error', () => resolve(false));
    });
  }

  /**
   * Smart port allocation with random start and probing
   */
  async allocatePort(): Promise<number | null> {
    // Start from a random port to avoid clustering
    const randomOffset = Math.floor(Math.random() * (this.portEnd - this.portStart));
    const startPort = this.portStart + randomOffset;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      // Calculate port with wrap-around
      const port = this.portStart + ((startPort - this.portStart + attempt) % (this.portEnd - this.portStart + 1));
      
      // Skip if port is excluded or already tracked as used
      if (this.excludePorts.has(port) || this.usedPorts.has(port)) {
        continue;
      }
      
      // Check if port is actually free on the system
      if (await this.isPortFree(port)) {
        this.usedPorts.add(port);
        this.allocationCount++;
        
        console.log(`✅ Allocated port ${port} (attempt ${attempt + 1})`);
        return port;
      } else {
        this.conflictCount++;
      }
    }
    
    console.error(`❌ Failed to allocate port after ${this.maxRetries} attempts`);
    return null;
  }

  /**
   * Release a port back to the pool
   */
  releasePort(port: number): void {
    this.usedPorts.delete(port);
    console.log(`♻️ Released port ${port}`);
  }

  /**
   * Get port allocation statistics
   */
  getStats() {
    return {
      totalAllocated: this.usedPorts.size,
      allocationCount: this.allocationCount,
      conflictCount: this.conflictCount,
      successRate: this.allocationCount > 0 ? 
        ((this.allocationCount - this.conflictCount) / this.allocationCount * 100).toFixed(1) + '%' : 
        '0%',
      availableRange: `${this.portStart}-${this.portEnd}`,
      usedPorts: Array.from(this.usedPorts).sort()
    };
  }

  /**
   * Get detailed info about a specific port
   */
  async getPortInfo(port: number): Promise<PortInfo> {
    return {
      port,
      isSystemFree: await this.isPortFree(port),
      isInternalFree: !this.usedPorts.has(port),
      allocatedAt: new Date()
    };
  }

  // REMOVED: _cleanupOrphanedProcesses method was too aggressive and killed main server processes
  // The method has been disabled in constructor as it was causing issues with server stability

  /**
   * Perform health check on allocated ports
   */
  async performHealthCheck(): Promise<{ healthy: number[]; unhealthy: number[] }> {
    const healthy: number[] = [];
    const unhealthy: number[] = [];
    
    for (const port of this.usedPorts) {
      try {
        // Simple HTTP HEAD request to check if port is responding
        const isResponding = await this.checkPortHealth(port);
        if (isResponding) {
          healthy.push(port);
        } else {
          unhealthy.push(port);
        }
      } catch {
        unhealthy.push(port);
      }
    }
    
    return { healthy, unhealthy };
  }

  /**
   * Check if a port is responding to HTTP requests
   */
  private async checkPortHealth(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const http = require('http');
      const req = http.request({
        hostname: (() => {
          const baseHost = process.env['BASE_HOST'];
          if (!baseHost) {
            throw new Error('BASE_HOST environment variable is required. Set it to your production domain.');
          }
          return baseHost;
        })(),
        port,
        method: 'HEAD',
        timeout: 3000
      }, () => resolve(true));
      
      req.on('error', () => resolve(false));
      req.on('timeout', () => resolve(false));
      req.end();
    });
  }

  /**
   * Get system load and recommend allocation strategy
   */
  async getLoadBasedRecommendation(): Promise<{ strategy: string; portRange: { start: number; end: number } }> {
    try {
      const { stdout } = await execAsync('uptime');
      const loadMatch = stdout.match(/load average: ([\d.]+)/);
      const load = loadMatch ? parseFloat(loadMatch[1]!) : 0;
      
      if (load > 2.0) {
        // High load: use higher port range
        return {
          strategy: 'high-load',
          portRange: { start: 6000, end: this.portEnd }
        };
      } else if (load > 1.0) {
        // Medium load: use middle range
        return {
          strategy: 'medium-load',
          portRange: { start: 5000, end: 7000 }
        };
      } else {
        // Low load: use standard range
        return {
          strategy: 'low-load',
          portRange: { start: this.portStart, end: 5999 }
        };
      }
    } catch {
      // Fallback to standard range
      return {
        strategy: 'fallback',
        portRange: { start: this.portStart, end: this.portEnd }
      };
    }
  }
}

// Export singleton instance
export const portAllocator = new IntelligentPortAllocator({
  portStart: 4000,
  portEnd: 8999,
  maxRetries: 100,
  excludePorts: [3000, 3001, 3006, 5432, 5433, 5555, 6379] // Exclude main app ports including backend server
});