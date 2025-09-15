/**
 * Agent Management Routes
 * 
 * Handles agent spawning, listing, and control with JWT authentication
 * Requirements:
 * - Handle agent spawning with type ("general" or "code-writer") and task parameters
 * - List team agents with filtering
 * - Stop running agents
 * - Use JWT authentication middleware
 * - Use Prisma client for database operations
 * - Integrate with SSH service for agent execution
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { authenticateToken } from '../middleware/auth.js';
import { getIO } from '../server.js';
import { generateAgentName } from '../utils/nameGenerator.js';
import { agentChatService } from '../../services/agent-chat.js';
import { dockerManager } from '../services/docker-manager-compat.js';
import { terminalManagerFactory } from '../services/terminal-manager-factory.js';
// import fs from 'fs/promises';
// import path from 'path';
// import os from 'os';

const router = express.Router();
const prisma = new PrismaClient();

// Local workspace configuration
// const WORKSPACE_BASE_PATH = path.join(os.homedir(), '.covibes/workspaces');

// Import module augmentation for Express types

// Validation schemas
const spawnAgentSchema = z.object({
  task: z.string().max(1000).transform(val => val || '').default(''), // Allow empty strings for interactive sessions
  agentType: z.enum(['claude']).optional().default('claude'), // Client sends agentType, not type
  terminalLocation: z.enum(['local', 'remote']).optional().default('local'),
  terminalIsolation: z.enum(['none', 'docker', 'tmux']).optional().default('tmux') // Tmux provides persistent sessions with proper system prompt
});

// Apply JWT authentication middleware to all routes
router.use(authenticateToken);

/**
 * Execute agent asynchronously using configured terminal manager
 */
