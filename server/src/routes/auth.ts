/**
 * Authentication Routes
 * 
 * Handles user registration, login, and team joining with bcrypt password hashing
 * Requirements:
 * - Use bcrypt for password hashing
 * - Generate JWT tokens with 24h expiration
 * - Handle user registration with team creation
 * - Handle login validation
 * - Handle team joining via team code
 * - Return appropriate user and team data
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import passport from '../config/passport.js';
import { cryptoService } from '../../services/crypto.js';

// Import module augmentation for Express types
import { createAuthHandler } from '../types/express.js';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env['JWT_SECRET'] || 'fallback-secret-key';
const FRONTEND_URL = process.env['FRONTEND_URL'] || 'http://localhost:3000';

// Password validation - minimum 6 characters for security
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters long');

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  userName: z.string().min(2, 'Username must be at least 2 characters').max(50, 'Username must be less than 50 characters'),
  password: passwordSchema,
  teamName: z.string().min(2, 'Team name must be at least 2 characters').max(100, 'Team name must be less than 100 characters')
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: passwordSchema
});

// const joinTeamSchema = z.object({
//   email: z.string().email('Invalid email format'),
//   userName: z.string().min(2, 'Username must be at least 2 characters').max(50, 'Username must be less than 50 characters'),
//   password: passwordSchema,
//   teamCode: z.string().min(6, 'Team code must be at least 6 characters').max(10, 'Team code must be less than 10 characters')
// });

/**
 * Generate JWT token with 24h expiration
 */
