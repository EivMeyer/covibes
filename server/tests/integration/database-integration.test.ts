/**
 * Database Integration Tests
 * 
 * Tests the database integration and business logic without HTTP layer
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { testDb, testAssertions } from '../setup/test-database.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://postgres:password@localhost:5433/covibes_test'
    }
  }
});

describe('Database Integration Tests', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await testDb.cleanupTestData();
  });

  describe('User Registration Logic', () => {
    it('should create user and team with proper validation', async () => {
      const timestamp = Date.now();
      const teamData = {
        name: `Integration Test Team ${timestamp}`,
        teamCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        repositoryUrl: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const team = await prisma.teams.create({ data: teamData });
      
      const hashedPassword = await bcrypt.hash('testpassword123', 10);
      const userData = {
        email: `test-${timestamp}@integration-test.com`,
        userName: 'IntegrationTestUser',
        password: hashedPassword,
        teamId: team.id,
        vmId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const user = await prisma.user.create({ data: userData });

      // Verify the relationship
      const teamWithUser = await prisma.teams.findUnique({
        where: { id: team.id },
        include: { users: true }
      });

      expect(teamWithUser).toBeTruthy();
      expect(teamWithUser!.users).toHaveLength(1);
      expect(teamWithUser!.users[0].id).toBe(user.id);

      // Verify password is properly hashed
      const isPasswordValid = await bcrypt.compare('testpassword123', user.password);
      expect(isPasswordValid).toBe(true);

      testAssertions.assertValidTeam(team);
      testAssertions.assertValidUser(user);
    });

    it('should enforce unique email addresses', async () => {
      const { team } = await testDb.createTestTeam();
      const timestamp = Date.now();
      
      const userData = {
        email: `unique-test-${timestamp}@integration-test.com`,
        userName: 'TestUser1',
        password: 'hashedpassword123',
        teamId: team.id
      };

      // First user creation should succeed
      await prisma.user.create({ data: userData });

      // Second user with same email should fail
      const duplicateData = {
        ...userData,
        userName: 'TestUser2',
        teamId: team.id
      };

      await expect(prisma.user.create({ data: duplicateData }))
        .rejects.toThrow();
    });
  });

  describe('Team Management Logic', () => {
    it('should handle team joining workflow', async () => {
      // Create initial team with owner
      const { team, owner } = await testDb.createTestTeam();

      // New user joins the team
      const timestamp = Date.now();
      const newUserData = {
        email: `joiner-${timestamp}@integration-test.com`,
        userName: 'TeamJoiner',
        password: 'hashedpassword123',
        teamId: team.id
      };

      const newUser = await prisma.user.create({ data: newUserData });

      // Verify team now has both users
      const teamWithUsers = await prisma.teams.findUnique({
        where: { id: team.id },
        include: { users: true }
      });

      expect(teamWithUsers!.users).toHaveLength(2);
      const userIds = teamWithUsers!.users.map(u => u.id);
      expect(userIds).toContain(owner.id);
      expect(userIds).toContain(newUser.id);
    });

    it('should handle repository configuration', async () => {
      const { team } = await testDb.createTestTeam();

      const updatedTeam = await prisma.teams.update({
        where: { id: team.id },
        data: { repositoryUrl: 'https://github.com/test/integration-repo.git' }
      });

      expect(updatedTeam.repositoryUrl).toBe('https://github.com/test/integration-repo.git');
    });
  });

  describe('Agent Management Logic', () => {
    it('should create agents for users', async () => {
      const { team, owner } = await testDb.createTestTeam();
      
      const agentData = {
        userId: owner.id,
        teamId: team.id,
        type: 'general',
        task: 'Integration test task',
        repositoryUrl: null,
        status: 'running',
        output: 'Starting agent...',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const agent = await prisma.agents.create({ data: agentData });

      testAssertions.assertValidAgent(agent);

      // Verify relationships
      const userWithAgents = await prisma.user.findUnique({
        where: { id: owner.id },
        include: { agents: true }
      });

      expect(userWithAgents!.agents).toHaveLength(1);
      expect(userWithAgents!.agents[0].id).toBe(agent.id);
    });

    it('should support different agent types and statuses', async () => {
      const { team, owner } = await testDb.createTestTeam();
      
      const agentTypes = ['general', 'code-writer'];
      const agentStatuses = ['running', 'completed', 'stopped', 'failed'];

      for (const type of agentTypes) {
        for (const status of agentStatuses) {
          const agent = await prisma.agents.create({
            data: {
              userId: owner.id,
              teamId: team.id,
              type,
              task: `${type} agent test`,
              status,
              output: `Output for ${status} ${type} agent`
            }
          });

          expect(agent.type).toBe(type);
          expect(agent.status).toBe(status);
        }
      }

      // Verify all agents were created
      const userWithAgents = await prisma.user.findUnique({
        where: { id: owner.id },
        include: { agents: true }
      });

      const expectedCount = agentTypes.length * agentStatuses.length;
      expect(userWithAgents!.agents).toHaveLength(expectedCount);
    });
  });

  describe('Message Persistence Logic', () => {
    it('should store and retrieve team messages', async () => {
      const { team, users } = await testDb.createCompleteTestScenario();
      
      const messageData = {
        content: 'Integration test message',
        userId: users[0].id,
        teamId: team.id,
        createdAt: new Date()
      };

      const message = await prisma.message.create({ data: messageData });

      testAssertions.assertValidMessage(message);

      // Retrieve messages for the team
      const teamMessages = await prisma.message.findMany({
        where: { teamId: team.id },
        include: { user: true },
        orderBy: { createdAt: 'asc' }
      });

      expect(teamMessages).toContainEqual(
        expect.objectContaining({
          content: 'Integration test message',
          user: expect.objectContaining({
            id: users[0].id
          })
        })
      );
    });

    it('should handle message history loading', async () => {
      const { team, users, messages } = await testDb.createCompleteTestScenario();

      // Add some additional messages
      const additionalMessages = [];
      for (let i = 0; i < 5; i++) {
        const msg = await prisma.message.create({
          data: {
            content: `Additional message ${i + 1}`,
            userId: users[i % users.length].id,
            teamId: team.id,
            createdAt: new Date(Date.now() + i * 1000) // Stagger timestamps
          }
        });
        additionalMessages.push(msg);
      }

      // Load message history
      const messageHistory = await prisma.message.findMany({
        where: { teamId: team.id },
        include: { user: true },
        orderBy: { createdAt: 'asc' }
      });

      expect(messageHistory.length).toBeGreaterThan(messages.length);
      
      // Verify message ordering
      for (let i = 1; i < messageHistory.length; i++) {
        expect(messageHistory[i].createdAt >= messageHistory[i - 1].createdAt).toBe(true);
      }
    });
  });

  describe('Data Integrity and Constraints', () => {
    it('should maintain referential integrity on cascading deletes', async () => {
      const { team, users, agents, messages } = await testDb.createCompleteTestScenario();

      // Delete a user should cascade to their agents and messages
      const userToDelete = users[0];
      const userAgentCount = agents.filter(a => a.userId === userToDelete.id).length;
      const userMessageCount = messages.filter(m => m.userId === userToDelete.id).length;

      expect(userAgentCount).toBeGreaterThan(0);
      expect(userMessageCount).toBeGreaterThan(0);

      await prisma.user.delete({ where: { id: userToDelete.id } });

      // Verify agents and messages are deleted
      const remainingAgents = await prisma.agents.findMany({
        where: { userId: userToDelete.id }
      });
      const remainingMessages = await prisma.message.findMany({
        where: { userId: userToDelete.id }
      });

      expect(remainingAgents).toHaveLength(0);
      expect(remainingMessages).toHaveLength(0);
    });

    it('should handle team deletion properly', async () => {
      const { team, users, agents, messages } = await testDb.createCompleteTestScenario();

      const teamId = team.id;

      // Delete the team should cascade to all related data
      await prisma.teams.delete({ where: { id: teamId } });

      // Verify all related data is deleted
      const [remainingUsers, remainingAgents, remainingMessages] = await Promise.all([
        prisma.user.findMany({ where: { teamId } }),
        prisma.agents.findMany({ where: { teamId } }),
        prisma.message.findMany({ where: { teamId } })
      ]);

      expect(remainingUsers).toHaveLength(0);
      expect(remainingAgents).toHaveLength(0);
      expect(remainingMessages).toHaveLength(0);
    });
  });
});