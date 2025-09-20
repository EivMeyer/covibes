/**
 * Preview Routes
 * 
 * Handles live preview for team project repositories
 * Requirements:
 * - Clone and run team repositories
 * - Manage preview processes
 * - Proxy requests to running projects
 */

console.log('🔥🔥🔥 PREVIEW ROUTES FILE LOADED WITH FETCH PROXY DEBUG!!! 🔥🔥🔥');

import express from 'express';
import { PrismaClient } from '@prisma/client';
// import jwt from 'jsonwebtoken';
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

const inspectorToggleSchema = z.object({
  enabled: z.boolean()
});

// Inspector state storage (TODO: Move to Redis for persistence)
const inspectorStates = new Map<string, boolean>(); // teamId -> enabled

/**
 * HTML injection function for element inspector
 */
function injectInspectorScript(html: string): string {
  const inspectorScript = `
<script id="colabvibe-inspector">
(function() {
  let hoveredElement = null;
  const originalStyles = new WeakMap();

  // Helper to get CSS selector path
  function getSelector(el) {
    if (el.id) return '#' + el.id;

    const path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
      let selector = el.nodeName.toLowerCase();
      if (el.className) {
        selector += '.' + Array.from(el.classList).join('.');
      }
      path.unshift(selector);
      el = el.parentNode;
    }
    return path.join(' > ');
  }

  // Helper to get important computed styles
  function getImportantStyles(element) {
    const styles = window.getComputedStyle(element);
    const important = {};

    // Key styles to capture
    const keys = [
      'display', 'position', 'width', 'height',
      'padding', 'margin', 'color', 'backgroundColor',
      'fontSize', 'fontWeight', 'border', 'borderRadius',
      'boxShadow', 'opacity', 'zIndex', 'overflow'
    ];

    keys.forEach(key => {
      const value = styles[key];
      if (value && value !== 'none' && value !== 'auto' && value !== '0px') {
        important[key] = value;
      }
    });

    return important;
  }

  // Listen for enable/disable messages from parent
  window.addEventListener('message', function(event) {
    if (event.data.type === 'enable-inspector') {
      window.__inspectorActive = event.data.active;
      console.log('ColabVibe Inspector:', window.__inspectorActive ? 'ENABLED' : 'DISABLED');
    }
  });

  // Mouse over handler
  function handleMouseOver(e) {
    if (!window.__inspectorActive) return;

    // Don't highlight if we're over the same element
    if (e.target === hoveredElement) return;

    // Restore previous element
    if (hoveredElement && originalStyles.has(hoveredElement)) {
      hoveredElement.style.outline = originalStyles.get(hoveredElement).outline || '';
      hoveredElement.style.cursor = originalStyles.get(hoveredElement).cursor || '';
    }

    // Store original styles
    originalStyles.set(e.target, {
      outline: e.target.style.outline,
      cursor: e.target.style.cursor
    });

    // Apply highlight
    e.target.style.outline = '2px solid #3B82F6';
    e.target.style.cursor = 'crosshair';
    hoveredElement = e.target;
  }

  // Mouse out handler
  function handleMouseOut(e) {
    if (!window.__inspectorActive) return;
    if (e.target === hoveredElement && originalStyles.has(e.target)) {
      e.target.style.outline = originalStyles.get(e.target).outline || '';
      e.target.style.cursor = originalStyles.get(e.target).cursor || '';
      hoveredElement = null;
    }
  }

  // Click handler
  function handleClick(e) {
    if (!window.__inspectorActive) return;

    e.preventDefault();
    e.stopPropagation();

    // Send element data to parent
    window.parent.postMessage({
      type: 'inspector-element-selected',
      data: {
        html: e.target.outerHTML.substring(0, 500), // Limit size
        selector: getSelector(e.target),
        computedStyles: getImportantStyles(e.target),
        rect: e.target.getBoundingClientRect(),
        text: e.target.textContent?.substring(0, 200) || '',
        tagName: e.target.tagName.toLowerCase(),
        className: e.target.className || '',
        id: e.target.id || ''
      },
      position: { x: e.pageX, y: e.pageY }
    }, '*');
  }

  // Set up event listeners
  document.addEventListener('mouseover', handleMouseOver);
  document.addEventListener('mouseout', handleMouseOut);
  document.addEventListener('click', handleClick);

  // Mark as ready
  window.__inspectorReady = true;
  console.log('ColabVibe Inspector injected server-side and ready');
})();
</script>`;

  // Inject before </head> or at end of <head>
  if (html.includes('</head>')) {
    return html.replace('</head>', inspectorScript + '\n</head>');
  } else if (html.includes('<head>')) {
    return html.replace('<head>', '<head>\n' + inspectorScript);
  } else if (html.includes('<body>')) {
    // Fallback: inject at start of body
    return html.replace('<body>', '<body>\n' + inspectorScript);
  } else {
    // Last resort: prepend to entire document
    return inspectorScript + '\n' + html;
  }
}