async function executeAgentAsync(
  agentId: string, 
  _vmId: string | null, 
  _type: string, 
  task: string, 
  terminalLocation: 'local' | 'remote',
  terminalIsolation: 'none' | 'docker' | 'tmux' | 'screen',
  repositoryUrl?: string,
  userId?: string,
  teamId?: string
): Promise<void> {
  try {
    // Update agent status to starting
    await prisma.agents.update({
      where: { id: agentId },
      data: { status: 'starting' }
    });

    // Send start message to chat
    await agentChatService.sendAgentStartMessage(agentId, task);

    if (!userId || !teamId) {
      const errorMessage = 'Missing user ID or team ID for agent execution.';
      await prisma.agents.update({
        where: { id: agentId },
        data: { 
          status: 'error',
          output: errorMessage
        }
      });
      
      await agentChatService.sendAgentErrorMessage(agentId, errorMessage);
      return;
    }

    // Route to appropriate terminal manager based on configuration
    console.log(`🚀 Starting Claude agent with ${terminalLocation}/${terminalIsolation} terminal for agent: ${agentId}`);
    
    try {
      const io = getIO();
      
      if (terminalIsolation === 'docker') {
        // Use Docker manager (backward compatibility)
        const containerResult = await dockerManager.spawnAgentInContainer({
          userId,
          teamId,
          agentId,
          task,
          workspaceRepo: repositoryUrl || undefined
        });
        
        const { container, sessionId } = containerResult;
        
        console.log(`✅ Agent ${agentId} spawned in container ${container.containerId} with session ${sessionId}`);

        // Update agent status to running with container info
        await prisma.agents.update({
          where: { id: agentId },
          data: {
            status: 'running',
            output: `Claude agent running in Docker container\nContainer ID: ${container.containerId}\nSession: ${sessionId}\n\nExecuting: claude "${task}"\n\nFiles created/modified by this agent will appear in the preview.`
          }
        });
        
        // Notify team that agent is running in container
        if (teamId && io) {
          io.to(teamId).emit('agent-status', {
            agentId,
            status: 'running',
            message: 'Agent running in Docker container - Changes will appear in preview',
            containerId: container.containerId,
            sessionId,
            userId
          });
        }
      } else {
        // Use new terminal manager factory for simple PTY mode
        const manager = terminalManagerFactory.getManager(terminalLocation, terminalIsolation);
        
        const terminalOptions: any = {
          agentId,
          userId: userId!,
          teamId: teamId!,
          task,
          location: terminalLocation,
          isolation: terminalIsolation
        };
        if (repositoryUrl !== undefined) {
          terminalOptions.workspaceRepo = repositoryUrl;
        }
        await manager.spawnTerminal(terminalOptions);
        
        console.log(`✅ Agent ${agentId} spawned with ${terminalLocation}/${terminalIsolation} terminal`);

        // Update agent status to running
        await prisma.agents.update({
          where: { id: agentId },
          data: {
            status: 'running',
            output: `Claude agent running with ${terminalLocation}/${terminalIsolation} terminal\nAgent: ${agentId}\n\nExecuting: claude "${task}"\n\nAgent is ready for interactive commands.`
          }
        });
        
        // Notify team that agent is running
        if (teamId && io) {
          io.to(teamId).emit('agent-status', {
            agentId,
            status: 'running',
            message: `Agent running with ${terminalLocation}/${terminalIsolation} terminal`,
            terminalLocation,
            terminalIsolation,
            userId
          });
        }
      }
        
    } catch (processError) {
      console.error(`❌ Docker agent execution failed for agent ${agentId}:`, processError);
      
      const errorMessage = `Agent execution failed: ${processError instanceof Error ? processError.message : 'Unknown error'}`;
      
      await prisma.agents.update({
        where: { id: agentId },
        data: {
          status: 'error',
          output: errorMessage
        }
      });
      
      // Send error message to chat
      await agentChatService.sendAgentErrorMessage(agentId, errorMessage);
      
      // Notify team of error
      const io = getIO();
      if (teamId && io) {
        io.to(teamId).emit('agent-completed', {
          agentId,
          status: 'error',
          error: processError instanceof Error ? processError.message : 'Docker execution failed',
          userId
        });
      }
    }

  } catch (error) {
    console.error(`Agent execution error for ${agentId}:`, error);
    
    const errorMessage = `Execution failed: ${(error as Error).message}`;
    
    try {
      await prisma.agents.update({
        where: { id: agentId },
        data: {
          status: 'error',
          output: errorMessage
        }
      });
      
      // Send error message to chat
      await agentChatService.sendAgentErrorMessage(agentId, errorMessage);
    } catch (updateError) {
      console.error('Failed to update agent error status:', updateError);
    }
  }
}

// Utility functions disabled for now since SSH is not available
// /**
//  * Build Claude command based on agent type and parameters
//  */
// function buildAgentCommand(type: string, task: string, repositoryUrl?: string): string {
//   if (type === 'code-writer') {
//     return repositoryUrl 
//       ? `claude --mode code --repository "${repositoryUrl}" --task "${task}"`
//       : `claude --mode code --task "${task}"`;
//   } else {
//     return `claude --mode general --task "${task}"`;
//   }
// }

// /**
//  * Extract repository name from URL
//  */
// function extractRepoName(repositoryUrl: string): string {
//   const match = repositoryUrl.match(/\/([^\/]+)\.git$/) || repositoryUrl.match(/\/([^\/]+)\/?$/);
//   return match ? match[1] : 'project';
// }

// /**
//  * Get VM host from VM ID (mock implementation)
//  * In production, this would query your VM management system
//  */
// function getVMHost(vmId: string): string | null {
//   const vmHostMap: Record<string, string> = {
//     'vm-001': '10.0.1.10',
//     'vm-002': '10.0.1.11',
//     'vm-003': '10.0.1.12',
//     'vm-004': '10.0.1.13',
//     'vm-005': '10.0.1.14'
//   };
//   
//   return vmHostMap[vmId] || null;
// }

