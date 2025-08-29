#!/usr/bin/env node

/**
 * Backend Integration Test for CoVibe
 * Tests all backend API endpoints and functionality
 */

const http = require('http');
const assert = require('assert');

class BackendIntegrationTest {
  constructor() {
    this.baseUrl = 'http://localhost:3001';
    this.testData = {
      team: null,
      users: [],
      agents: []
    };
    this.passed = 0;
    this.failed = 0;
  }

  async request(method, path, data = null, token = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const options = {
        method,
        hostname: url.hostname,
        port: url.port || 3001,
        path: url.pathname,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };

      if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
      }

      if (data) {
        const jsonData = JSON.stringify(data);
        options.headers['Content-Length'] = Buffer.byteLength(jsonData);
      }

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              data: body ? JSON.parse(body) : null
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              data: body
            });
          }
        });
      });

      req.on('error', reject);
      if (data) req.write(JSON.stringify(data));
      req.end();
    });
  }

  async test(name, fn) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      this.passed++;
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      this.failed++;
    }
  }

  async run() {
    console.log('🧪 CoVibe Backend Integration Tests\n');
    console.log('=' .repeat(50));

    // Health Check
    await this.test('Health check endpoint', async () => {
      const res = await this.request('GET', '/api/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.status, 'healthy');
    });

    // Authentication Tests
    await this.test('Register new team', async () => {
      const res = await this.request('POST', '/api/auth/register', {
        teamName: `TestTeam_${Date.now()}`,
        userName: 'Leader',
        email: `leader${Date.now()}@test.com`,
        password: 'password123'
      });
      assert.strictEqual(res.status, 201);
      assert.ok(res.data.token);
      assert.ok(res.data.team.inviteCode);
      
      this.testData.team = res.data.team;
      this.testData.users.push({
        ...res.data.user,
        token: res.data.token,
        password: 'password123'
      });
    });

    await this.test('Login with credentials', async () => {
      const user = this.testData.users[0];
      const res = await this.request('POST', '/api/auth/login', {
        email: user.email,
        password: user.password
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.token);
    });

    await this.test('Get authenticated user info', async () => {
      const user = this.testData.users[0];
      const res = await this.request('GET', '/api/auth/me', null, user.token);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.user.email, user.email);
    });

    await this.test('Join team with invite code', async () => {
      const res = await this.request('POST', '/api/auth/join', {
        inviteCode: this.testData.team.inviteCode,
        userName: 'Member1',
        email: `member${Date.now()}@test.com`,
        password: 'password123'
      });
      assert.strictEqual(res.status, 201);
      assert.ok(res.data.token);
      
      this.testData.users.push({
        ...res.data.user,
        token: res.data.token
      });
    });

    // VM Configuration Tests
    await this.test('Configure VM credentials', async () => {
      const user = this.testData.users[0];
      const res = await this.request('POST', '/api/vm/configure', {
        host: 'test.example.com',
        port: 22,
        username: 'testuser',
        privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----\ntest-key-content\n-----END OPENSSH PRIVATE KEY-----'
      }, user.token);
      assert.strictEqual(res.status, 200);
    });

    await this.test('Get VM status', async () => {
      const user = this.testData.users[0];
      const res = await this.request('GET', '/api/vm/status', null, user.token);
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.hasOwnProperty('configured'));
    });

    // Agent Management Tests
    await this.test('Spawn mock agent', async () => {
      const user = this.testData.users[0];
      const res = await this.request('POST', '/api/agents/spawn', {
        task: 'Test task',
        useMockAgent: true
      }, user.token);
      assert.strictEqual(res.status, 201);
      assert.ok(res.data.agent.id);
      
      this.testData.agents.push(res.data.agent);
    });

    await this.test('Get team agents', async () => {
      const user = this.testData.users[0];
      const res = await this.request('GET', '/api/agents', null, user.token);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data.agents));
      assert.ok(res.data.agents.length > 0);
    });

    await this.test('Get agent by ID', async () => {
      const user = this.testData.users[0];
      const agent = this.testData.agents[0];
      const res = await this.request('GET', `/api/agents/${agent.id}`, null, user.token);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.agent.id, agent.id);
    });

    await this.test('Kill agent', async () => {
      const user = this.testData.users[0];
      const agent = this.testData.agents[0];
      const res = await this.request('DELETE', `/api/agents/${agent.id}`, null, user.token);
      assert.strictEqual(res.status, 200);
    });

    // Error Handling Tests
    await this.test('Reject invalid registration data', async () => {
      const res = await this.request('POST', '/api/auth/register', {
        teamName: 'Test'
        // Missing required fields
      });
      assert.strictEqual(res.status, 400);
    });

    await this.test('Reject invalid login', async () => {
      const res = await this.request('POST', '/api/auth/login', {
        email: 'nonexistent@test.com',
        password: 'wrongpassword'
      });
      assert.strictEqual(res.status, 401);
    });

    await this.test('Reject unauthorized access', async () => {
      const res = await this.request('GET', '/api/agents');
      assert.strictEqual(res.status, 401);
    });

    await this.test('Handle non-existent agent', async () => {
      const user = this.testData.users[0];
      const res = await this.request('GET', '/api/agents/non-existent-id', null, user.token);
      assert.strictEqual(res.status, 404);
    });

    // Summary
    console.log('\n' + '=' .repeat(50));
    console.log(`📊 Results: ${this.passed} passed, ${this.failed} failed`);
    
    if (this.failed === 0) {
      console.log('✅ All backend integration tests passed!');
    } else {
      console.log('❌ Some tests failed. Please check the errors above.');
      process.exit(1);
    }
  }
}

// Run tests
const tester = new BackendIntegrationTest();
tester.run().catch(console.error);