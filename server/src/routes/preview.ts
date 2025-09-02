/**
 * Preview Routes
 * 
 * Handles live preview for team project repositories
 * Requirements:
 * - Clone and run team repositories
 * - Manage preview processes
 * - Proxy requests to running projects
 */

console.log('🔥🔥🔥 PREVIEW ROUTES FILE LOADED!!! 🔥🔥🔥');

import express from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import http from 'http';
import { authenticateToken } from '../middleware/auth.js';
import { createAuthHandler } from '../types/express.js';
import { previewService } from '../../services/preview-service.js';
import { vmPreviewService } from '../../services/vm-preview-service.js';
import { universalPreviewService } from '../../services/universal-preview-service.js';
import { z } from 'zod';

// Import module augmentation

const router = express.Router();
const prisma = new PrismaClient();

// Get the base host from environment - FAIL if not configured
const BASE_HOST = process.env['BASE_HOST'];
if (!BASE_HOST) {
  throw new Error('BASE_HOST environment variable is required. Set it to your production domain.');
}

// Validation schemas
const createPreviewSchema = z.object({
  branch: z.enum(['main', 'staging', 'workspace']).default('main')
});

/**
 * GET /api/preview/proxy/:teamId/:branch/*
 * Proxy requests to the preview container
 * This handles the actual preview iframe content
 * NOTE: This route handles its own authentication via query params or headers
 * MUST be defined BEFORE the global auth middleware
 */
