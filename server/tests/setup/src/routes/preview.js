/**
 * Preview Routes
 *
 * Handles live preview for team project repositories
 * Requirements:
 * - Clone and run team repositories
 * - Manage preview processes
 * - Proxy requests to running projects
 */
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import { previewService } from '../../services/preview-service.js';
import { vmPreviewService } from '../../services/vm-preview-service.js';
import { universalPreviewService } from '../../services/universal-preview-service.js';
import { z } from 'zod';
const router = express.Router();
const prisma = new PrismaClient();
// Validation schemas
const createPreviewSchema = z.object({
    branch: z.enum(['main', 'staging', 'workspace']).default('main')
});
// Apply authentication to all preview routes
router.use(authenticateToken);
/**
 * GET /api/preview/status
 * Get preview status for the team
 */
router.get('/status', async (req, res) => {
    try {
        const teamId = req.user?.teamId;
        if (!teamId) {
            return res.status(401).json({ message: 'Not authenticated' });
        }
        // Check preview mode
        const previewMode = process.env.PREVIEW_MODE || 'local';
        if (previewMode === 'vm-docker') {
            // Get VM preview status (workspace-based)
            const vmStatus = vmPreviewService.getPreviewStatus(teamId);
            if (vmStatus) {
                return res.json({
                    workspace: {
                        status: vmStatus.status,
                        port: vmStatus.localPort,
                        message: vmStatus.status === 'running'
                            ? `Workspace preview running on port ${vmStatus.localPort}`
                            : vmStatus.error || 'Preview not running'
                    },
                    mode: 'vm-docker'
                });
            }
            else {
                return res.json({
                    workspace: { status: 'stopped', message: 'No preview running' },
                    mode: 'vm-docker'
                });
            }
        }
        if (previewMode === 'local' || previewMode === 'docker') {
            // Use universal Docker preview service
            const dockerStatus = await universalPreviewService.getPreviewStatus(teamId);
            if (dockerStatus && dockerStatus.running) {
                return res.json({
                    workspace: {
                        status: 'running',
                        port: dockerStatus.proxyPort || dockerStatus.port, // Return proxy port
                        url: dockerStatus.proxyPort ? `http://localhost:${dockerStatus.proxyPort}` : undefined,
                        message: `Universal preview running on proxy port ${dockerStatus.proxyPort || dockerStatus.port}`,
                        projectType: dockerStatus.projectType
                    },
                    mode: 'docker'
                });
            }
            else {
                return res.json({
                    workspace: { status: 'stopped', message: 'No universal preview running' },
                    mode: 'docker'
                });
            }
        }
        // Fall back to repository-based preview mode (legacy)
        const team = await prisma.teams.findUnique({
            where: { id: teamId }
        });
        if (!team?.repositoryUrl) {
            return res.json({
                main: { status: 'no_repository', message: 'No repository configured' },
                staging: { status: 'no_repository', message: 'No repository configured' },
                mode: 'repository'
            });
        }
        // Get preview status from repository service
        const mainStatus = await previewService.getPreviewStatus(teamId, 'main');
        const stagingStatus = await previewService.getPreviewStatus(teamId, 'staging');
        res.json({
            main: mainStatus,
            staging: stagingStatus,
            mode: 'repository'
        });
    }
    catch (error) {
        console.error('Error getting preview status:', error);
        res.status(500).json({ message: 'Failed to get preview status' });
    }
});
/**
 * POST /api/preview/create
 * Create or start a preview
 */
router.post('/create', async (req, res) => {
    try {
        const teamId = req.user?.teamId;
        if (!teamId) {
            return res.status(401).json({ message: 'Not authenticated' });
        }
        // Check preview mode
        const previewMode = process.env.PREVIEW_MODE || 'local';
        if (previewMode === 'vm-docker') {
            // Start VM-based workspace preview
            const result = await vmPreviewService.startPreview(teamId);
            return res.json({
                message: 'Workspace preview started successfully',
                port: result.localPort,
                status: result.status,
                mode: 'vm-docker',
                url: `/api/preview/${teamId}/workspace/`
            });
        }
        if (previewMode === 'local' || previewMode === 'docker') {
            // Get team's repository URL if available
            const team = await prisma.teams.findUnique({
                where: { id: teamId }
            });
            // Start universal Docker preview
            const result = await universalPreviewService.startPreview(teamId, team?.repositoryUrl || undefined);
            return res.json({
                message: 'Universal preview started successfully',
                port: result.port,
                status: 'running',
                mode: 'docker',
                url: result.url
            });
        }
        // Fall back to repository-based preview mode (legacy)
        const { branch } = createPreviewSchema.parse(req.body);
        // Get team repository
        const team = await prisma.teams.findUnique({
            where: { id: teamId }
        });
        if (!team?.repositoryUrl) {
            return res.status(400).json({
                message: 'No repository configured for team. Please configure a repository first.'
            });
        }
        // Create/start repository preview
        const result = await previewService.createPreview({
            teamId,
            branch,
            repositoryUrl: team.repositoryUrl
        });
        res.json({
            message: 'Preview created successfully',
            branch,
            mode: 'local',
            ...result
        });
    }
    catch (error) {
        console.error('Error creating preview:', error);
        console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
        console.error('Request user:', req.user);
        console.error('Request body:', req.body);
        res.status(500).json({
            message: error instanceof Error ? error.message : 'Failed to create preview'
        });
    }
});
/**
 * POST /api/preview/stop
 * Stop a preview
 */