// POST /api/agents/spawn - Spawn new agent
router.post('/spawn', async (req: express.Request, res) => {
  try {
    const { task, agentType, terminalLocation, terminalIsolation } = spawnAgentSchema.parse(req.body);
    
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    // Get user information
    const user = await prisma.users.findUnique({
      where: { id: req.user?.userId },
      include: { teams: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Auto-assign default VM to user if not set (for Docker containers)
    const DEFAULT_VM = { vmId: 'local-docker' };
    if (!user.vmId) {
      await prisma.users.update({
        where: { id: req.user?.userId },
        data: { vmId: DEFAULT_VM.vmId }
      });
      user.vmId = DEFAULT_VM.vmId;
      console.log(`Auto-assigned default VM to user ${req.user?.userId}`);
    }

    // Generate a random name for the agent
    const agentName = generateAgentName();

    // Create agent record
    const agent = await prisma.agents.create({
      data: {
        id: randomUUID(),
        userId: req.user?.userId,
        teamId: user.teamId,
        type: agentType, // Map agentType to type field in DB
        task,
        repositoryUrl: user.teams?.repositoryUrl ?? null, // Use team repository or null for team workspace
        status: 'starting',
        agentName,
        terminalLocation: terminalLocation || 'local',
        terminalIsolation: terminalIsolation || 'none',
        updatedAt: new Date()
      },
      include: {
        users: { select: { userName: true } }
      }
    });

    // Start agent execution asynchronously
    executeAgentAsync(
      agent.id, 
      user.vmId, 
      agentType, 
      task,
      terminalLocation || 'local',
      terminalIsolation || 'none',
      user.teams?.repositoryUrl || undefined,
      req.user?.userId,
      user.teamId
    );

    // Broadcast agent creation to all team members via WebSocket
    const io = getIO();
    if (io) {
      console.log(`🚀 Broadcasting agent-spawned event to team: ${user.teamId}, agent: ${agent.id}`);
      io.to(user.teamId).emit('agent-spawned', {
        agent: {
          id: agent.id,
          task: agent.task,
          status: agent.status,
          type: agent.type,
          teamId: agent.teamId,
          userId: agent.userId,
          userName: agent.users.userName,
          agentName: agent.agentName || generateAgentName(),
          repositoryUrl: agent.repositoryUrl,
          lastActivity: agent.createdAt.toISOString(),
          outputLines: 0,
          isOwner: req.user?.userId === agent.userId,
          output: agent.output || ''
        }
      });
    } else {
      console.error('❌ No WebSocket server instance available for broadcasting');
    }

    res.status(201).json({
      message: 'Agent spawned successfully',
      agent: {
        id: agent.id,
        task: agent.task,
        status: agent.status,
        agentType: agent.type,
        teamId: agent.teamId,
        userId: agent.userId,
        startedAt: agent.createdAt.toISOString(),
        userName: agent.users.userName,
        agentName: agent.agentName || generateAgentName(),
        outputLines: 0,
        isOwner: true
      }
    });

  } catch (error) {
    console.error('Spawn agent error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input data', details: error.errors });
    }
    
    res.status(500).json({ error: 'Failed to spawn agent' });
  }
});

// GET /api/agents/:id/container - Get container info for an agent
router.get('/:id/container', async (req: express.Request, res) => {
  try {
    const { id: agentId } = req.params;
    const userId = req.user?.userId;
    const teamId = req.user?.teamId;

    if (!userId || !teamId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Check if agent exists and belongs to user's team
    const agent = await prisma.agents.findFirst({
      where: {
        ...(agentId && { id: agentId }),
        teamId: teamId
      }
    });

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found or access denied' });
    }

    // Get container info from database
    const containerInstance = await prisma.container_instances.findFirst({
      where: {
        agentId: agentId!,
        type: 'user-claude-agent'
      }
    });

    if (!containerInstance) {
      return res.status(404).json({ message: 'No container found for this agent' });
    }

    // Get live container status if available
    let liveStatus = null;
    if (containerInstance.containerId) {
      try {
        liveStatus = await dockerManager.getContainerStatus(containerInstance.containerId);
      } catch (error) {
        console.warn(`Could not get live status for container ${containerInstance.containerId}:`, error);
      }
    }

    res.json({
      agentId,
      container: {
        id: containerInstance.id,
        containerId: containerInstance.containerId,
        status: (liveStatus as any)?.status || containerInstance.status,
        terminalPort: containerInstance.terminalPort,
        metadata: containerInstance.metadata,
        createdAt: containerInstance.createdAt.toISOString(),
        updatedAt: containerInstance.updatedAt.toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching agent container info:', error);
    res.status(500).json({ message: 'Failed to fetch container information' });
  }
});

// POST /api/agents/:id/container/exec - Execute command in agent container
router.post('/:id/container/exec', async (req: express.Request, res) => {
  try {
    const { id: agentId } = req.params;
    const { command } = req.body;
    const userId = req.user?.userId;
    const teamId = req.user?.teamId;

    if (!userId || !teamId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!command || typeof command !== 'string') {
      return res.status(400).json({ message: 'Command is required and must be a string' });
    }

    // Check if agent exists and belongs to user's team
    const agent = await prisma.agents.findFirst({
      where: {
        ...(agentId && { id: agentId }),
        teamId: teamId
      }
    });

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found or access denied' });
    }

    // Get container info
    const containerInstance = await prisma.container_instances.findFirst({
      where: {
        agentId: agentId!,
        type: 'user-claude-agent'
      }
    });

    if (!containerInstance?.containerId) {
      return res.status(404).json({ message: 'No running container found for this agent' });
    }

    // Execute command in container
    const result = await dockerManager.execCommand(containerInstance.containerId, command);

    res.json({
      agentId,
      command,
      result: {
        stdout: result.stdout,
        stderr: result.stderr
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error executing command in container:', error);
    res.status(500).json({ 
      message: error instanceof Error ? error.message : 'Failed to execute command in container'
    });
  }
});

// DELETE /api/agents/:id/container - Stop and remove agent container
router.delete('/:id/container', async (req: express.Request, res) => {
  try {
    const { id: agentId } = req.params;
    const userId = req.user?.userId;
    const teamId = req.user?.teamId;

    if (!userId || !teamId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Check if agent exists and belongs to user's team
    const agent = await prisma.agents.findFirst({
      where: {
        ...(agentId && { id: agentId }),
        teamId: teamId
      }
    });

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found or access denied' });
    }

    // Get container info
    const containerInstance = await prisma.container_instances.findFirst({
      where: {
        agentId: agentId!,
        type: 'user-claude-agent'
      }
    });

    if (!containerInstance?.containerId) {
      return res.json({ message: 'No container found for this agent' });
    }

    // Stop the container
    await dockerManager.stopContainer(containerInstance.containerId);

    // Update agent status
    await prisma.agents.update({
      where: { id: agentId! },
      data: { 
        status: 'stopped',
        output: (agent.output || '') + '\n\nContainer stopped by user'
      }
    });

    res.json({
      message: 'Agent container stopped successfully',
      agentId,
      containerId: containerInstance.containerId
    });

  } catch (error) {
    console.error('Error stopping agent container:', error);
    res.status(500).json({ message: 'Failed to stop agent container' });
  }
});

// GET /api/agents/:id/terminal-history - Get terminal history for an agent
router.get('/:id/terminal-history', async (req: express.Request, res) => {
  try {
    const { id: agentId } = req.params;
    const userId = req.user?.userId;
    const teamId = req.user?.teamId;

    if (!userId || !teamId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Check if agent exists and belongs to user's team
    const agent = await prisma.agents.findFirst({
      where: {
        ...(agentId && { id: agentId }),
        teamId: teamId
      }
    });

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found or access denied' });
    }

    // Get terminal history ordered by timestamp
    const history = await prisma.terminal_history.findMany({
      where: {
        agentId: agentId!
      },
      orderBy: {
        timestamp: 'asc'
      },
      take: 5000 // Limit to last 5000 entries to prevent huge responses
    });

    res.json({
      agentId,
      history: history.map(entry => ({
        id: entry.id,
        output: entry.output,
        type: entry.type,
        timestamp: entry.timestamp.toISOString()
      })),
      totalEntries: history.length
    });

  } catch (error) {
    console.error('Error fetching terminal history:', error);
    res.status(500).json({ message: 'Failed to fetch terminal history' });
  }
});

// GET /api/agents - List team's agents with filtering
router.get('/', async (req: express.Request, res) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    // Parse query parameters for filtering
    const { status, type, limit } = req.query;
    const limitNum = limit ? parseInt(limit as string, 10) : 50;

    // Get user's team ID first
    const user = await prisma.users.findUnique({
      where: { id: req.user?.userId },
      select: { teamId: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const whereClause: any = { 
      users: {
        teamId: user.teamId // Show all team agents, not just user's agents
      }
    };
    
    if (status) {
      whereClause.status = status;
    }
    
    if (type) {
      whereClause.type = type;
    }

    const agents = await prisma.agents.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limitNum, 100), // Cap at 100 for performance
      include: {
        users: { select: { userName: true } }
      }
    });

    res.json({
      agents: agents.map(agent => ({
        id: agent.id,
        task: agent.task,
        status: agent.status,
        agentType: agent.type,
        teamId: agent.teamId,
        userId: agent.userId,
        startedAt: agent.createdAt.toISOString(),
        completedAt: agent.status === 'completed' ? agent.updatedAt.toISOString() : undefined,
        userName: agent.users.userName,
        agentName: agent.agentName || generateAgentName(),
        outputLines: agent.output ? agent.output.split('\n').length : 0,
        isOwner: agent.userId === req.user?.userId
      }))
    });

  } catch (error) {
    console.error('List agents error:', error);
    res.status(500).json({ error: 'Failed to list agents' });
  }
});

// Get Claude Code status for an agent
router.get('/:agentId/claude-status', async (req: express.Request, res) => {
  try {
    const { agentId } = req.params;
    
    // Get agent to verify ownership/team access
    const agent = await prisma.agents.findFirst({
      where: { 
        id: agentId!,
        OR: [
          { userId: req.user?.userId! },
          { teams: { users: { some: { id: req.user?.userId! } } } }
        ]
      },
      include: { users: true, teams: true }
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Check Claude Code process status via SSH
    const { sshService } = await import('../../services/ssh.js');
    const user = await prisma.users.findUnique({ where: { id: req.user?.userId! } });
    const vmId = user?.vmId || 'main-ec2';
    
    try {
      // Check if Claude process exists for this agent
      const processCheck = await sshService.executeCommand(vmId, {
        command: `pgrep -f "claude.*${agentId}" && echo "RUNNING" || echo "STOPPED"`,
        timeout: 5000
      });
      
      // Check if Claude is actively processing (recent activity in log)
      const activityCheck = await sshService.executeCommand(vmId, {
        command: `if [ -f /tmp/claude-${agentId}.log ]; then tail -1 /tmp/claude-${agentId}.log; else echo "No log found"; fi`,
        timeout: 5000
      });
      
      const claudeStatus = {
        isRunning: processCheck.stdout.includes('RUNNING'),
        lastActivity: activityCheck.stdout || 'No recent activity',
        agentId,
        status: agent.status
      };
      
      res.json(claudeStatus);
      
    } catch (sshError) {
      console.error(`SSH error checking Claude status for ${agentId}:`, sshError);
      res.json({
        isRunning: false,
        lastActivity: 'Cannot connect to VM',
        agentId,
        status: agent.status
      });
    }
    
  } catch (error) {
    console.error('Claude status check error:', error);
    res.status(500).json({ error: 'Failed to check Claude status' });
  }
});


// GET /api/agents/:id - Get agent details
router.get('/:id', async (req: express.Request, res) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const agentId = req.params['id']!;

    // Get user's team ID first
    const user = await prisma.users.findUnique({
      where: { id: req.user?.userId },
      select: { teamId: true }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Get agent with user permission check (user can see own agents or team member's agents)
    const agent = await prisma.agents.findFirst({
      where: {
        id: agentId,
        OR: [
          { userId: req.user?.userId }, // User's own agent
          { teamId: user.teamId }  // Or same team member's agent
        ]
      },
      include: {
        users: { select: { userName: true } }
      }
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found or access denied' });
    }

    res.json({
      agent: {
        id: agent.id,
        task: agent.task,
        status: agent.status,
        agentType: agent.type,
        teamId: agent.teamId,
        userId: agent.userId,
        startedAt: agent.createdAt.toISOString(),
        completedAt: agent.status === 'completed' ? agent.updatedAt.toISOString() : undefined,
        userName: agent.users.userName,
        agentName: agent.agentName || generateAgentName(),
        output: agent.output ? agent.output.split('\n').map((line, index) => ({ 
          timestamp: new Date(agent.updatedAt.getTime() + index * 1000).toISOString(), 
          line 
        })) : [],
        outputLines: agent.output ? agent.output.split('\n').length : 0,
        isOwner: agent.userId === req.user?.userId
      }
    });

  } catch (error) {
    console.error('Get agent error:', error);
    res.status(500).json({ error: 'Failed to get agent details' });
  }
});

// POST /api/agents/:id/input - Send input to agent
router.post('/:id/input', async (req: express.Request, res) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const agentId = req.params['id']!;
    const { input } = req.body;

    if (!input || typeof input !== 'string') {
      return res.status(400).json({ error: 'Input is required and must be a string' });
    }

    // Verify agent exists and is accessible to user (same team)
    const user = await prisma.users.findUnique({
      where: { id: req.user?.userId },
      select: { teamId: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const agent = await prisma.agents.findFirst({
      where: {
        id: agentId,
        users: { teamId: user.teamId }
      }
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found or access denied' });
    }

    // In a real implementation, this would send input to the running agent process
    // For now, we'll just acknowledge the input
    console.log(`Input sent to agent ${agentId}: ${input}`);

    res.json({
      message: 'Input sent to agent successfully'
    });

  } catch (error) {
    console.error('Send agent input error:', error);
    res.status(500).json({ error: 'Failed to send input to agent' });
  }
});

// POST /api/agents/:id/signal - Send signal to agent
router.post('/:id/signal', async (req: express.Request, res) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const agentId = req.params['id']!;
    const { signal } = req.body;

    if (!signal || typeof signal !== 'string') {
      return res.status(400).json({ error: 'Signal is required and must be a string' });
    }

    // Verify agent exists and is accessible to user (same team)
    const user = await prisma.users.findUnique({
      where: { id: req.user?.userId },
      select: { teamId: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const agent = await prisma.agents.findFirst({
      where: {
        id: agentId,
        users: { teamId: user.teamId }
      }
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found or access denied' });
    }

    // In a real implementation, this would send a signal to the running agent process
    // Common signals: SIGTERM, SIGKILL, SIGINT
    console.log(`Signal sent to agent ${agentId}: ${signal}`);

    res.json({
      message: `Signal ${signal} sent to agent successfully`
    });

  } catch (error) {
    console.error('Send agent signal error:', error);
    res.status(500).json({ error: 'Failed to send signal to agent' });
  }
});

// DELETE /api/agents/:id - Delete a specific agent
router.delete('/:id', async (req: express.Request, res) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const agentId = req.params['id']!;

    // Verify agent exists and is accessible to user (same team)
    const user = await prisma.users.findUnique({
      where: { id: req.user?.userId },
      select: { teamId: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const agent = await prisma.agents.findFirst({
      where: {
        id: agentId,
        users: { teamId: user.teamId }
      },
      include: { users: true }
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found or access denied' });
    }

    // Kill tmux session if running
    if (agent.status === 'running') {
      try {
        // TODO: Kill tmux session via SSH
        console.log(`🗑️ Would kill tmux session claude-${agentId}`);
      } catch (killError) {
        console.warn(`Failed to kill agent session ${agentId}:`, killError);
      }
    }

    // Delete the agent from database
    await prisma.agents.delete({
      where: { id: agentId }
    });

    // Notify team via WebSocket
    const io = getIO();
    if (user.teamId && io) {
      io.to(user.teamId).emit('agent-deleted', {
        agentId,
        userId: req.user?.userId
      });
    }

    console.log(`✅ Deleted agent ${agentId}`);

    res.json({
      message: 'Agent deleted successfully',
      agentId
    });

  } catch (error) {
    console.error('Delete agent error:', error);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

// DELETE /api/agents - Delete all agents for user's team
router.delete('/', async (req: express.Request, res) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    // Get user's team
    const user = await prisma.users.findUnique({
      where: { id: req.user?.userId },
      select: { teamId: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all agents in the team
    const agents = await prisma.agents.findMany({
      where: {
        users: { teamId: user.teamId }
      },
      select: { id: true, status: true }
    });

    // Kill all running tmux sessions
    for (const agent of agents) {
      if (agent.status === 'running') {
        try {
          // TODO: Kill tmux session via SSH
          console.log(`🗑️ Would kill tmux session claude-${agent.id}`);
        } catch (killError) {
          console.warn(`Failed to kill agent session ${agent.id}:`, killError);
        }
      }
    }

    // Delete all agents for the team
    const deleteResult = await prisma.agents.deleteMany({
      where: {
        users: { teamId: user.teamId }
      }
    });

    // Notify team via WebSocket
    const io = getIO();
    if (user.teamId && io) {
      io.to(user.teamId).emit('all-agents-deleted', {
        deletedCount: deleteResult.count,
        userId: req.user?.userId
      });
    }

    console.log(`✅ Deleted ${deleteResult.count} agents for team ${user.teamId}`);

    res.json({
      message: `Successfully deleted ${deleteResult.count} agents`,
      deletedCount: deleteResult.count
    });

  } catch (error) {
    console.error('Delete all agents error:', error);
    res.status(500).json({ error: 'Failed to delete agents' });
  }
});

// GET /api/agents/:id/session-status - Check tmux session status
router.get('/:id/session-status', async (req: express.Request, res) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const agentId = req.params['id']!;

    // Get user's team ID first
    const user = await prisma.users.findUnique({
      where: { id: req.user?.userId },
      select: { teamId: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get agent with session info
    const agent = await prisma.agents.findFirst({
      where: {
        id: agentId,
        users: { teamId: user.teamId }
      },
      select: {
        id: true,
        status: true,
        tmuxSessionName: true,
        isSessionPersistent: true,
        terminalIsolation: true,
        userId: true
      }
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found or access denied' });
    }

    // Check if tmux session actually exists (if it's a tmux agent)
    let tmuxSessionExists = false;
    if (agent.tmuxSessionName && agent.terminalIsolation === 'tmux') {
      try {
        const { spawn } = await import('child_process');
        const tmuxCheck = spawn('tmux', ['has-session', '-t', agent.tmuxSessionName]);
        
        await new Promise((resolve) => {
          tmuxCheck.on('close', (code) => {
            tmuxSessionExists = code === 0;
            resolve(undefined);
          });
          tmuxCheck.on('error', () => {
            tmuxSessionExists = false;
            resolve(undefined);
          });
        });
      } catch {
        tmuxSessionExists = false;
      }
    }

    res.json({
      agentId: agent.id,
      status: agent.status,
      sessionInfo: {
        sessionName: agent.tmuxSessionName,
        isPersistent: agent.isSessionPersistent,
        isolation: agent.terminalIsolation,
        tmuxSessionExists: tmuxSessionExists,
        canReconnect: tmuxSessionExists && agent.isSessionPersistent
      },
      isOwner: agent.userId === req.user?.userId
    });

  } catch (error) {
    console.error('Get session status error:', error);
    res.status(500).json({ error: 'Failed to get session status' });
  }
});

// POST /api/agents/:id/reconnect - Reconnect to existing tmux session
router.post('/:id/reconnect', async (req: express.Request, res) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const agentId = req.params['id']!;

    // Get user info
    const user = await prisma.users.findUnique({
      where: { id: req.user?.userId },
      select: { teamId: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get agent
    const agent = await prisma.agents.findFirst({
      where: {
        id: agentId,
        users: { teamId: user.teamId }
      }
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found or access denied' });
    }

    if (!agent.isSessionPersistent || !agent.tmuxSessionName) {
      return res.status(400).json({ error: 'Agent does not have a persistent session' });
    }

    // Try to reconnect via terminal manager
    const manager = terminalManagerFactory.getManager('local', 'tmux');
    
    try {
      // This will attempt to attach to the existing session
      const terminalOptions: any = {
        agentId: agent.id,
        userId: req.user?.userId!,
        teamId: user.teamId,
        task: agent.task,
        location: 'local',
        isolation: 'tmux'
      };
      if (agent.repositoryUrl) {
        terminalOptions.workspaceRepo = agent.repositoryUrl;
      }
      // Spawn terminal for reconnection - don't need to store session result
      await manager.spawnTerminal(terminalOptions);

      // Update agent status to running if reconnection successful
      await prisma.agents.update({
        where: { id: agentId },
        data: { status: 'running' }
      });

      res.json({
        message: 'Successfully reconnected to agent session',
        agentId: agent.id,
        sessionName: agent.tmuxSessionName,
        status: 'running'
      });

    } catch (reconnectError) {
      console.error(`Failed to reconnect to agent ${agentId}:`, reconnectError);
      res.status(500).json({ 
        error: 'Failed to reconnect to session',
        details: reconnectError instanceof Error ? reconnectError.message : 'Unknown error'
      });
    }

  } catch (error) {
    console.error('Reconnect session error:', error);
    res.status(500).json({ error: 'Failed to reconnect to session' });
  }
});

// GET /api/agents/tmux-sessions - List all ColabVibe tmux sessions (debug endpoint)
router.get('/tmux-sessions', async (req: express.Request, res) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    // Get user's team
    const user = await prisma.users.findUnique({
      where: { id: req.user?.userId },
      select: { teamId: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get tmux manager and list sessions
    const manager = terminalManagerFactory.getManager('local', 'tmux');
    
    if ('listColabVibeSessions' in manager) {
      const sessions = await (manager as any).listColabVibeSessions();
      
      // Get corresponding database records
      const dbAgents = await prisma.agents.findMany({
        where: {
          users: { teamId: user.teamId },
          tmuxSessionName: { not: null }
        },
        select: {
          id: true,
          tmuxSessionName: true,
          isSessionPersistent: true,
          status: true,
          agentName: true,
          task: true,
          userId: true
        }
      });

      res.json({
        tmuxSessions: sessions,
        dbAgents: dbAgents,
        summary: {
          totalTmuxSessions: sessions.length,
          totalDbAgents: dbAgents.length
        }
      });
    } else {
      res.status(400).json({ error: 'Tmux manager not available' });
    }

  } catch (error) {
    console.error('List tmux sessions error:', error);
    res.status(500).json({ error: 'Failed to list tmux sessions' });
  }
});

export default router;
