/**
 * Team Management Routes
 * 
 * Handles team information and member management with JWT authentication
 * Requirements:
 * - Get team information and members
 * - Get all team agents
 * - Use JWT authentication middleware
 * - Use Prisma client for database operations
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import { createAuthHandler } from '../types/express.js';
// Module augmentation for Express Request is automatically loaded from types/express-ext.d.ts

const router = express.Router();
const prisma = new PrismaClient();

// Using Express module augmentation from types/express-ext.d.ts
// No need for custom AuthRequest interface

// Apply JWT authentication middleware to all routes
router.use(authenticateToken);

// POST /api/team/repository - Update team repository URL
router.post('/repository', createAuthHandler(async (req, res) => {
  try {
    const teamId = req.user?.teamId;
    if (!teamId) {
      return res.status(401).json({ error: 'Team ID not found' });
    }

    const { repositoryUrl } = req.body;
    if (!repositoryUrl) {
      return res.status(400).json({ error: 'Repository URL is required' });
    }

    // Update team repository
    const updatedTeam = await prisma.teams.update({
      where: { id: teamId },
      data: { repositoryUrl }
    });

    res.json({
      message: 'Repository URL updated successfully',
      repositoryUrl: updatedTeam.repositoryUrl
    });

  } catch (error) {
    console.error('Update repository error:', error);
    res.status(500).json({ error: 'Failed to update repository URL' });
  }
}));

// GET /api/team/info - Get team information and members
router.get('/info', createAuthHandler(async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    // Get user's team information
    const user = await prisma.users.findUnique({
      where: { id: req.userId },
      include: {
        teams: {
          include: {
            users: {
              select: {
                id: true,
                userName: true,
                email: true,
                vmId: true,
                createdAt: true
              },
              orderBy: { createdAt: 'asc' } // Show team creator first
            }
          }
        }
      }
    });

    if (!user || !user.teams) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json({
      team: {
        id: user.teams.id,
        name: user.teams.name,
        teamCode: user.teams.teamCode,
        createdAt: user.teams.createdAt,
        memberCount: user.teams.users.length,
        members: user.teams.users.map(member => ({
          id: member.id,
          userName: member.userName,
          email: member.email,
          vmId: member.vmId,
          joinedAt: member.createdAt,
          isCurrentUser: member.id === req.userId,
          hasVmAssigned: !!member.vmId
        }))
      }
    });

  } catch (error) {
    console.error('Get team info error:', error);
    res.status(500).json({ error: 'Failed to get team information' });
  }
}));

// GET /api/team/agents - Get all team agents
router.get('/agents', createAuthHandler(async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    // Parse query parameters for filtering
    const { status, type, userId, limit } = req.query;
    const limitNum = limit ? parseInt(limit as string, 10) : 50;

    // Get user's team ID
    const user = await prisma.users.findUnique({
      where: { id: req.userId },
      select: { teamId: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build where clause for filtering
    const whereClause: any = {
      users: {
        teamId: user.teamId
      }
    };

    if (status) {
      whereClause.status = status;
    }

    if (type) {
      whereClause.type = type;
    }

    if (userId) {
      whereClause.userId = userId;
    }

    // Get all agents from team members
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
        type: agent.type,
        task: agent.task,
        repositoryUrl: agent.repositoryUrl,
        status: agent.status,
        output: agent.output.slice(0, 500), // Truncate long outputs for list view
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
        userName: agent.users.userName,
        isOwner: agent.userId === req.userId
      }))
    });

  } catch (error) {
    console.error('Get team agents error:', error);
    res.status(500).json({ error: 'Failed to get team agents' });
  }
}));

// GET /api/team/stats - Get team statistics
router.get('/stats', createAuthHandler(async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    // Get user's team ID
    const user = await prisma.users.findUnique({
      where: { id: req.userId },
      select: { teamId: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get team statistics
    const [
      totalMembers,
      totalAgents,
      activeAgents,
      completedAgents,
      stoppedAgents
    ] = await Promise.all([
      prisma.users.count({
        where: { teamId: user.teamId }
      }),
      prisma.agents.count({
        where: { users: { teamId: user.teamId } }
      }),
      prisma.agents.count({
        where: { 
          users: { teamId: user.teamId },
          status: 'running'
        }
      }),
      prisma.agents.count({
        where: { 
          users: { teamId: user.teamId },
          status: 'completed'
        }
      }),
      prisma.agents.count({
        where: { 
          users: { teamId: user.teamId },
          status: 'stopped'
        }
      })
    ]);

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentAgents = await prisma.agents.count({
      where: {
        users: { teamId: user.teamId },
        createdAt: { gte: sevenDaysAgo }
      }
    });

    // Get members with VM assignments
    const membersWithVms = await prisma.users.count({
      where: {
        teamId: user.teamId,
        vmId: { not: null }
      }
    });

    res.json({
      stats: {
        totalMembers,
        membersWithVms,
        totalAgents,
        activeAgents,
        completedAgents,
        stoppedAgents,
        errorAgents: totalAgents - activeAgents - completedAgents - stoppedAgents,
        recentActivity: recentAgents
      }
    });

  } catch (error) {
    console.error('Get team stats error:', error);
    res.status(500).json({ error: 'Failed to get team statistics' });
  }
}));

// GET /api/team/members - Get team members (detailed view)
router.get('/members', createAuthHandler(async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    // Get user's team ID
    const user = await prisma.users.findUnique({
      where: { id: req.userId },
      select: { teamId: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all team members with their agent statistics
    const members = await prisma.users.findMany({
      where: { teamId: user.teamId },
      select: {
        id: true,
        userName: true,
        email: true,
        vmId: true,
        createdAt: true,
        _count: {
          select: {
            agents: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Get agent statistics for each member
    const membersWithStats = await Promise.all(
      members.map(async (member) => {
        const [activeAgents, completedAgents] = await Promise.all([
          prisma.agents.count({
            where: {
              userId: member.id,
              status: 'running'
            }
          }),
          prisma.agents.count({
            where: {
              userId: member.id,
              status: 'completed'
            }
          })
        ]);

        return {
          id: member.id,
          userName: member.userName,
          email: member.email,
          vmId: member.vmId,
          joinedAt: member.createdAt,
          isCurrentUser: member.id === req.userId,
          hasVmAssigned: !!member.vmId,
          agentStats: {
            total: member._count.agents,
            active: activeAgents,
            completed: completedAgents
          }
        };
      })
    );

    res.json({
      members: membersWithStats
    });

  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({ error: 'Failed to get team members' });
  }
}));

// POST /api/team/configure-repository - Configure team repository
router.post('/configure-repository', createAuthHandler(async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const { repositoryUrl } = req.body;

    if (!repositoryUrl || typeof repositoryUrl !== 'string') {
      return res.status(400).json({ error: 'repositoryUrl is required and must be a string' });
    }

    // Basic URL validation
    try {
      new URL(repositoryUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid repository URL format' });
    }

    // Get user's team
    const user = await prisma.users.findUnique({
      where: { id: req.userId },
      select: { teamId: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update team with repository URL
    const updatedTeam = await prisma.teams.update({
      where: { id: user.teamId },
      data: { repositoryUrl }
    });

    res.json({
      message: 'Repository configured successfully',
      team: {
        id: updatedTeam.id,
        name: updatedTeam.name,
        inviteCode: updatedTeam.teamCode,
        repositoryUrl: updatedTeam.repositoryUrl
      }
    });

  } catch (error) {
    console.error('Configure repository error:', error);
    res.status(500).json({ error: 'Failed to configure repository' });
  }
}));

export default router;