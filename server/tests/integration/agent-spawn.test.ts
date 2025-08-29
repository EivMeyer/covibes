/**
 * Agent Spawning Integration Test
 * Tests agent spawning with and without tasks (interactive mode)
 */

import request from 'supertest';
import app from '../setup/test-app.js';

describe('Agent Spawning E2E Tests', () => {
  let authToken;
  let userId;
  let teamId;

  // Setup - create user and get auth token
  beforeAll(async () => {
    // Register a test user
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        teamName: 'Test Team E2E',
        userName: 'Test User',
        email: `test-e2e-${Date.now()}@example.com`,
        password: 'testpass123'
      });

    authToken = registerRes.body.token;
    userId = registerRes.body.user.id;
    teamId = registerRes.body.team.id;
  });

  describe('Spawning agent with task', () => {
    it('should spawn agent with task successfully', async () => {
      const response = await request(app)
        .post('/api/agents/spawn')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          task: 'Fix the login bug',
          agentType: 'claude'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Agent spawned successfully');
      expect(response.body.agent).toMatchObject({
        task: 'Fix the login bug',
        status: 'starting',
        agentType: 'claude',
        teamId: teamId,
        userId: userId,
        isOwner: true
      });
      expect(response.body.agent.id).toBeDefined();
      expect(response.body.agent.startedAt).toBeDefined();
    });

    it('should complete task-based agents', async (done) => {
      const spawnRes = await request(app)
        .post('/api/agents/spawn')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          task: 'Run tests',
          agentType: 'mock'
        });

      const agentId = spawnRes.body.agent.id;

      // Wait for agent to complete
      setTimeout(async () => {
        const detailsRes = await request(app)
          .get(`/api/agents/${agentId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(detailsRes.body.agent.status).toBe('completed');
        expect(detailsRes.body.agent.outputLines).toBeGreaterThan(0);
        done();
      }, 5000);
    }, 10000);
  });

  describe('Spawning agent without task (interactive mode)', () => {
    it('should spawn agent with empty task for interactive mode', async () => {
      const response = await request(app)
        .post('/api/agents/spawn')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          task: '',
          agentType: 'claude'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Agent spawned successfully');
      expect(response.body.agent).toMatchObject({
        task: '',
        status: 'starting',
        agentType: 'claude',
        teamId: teamId,
        userId: userId,
        isOwner: true
      });
    });

    it('should keep interactive agents running', async (done) => {
      const spawnRes = await request(app)
        .post('/api/agents/spawn')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          task: '',
          agentType: 'mock'
        });

      const agentId = spawnRes.body.agent.id;

      // Wait and check agent is still running
      setTimeout(async () => {
        const detailsRes = await request(app)
          .get(`/api/agents/${agentId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(detailsRes.body.agent.status).toBe('running');
        expect(detailsRes.body.agent.output).toBeDefined();
        
        // Check for interactive session messages in output
        const outputText = detailsRes.body.agent.output
          .map(o => o.line)
          .join('\n');
        
        expect(outputText).toContain('Interactive Claude Code session established');
        expect(outputText).toContain('Type your first message');
        
        done();
      }, 5000);
    }, 10000);

    it('should allow spawning without task field', async () => {
      const response = await request(app)
        .post('/api/agents/spawn')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          agentType: 'claude'
          // No task field at all
        });

      expect(response.status).toBe(201);
      expect(response.body.agent.task).toBe('');
    });
  });

  describe('Agent listing', () => {
    it('should list both task and interactive agents', async () => {
      // Spawn one of each type
      await request(app)
        .post('/api/agents/spawn')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          task: 'Task agent',
          agentType: 'mock'
        });

      await request(app)
        .post('/api/agents/spawn')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          task: '',
          agentType: 'mock'
        });

      // List agents
      const listRes = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${authToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.agents).toBeDefined();
      
      const taskAgent = listRes.body.agents.find(a => a.task === 'Task agent');
      const interactiveAgent = listRes.body.agents.find(a => a.task === '');
      
      expect(taskAgent).toBeDefined();
      expect(interactiveAgent).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should validate task length if provided', async () => {
      const response = await request(app)
        .post('/api/agents/spawn')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          task: 'abc', // Too short when provided
          agentType: 'claude'
        });

      // This should pass now since we removed the minimum length requirement
      expect(response.status).toBe(201);
    });

    it('should handle very long tasks', async () => {
      const longTask = 'a'.repeat(1001);
      
      const response = await request(app)
        .post('/api/agents/spawn')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          task: longTask,
          agentType: 'claude'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid input data');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/agents/spawn')
        .send({
          task: '',
          agentType: 'claude'
        });

      expect(response.status).toBe(401);
    });
  });
});