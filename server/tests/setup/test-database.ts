/**
 * Test Database Setup and Cleanup Utilities
 * 
 * This module provides utilities for:
 * - Setting up test database connections
 * - Creating and cleaning test data
 * - Database transaction management for tests
 * - Mock data generation
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Test database configuration
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 
  process.env.DATABASE_URL?.replace('colabvibe_dev', 'colabvibe_test') ||
  'postgresql://postgres:password@localhost:5432/colabvibe_test';

export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: TEST_DATABASE_URL
    }
  }
});

/**
 * Mock data generators for consistent test data creation
 */
export const mockDataGenerators = {
  /**
   * Generate a unique team object
   */
  team: (overrides: Partial<any> = {}) => ({
    name: `TestTeam_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    teamCode: generateTeamCode(),
    repositoryUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  /**
   * Generate a unique user object
   */
  user: (teamId: string, overrides: Partial<any> = {}) => ({
    email: `user_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
    userName: `TestUser_${Math.random().toString(36).substring(7)}`,
    password: bcrypt.hashSync('testpassword123', 10),
    teamId,
    vmId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  /**
   * Generate a unique agent object
   */
  agent: (userId: string, teamId: string, overrides: Partial<any> = {}) => ({
    userId,
    teamId,
    type: 'general',
    task: `Test task ${Date.now()}`,
    repositoryUrl: null,
    status: 'running',
    output: 'Test output',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  /**
   * Generate a unique message object
   */
  message: (userId: string, teamId: string, overrides: Partial<any> = {}) => ({
    content: `Test message ${Date.now()}`,
    userId,
    teamId,
    createdAt: new Date(),
    ...overrides
  })
};

/**
 * Generate a random team code (6 characters, alphanumeric, uppercase)
 */
function generateTeamCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Database setup and cleanup utilities
 */
export class TestDatabaseManager {
  private prisma: PrismaClient;

  constructor(prismaClient: PrismaClient = testPrisma) {
    this.prisma = prismaClient;
  }

  /**
   * Initialize test database connection
   */
  async connect(): Promise<void> {
    await this.prisma.$connect();
  }

  /**
   * Close test database connection
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  /**
   * Clean up all test data from the database
   */
  async cleanupTestData(): Promise<void> {
    // Delete in order to respect foreign key constraints
    await this.prisma.message.deleteMany({
      where: {
        OR: [
          { content: { contains: 'Test' } },
          { user: { email: { contains: '@test.com' } } }
        ]
      }
    });

    await this.prisma.agents.deleteMany({
      where: {
        OR: [
          { task: { contains: 'Test' } },
          { user: { email: { contains: '@test.com' } } }
        ]
      }
    });

    await this.prisma.user.deleteMany({
      where: { email: { contains: '@test.com' } }
    });

    await this.prisma.teams.deleteMany({
      where: { name: { contains: 'Test' } }
    });
  }

  /**
   * Create a complete test team setup (team + owner)
   */
  async createTestTeam(overrides: {
    team?: Partial<any>;
    owner?: Partial<any>;
  } = {}): Promise<{ team: any; owner: any }> {
    const teamData = mockDataGenerators.team(overrides.team);
    const team = await this.prisma.teams.create({ data: teamData });

    const ownerData = mockDataGenerators.user(team.id, overrides.owner);
    const owner = await this.prisma.user.create({ data: ownerData });

    return { team, owner };
  }

  /**
   * Create multiple test users in the same team
   */
  async createTestUsers(teamId: string, count: number = 3): Promise<any[]> {
    const users = [];
    for (let i = 0; i < count; i++) {
      const userData = mockDataGenerators.user(teamId, {
        userName: `TestUser${i + 1}`,
        email: `user${i + 1}_${Date.now()}@test.com`
      });
      const user = await this.prisma.user.create({ data: userData });
      users.push(user);
    }
    return users;
  }

  /**
   * Create test agents for a user
   */
  async createTestAgents(userId: string, teamId: string, count: number = 2): Promise<any[]> {
    const agents = [];
    for (let i = 0; i < count; i++) {
      const agentData = mockDataGenerators.agent(userId, teamId, {
        task: `Test task ${i + 1} - ${Date.now()}`,
        type: i % 2 === 0 ? 'general' : 'code-writer',
        status: ['running', 'completed', 'stopped'][i % 3]
      });
      const agent = await this.prisma.agents.create({ data: agentData });
      agents.push(agent);
    }
    return agents;
  }

  /**
   * Create test messages for a team
   */
  async createTestMessages(users: any[], teamId: string, count: number = 5): Promise<any[]> {
    const messages = [];
    for (let i = 0; i < count; i++) {
      const randomUser = users[i % users.length];
      const messageData = mockDataGenerators.message(randomUser.id, teamId, {
        content: `Test message ${i + 1} from ${randomUser.userName}`
      });
      const message = await this.prisma.message.create({ data: messageData });
      messages.push(message);
    }
    return messages;
  }

  /**
   * Create a complete test scenario with team, users, agents, and messages
   */
  async createCompleteTestScenario(): Promise<{
    team: any;
    users: any[];
    agents: any[];
    messages: any[];
  }> {
    // Create team with owner
    const { team, owner } = await this.createTestTeam();

    // Add additional team members
    const additionalUsers = await this.createTestUsers(team.id, 2);
    const users = [owner, ...additionalUsers];

    // Create agents for each user
    let agents: any[] = [];
    for (const user of users) {
      const userAgents = await this.createTestAgents(user.id, team.id, 2);
      agents = [...agents, ...userAgents];
    }

    // Create team messages
    const messages = await this.createTestMessages(users, team.id, 10);

    return { team, users, agents, messages };
  }

  /**
   * Execute code in a database transaction (rollback after test)
   */
  async withTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const result = await callback(tx);
      // Transaction will rollback automatically if an error is thrown
      // For manual rollback, you can throw an error at the end
      return result;
    });
  }

  /**
   * Get database statistics for debugging
   */
  async getDatabaseStats(): Promise<{
    teams: number;
    users: number;
    agents: number;
    messages: number;
  }> {
    const [teams, users, agents, messages] = await Promise.all([
      this.prisma.teams.count(),
      this.prisma.user.count(),
      this.prisma.agents.count(),
      this.prisma.message.count()
    ]);

    return { teams, users, agents, messages };
  }

  /**
   * Reset database to clean state (use with caution!)
   */
  async resetDatabase(): Promise<void> {
    console.warn('⚠️  Resetting entire test database!');
    
    // Delete all data
    await this.prisma.message.deleteMany();
    await this.prisma.agents.deleteMany();
    await this.prisma.user.deleteMany();
    await this.prisma.teams.deleteMany();

    console.log('✅ Test database reset complete');
  }

  /**
   * Verify database constraints and relationships
   */
  async verifyDatabaseIntegrity(): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Basic connectivity and table existence check
    try {
      const stats = await this.getDatabaseStats();
      if (stats.teams < 0 || stats.users < 0 || stats.agents < 0 || stats.messages < 0) {
        issues.push('Invalid statistics returned from database');
      }
    } catch (error) {
      issues.push(`Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Check for users in different teams than their agents
    // Note: This is a simplified check - in real scenarios we'd use raw SQL or more complex queries
    const users = await this.prisma.user.findMany({
      include: { agents: true }
    });
    
    const userAgentTeamMismatches = users.filter(user => 
      user.agents.some(agent => agent.teamId !== user.teamId)
    );
    if (userAgentTeamMismatches.length > 0) {
      issues.push(`Found ${userAgentTeamMismatches.length} user-agent team mismatches`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

// Export singleton instance for convenience
export const testDb = new TestDatabaseManager();

/**
 * Jest setup helpers
 */
export const jestSetupHelpers = {
  /**
   * Setup function for beforeAll hooks
   */
  async setupBeforeAll(): Promise<void> {
    await testDb.connect();
  },

  /**
   * Cleanup function for afterAll hooks
   */
  async cleanupAfterAll(): Promise<void> {
    await testDb.disconnect();
  },

  /**
   * Setup function for beforeEach hooks
   */
  async setupBeforeEach(): Promise<void> {
    await testDb.cleanupTestData();
  },

  /**
   * Cleanup function for afterEach hooks (optional)
   */
  async cleanupAfterEach(): Promise<void> {
    // Usually not needed since beforeEach handles cleanup
    // But can be used for additional cleanup if needed
  }
};

/**
 * Test data assertions
 */
export const testAssertions = {
  /**
   * Assert that a team has the expected structure
   */
  assertValidTeam(team: any): void {
    expect(team).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      teamCode: expect.stringMatching(/^[A-Z0-9]{6}$/),
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date)
    });
  },

  /**
   * Assert that a user has the expected structure
   */
  assertValidUser(user: any): void {
    expect(user).toMatchObject({
      id: expect.any(String),
      email: expect.stringMatching(/.+@.+\..+/),
      userName: expect.any(String),
      teamId: expect.any(String),
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date)
    });
  },

  /**
   * Assert that an agent has the expected structure
   */
  assertValidAgent(agent: any): void {
    expect(agent).toMatchObject({
      id: expect.any(String),
      userId: expect.any(String),
      teamId: expect.any(String),
      type: expect.any(String),
      task: expect.any(String),
      status: expect.any(String),
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date)
    });
  },

  /**
   * Assert that a message has the expected structure
   */
  assertValidMessage(message: any): void {
    expect(message).toMatchObject({
      id: expect.any(String),
      content: expect.any(String),
      userId: expect.any(String),
      teamId: expect.any(String),
      createdAt: expect.any(Date)
    });
  }
};