const generateToken = (userId: string, teamId: string): string => {
  return jwt.sign(
    { userId, teamId },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

/**
 * Generate random team code (6 characters, alphanumeric uppercase)
 */
const generateTeamCode = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

/**
 * Hash password using bcrypt with salt rounds = 12
 */
const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

/**
 * Verify password against hash using bcrypt
 */
const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

// POST /api/auth/register - Create new user and team
router.post('/register', async (req, res) => {
  try {
    const { email, userName, password, teamName } = registerSchema.parse(req.body);
    
    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Generate unique team code
    let teamCode: string;
    let codeExists = true;
    
    do {
      teamCode = generateTeamCode();
      const existingTeam = await prisma.teams.findUnique({
        where: { teamCode }
      });
      codeExists = !!existingTeam;
    } while (codeExists);

    // Create team and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const team = await tx.teams.create({
        data: {
          id: crypto.randomUUID(),
          name: teamName,
          teamCode: teamCode!,
          updatedAt: new Date()
        }
      });

      const user = await tx.users.create({
        data: {
          id: crypto.randomUUID(),
          email,
          userName,
          password: hashedPassword,
          teamId: team.id,
          updatedAt: new Date()
        }
      });

      return { user, team };
    });

    const token = generateToken(result.user.id, result.team.id);

    res.status(201).json({
      message: 'Team and user created successfully',
      token,
      user: {
        id: result.user.id,
        name: result.user.userName, // Client expects 'name'
        email: result.user.email,
        teamId: result.team.id,
        hasVMConfig: !!result.user.vmId
      },
      team: {
        id: result.team.id,
        name: result.team.name,
        inviteCode: result.team.teamCode, // Client expects 'inviteCode'
        repositoryUrl: result.team.repositoryUrl
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid input data', 
        details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/login - Login existing user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    
    // Find user with team information
    const user = await prisma.users.findUnique({
      where: { email },
      include: { teams: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password!);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user.id, user.teamId);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.userName, // Client expects 'name'
        email: user.email,
        teamId: user.teamId,
        hasVMConfig: !!user.vmId
      },
      team: {
        id: user.teams.id,
        name: user.teams.name,
        inviteCode: user.teams.teamCode, // Client expects 'inviteCode'
        repositoryUrl: user.teams.repositoryUrl
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid input data', 
        details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// POST /api/auth/join - Join existing team
router.post('/join', async (req, res) => {
  try {
    const { email, userName, password, inviteCode } = req.body; // Client sends inviteCode, not teamCode
    
    // Basic validation
    if (!email || !userName || !password || !inviteCode) {
      return res.status(400).json({ error: 'Email, userName, password, and inviteCode are required' });
    }

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Find team by code (case insensitive)
    const team = await prisma.teams.findUnique({
      where: { teamCode: inviteCode.toUpperCase() }
    });

    if (!team) {
      return res.status(404).json({ error: 'Invalid invite code' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.users.create({
      data: {
        id: crypto.randomUUID(),
        email,
        userName,
        password: hashedPassword,
        teamId: team.id,
        updatedAt: new Date()
      }
    });

    const token = generateToken(user.id, team.id);

    res.status(201).json({
      message: 'Successfully joined team',
      token,
      user: {
        id: user.id,
        name: user.userName, // Client expects 'name', not 'userName'
        email: user.email,
        teamId: team.id,
        hasVMConfig: !!user.vmId
      },
      team: {
        id: team.id,
        name: team.name,
        inviteCode: team.teamCode, // Client expects 'inviteCode'
        repositoryUrl: team.repositoryUrl
      }
    });

  } catch (error) {
    console.error('Join team error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid input data', 
        details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    
    res.status(500).json({ error: 'Failed to join team. Please try again.' });
  }
});

// GET /api/auth/me - Get current user info
router.get('/me', authenticateToken, createAuthHandler(async (req, res) => {
  console.log('/auth/me called with userId:', req.userId);
  try {
    if (!req.userId) {
      console.error('/auth/me: No userId in request');
      return res.status(401).json({ error: 'User ID not found' });
    }

    // Get user with team information
    console.log('/auth/me: Looking up user with ID:', req.userId);
    const user = await prisma.users.findUnique({
      where: { id: req.userId },
      include: { teams: true }
    });

    if (!user) {
      console.error('/auth/me: User not found in database:', req.userId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('/auth/me: User found:', { userId: user.id, teamId: user.teamId });

    res.json({
      user: {
        id: user.id,
        name: user.userName,
        email: user.email,
        teamId: user.teamId,
        hasVMConfig: !!user.vmId
      },
      team: {
        id: user.teams.id,
        name: user.teams.name,
        inviteCode: user.teams.teamCode,
        repositoryUrl: user.teams.repositoryUrl
      }
    });

  } catch (error) {
    console.error('Get current user error:', error);
    console.error('Error details:', {
      message: (error as Error)?.message,
      stack: (error as Error)?.stack,
      code: (error as any)?.code
    });
    res.status(500).json({ error: 'Failed to get user information' });
  }
}));

// POST /api/auth/refresh - Refresh JWT token
router.post('/refresh', authenticateToken, createAuthHandler(async (req, res) => {
  try {
    if (!req.userId || !req.user?.teamId) {
      return res.status(401).json({ error: 'Invalid token data' });
    }

    // Generate new token with same payload
    const newToken = generateToken(req.userId, req.user.teamId);

    res.json({
      token: newToken,
      message: 'Token refreshed successfully'
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
}));

// GitHub OAuth Routes

// GET /api/auth/github - Initiate GitHub OAuth
router.get('/github', passport.authenticate('github', { 
  scope: ['user:email', 'read:user'] 
}));

// GET /api/auth/github/callback - GitHub OAuth callback
router.get('/github/callback', (req, res, next) => {
  passport.authenticate('github', (err: any, user: any, info: any) => {
    if (err) {
      console.error('GitHub auth error:', err);
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        statusCode: err.statusCode,
        oauthError: err.oauthError
      });
      // Redirect to frontend with error
      return res.redirect(`${FRONTEND_URL}/?error=github_auth_failed`);
    }

    // Check if this is a new user who needs to complete signup
    if (!user && info?.message === 'github_signup_required') {
      console.log('GitHub signup required - storing user data in session');
      // Store GitHub data in session for team creation/joining
      req.session.githubUserData = info.githubUserData;
      // Redirect to frontend (Vite dev server on port 3000)
      console.log('Redirecting to frontend for GitHub signup');
      return res.redirect(`${FRONTEND_URL}/?github_signup=true`);
    }

    if (!user) {
      // Redirect to frontend with error
      return res.redirect(`${FRONTEND_URL}/?error=github_auth_failed`);
    }

    // Skip req.logIn() and directly generate JWT for existing user
    if (user?.userId && user?.teamId) {
      console.log('Existing user found - generating token', { userId: user.userId, teamId: user.teamId });
      const token = generateToken(user.userId, user.teamId);
      
      // Redirect to frontend success page with token (no session needed for JWT)
      const redirectUrl = `${FRONTEND_URL}/?auth_success=true&token=${token}`;
      console.log('Redirecting to frontend with success token');
      console.log('🔗 Redirect URL:', redirectUrl);
      return res.redirect(redirectUrl);
    }

    // Should not reach here
    console.log('No user data available, redirecting with error');
    res.redirect(`${FRONTEND_URL}/?error=authentication_failed`);
  })(req, res, next);
});

// POST /api/auth/github/complete - Complete GitHub signup with team selection
router.post('/github/complete', async (req, res) => {
  try {
    const { action, teamName, inviteCode } = req.body;
    const githubUserData = req.session.githubUserData;

    if (!githubUserData) {
      return res.status(400).json({ error: 'No GitHub authentication data found' });
    }

    const { githubId, email, username, displayName, avatarUrl, accessToken } = githubUserData;
    const encryptedToken = cryptoService.encrypt(accessToken);

    let user;
    let team;

    if (action === 'create_team') {
      if (!teamName) {
        return res.status(400).json({ error: 'Team name is required' });
      }

      // Generate unique team code
      let teamCode: string;
      let codeExists = true;
      
      do {
        teamCode = generateTeamCode();
        const existingTeam = await prisma.teams.findUnique({
          where: { teamCode }
        });
        codeExists = !!existingTeam;
      } while (codeExists);

      // Create team and user in transaction
      const result = await prisma.$transaction(async (tx) => {
        const newTeam = await tx.teams.create({
          data: {
            id: crypto.randomUUID(),
            name: teamName,
            teamCode: teamCode!,
            updatedAt: new Date()
          }
        });

        const newUser = await tx.users.create({
          data: {
            id: crypto.randomUUID(),
            email,
            userName: displayName,
            teamId: newTeam.id,
            githubId,
            githubUsername: username,
            avatarUrl: avatarUrl || null,
            accessToken: JSON.stringify(encryptedToken),
            updatedAt: new Date()
          }
        });

        return { user: newUser, team: newTeam };
      });

      user = result.user;
      team = result.team;

    } else if (action === 'join_team') {
      if (!inviteCode) {
        return res.status(400).json({ error: 'Invite code is required' });
      }

      // Find team by code
      team = await prisma.teams.findUnique({
        where: { teamCode: inviteCode.toUpperCase() }
      });

      if (!team) {
        return res.status(404).json({ error: 'Invalid invite code' });
      }

      // Create user
      user = await prisma.users.create({
        data: {
          id: crypto.randomUUID(),
          email,
          userName: displayName,
          teamId: team.id,
          githubId,
          githubUsername: username,
          avatarUrl: avatarUrl || null,
          accessToken: JSON.stringify(encryptedToken),
          updatedAt: new Date()
        }
      });

    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // Clear GitHub data from session
    delete req.session.githubUserData;

    const token = generateToken(user.id, team.id);

    res.status(201).json({
      message: 'GitHub authentication completed successfully',
      token,
      user: {
        id: user.id,
        name: user.userName,
        email: user.email,
        teamId: team.id,
        hasVMConfig: !!user.vmId,
        githubUsername: user.githubUsername,
        avatarUrl: user.avatarUrl
      },
      team: {
        id: team.id,
        name: team.name,
        inviteCode: team.teamCode,
        repositoryUrl: team.repositoryUrl
      }
    });

  } catch (error) {
    console.error('GitHub complete error:', error);
    res.status(500).json({ error: 'Failed to complete GitHub authentication' });
  }
});

export default router;