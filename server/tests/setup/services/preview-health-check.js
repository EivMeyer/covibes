/**
 * Preview Health Check Service
 *
 * Background job to monitor preview container health and maintain database consistency
 */
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import { dedicatedPreviewProxy } from './dedicated-preview-proxy.js';
const execAsync = promisify(exec);
class PreviewHealthCheckService {
    constructor() {
        this.prisma = new PrismaClient();
        this.healthCheckInterval = null;
        this.CHECK_INTERVAL = 30000; // 30 seconds
    }
    /**
     * Start the health check background job
     */
    start() {
        if (this.healthCheckInterval) {
            return; // Already running
        }
        console.log('🩺 Starting preview health check service (30s interval)');
        // Run initial check immediately
        this.performHealthCheck();
        // Then run periodically
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, this.CHECK_INTERVAL);
    }
    /**
     * Stop the health check background job
     */
    stop() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
            console.log('🛑 Stopped preview health check service');
        }
    }
    /**
     * Perform health check on all active deployments
     */
    async performHealthCheck() {
        try {
            const activeDeployments = await this.prisma.preview_deployments.findMany({
                where: { status: 'running' }
            });
            if (activeDeployments.length === 0) {
                return; // No active deployments to check
            }
            console.log(`🩺 Health checking ${activeDeployments.length} active preview deployments`);
            for (const deployment of activeDeployments) {
                await this.checkDeploymentHealth(deployment);
            }
        }
        catch (error) {
            console.error('❌ Error during preview health check:', error);
        }
    }
    /**
     * Check health of a specific deployment
     */
    async checkDeploymentHealth(deployment) {
        try {
            // Check if container exists and is running
            const { stdout } = await execAsync(`docker inspect ${deployment.containerName} --format '{{.State.Status}}'`);
            if (stdout.trim() === 'running') {
                // Container is healthy - update last health check
                await this.prisma.preview_deployments.update({
                    where: { id: deployment.id },
                    data: {
                        lastHealthCheck: new Date(),
                        errorMessage: null // Clear any previous error
                    }
                });
                // Ensure proxy is still running
                const proxyPort = dedicatedPreviewProxy.getProxyPort(deployment.teamId);
                if (!proxyPort) {
                    console.log(`⚠️ Proxy missing for team ${deployment.teamId}, recreating...`);
                    // Pass existing proxy port from database to avoid port conflicts
                    const newProxyPort = await dedicatedPreviewProxy.createProxy(deployment.teamId, deployment.port, deployment.proxyPort // Use existing proxy port from database
                    );
                    await this.prisma.preview_deployments.update({
                        where: { id: deployment.id },
                        data: { proxyPort: newProxyPort }
                    });
                }
            }
            else {
                // Container exists but not running
                await this.markDeploymentUnhealthy(deployment, `Container status: ${stdout.trim()}`);
            }
        }
        catch (error) {
            // Container doesn't exist or docker command failed
            await this.markDeploymentUnhealthy(deployment, 'Container not found or inaccessible');
        }
    }
    /**
     * Mark deployment as unhealthy and clean up
     */
    async markDeploymentUnhealthy(deployment, reason) {
        console.log(`❌ Preview unhealthy for team ${deployment.teamId}: ${reason}`);
        // Stop proxy if running
        await dedicatedPreviewProxy.stopProxy(deployment.teamId);
        // Update database status
        await this.prisma.preview_deployments.update({
            where: { id: deployment.id },
            data: {
                status: 'stopped',
                errorMessage: reason,
                lastHealthCheck: new Date()
            }
        });
        // Try to clean up container if it exists in weird state
        try {
            await execAsync(`docker rm -f ${deployment.containerName}`);
        }
        catch {
            // Ignore - container might already be gone
        }
    }
    /**
     * Get health check statistics
     */
    async getHealthStats() {
        const deployments = await this.prisma.preview_deployments.findMany();
        const running = deployments.filter(d => d.status === 'running').length;
        const stopped = deployments.filter(d => d.status === 'stopped').length;
        const error = deployments.filter(d => d.status === 'error').length;
        // Get most recent health check time
        const lastHealthCheck = await this.prisma.preview_deployments.findFirst({
            where: { lastHealthCheck: { not: null } },
            orderBy: { lastHealthCheck: 'desc' },
            select: { lastHealthCheck: true }
        });
        return {
            totalDeployments: deployments.length,
            runningDeployments: running,
            stoppedDeployments: stopped,
            errorDeployments: error,
            lastCheckTime: lastHealthCheck?.lastHealthCheck || undefined
        };
    }
}
export const previewHealthCheck = new PreviewHealthCheckService();
