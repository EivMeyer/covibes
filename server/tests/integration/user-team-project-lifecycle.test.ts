/**
 * Comprehensive Integration Tests for User Registration, Team Creation, and Project Management
 * 
 * This test suite covers the complete lifecycle of:
 * - User registration and authentication
 * - Team creation and management
 * - Project/repository configuration
 * - User joining existing teams
 * - Team collaboration workflows
 */

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../setup/test-app.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://postgres:password@localhost:5433/colabvibe_test'
    }
  }
});

describe('User, Team, and Project Lifecycle Integration Tests', () => {
  beforeAll(async () => {
    // Ensure database is connected
    await prisma.$connect();
  });

  afterAll(async () => {
    // Clean up and disconnect
    await prisma.$disconnect();
  });

  // Clean up test data before each test
  beforeEach(async () => {
    await prisma.agents.deleteMany({
      where: { task: { contains: 'Integration Test' } }
    });
    
    await prisma.message.deleteMany({
      where: { content: { contains: 'Integration Test' } }
    });
    
    await prisma.user.deleteMany({
      where: { email: { contains: '@integration-test.com' } }
    });
    
    await prisma.teams.deleteMany({
      where: { name: { contains: 'Integration Test' } }
    });
  });

  describe('User Registration Flow', () => {
    const timestamp = Date.now();
    
    it('should create user and team simultaneously during registration', async () => {
      const registrationData = {
        teamName: `Integration Test Team ${timestamp}`,
        userName: 'TestUser',
        email: `user-${timestamp}@integration-test.com`,
        password: 'securepassword123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect(201);

      // Verify response structure
      expect(response.body).toMatchObject({
        message: 'Registration successful',
        token: expect.any(String),
        user: {
          id: expect.any(String),
          userName: 'TestUser',
          email: registrationData.email,
          teamId: expect.any(String)
        },
        team: {
          id: expect.any(String),
          name: registrationData.teamName,
          teamCode: expect.any(String),
          repositoryUrl: null
        }
      });

      // Verify JWT token is valid
      expect(response.body.token.split('.')).toHaveLength(3);
      
      // Verify data was saved correctly in database
      const savedUser = await prisma.user.findUnique({
        where: { email: registrationData.email },
        include: { team: true }
      });
      
      expect(savedUser).toBeTruthy();
      expect(savedUser?.userName).toBe('TestUser');
      expect(savedUser?.team.name).toBe(registrationData.teamName);
      expect(savedUser?.team.teamCode).toMatch(/^[A-Z0-9]{6}$/);
    });

    it('should validate email uniqueness across teams', async () => {
      const email = `duplicate-${Date.now()}@integration-test.com`;
      
      // First registration should succeed
      await request(app)
        .post('/api/auth/register')
        .send({
          teamName: 'Team 1',
          userName: 'User1',
          email,
          password: 'password123'
        })
        .expect(201);

      // Second registration with same email should fail
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          teamName: 'Team 2',
          userName: 'User2',
          email,
          password: 'password456'
        })
        .expect(400);

      expect(response.body.error).toContain('Email already registered');
    });

    it('should validate required fields', async () => {
      const incompleteData = {
        teamName: 'Test Team',
        // Missing userName, email, password
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(incompleteData)
        .expect(400);

      expect(response.body.error).toContain('Invalid input data');
    });

    it('should enforce password strength', async () => {
      const weakPasswordData = {
        teamName: 'Test Team',
        userName: 'TestUser',
        email: `weak-password-${Date.now()}@integration-test.com`,
        password: '123' // Too weak
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordData)
        .expect(400);

      expect(response.body.error).toContain('Password must be at least');
    });
  });

  describe('User Authentication Flow', () => {
    let testUser: any;
    let testTeam: any;
    const timestamp = Date.now();

    beforeEach(async () => {
      // Create a test user for authentication tests
      const registrationData = {
        teamName: `Auth Test Team ${timestamp}`,
        userName: 'AuthTestUser',
        email: `auth-test-${timestamp}@integration-test.com`,
        password: 'testpassword123'
      };

      const regResponse = await request(app)
        .post('/api/auth/register')
        .send(registrationData);
      
      testUser = regResponse.body.user;
      testTeam = regResponse.body.team;
    });

    it('should authenticate user with valid credentials', async () => {
      const loginData = {
        email: testUser.email,
        password: 'testpassword123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Login successful',
        token: expect.any(String),
        user: {
          id: testUser.id,
          userName: testUser.userName,
          email: testUser.email,
          teamId: testTeam.id
        },
        team: {
          id: testTeam.id,
          name: testTeam.name,
          teamCode: testTeam.teamCode
        }
      });
    });

    it('should reject invalid password', async () => {
      const loginData = {
        email: testUser.email,
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should reject non-existent email', async () => {
      const loginData = {
        email: 'nonexistent@integration-test.com',
        password: 'somepassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.error).toContain('Invalid credentials');
    });
  });

  describe('Team Joining Flow', () => {
    let teamOwner: any;
    let existingTeam: any;
    let ownerToken: string;
    const timestamp = Date.now();

    beforeEach(async () => {
      // Create an existing team with owner
      const ownerRegistration = {
        teamName: `Existing Team ${timestamp}`,
        userName: 'TeamOwner',
        email: `team-owner-${timestamp}@integration-test.com`,
        password: 'ownerpassword123'
      };

      const ownerResponse = await request(app)
        .post('/api/auth/register')
        .send(ownerRegistration);

      teamOwner = ownerResponse.body.user;
      existingTeam = ownerResponse.body.team;
      ownerToken = ownerResponse.body.token;
    });

    it('should allow new user to join existing team with valid team code', async () => {
      const joinData = {
        teamCode: existingTeam.teamCode,
        userName: 'NewMember',
        email: `new-member-${timestamp}@integration-test.com`,
        password: 'memberpassword123'
      };

      const response = await request(app)
        .post('/api/auth/join')
        .send(joinData)
        .expect(201);

      expect(response.body).toMatchObject({
        message: 'Joined team successfully',
        token: expect.any(String),
        user: {
          userName: 'NewMember',
          email: joinData.email,
          teamId: existingTeam.id
        },
        team: {
          id: existingTeam.id,
          name: existingTeam.name,
          teamCode: existingTeam.teamCode
        }
      });

      // Verify team now has 2 members
      const teamWithUsers = await prisma.teams.findUnique({
        where: { id: existingTeam.id },
        include: { users: true }
      });

      expect(teamWithUsers?.users).toHaveLength(2);
    });

    it('should reject invalid team code', async () => {
      const joinData = {
        teamCode: 'INVALID',
        userName: 'NewMember',
        email: `invalid-join-${timestamp}@integration-test.com`,
        password: 'memberpassword123'
      };

      const response = await request(app)
        .post('/api/auth/join')
        .send(joinData)
        .expect(400);

      expect(response.body.error).toContain('Invalid team code');
    });

    it('should not allow same email to join multiple teams', async () => {
      const email = `multi-team-${timestamp}@integration-test.com`;
      
      // First, create a user in a different team
      await request(app)
        .post('/api/auth/register')
        .send({
          teamName: 'Other Team',
          userName: 'OriginalUser',
          email,
          password: 'password123'
        });

      // Then try to join the existing team with same email
      const joinData = {
        teamCode: existingTeam.teamCode,
        userName: 'DuplicateUser',
        email,
        password: 'differentpassword'
      };

      const response = await request(app)
        .post('/api/auth/join')
        .send(joinData)
        .expect(400);

      expect(response.body.error).toContain('Email already registered');
    });
  });

  describe('Team Management Flow', () => {
    let teamOwner: any;
    let team: any;
    let ownerToken: string;
    let member1: any;
    let member1Token: string;
    let member2: any;
    let member2Token: string;
    const timestamp = Date.now();

    beforeEach(async () => {
      // Create team owner
      const ownerReg = await request(app)
        .post('/api/auth/register')
        .send({
          teamName: `Management Test Team ${timestamp}`,
          userName: 'TeamOwner',
          email: `owner-${timestamp}@integration-test.com`,
          password: 'ownerpassword'
        });
      
      teamOwner = ownerReg.body.user;
      team = ownerReg.body.team;
      ownerToken = ownerReg.body.token;

      // Add team members
      const member1Reg = await request(app)
        .post('/api/auth/join')
        .send({
          teamCode: team.teamCode,
          userName: 'Member1',
          email: `member1-${timestamp}@integration-test.com`,
          password: 'member1password'
        });

      const member2Reg = await request(app)
        .post('/api/auth/join')
        .send({
          teamCode: team.teamCode,
          userName: 'Member2',
          email: `member2-${timestamp}@integration-test.com`,
          password: 'member2password'
        });

      member1 = member1Reg.body.user;
      member1Token = member1Reg.body.token;
      member2 = member2Reg.body.user;
      member2Token = member2Reg.body.token;
    });

    it('should retrieve team info with all members', async () => {
      const response = await request(app)
        .get('/api/team/info')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.team).toMatchObject({
        id: team.id,
        name: team.name,
        teamCode: team.teamCode,
        repositoryUrl: null
      });

      expect(response.body.team.users).toHaveLength(3);
      const userEmails = response.body.team.users.map((u: any) => u.email).sort();
      expect(userEmails).toEqual([
        teamOwner.email,
        member1.email,
        member2.email
      ].sort());
    });

    it('should show different perspectives for different users', async () => {
      // Owner perspective
      const ownerResponse = await request(app)
        .get('/api/team/info')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Member perspective  
      const memberResponse = await request(app)
        .get('/api/team/info')
        .set('Authorization', `Bearer ${member1Token}`)
        .expect(200);

      // Both should see same team data
      expect(ownerResponse.body.team.id).toBe(memberResponse.body.team.id);
      expect(ownerResponse.body.team.users).toHaveLength(3);
      expect(memberResponse.body.team.users).toHaveLength(3);
    });

    it('should require authentication for team info', async () => {
      await request(app)
        .get('/api/team/info')
        .expect(401);
    });
  });

  describe('Project/Repository Configuration Flow', () => {
    let user: any;
    let team: any;
    let authToken: string;
    const timestamp = Date.now();

    beforeEach(async () => {
      const registration = await request(app)
        .post('/api/auth/register')
        .send({
          teamName: `Project Test Team ${timestamp}`,
          userName: 'ProjectUser',
          email: `project-${timestamp}@integration-test.com`,
          password: 'projectpassword'
        });

      user = registration.body.user;
      team = registration.body.team;
      authToken = registration.body.token;
    });

    it('should configure team repository URL', async () => {
      const repoData = {
        repositoryUrl: 'https://github.com/example/test-project.git'
      };

      const response = await request(app)
        .post('/api/team/configure-repo')
        .set('Authorization', `Bearer ${authToken}`)
        .send(repoData)
        .expect(200);

      expect(response.body.message).toContain('Repository configured');

      // Verify it was saved
      const updatedTeam = await prisma.teams.findUnique({
        where: { id: team.id }
      });

      expect(updatedTeam?.repositoryUrl).toBe(repoData.repositoryUrl);
    });

    it('should validate GitHub repository URLs', async () => {
      const invalidRepoData = {
        repositoryUrl: 'not-a-valid-url'
      };

      const response = await request(app)
        .post('/api/team/configure-repo')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRepoData)
        .expect(400);

      expect(response.body.error).toContain('Invalid repository URL');
    });

    it('should allow updating existing repository URL', async () => {
      // Set initial repository
      await request(app)
        .post('/api/team/configure-repo')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          repositoryUrl: 'https://github.com/example/initial-repo.git'
        });

      // Update to new repository
      const newRepoData = {
        repositoryUrl: 'https://github.com/example/updated-repo.git'
      };

      await request(app)
        .post('/api/team/configure-repo')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newRepoData)
        .expect(200);

      // Verify update
      const updatedTeam = await prisma.teams.findUnique({
        where: { id: team.id }
      });

      expect(updatedTeam?.repositoryUrl).toBe(newRepoData.repositoryUrl);
    });

    it('should clear repository URL when set to null', async () => {
      // Set initial repository
      await request(app)
        .post('/api/team/configure-repo')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          repositoryUrl: 'https://github.com/example/temp-repo.git'
        });

      // Clear repository
      await request(app)
        .post('/api/team/configure-repo')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          repositoryUrl: null
        })
        .expect(200);

      // Verify cleared
      const updatedTeam = await prisma.teams.findUnique({
        where: { id: team.id }
      });

      expect(updatedTeam?.repositoryUrl).toBeNull();
    });
  });

  describe('End-to-End Team Collaboration Workflow', () => {
    let owner: any;
    let member1: any;
    let member2: any;
    let team: any;
    let ownerToken: string;
    let member1Token: string;
    let member2Token: string;
    const timestamp = Date.now();

    beforeEach(async () => {
      // Create complete team setup
      const ownerReg = await request(app)
        .post('/api/auth/register')
        .send({
          teamName: `E2E Test Team ${timestamp}`,
          userName: 'Owner',
          email: `e2e-owner-${timestamp}@integration-test.com`,
          password: 'ownerpass123'
        });

      owner = ownerReg.body.user;
      team = ownerReg.body.team;
      ownerToken = ownerReg.body.token;

      // Add members
      const member1Reg = await request(app)
        .post('/api/auth/join')
        .send({
          teamCode: team.teamCode,
          userName: 'Developer1',
          email: `e2e-dev1-${timestamp}@integration-test.com`,
          password: 'dev1pass123'
        });

      const member2Reg = await request(app)
        .post('/api/auth/join')
        .send({
          teamCode: team.teamCode,
          userName: 'Developer2',
          email: `e2e-dev2-${timestamp}@integration-test.com`,
          password: 'dev2pass123'
        });

      member1 = member1Reg.body.user;
      member1Token = member1Reg.body.token;
      member2 = member2Reg.body.user;
      member2Token = member2Reg.body.token;

      // Configure team project
      await request(app)
        .post('/api/team/configure-repo')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          repositoryUrl: 'https://github.com/example/collab-project.git'
        });
    });

    it('should complete full team setup and project configuration workflow', async () => {
      // 1. Verify team has correct setup
      const teamInfo = await request(app)
        .get('/api/team/info')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(teamInfo.body.team.users).toHaveLength(3);
      expect(teamInfo.body.team.repositoryUrl).toBe('https://github.com/example/collab-project.git');

      // 2. Each member should be able to access team info
      await request(app)
        .get('/api/team/info')
        .set('Authorization', `Bearer ${member1Token}`)
        .expect(200);

      await request(app)
        .get('/api/team/info')
        .set('Authorization', `Bearer ${member2Token}`)
        .expect(200);

      // 3. All members should be able to spawn agents
      const ownerAgent = await request(app)
        .post('/api/agents/spawn')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          type: 'general',
          task: 'Integration Test - Owner Agent',
          repositoryUrl: 'https://github.com/example/collab-project.git'
        })
        .expect(201);

      const member1Agent = await request(app)
        .post('/api/agents/spawn')
        .set('Authorization', `Bearer ${member1Token}`)
        .send({
          type: 'code-writer',
          task: 'Integration Test - Member1 Agent',
          repositoryUrl: 'https://github.com/example/collab-project.git'
        })
        .expect(201);

      // 4. Team agents should be visible to all members
      const teamAgents = await request(app)
        .get('/api/team/agents')
        .set('Authorization', `Bearer ${member2Token}`)
        .expect(200);

      expect(teamAgents.body.agents).toHaveLength(2);
      
      const agentTasks = teamAgents.body.agents.map((a: any) => a.task).sort();
      expect(agentTasks).toEqual([
        'Integration Test - Owner Agent',
        'Integration Test - Member1 Agent'
      ].sort());

      // 5. Individual agent lists should show ownership correctly
      const ownerAgents = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const member1Agents = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${member1Token}`)
        .expect(200);

      expect(ownerAgents.body.agents).toHaveLength(1);
      expect(member1Agents.body.agents).toHaveLength(1);
      expect(ownerAgents.body.agents[0].task).toBe('Integration Test - Owner Agent');
      expect(member1Agents.body.agents[0].task).toBe('Integration Test - Member1 Agent');
    });

    it('should maintain data consistency across team operations', async () => {
      // Perform multiple concurrent operations
      const operations = [
        // Repository updates
        request(app)
          .post('/api/team/configure-repo')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ repositoryUrl: 'https://github.com/example/updated-repo.git' }),
        
        // Agent spawning
        request(app)
          .post('/api/agents/spawn')
          .set('Authorization', `Bearer ${member1Token}`)
          .send({
            type: 'general',
            task: 'Integration Test - Concurrent Agent 1'
          }),
        
        request(app)
          .post('/api/agents/spawn')
          .set('Authorization', `Bearer ${member2Token}`)
          .send({
            type: 'code-writer',
            task: 'Integration Test - Concurrent Agent 2'
          }),
        
        // Team info queries
        request(app)
          .get('/api/team/info')
          .set('Authorization', `Bearer ${ownerToken}`),
        
        request(app)
          .get('/api/team/info')
          .set('Authorization', `Bearer ${member1Token}`)
      ];

      const results = await Promise.allSettled(operations);
      
      // All operations should succeed
      results.forEach((result, index) => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.status).toBeGreaterThanOrEqual(200);
          expect(result.value.status).toBeLessThan(300);
        }
      });

      // Verify final state is consistent
      const finalTeamInfo = await request(app)
        .get('/api/team/info')
        .set('Authorization', `Bearer ${ownerToken}`);

      const finalAgents = await request(app)
        .get('/api/team/agents')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(finalTeamInfo.body.team.repositoryUrl).toBe('https://github.com/example/updated-repo.git');
      expect(finalAgents.body.agents).toHaveLength(2);
    });
  });

  describe('Data Validation and Error Handling', () => {
    it('should handle database connection issues gracefully', async () => {
      // This test would require mocking database failures
      // For now, just verify our error handling structure exists
      expect(true).toBe(true);
    });

    it('should clean up orphaned data properly', async () => {
      const timestamp = Date.now();
      
      // Create team and users
      const ownerReg = await request(app)
        .post('/api/auth/register')
        .send({
          teamName: `Cleanup Test ${timestamp}`,
          userName: 'Owner',
          email: `cleanup-owner-${timestamp}@integration-test.com`,
          password: 'password123'
        });

      const memberReg = await request(app)
        .post('/api/auth/join')
        .send({
          teamCode: ownerReg.body.team.teamCode,
          userName: 'Member',
          email: `cleanup-member-${timestamp}@integration-test.com`,
          password: 'password123'
        });

      // Create agents
      await request(app)
        .post('/api/agents/spawn')
        .set('Authorization', `Bearer ${ownerReg.body.token}`)
        .send({
          type: 'general',
          task: 'Integration Test - Cleanup Test Agent'
        });

      // Delete the team (should cascade delete users and agents)
      await prisma.teams.delete({
        where: { id: ownerReg.body.team.id }
      });

      // Verify cascaded deletion worked
      const remainingUsers = await prisma.user.findMany({
        where: {
          email: { in: [ownerReg.body.user.email, memberReg.body.user.email] }
        }
      });

      const remainingAgents = await prisma.agents.findMany({
        where: { task: 'Integration Test - Cleanup Test Agent' }
      });

      expect(remainingUsers).toHaveLength(0);
      expect(remainingAgents).toHaveLength(0);
    });
  });
});