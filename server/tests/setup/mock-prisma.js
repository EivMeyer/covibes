/**
 * Mock Prisma client for testing
 * Simulates database operations without requiring actual database
 */

class MockPrismaClient {
  constructor() {
    // In-memory storage for mock data
    this.data = {
      preview_deployments: new Map(),
      teams: new Map(),
      users: new Map(),
      agents: new Map()
    };
    
    // Set up mock models
    this.preview_deployments = {
      findUnique: async ({ where }) => {
        if (where.teamId) {
          return this.data.preview_deployments.get(where.teamId) || null;
        }
        return null;
      },
      
      findMany: async ({ where }) => {
        const results = [];
        for (const [key, value] of this.data.preview_deployments) {
          if (!where || (where.status && value.status === where.status)) {
            results.push(value);
          }
        }
        return results;
      },
      
      create: async ({ data }) => {
        const deployment = {
          ...data,
          id: data.id || `preview-${Date.now()}`,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        this.data.preview_deployments.set(data.teamId, deployment);
        return deployment;
      },
      
      update: async ({ where, data }) => {
        const existing = this.data.preview_deployments.get(where.teamId);
        if (existing) {
          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date()
          };
          this.data.preview_deployments.set(where.teamId, updated);
          return updated;
        }
        throw new Error('Record not found');
      },
      
      upsert: async ({ where, create, update }) => {
        const existing = this.data.preview_deployments.get(where.teamId);
        if (existing) {
          return this.preview_deployments.update({ where, data: update });
        } else {
          return this.preview_deployments.create({ data: create });
        }
      },
      
      delete: async ({ where }) => {
        const existing = this.data.preview_deployments.get(where.teamId);
        if (existing) {
          this.data.preview_deployments.delete(where.teamId);
          return existing;
        }
        throw new Error('Record not found');
      },
      
      deleteMany: async ({ where }) => {
        let count = 0;
        if (where && where.teamId) {
          if (this.data.preview_deployments.has(where.teamId)) {
            this.data.preview_deployments.delete(where.teamId);
            count = 1;
          }
        } else {
          count = this.data.preview_deployments.size;
          this.data.preview_deployments.clear();
        }
        return { count };
      }
    };
    
    this.teams = {
      findUnique: async ({ where }) => {
        if (where.id) {
          return this.data.teams.get(where.id) || null;
        }
        return null;
      },
      
      create: async ({ data }) => {
        const team = {
          ...data,
          id: data.id || `team-${Date.now()}`,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        this.data.teams.set(team.id, team);
        return team;
      },
      
      update: async ({ where, data }) => {
        const existing = this.data.teams.get(where.id);
        if (existing) {
          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date()
          };
          this.data.teams.set(where.id, updated);
          return updated;
        }
        throw new Error('Team not found');
      }
    };
    
    this.agent = {
      deleteMany: async () => {
        this.data.agents.clear();
        return { count: 0 };
      }
    };
  }
  
  async $disconnect() {
    // Mock disconnect
    return Promise.resolve();
  }
  
  async $connect() {
    // Mock connect
    return Promise.resolve();
  }
  
  // Clear all data (useful for test cleanup)
  clearAll() {
    for (const collection of Object.values(this.data)) {
      if (collection instanceof Map) {
        collection.clear();
      }
    }
  }
}

module.exports = { MockPrismaClient };