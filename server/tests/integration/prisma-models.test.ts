/**
 * Prisma Models Integration Tests
 * Tests database models and relationships
 */

import { jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

// Use test database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://postgres:password@localhost:5433/covibes_test'
    }
  }
});

// Mock data generators
const generateTeam = (overrides = {}) => ({
  name: `TestTeam_${Date.now()}`,
  teamCode: `TC${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
  repositoryUrl: 'https://github.com/test/repo.git',
  ...overrides
});

const generateUser = (teamId: string, overrides = {}) => ({
  email: `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}@test.com`,
  userName: `TestUser_${Math.random().toString(36).substring(2, 8)}`,
  password: 'hashedpassword123',
  teamId,
  vmId: null,
  ...overrides
});

const generateAgent = (userId: string, teamId: string, overrides = {}) => ({
  userId,
  teamId,
  type: 'general',
  task: `Test task ${Date.now()}`,
  repositoryUrl: 'https://github.com/test/task-repo.git',
  status: 'running',
  output: 'Initial output',
  ...overrides
});

describe('Prisma Models Integration Tests', () => {
  beforeAll(async () => {
    // Ensure database is connected
    await prisma.$connect();
  });

  afterAll(async () => {
    // Clean up and disconnect
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await prisma.agents.deleteMany({
      where: {
        task: { contains: 'Test task' }
      }
    });
    
    await prisma.user.deleteMany({
      where: {
        email: { contains: 'test.com' }
      }
    });
    
    await prisma.teams.deleteMany({
      where: {
        name: { contains: 'TestTeam_' }
      }
    });
  });

  describe('Team model', () => {
    it('should create a team with required fields', async () => {
      const teamData = generateTeam();
      
      const team = await prisma.teams.create({
        data: teamData
      });

      expect(team.id).toBeTruthy();
      expect(team.name).toBe(teamData.name);
      expect(team.teamCode).toBe(teamData.teamCode);
      expect(team.repositoryUrl).toBe(teamData.repositoryUrl);
      expect(team.createdAt).toBeInstanceOf(Date);
      expect(team.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a team without optional repository URL', async () => {
      const teamData = generateTeam({ repositoryUrl: undefined });
      
      const team = await prisma.teams.create({
        data: teamData
      });

      expect(team.repositoryUrl).toBeNull();
    });

    it('should enforce unique team codes', async () => {
      const teamCode = 'UNIQUE123';
      const teamData1 = generateTeam({ teamCode });
      const teamData2 = generateTeam({ teamCode });

      await prisma.teams.create({ data: teamData1 });

      await expect(prisma.teams.create({ data: teamData2 }))
        .rejects.toThrow();
    });

    it('should update team fields', async () => {
      const teamData = generateTeam();
      const team = await prisma.teams.create({ data: teamData });

      const updatedTeam = await prisma.teams.update({
        where: { id: team.id },
        data: {
          name: 'Updated Team Name',
          repositoryUrl: 'https://github.com/updated/repo.git'
        }
      });

      expect(updatedTeam.name).toBe('Updated Team Name');
      expect(updatedTeam.repositoryUrl).toBe('https://github.com/updated/repo.git');
      expect(updatedTeam.updatedAt.getTime()).toBeGreaterThan(team.updatedAt.getTime());
    });

    it('should find team by team code', async () => {
      const teamData = generateTeam();
      const createdTeam = await prisma.teams.create({ data: teamData });

      const foundTeam = await prisma.teams.findUnique({
        where: { teamCode: teamData.teamCode }
      });

      expect(foundTeam?.id).toBe(createdTeam.id);
    });

    it('should delete team', async () => {
      const teamData = generateTeam();
      const team = await prisma.teams.create({ data: teamData });

      await prisma.teams.delete({
        where: { id: team.id }
      });

      const deletedTeam = await prisma.teams.findUnique({
        where: { id: team.id }
      });

      expect(deletedTeam).toBeNull();
    });
  });

  describe('User model', () => {
    let testTeam: any;

    beforeEach(async () => {
      const teamData = generateTeam();
      testTeam = await prisma.teams.create({ data: teamData });
    });

    it('should create a user with required fields', async () => {
      const userData = generateUser(testTeam.id);
      
      const user = await prisma.user.create({
        data: userData
      });

      expect(user.id).toBeTruthy();
      expect(user.email).toBe(userData.email);
      expect(user.userName).toBe(userData.userName);
      expect(user.password).toBe(userData.password);
      expect(user.teamId).toBe(testTeam.id);
      expect(user.vmId).toBeNull();
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a user with VM assignment', async () => {
      const userData = generateUser(testTeam.id, { vmId: 'vm-123' });
      
      const user = await prisma.user.create({
        data: userData
      });

      expect(user.vmId).toBe('vm-123');
    });

    it('should enforce unique email addresses', async () => {
      const email = `unique_${Date.now()}@test.com`;
      const userData1 = generateUser(testTeam.id, { email });
      const userData2 = generateUser(testTeam.id, { email });

      await prisma.user.create({ data: userData1 });

      await expect(prisma.user.create({ data: userData2 }))
        .rejects.toThrow();
    });

    it('should relate user to team', async () => {
      const userData = generateUser(testTeam.id);
      const user = await prisma.user.create({
        data: userData,
        include: { team: true }
      });

      expect(user.team.id).toBe(testTeam.id);
      expect(user.team.name).toBe(testTeam.name);
    });

    it('should update user fields', async () => {
      const userData = generateUser(testTeam.id);
      const user = await prisma.user.create({ data: userData });

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          userName: 'UpdatedUserName',
          vmId: 'vm-456'
        }
      });

      expect(updatedUser.userName).toBe('UpdatedUserName');
      expect(updatedUser.vmId).toBe('vm-456');
    });

    it('should find user by email', async () => {
      const userData = generateUser(testTeam.id);
      const createdUser = await prisma.user.create({ data: userData });

      const foundUser = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      expect(foundUser?.id).toBe(createdUser.id);
    });

    it('should cascade delete when team is deleted', async () => {
      const userData = generateUser(testTeam.id);
      const user = await prisma.user.create({ data: userData });

      // Delete the team
      await prisma.teams.delete({
        where: { id: testTeam.id }
      });

      // User should be deleted due to cascade
      const deletedUser = await prisma.user.findUnique({
        where: { id: user.id }
      });

      expect(deletedUser).toBeNull();
    });
  });

  describe('Agent model', () => {
    let testTeam: any;
    let testUser: any;

    beforeEach(async () => {
      const teamData = generateTeam();
      testTeam = await prisma.teams.create({ data: teamData });

      const userData = generateUser(testTeam.id);
      testUser = await prisma.user.create({ data: userData });
    });

    it('should create an agent with required fields', async () => {
      const agentData = generateAgent(testUser.id, testTeam.id);
      
      const agent = await prisma.agents.create({
        data: agentData
      });

      expect(agent.id).toBeTruthy();
      expect(agent.userId).toBe(testUser.id);
      expect(agent.teamId).toBe(testTeam.id);
      expect(agent.type).toBe(agentData.type);
      expect(agent.task).toBe(agentData.task);
      expect(agent.repositoryUrl).toBe(agentData.repositoryUrl);
      expect(agent.status).toBe('running');
      expect(agent.output).toBe(agentData.output);
      expect(agent.createdAt).toBeInstanceOf(Date);
      expect(agent.updatedAt).toBeInstanceOf(Date);
    });

    it('should create agent without repository URL', async () => {
      const agentData = generateAgent(testUser.id, testTeam.id, { repositoryUrl: undefined });
      
      const agent = await prisma.agents.create({
        data: agentData
      });

      expect(agent.repositoryUrl).toBeNull();
    });

    it('should create agent with different types', async () => {
      const generalAgent = await prisma.agents.create({
        data: generateAgent(testUser.id, testTeam.id, { type: 'general' })
      });

      const codeAgent = await prisma.agents.create({
        data: generateAgent(testUser.id, testTeam.id, { type: 'code-writer' })
      });

      expect(generalAgent.type).toBe('general');
      expect(codeAgent.type).toBe('code-writer');
    });

    it('should relate agent to user and team', async () => {
      const agentData = generateAgent(testUser.id, testTeam.id);
      const agent = await prisma.agents.create({
        data: agentData,
        include: {
          user: true,
          team: true
        }
      });

      expect(agent.user.id).toBe(testUser.id);
      expect(agent.user.email).toBe(testUser.email);
      expect(agent.team.id).toBe(testTeam.id);
      expect(agent.team.name).toBe(testTeam.name);
    });

    it('should update agent status and output', async () => {
      const agentData = generateAgent(testUser.id, testTeam.id);
      const agent = await prisma.agents.create({ data: agentData });

      const updatedAgent = await prisma.agents.update({
        where: { id: agent.id },
        data: {
          status: 'completed',
          output: 'Final output with results'
        }
      });

      expect(updatedAgent.status).toBe('completed');
      expect(updatedAgent.output).toBe('Final output with results');
    });

    it('should handle different agent statuses', async () => {
      const statuses = ['spawning', 'running', 'completed', 'stopped', 'error'];
      
      for (const status of statuses) {
        const agentData = generateAgent(testUser.id, testTeam.id, { status });
        const agent = await prisma.agents.create({ data: agentData });
        
        expect(agent.status).toBe(status);
      }
    });

    it('should cascade delete when user is deleted', async () => {
      const agentData = generateAgent(testUser.id, testTeam.id);
      const agent = await prisma.agents.create({ data: agentData });

      // Delete the user
      await prisma.user.delete({
        where: { id: testUser.id }
      });

      // Agent should be deleted due to cascade
      const deletedAgent = await prisma.agents.findUnique({
        where: { id: agent.id }
      });

      expect(deletedAgent).toBeNull();
    });

    it('should cascade delete when team is deleted', async () => {
      const agentData = generateAgent(testUser.id, testTeam.id);
      const agent = await prisma.agents.create({ data: agentData });

      // Delete the team (this will also delete user due to cascade)
      await prisma.teams.delete({
        where: { id: testTeam.id }
      });

      // Agent should be deleted due to cascade
      const deletedAgent = await prisma.agents.findUnique({
        where: { id: agent.id }
      });

      expect(deletedAgent).toBeNull();
    });
  });

  describe('Relationships and queries', () => {
    let testTeam: any;
    let testUser1: any;
    let testUser2: any;

    beforeEach(async () => {
      const teamData = generateTeam();
      testTeam = await prisma.teams.create({ data: teamData });

      const userData1 = generateUser(testTeam.id);
      const userData2 = generateUser(testTeam.id);
      
      testUser1 = await prisma.user.create({ data: userData1 });
      testUser2 = await prisma.user.create({ data: userData2 });
    });

    it('should query team with all users', async () => {
      const teamWithUsers = await prisma.teams.findUnique({
        where: { id: testTeam.id },
        include: { users: true }
      });

      expect(teamWithUsers?.users).toHaveLength(2);
      const userIds = teamWithUsers?.users.map(u => u.id).sort();
      expect(userIds).toEqual([testUser1.id, testUser2.id].sort());
    });

    it('should query team with all agents', async () => {
      // Create agents for different users
      await prisma.agents.create({
        data: generateAgent(testUser1.id, testTeam.id)
      });
      await prisma.agents.create({
        data: generateAgent(testUser2.id, testTeam.id)
      });
      await prisma.agents.create({
        data: generateAgent(testUser1.id, testTeam.id)
      });

      const teamWithAgents = await prisma.teams.findUnique({
        where: { id: testTeam.id },
        include: { agents: true }
      });

      expect(teamWithAgents?.agents).toHaveLength(3);
    });

    it('should query user with all agents', async () => {
      // Create multiple agents for user1
      await prisma.agents.create({
        data: generateAgent(testUser1.id, testTeam.id, { type: 'general' })
      });
      await prisma.agents.create({
        data: generateAgent(testUser1.id, testTeam.id, { type: 'code-writer' })
      });

      // Create one agent for user2
      await prisma.agents.create({
        data: generateAgent(testUser2.id, testTeam.id)
      });

      const userWithAgents = await prisma.user.findUnique({
        where: { id: testUser1.id },
        include: { agents: true }
      });

      expect(userWithAgents?.agents).toHaveLength(2);
      expect(userWithAgents?.agents.every(a => a.userId === testUser1.id)).toBe(true);
    });

    it('should query agents by type', async () => {
      await prisma.agents.create({
        data: generateAgent(testUser1.id, testTeam.id, { type: 'general' })
      });
      await prisma.agents.create({
        data: generateAgent(testUser2.id, testTeam.id, { type: 'code-writer' })
      });
      await prisma.agents.create({
        data: generateAgent(testUser1.id, testTeam.id, { type: 'general' })
      });

      const generalAgents = await prisma.agents.findMany({
        where: {
          teamId: testTeam.id,
          type: 'general'
        }
      });

      expect(generalAgents).toHaveLength(2);
      expect(generalAgents.every(a => a.type === 'general')).toBe(true);
    });

    it('should query agents by status', async () => {
      await prisma.agents.create({
        data: generateAgent(testUser1.id, testTeam.id, { status: 'running' })
      });
      await prisma.agents.create({
        data: generateAgent(testUser2.id, testTeam.id, { status: 'completed' })
      });
      await prisma.agents.create({
        data: generateAgent(testUser1.id, testTeam.id, { status: 'running' })
      });

      const runningAgents = await prisma.agents.findMany({
        where: {
          teamId: testTeam.id,
          status: 'running'
        }
      });

      expect(runningAgents).toHaveLength(2);
      expect(runningAgents.every(a => a.status === 'running')).toBe(true);
    });

    it('should order agents by creation date', async () => {
      // Create agents with slight delay to ensure different timestamps
      const agent1 = await prisma.agents.create({
        data: generateAgent(testUser1.id, testTeam.id, { task: 'First task' })
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const agent2 = await prisma.agents.create({
        data: generateAgent(testUser1.id, testTeam.id, { task: 'Second task' })
      });

      const orderedAgents = await prisma.agents.findMany({
        where: { teamId: testTeam.id },
        orderBy: { createdAt: 'asc' }
      });

      expect(orderedAgents[0].id).toBe(agent1.id);
      expect(orderedAgents[1].id).toBe(agent2.id);
    });

    it('should count agents by team', async () => {
      // Create another team for comparison
      const otherTeamData = generateTeam();
      const otherTeam = await prisma.teams.create({ data: otherTeamData });
      const otherUserData = generateUser(otherTeam.id);
      const otherUser = await prisma.user.create({ data: otherUserData });

      // Create agents in both teams
      await prisma.agents.create({
        data: generateAgent(testUser1.id, testTeam.id)
      });
      await prisma.agents.create({
        data: generateAgent(testUser2.id, testTeam.id)
      });
      await prisma.agents.create({
        data: generateAgent(otherUser.id, otherTeam.id)
      });

      const testTeamAgentCount = await prisma.agents.count({
        where: { teamId: testTeam.id }
      });

      const otherTeamAgentCount = await prisma.agents.count({
        where: { teamId: otherTeam.id }
      });

      expect(testTeamAgentCount).toBe(2);
      expect(otherTeamAgentCount).toBe(1);
    });
  });

  describe('Complex queries and aggregations', () => {
    let testTeam: any;
    let testUsers: any[];

    beforeEach(async () => {
      const teamData = generateTeam();
      testTeam = await prisma.teams.create({ data: teamData });

      // Create multiple users
      testUsers = [];
      for (let i = 0; i < 3; i++) {
        const userData = generateUser(testTeam.id);
        const user = await prisma.user.create({ data: userData });
        testUsers.push(user);
      }
    });

    it('should perform complex nested queries', async () => {
      // Create agents for each user
      for (const user of testUsers) {
        await prisma.agents.create({
          data: generateAgent(user.id, testTeam.id, { type: 'general', status: 'running' })
        });
        await prisma.agents.create({
          data: generateAgent(user.id, testTeam.id, { type: 'code-writer', status: 'completed' })
        });
      }

      const complexQuery = await prisma.teams.findUnique({
        where: { id: testTeam.id },
        include: {
          users: {
            include: {
              agents: {
                where: { status: 'running' }
              }
            }
          }
        }
      });

      expect(complexQuery?.users).toHaveLength(3);
      expect(complexQuery?.users.every(u => u.agents.length === 1)).toBe(true);
      expect(complexQuery?.users.every(u => u.agents[0].status === 'running')).toBe(true);
    });

    it('should aggregate agent statistics', async () => {
      // Create various agents
      await prisma.agents.create({
        data: generateAgent(testUsers[0].id, testTeam.id, { status: 'running' })
      });
      await prisma.agents.create({
        data: generateAgent(testUsers[1].id, testTeam.id, { status: 'completed' })
      });
      await prisma.agents.create({
        data: generateAgent(testUsers[2].id, testTeam.id, { status: 'running' })
      });
      await prisma.agents.create({
        data: generateAgent(testUsers[0].id, testTeam.id, { status: 'error' })
      });

      const agentStats = await prisma.agents.groupBy({
        by: ['status'],
        where: { teamId: testTeam.id },
        _count: { status: true }
      });

      const statsMap = new Map(agentStats.map(s => [s.status, s._count.status]));
      expect(statsMap.get('running')).toBe(2);
      expect(statsMap.get('completed')).toBe(1);
      expect(statsMap.get('error')).toBe(1);
    });

    it('should find users without agents', async () => {
      // Create agents for only some users
      await prisma.agents.create({
        data: generateAgent(testUsers[0].id, testTeam.id)
      });
      await prisma.agents.create({
        data: generateAgent(testUsers[2].id, testTeam.id)
      });

      const usersWithoutAgents = await prisma.user.findMany({
        where: {
          teamId: testTeam.id,
          agents: {
            none: {}
          }
        }
      });

      expect(usersWithoutAgents).toHaveLength(1);
      expect(usersWithoutAgents[0].id).toBe(testUsers[1].id);
    });

    it('should find most active users by agent count', async () => {
      // Create different numbers of agents for users
      for (let i = 0; i < 3; i++) {
        await prisma.agents.create({
          data: generateAgent(testUsers[0].id, testTeam.id, { task: `User 0 task ${i}` })
        });
      }

      for (let i = 0; i < 1; i++) {
        await prisma.agents.create({
          data: generateAgent(testUsers[1].id, testTeam.id, { task: `User 1 task ${i}` })
        });
      }

      // testUsers[2] has no agents

      const usersWithAgentCount = await prisma.user.findMany({
        where: { teamId: testTeam.id },
        include: {
          _count: {
            select: { agents: true }
          }
        },
        orderBy: {
          agents: {
            _count: 'desc'
          }
        }
      });

      expect(usersWithAgentCount[0].id).toBe(testUsers[0].id);
      expect(usersWithAgentCount[0]._count.agents).toBe(3);
      expect(usersWithAgentCount[1].id).toBe(testUsers[1].id);
      expect(usersWithAgentCount[1]._count.agents).toBe(1);
      expect(usersWithAgentCount[2].id).toBe(testUsers[2].id);
      expect(usersWithAgentCount[2]._count.agents).toBe(0);
    });
  });

  describe('Database constraints and edge cases', () => {
    it('should handle transaction rollback on error', async () => {
      const teamData = generateTeam();
      
      await expect(prisma.$transaction(async (tx) => {
        // Create team
        const team = await tx.team.create({ data: teamData });
        
        // Create user
        const userData = generateUser(team.id);
        await tx.user.create({ data: userData });
        
        // Try to create duplicate team code (should fail)
        await tx.team.create({ data: teamData });
      })).rejects.toThrow();

      // Verify no data was created due to rollback
      const team = await prisma.teams.findUnique({
        where: { teamCode: teamData.teamCode }
      });
      expect(team).toBeNull();
    });

    it('should handle concurrent updates correctly', async () => {
      const teamData = generateTeam();
      const team = await prisma.teams.create({ data: teamData });

      // Simulate concurrent updates
      const update1 = prisma.teams.update({
        where: { id: team.id },
        data: { name: 'Update 1' }
      });

      const update2 = prisma.teams.update({
        where: { id: team.id },
        data: { name: 'Update 2' }
      });

      // Both should succeed (last one wins)
      await Promise.all([update1, update2]);

      const finalTeam = await prisma.teams.findUnique({
        where: { id: team.id }
      });

      expect(['Update 1', 'Update 2']).toContain(finalTeam?.name);
    });
  });
});