/**
 * POST /api/preview/inspector/:teamId/toggle
 * Toggle element inspector for a team's preview
 */
router.post('/inspector/:teamId/toggle', authenticateToken, createAuthHandler(async (req, res) => {
  try {
    const { teamId } = req.params;

    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    const validation = inspectorToggleSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.errors
      });
    }

    const { enabled } = validation.data;

    // Verify user has access to this team
    const userTeamId = req.user?.teamId;
    if (userTeamId !== teamId) {
      return res.status(403).json({ error: 'Access denied to this team' });
    }

    // Store inspector state
    inspectorStates.set(teamId, enabled);

    console.log(`🔍 [INSPECTOR] ${enabled ? 'Enabled' : 'Disabled'} inspector for team ${teamId}`);

    res.json({
      success: true,
      enabled,
      teamId
    });

  } catch (error) {
    console.error('Inspector toggle error:', error);
    res.status(500).json({ error: 'Failed to toggle inspector' });
  }
}));

/**
 * GET /api/preview/inspector/:teamId/status
 * Get current inspector status for a team
 */
router.get('/inspector/:teamId/status', authenticateToken, createAuthHandler(async (req, res) => {
  try {
    const { teamId } = req.params;

    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    // Verify user has access to this team
    const userTeamId = req.user?.teamId;
    if (userTeamId !== teamId) {
      return res.status(403).json({ error: 'Access denied to this team' });
    }

    const enabled = inspectorStates.get(teamId) || false;

    res.json({
      enabled,
      teamId
    });

  } catch (error) {
    console.error('Inspector status error:', error);
    res.status(500).json({ error: 'Failed to get inspector status' });
  }
}));

/**
 * ALL /api/preview/proxy/:teamId/:branch/*
 * Proxy requests to the preview container with WebSocket support for HMR
 * This handles the actual preview iframe content AND WebSocket connections
 * NOTE: This route handles its own authentication via query params or headers
 * MUST be defined BEFORE the global auth middleware
 */