router.post('/stop', async (req, res) => {
    try {
        const teamId = req.user?.teamId;
        if (!teamId) {
            return res.status(401).json({ message: 'Not authenticated' });
        }
        // Check preview mode
        const previewMode = process.env.PREVIEW_MODE || 'local';
        if (previewMode === 'vm-docker') {
            // Stop VM preview
            await vmPreviewService.stopPreview(teamId);
            return res.json({
                message: 'Workspace preview stopped successfully',
                mode: 'vm-docker'
            });
        }
        if (previewMode === 'local' || previewMode === 'docker') {
            // Stop universal Docker preview
            await universalPreviewService.stopPreview(teamId);
            return res.json({
                message: 'Universal preview stopped successfully',
                mode: 'docker'
            });
        }
        // Fall back to repository preview mode
        const { branch } = createPreviewSchema.parse(req.body);
        // Stop repository preview
        await previewService.stopPreview(teamId, branch);
        res.json({
            message: 'Preview stopped successfully',
            branch,
            mode: 'repository'
        });
    }
    catch (error) {
        console.error('Error stopping preview:', error);
        res.status(500).json({ message: 'Failed to stop preview' });
    }
});
/**
 * POST /api/preview/restart
 * Restart a preview container
 */
router.post('/restart', async (req, res) => {
    try {
        const teamId = req.user?.teamId;
        if (!teamId) {
            return res.status(401).json({ message: 'Not authenticated' });
        }
        // Check preview mode
        const previewMode = process.env.PREVIEW_MODE || 'local';
        if (previewMode === 'vm-docker') {
            // Restart VM preview
            await vmPreviewService.stopPreview(teamId);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
            const result = await vmPreviewService.startPreview(teamId);
            return res.json({
                message: 'Workspace preview restarted successfully',
                port: result.localPort,
                status: result.status,
                mode: 'vm-docker',
                url: `/api/preview/${teamId}/workspace/`
            });
        }
        if (previewMode === 'local' || previewMode === 'docker') {
            // Restart universal Docker preview
            await universalPreviewService.restartPreview(teamId);
            const status = await universalPreviewService.getPreviewStatus(teamId);
            return res.json({
                message: 'Universal preview restarted successfully',
                mode: 'docker',
                url: status?.proxyPort ? `http://localhost:${status.proxyPort}` : undefined
            });
        }
        // Fall back to repository preview mode
        return res.status(400).json({
            message: 'Restart not supported for repository preview mode'
        });
    }
    catch (error) {
        console.error('Error restarting preview:', error);
        res.status(500).json({
            message: error instanceof Error ? error.message : 'Failed to restart preview'
        });
    }
});
/**
 * GET /api/preview/logs/:branch
 * Get preview logs
 */
router.get('/logs/:branch', async (req, res) => {
    try {
        const teamId = req.user?.teamId;
        if (!teamId) {
            return res.status(401).json({ message: 'Not authenticated' });
        }
        // Check if using VM preview mode
        const useVMPreview = process.env.PREVIEW_MODE === 'vm-docker';
        if (useVMPreview && req.params.branch === 'workspace') {
            // Get VM container logs
            const logs = await vmPreviewService.getContainerLogs(teamId);
            return res.json({ logs, mode: 'vm-docker' });
        }
        // Fall back to local preview logs
        const branch = req.params.branch;
        // Get logs
        const logs = await previewService.getPreviewLogs(teamId, branch);
        res.json({ logs, mode: 'local' });
    }
    catch (error) {
        console.error('Error getting logs:', error);
        res.status(500).json({ message: 'Failed to get logs' });
    }
});
/**
 * GET /api/preview/stats
 * Get port allocation statistics (admin/debug info)
 */
router.get('/stats', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authenticated' });
        }
        const stats = previewService.getPortStats();
        res.json({
            message: 'Port allocation statistics',
            ...stats,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Error getting port stats:', error);
        res.status(500).json({ message: 'Failed to get port statistics' });
    }
});
// Proxy routes removed - using dedicated proxy servers now (like Caddy MVP)
export default router;
