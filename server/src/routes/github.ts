/**
 * GitHub Routes for Repository Management
 * 
 * Requirements:
 * - List user's GitHub repositories
 * - Search repositories
 * - Set team repository
 * - Get repository details
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { createGitHubService, hasGitHubIntegration } from '../../services/github.js';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/github/repositories - List user's repositories
router.get('/repositories', authenticateToken, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user has GitHub integration
    const hasIntegration = await hasGitHubIntegration(req.userId);
    if (!hasIntegration) {
      return res.status(400).json({ 
        error: 'GitHub not connected',
        message: 'Please connect your GitHub account first'
      });
    }

    // Get query parameters
    const { 
      type,
      sort = 'updated',
      per_page = '30',
      page = '1'
    } = req.query;

    const githubService = createGitHubService(req.userId);
    const params: any = {
      sort: sort as 'created' | 'updated' | 'pushed' | 'full_name',
      per_page: parseInt(per_page as string),
      page: parseInt(page as string)
    };

    // Only include type if explicitly specified
    if (type && ['all', 'owner', 'member'].includes(type as string)) {
      params.type = type as 'all' | 'owner' | 'member';
    }

    const repositories = await githubService.getUserRepositories(params);

    res.json({
      repositories,
      total: repositories.length,
      page: parseInt(page as string)
    });

  } catch (error: any) {
    console.error('Failed to fetch repositories:', error);
    res.status(500).json({ 
      error: 'Failed to fetch repositories',
      message: error.message
    });
  }
});

// GET /api/github/search - Search repositories
router.get('/search', authenticateToken, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { q, per_page = '10', page = '1' } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const hasIntegration = await hasGitHubIntegration(req.userId);
    if (!hasIntegration) {
      return res.status(400).json({ 
        error: 'GitHub not connected',
        message: 'Please connect your GitHub account first'
      });
    }

    const githubService = createGitHubService(req.userId);
    const repositories = await githubService.searchRepositories(
      q as string,
      {
        per_page: parseInt(per_page as string),
        page: parseInt(page as string)
      }
    );

    res.json({
      repositories,
      query: q,
      total: repositories.length
    });

  } catch (error: any) {
    console.error('Search repositories error:', error);
    res.status(500).json({ 
      error: 'Failed to search repositories',
      message: error.message
    });
  }
});

// GET /api/github/repository/:owner/:repo - Get specific repository
router.get('/repository/:owner/:repo', authenticateToken, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { owner, repo } = req.params;

    if (!owner || !repo) {
      return res.status(400).json({ error: 'Owner and repo parameters are required' });
    }

    const hasIntegration = await hasGitHubIntegration(req.userId);
    if (!hasIntegration) {
      return res.status(400).json({ 
        error: 'GitHub not connected',
        message: 'Please connect your GitHub account first'
      });
    }

    const githubService = createGitHubService(req.userId);
    const repository = await githubService.getRepository(owner, repo);
    
    // Also get branches
    const branches = await githubService.getRepositoryBranches(owner, repo);

    res.json({
      repository,
      branches
    });

  } catch (error: any) {
    console.error('Get repository error:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch repository',
      message: error.message
    });
  }
});

// POST /api/github/set-team-repository - Set team's repository
router.post('/set-team-repository', authenticateToken, async (req, res) => {
  try {
    if (!req.userId || !req.user?.teamId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { repositoryUrl } = req.body;

    if (!repositoryUrl) {
      return res.status(400).json({ error: 'Repository URL is required' });
    }

    // Validate repository URL format
    const githubUrlPattern = /^https:\/\/github\.com\/[\w-]+\/[\w.-]+$/;
    if (!githubUrlPattern.test(repositoryUrl)) {
      return res.status(400).json({ error: 'Invalid GitHub repository URL' });
    }

    // Extract owner and repo from URL
    const urlParts = repositoryUrl.replace('https://github.com/', '').split('/');
    const owner = urlParts[0];
    const repo = urlParts[1].replace('.git', '');

    // Verify user has access to this repository
    const githubService = createGitHubService(req.userId);
    const hasAccess = await githubService.hasRepositoryAccess(owner, repo);

    if (!hasAccess) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'You do not have access to this repository'
      });
    }

    // Update team's repository URL
    const team = await prisma.teams.update({
      where: { id: req.user.teamId },
      data: { repositoryUrl }
    });

    res.json({
      message: 'Team repository updated successfully',
      team: {
        id: team.id,
        name: team.name,
        repositoryUrl: team.repositoryUrl
      }
    });

  } catch (error: any) {
    console.error('Set team repository error:', error);
    res.status(500).json({ 
      error: 'Failed to set team repository',
      message: error.message
    });
  }
});

// GET /api/github/profile - Get user's GitHub profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const hasIntegration = await hasGitHubIntegration(req.userId);
    if (!hasIntegration) {
      return res.status(400).json({ 
        error: 'GitHub not connected',
        message: 'Please connect your GitHub account first'
      });
    }

    const githubService = createGitHubService(req.userId);
    const profile = await githubService.getUserProfile();

    res.json({ profile });

  } catch (error: any) {
    console.error('Get GitHub profile error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch GitHub profile',
      message: error.message
    });
  }
});

// GET /api/github/status - Check GitHub integration status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const hasIntegration = await hasGitHubIntegration(req.userId);
    
    if (!hasIntegration) {
      return res.json({ 
        connected: false,
        message: 'GitHub account not connected'
      });
    }

    // Validate token is still valid
    const githubService = createGitHubService(req.userId);
    const isValid = await githubService.validateToken();

    if (!isValid) {
      return res.json({
        connected: false,
        message: 'GitHub token expired or invalid',
        needsReconnect: true
      });
    }

    // Get user's GitHub info
    const user = await prisma.users.findUnique({
      where: { id: req.userId },
      select: { githubUsername: true, avatarUrl: true }
    });

    res.json({
      connected: true,
      githubUsername: user?.githubUsername,
      avatarUrl: user?.avatarUrl
    });

  } catch (error: any) {
    console.error('GitHub status check error:', error);
    res.status(500).json({ 
      error: 'Failed to check GitHub status',
      message: error.message
    });
  }
});

export default router;