router.use('/proxy/:teamId/:branch/*', async (req, res) => {
  try {
    const requestTeamId = req.params.teamId;
    console.log(`🔍 [WS-PROXY] ${req.method} ${req.originalUrl} (Team: ${requestTeamId})`);
    
    // For preview proxy, we'll allow access if a preview is running for the team
    console.log(`🔓 [WS-PROXY] Allowing access for team ${requestTeamId}`);
    
    // Get preview status from service (database-backed)
    console.log(`🔍 [SERVICE] Getting preview status for team ${requestTeamId}`);
    const previewStatus = await universalPreviewService.getPreviewStatus(requestTeamId);
    console.log(`📊 [SERVICE] Preview status result:`, previewStatus ? `running=${previewStatus.running}, port=${previewStatus.port}` : 'null');
    
    if (!previewStatus || !previewStatus.running) {
      console.log(`❌ [WS-PROXY] No preview running for team ${requestTeamId}`);
      return res.status(404).json({ message: 'Preview not available for this team' });
    }
    
    // EXPRESS SHOULD ALWAYS PROXY TO CONTAINER PORT, NOT DEDICATED PROXY PORT!
    const containerPort = previewStatus.port;  // Container port (8000)
    console.log(`🔄 [WS-PROXY] Express proxying DIRECTLY to container: http://localhost:${containerPort}`);
    
    // SIMPLE HTTP PROXY: Direct request with MIME type preservation
    const originalPath = req.originalUrl;
    const proxyPath = originalPath.replace(`/api/preview/proxy/${requestTeamId}/main`, '') || '/';
    const targetUrl = `http://localhost:${containerPort}${proxyPath}`;
    
    console.log(`🔄 [SIMPLE-PROXY] ${originalPath} -> ${targetUrl}`);
    
    try {
      // Make HTTP request to container
      const cleanHeaders = Object.fromEntries(
        Object.entries(req.headers).filter(([key]) => 
          !['host', 'connection', 'content-length'].includes(key.toLowerCase())
        )
      );
      
      const requestOptions: RequestInit = {
        method: req.method,
        headers: {
          ...cleanHeaders,
          'host': `localhost:${containerPort}`,
        },
        body: (req.method !== 'GET' && req.method !== 'HEAD' && req.body) 
          ? JSON.stringify(req.body) 
          : null,
      };
      
      const response = await fetch(targetUrl, requestOptions);
      console.log(`🔍 [FETCH-DEBUG] Got response: status=${response.status}, ok=${response.ok}`);
      const responseHeaders = Object.fromEntries(response.headers.entries());
      
      console.log(`✅ [SIMPLE-PROXY] ${response.status} ${response.statusText}`);
      console.log(`📄 [SIMPLE-PROXY] Original Content-Type: ${responseHeaders['content-type'] || 'none'}`);
      
      // MIME type fix for JavaScript modules - check both original path and proxy path
      const isJSModule = originalPath.match(/\.(js|jsx|ts|tsx|mjs)(\?.*)?$/) || proxyPath.match(/\.(js|jsx|ts|tsx|mjs)(\?.*)?$/);
      if (isJSModule) {
        responseHeaders['content-type'] = 'text/javascript; charset=utf-8';
        console.log(`🔧 [MIME-FIX] Fixed MIME type for JS module: ${originalPath} -> ${proxyPath}`);
      }

      // 🚀 HTML PATH REWRITING FIX - Fix absolute paths in Vite HTML responses
      const isHTML = responseHeaders['content-type']?.includes('text/html');
      let responseBody = await response.text();

      console.log(`🔍 [HTML-DEBUG] isHTML: ${isHTML}, proxyPath: "${proxyPath}", content-type: ${responseHeaders['content-type']}`);

      // 🔍 INSPECTOR INJECTION - Always inject inspector script for HTML (inactive by default)
      if (isHTML) {
        console.log(`🔍 [INSPECTOR] Injecting inspector script for team ${requestTeamId} (inactive by default)`);
        responseBody = injectInspectorScript(responseBody);
        console.log(`✅ [INSPECTOR] Inspector script injected successfully`);
      }

      if (isHTML && proxyPath === '/') {
        console.log(`🔧 [HTML-REWRITE] Fixing absolute paths in HTML response`);
        const baseProxyPath = `/api/preview/proxy/${requestTeamId}/main`;

        // Fix common Vite development absolute paths
        responseBody = responseBody
          .replace(/src="\/(@vite\/[^"]+)"/g, `src="${baseProxyPath}/$1"`)
          .replace(/src="\/(@react-refresh[^"]+)"/g, `src="${baseProxyPath}/$1"`)
          .replace(/src="\/src\/([^"]+)"/g, `src="${baseProxyPath}/src/$1"`)
          .replace(/src="\/node_modules\/([^"]+)"/g, `src="${baseProxyPath}/node_modules/$1"`)
          .replace(/href="\/(@vite\/[^"]+)"/g, `href="${baseProxyPath}/$1"`)
          .replace(/href="\/src\/([^"]+)"/g, `href="${baseProxyPath}/src/$1"`);

        console.log(`✅ [HTML-REWRITE] Fixed absolute paths for proxy: ${baseProxyPath}`);
      } else if (isHTML) {
        console.log(`⏭️ [HTML-SKIP] Not root path, skipping HTML rewrite for: "${proxyPath}"`);
      }
      
      // Set response status and headers
      res.status(response.status);
      Object.entries(responseHeaders).forEach(([key, value]) => {
        res.set(key, value);
      });
      
      // Send rewritten response body (HTML paths fixed, MIME types corrected)
      if (responseBody) {
        res.send(responseBody);
      } else {
        res.end();
      }
      
    } catch (fetchError) {
      console.error(`❌ [SIMPLE-PROXY] Error:`, fetchError);
      res.status(502).json({ message: 'Proxy error', error: String(fetchError) });
    }
    
  } catch (error) {
    console.error('❌ [WS-PROXY] Setup error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Preview proxy setup failed' });
    }
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
        // Check if nginx=true query param is set to force nginx URL
        const forceNginx = req.query['nginx'] === 'true';
        let publicUrl;
        
        // FIXED: Use dynamic server port instead of hardcoding
        const serverPort = process.env['PORT'] || 3001;
        publicUrl = `http://${BASE_HOST}:${serverPort}/preview/${teamId}/`;
        
        console.log('🚀 URL SET TO:', publicUrl, 'forceNginx:', forceNginx);
        const response = {
          workspace: {
            status: 'running',
            port: dockerStatus.port,  // Host port mapped to container 5173
            url: publicUrl,
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
      await universalPreviewService.getPreviewStatus(teamId);
      
      // Always use clean URLs through main server
      const publicUrl = `http://${BASE_HOST}/preview/${teamId}/`;
      return res.json({
        message: 'Universal preview restarted successfully',
        mode: 'docker',
        url: publicUrl
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
 * GET /api/preview/test
 * Test if new routes work
 */
router.get('/test', (_req, res) => {
  res.json({
    message: 'Preview API endpoint working',
    apiVersion: '2.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/preview/nginx-status  
 * Get preview status with nginx URLs (bypasses cache issues)
 */
router.get('/nginx-status', createAuthHandler(async (req, res) => {
  try {
    const teamId = req.user?.teamId;
    if (!teamId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Get preview deployment from database
    const deployment = await prisma.preview_deployments.findUnique({
      where: { teamId }
    });
    
    if (!deployment || deployment.status !== 'running') {
      return res.json({
        workspace: { status: 'stopped', message: 'No preview running' },
        mode: 'docker'
      });
    }
    
    // Always return nginx direct proxy URL
    const nginxUrl = `http://${BASE_HOST}/preview/${teamId}/`;
    
    return res.json({
      workspace: {
        status: 'running',
        port: deployment.port,
        url: nginxUrl,
        message: `Nginx preview running on port ${deployment.port}`,
        projectType: deployment.projectType
      },
      mode: 'nginx-direct'
    });
    
  } catch (error) {
    console.error('Error getting nginx preview status:', error);
    res.status(500).json({ message: 'Failed to get preview status' });
  }
}));

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


/**
 * GET /api/preview/proxy/:teamId/:branch/*
 * Proxy requests to dedicated preview proxy servers
 * This route enables HTTPS-compatible preview access while maintaining HMR WebSocket support
 */

// Simplified direct proxy - no caching needed

// Simplified direct proxy without caching - just forward to dedicated proxy
// COMPLETELY DISABLED: This conflicts with the WebSocket-enabled proxy middleware above
// Commenting out the entire handler to prevent redirect loops
/* DISABLED HANDLER - CAUSING REDIRECT LOOPS
router.all('/disabled-proxy/:teamId/:branch*', async (req, res) => {
  try {
    const { teamId } = req.params;
    console.log(`🔍 Preview proxy: ${req.method} ${req.originalUrl}`);
    
    // Get deployment info
    const deployment = await universalPreviewService.getPreviewStatus(teamId);
    if (!deployment || !deployment.proxyPort || !deployment.running) {
      console.warn(`❌ No running deployment for team ${teamId}`);
      return res.status(404).json({ 
        message: 'Preview not found or not running',
        teamId 
      });
    }
    
    // Extract the path after the route prefix (support any branch, not just 'main')
    const originalPath = req.originalUrl;
    const routePrefix = `/api/preview/proxy/${teamId}/${req.params.branch}`;
    const suffix = originalPath.startsWith(routePrefix)
      ? originalPath.slice(routePrefix.length)
      : '/';
    const qIndex = suffix.indexOf('?');
    const pathOnly = qIndex >= 0 ? suffix.slice(0, qIndex) || '/' : (suffix || '/');
    const queryOnly = qIndex >= 0 ? suffix.slice(qIndex) : '';

    // DISABLED: This redirect causes redirect loops with the proxy middleware
    // Use the proper proxy middleware instead of redirecting
    // if (pathOnly === '/' || pathOnly === '') {
    //   const redirectUrl = `http://${BASE_HOST}:${deployment.proxyPort}/${queryOnly}`;
    //   console.log(`↪️  Redirecting proxy root to dedicated origin: ${redirectUrl}`);
    //   return res.redirect(302, redirectUrl);
    // }

    const targetUrl = `http://localhost:${deployment.proxyPort}${pathOnly}${queryOnly}`;
    
    console.log(`🔄 Proxying ${originalPath} -> ${targetUrl}`);
    
    // Forward the request
    try {
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: {
          ...req.headers,
          host: `localhost:${deployment.proxyPort}`,
        } as HeadersInit,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
      });
      
      // Copy status and headers
      res.status(response.status);
      response.headers.forEach((value, key) => {
        res.set(key, value);
      });
      
      // Stream the response body
      if (response.body) {
        const reader = response.body.getReader();
        const stream = new ReadableStream({
          start(controller) {
            function pump(): Promise<void> {
              return reader.read().then(({ done, value }) => {
                if (done) {
                  controller.close();
                  return;
                }
                controller.enqueue(value);
                return pump();
              });
            }
            return pump();
          }
        });
        
        const buffer = Buffer.from(await new Response(stream).arrayBuffer());
        res.send(buffer);
      } else {
        res.end();
      }
      
    } catch (fetchError) {
      console.error(`❌ Fetch error:`, fetchError);
      res.status(502).json({ message: 'Proxy error', error: String(fetchError) });
    }
    
  } catch (error) {
    console.error('❌ Preview proxy error:', error);
    res.status(500).json({ 
      message: 'Preview proxy failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
*/

/**
 * WebSocket upgrade handler for HMR support
 * This is handled at the server level in server.ts for WebSocket upgrades
 */

export default router;
