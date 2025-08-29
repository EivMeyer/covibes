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
export class IntelligentPortAllocator {
    constructor(options = {}) {
        this.usedPorts = new Set();
        // Port allocation stats
        this.allocationCount = 0;
        this.conflictCount = 0;
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
    async isPortFree(port) {
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
    async allocatePort() {
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
            }
            else {
                this.conflictCount++;
            }
        }
        console.error(`❌ Failed to allocate port after ${this.maxRetries} attempts`);
        return null;
    }
    /**
     * Release a port back to the pool
     */
    releasePort(port) {
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
    async getPortInfo(port) {
        return {
            port,
            isSystemFree: await this.isPortFree(port),
            isInternalFree: !this.usedPorts.has(port),
            allocatedAt: new Date()
        };
    }
    /**
     * Find and kill orphaned processes in our port range
     */
    async cleanupOrphanedProcesses() {
        try {
            console.log('🧹 Cleaning up orphaned preview processes...');
            // Find processes listening on our port range
            const { stdout } = await execAsync(`lsof -ti:${this.portStart}-${this.portEnd}` || 'echo');
            if (stdout.trim()) {
                const pids = stdout.trim().split('\n').filter(pid => pid);
                if (pids.length > 0) {
                    console.log(`Found ${pids.length} processes in port range, checking...`);
                    // Kill processes (they're likely orphaned previews)
                    for (const pid of pids) {
                        try {
                            await execAsync(`kill ${pid}`);
                            console.log(`💀 Killed orphaned process ${pid}`);
                        }
                        catch (error) {
                            // Process might already be dead, ignore
                        }
                    }
                    // Wait a moment for processes to die
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            console.log('✅ Cleanup completed');
        }
        catch (error) {
            console.warn('⚠️ Cleanup failed (non-critical):', error instanceof Error ? error.message : error);
        }
    }
    /**
     * Perform health check on allocated ports
     */
    async performHealthCheck() {
        const healthy = [];
        const unhealthy = [];
        for (const port of this.usedPorts) {
            try {
                // Simple HTTP HEAD request to check if port is responding
                const isResponding = await this.checkPortHealth(port);
                if (isResponding) {
                    healthy.push(port);
                }
                else {
                    unhealthy.push(port);
                }
            }
            catch {
                unhealthy.push(port);
            }
        }
        return { healthy, unhealthy };
    }
    /**
     * Check if a port is responding to HTTP requests
     */
    async checkPortHealth(port) {
        return new Promise((resolve) => {
            const http = require('http');
            const req = http.request({
                hostname: 'localhost',
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
    async getLoadBasedRecommendation() {
        try {
            const { stdout } = await execAsync('uptime');
            const loadMatch = stdout.match(/load average: ([\d.]+)/);
            const load = loadMatch ? parseFloat(loadMatch[1]) : 0;
            if (load > 2.0) {
                // High load: use higher port range
                return {
                    strategy: 'high-load',
                    portRange: { start: 6000, end: this.portEnd }
                };
            }
            else if (load > 1.0) {
                // Medium load: use middle range
                return {
                    strategy: 'medium-load',
                    portRange: { start: 5000, end: 7000 }
                };
            }
            else {
                // Low load: use standard range
                return {
                    strategy: 'low-load',
                    portRange: { start: this.portStart, end: 5999 }
                };
            }
        }
        catch {
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