router.get('/proxy/:teamId/:branch/*', async (req, res) => {
  try {
    console.log(`🔍 Preview proxy request: ${req.method} ${req.url}`);
    console.log(`🔍 Team ID: ${req.params.teamId}, Branch: ${req.params.branch}`);
    console.log(`🔍 Query params:`, req.query);
    console.log(`🔍 Headers:`, req.headers);
    
    const requestTeamId = req.params.teamId;
    
    // For preview proxy, we'll allow access if a preview is running for the team
    // The preview itself is just a React app and not sensitive
    // Authentication is still required for all other preview management routes
    console.log(`🔓 Preview proxy allowing access for team ${requestTeamId}`);
    
    // Get the actual preview port for this team
    const previewStatus = await universalPreviewService.getPreviewStatus(requestTeamId);
    if (!previewStatus || !previewStatus.running) {
      console.log(`❌ No preview running for team ${requestTeamId}`);
      return res.status(404).json({ message: 'Preview not available for this team' });
    }
    
    const proxyPort = previewStatus.proxyPort || previewStatus.port;
    console.log(`🔄 Proxying to http://localhost:${proxyPort}`);
    
    // Get the rest of the path after /proxy/:teamId/:branch/
    const restPath = (req.params as any)[0] || '/';
    const fullPath = restPath + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
    
    // Create a simple proxy using node's http module
    const proxyReq = http.request({
      hostname: 'localhost',
      port: proxyPort,
      path: fullPath,
      method: req.method,
      headers: {
        ...req.headers,
        'host': `localhost:${proxyPort}`
      }
    }, (proxyRes: any) => {
      // Forward status code and headers
      res.status(proxyRes.statusCode);
      Object.keys(proxyRes.headers).forEach(key => {
        res.set(key, proxyRes.headers[key]);
      });
      
      // Pipe the response
      proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (err: any) => {
      console.error('❌ Proxy error:', err);
      res.status(502).json({ message: 'Preview service unavailable' });
    });
    
    // Forward request body if any
    req.pipe(proxyReq);
    
  } catch (error) {
    console.error('❌ Preview proxy error:', error);
    res.status(500).json({ message: 'Preview proxy failed' });
  }
});

// Apply authentication to all OTHER preview routes (except proxy which handles its own auth)
router.use(authenticateToken);

/**
 * GET /api/preview/status
 * Get preview status for the team
 */
router.get('/status', createAuthHandler(async (req, res) => {
  console.log('🚨🚨🚨 PREVIEW STATUS ROUTE HIT!!! 🚨🚨🚨');
  try {
    console.log('🎯 PREVIEW STATUS ENDPOINT CALLED for teamId:', req.user?.teamId);
    
    // Add cache-busting headers to ensure fresh data
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    const teamId = req.user?.teamId;
    if (!teamId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Check preview mode
    const previewMode = process.env['PREVIEW_MODE'] || 'local';
    
    if (previewMode === 'vm-docker') {
      // Get VM preview status (workspace-based)
      const vmStatus = vmPreviewService.getPreviewStatus(teamId);
      
      if (vmStatus && typeof vmStatus === 'object') {
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
      } else {
        return res.json({
          workspace: { status: 'stopped', message: 'No preview running' },
          mode: 'vm-docker'
        });
      }
    }

    if (previewMode === 'local' || previewMode === 'docker') {
      // Use universal Docker preview service
      const dockerStatus = await universalPreviewService.getPreviewStatus(teamId);
      console.log('🎯 DOCKER STATUS FROM SERVICE:', JSON.stringify(dockerStatus, null, 2));
      
      if (dockerStatus && dockerStatus.running) {
        const response = {
          workspace: {
            status: 'running',
            port: dockerStatus.port,  // Return actual container port for direct access
            url: dockerStatus.proxyPort ? `/api/preview/proxy/${teamId}/main/` : undefined,
            message: `Universal preview running on port ${dockerStatus.port}`,
            projectType: dockerStatus.projectType
          },
          mode: 'docker'
        };
        console.log('🎯 PREVIEW STATUS RESPONSE:', JSON.stringify(response, null, 2));
        return res.json(response);
      } else {
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
  } catch (error) {
    console.error('Error getting preview status:', error);
    res.status(500).json({ message: 'Failed to get preview status' });
  }
}));

/**
 * POST /api/preview/create
 * Create or start a preview
 */
router.post('/create', createAuthHandler(async (req, res) => {
  try {
    const teamId = req.user?.teamId;
    if (!teamId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Check preview mode
    const previewMode = process.env['PREVIEW_MODE'] || 'local';
    
    if (previewMode === 'vm-docker') {
      // Start VM-based workspace preview
      try {
        const result = await vmPreviewService.startPreview(teamId);
        
        return res.json({
          message: 'Workspace preview started successfully',
          port: result?.localPort || 0,
          status: result?.status || 'error',
          mode: 'vm-docker',
          url: `/api/preview/${teamId}/workspace/`
        });
      } catch (error) {
        return res.status(501).json({
          message: 'VM preview mode not configured',
          error: error instanceof Error ? error.message : 'Unknown error',
          mode: 'vm-docker'
        });
      }
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

  } catch (error) {
    console.error('Error creating preview:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Request user:', req.user);
    console.error('Request body:', req.body);
    res.status(500).json({ 
      message: error instanceof Error ? error.message : 'Failed to create preview' 
    });
  }
}));

/**
 * POST /api/preview/stop
 * Stop a preview
 */
router.post('/stop', createAuthHandler(async (req, res) => {
  try {
    const teamId = req.user?.teamId;
    if (!teamId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Check preview mode
    const previewMode = process.env['PREVIEW_MODE'] || 'local';
    
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

  } catch (error) {
    console.error('Error stopping preview:', error);
    res.status(500).json({ message: 'Failed to stop preview' });
  }
}));

/**
 * POST /api/preview/restart
 * Restart a preview container
 */
router.post('/restart', createAuthHandler(async (req, res) => {
  try {
    const teamId = req.user?.teamId;
    if (!teamId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Check preview mode
    const previewMode = process.env['PREVIEW_MODE'] || 'local';
    
    if (previewMode === 'vm-docker') {
      // Restart VM preview
      try {
        await vmPreviewService.stopPreview(teamId);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
        const result = await vmPreviewService.startPreview(teamId);
        
        return res.json({
          message: 'Workspace preview restarted successfully',
          port: result?.localPort || 0,
          status: result?.status || 'error',
          mode: 'vm-docker',
          url: `/api/preview/${teamId}/workspace/`
        });
      } catch (error) {
        return res.status(501).json({
          message: 'VM preview mode not configured',
          error: error instanceof Error ? error.message : 'Unknown error',
          mode: 'vm-docker'
        });
      }
    }

    if (previewMode === 'local' || previewMode === 'docker') {
      // Restart universal Docker preview
      await universalPreviewService.restartPreview(teamId);
      const status = await universalPreviewService.getPreviewStatus(teamId);
      
      return res.json({
        message: 'Universal preview restarted successfully',
        mode: 'docker',
        url: status?.proxyPort ? `/api/preview/proxy/${teamId}/main/` : undefined
      });
    }

    // Fall back to repository preview mode
    return res.status(400).json({ 
      message: 'Restart not supported for repository preview mode' 
    });

  } catch (error) {
    console.error('Error restarting preview:', error);
    res.status(500).json({ 
      message: error instanceof Error ? error.message : 'Failed to restart preview' 
    });
  }
}));

/**
 * GET /api/preview/logs/:branch
 * Get preview logs
 */
router.get('/logs/:branch', createAuthHandler(async (req, res) => {
  try {
    const teamId = req.user?.teamId;
    if (!teamId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Check if using VM preview mode
    const useVMPreview = process.env['PREVIEW_MODE'] === 'vm-docker';
    
    if (useVMPreview && req.params['branch'] === 'workspace') {
      // Get VM container logs
      const logs = await vmPreviewService.getContainerLogs(teamId);
      return res.json({ logs, mode: 'vm-docker' });
    }

    // Fall back to local preview logs
    const branch = req.params['branch'] as 'main' | 'staging';
    
    // Get logs
    const logs = await previewService.getPreviewLogs(teamId, branch);
    
    res.json({ logs, mode: 'local' });

  } catch (error) {
    console.error('Error getting logs:', error);
    res.status(500).json({ message: 'Failed to get logs' });
  }
}));

// Proxy route has been moved before the global auth middleware to handle its own authentication

/**
 * GET /api/preview/stats
 * Get port allocation statistics (admin/debug info)
 */
router.get('/stats', createAuthHandler(async (req, res) => {
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

  } catch (error) {
    console.error('Error getting port stats:', error);
    res.status(500).json({ message: 'Failed to get port statistics' });
  }
}));


// Proxy routes removed - using dedicated proxy servers now (like Caddy MVP)

export default router;