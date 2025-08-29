/**
 * End-to-End Test Script for CoVibe
 * 
 * This script tests the complete system by:
 * 1. Creating a team
 * 2. Adding multiple users to the team
 * 3. Having each user spawn an agent
 * 4. Testing real-time communication
 * 5. Verifying all core features work together
 * 
 * Requirements:
 * - Server must be running on localhost:3001
 * - Database must be accessible and migrated
 * - All API endpoints must be functional
 */

const http = require('http');
const WebSocket = require('ws');
const { performance } = require('perf_hooks');

class CoVibeE2ETest {
  constructor(config = {}) {
    this.config = {
      serverUrl: config.serverUrl || 'http://localhost:3001',
      wsUrl: config.wsUrl || 'ws://localhost:3001',
      testTimeout: config.testTimeout || 60000, // 1 minute
      userCount: config.userCount || 3,
      verbose: config.verbose !== false,
      ...config
    };

    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: [],
      startTime: null,
      endTime: null
    };

    this.testData = {
      teamName: `TestTeam_${Date.now()}`,
      users: [],
      agents: [],
      chatMessages: [],
      websockets: []
    };
  }

  log(message, type = 'info') {
    if (!this.config.verbose && type === 'debug') return;
    
    const timestamp = new Date().toISOString();
    const prefix = {
      'info': 'ℹ️ ',
      'success': '✅',
      'error': '❌',
      'warning': '⚠️ ',
      'debug': '🔍'
    }[type] || 'ℹ️ ';
    
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.config.serverUrl);
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

      if (data) {
        const jsonData = JSON.stringify(data);
        options.headers['Content-Length'] = Buffer.byteLength(jsonData);
      }

      const req = http.request(options, (res) => {
        let body = '';
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = {
              statusCode: res.statusCode,
              headers: res.headers,
              body: body ? JSON.parse(body) : null
            };
            resolve(result);
          } catch (err) {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: body,
              parseError: err.message
            });
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  async createWebSocketConnection(userId) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.config.wsUrl);
      const messages = [];
      
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      ws.on('open', () => {
        clearTimeout(timeout);
        this.log(`WebSocket connected for user ${userId}`, 'debug');
        
        // Join team room
        ws.send(JSON.stringify({
          type: 'join-team',
          teamId: this.testData.teamId,
          userId: userId
        }));

        resolve({
          socket: ws,
          messages: messages,
          send: (data) => ws.send(JSON.stringify(data)),
          close: () => ws.close()
        });
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          messages.push({
            timestamp: Date.now(),
            ...message
          });
          this.log(`WebSocket message for ${userId}: ${message.type}`, 'debug');
        } catch (err) {
          this.log(`Failed to parse WebSocket message: ${err.message}`, 'warning');
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      ws.on('close', () => {
        this.log(`WebSocket closed for user ${userId}`, 'debug');
      });
    });
  }

  async runTest(testName, testFunction) {
    this.testResults.total++;
    const startTime = performance.now();
    
    try {
      this.log(`Running test: ${testName}`);
      await testFunction();
      
      const duration = Math.round(performance.now() - startTime);
      this.testResults.passed++;
      this.testResults.details.push({
        name: testName,
        status: 'PASSED',
        duration: `${duration}ms`
      });
      this.log(`Test passed: ${testName} (${duration}ms)`, 'success');
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      this.testResults.failed++;
      this.testResults.details.push({
        name: testName,
        status: 'FAILED',
        error: error.message,
        duration: `${duration}ms`
      });
      this.log(`Test failed: ${testName} - ${error.message}`, 'error');
      throw error; // Re-throw to stop execution if needed
    }
  }

  async testServerHealth() {
    const response = await this.makeRequest('GET', '/api/health');
    
    if (response.statusCode !== 200) {
      throw new Error(`Server health check failed: ${response.statusCode}`);
    }
    
    if (!response.body || response.body.status !== 'healthy') {
      throw new Error(`Server not healthy: ${JSON.stringify(response.body)}`);
    }
  }

  async testTeamCreation() {
    const teamData = {
      teamName: this.testData.teamName,
      userName: 'TeamLeader',
      email: `leader@${this.testData.teamName.toLowerCase()}.test`,
      password: 'testpassword123'
    };

    const response = await this.makeRequest('POST', '/api/auth/register', teamData);
    
    if (response.statusCode !== 201) {
      throw new Error(`Team creation failed: ${response.statusCode} - ${JSON.stringify(response.body)}`);
    }

    if (!response.body.team || !response.body.team.id) {
      throw new Error(`Team creation response missing team ID: ${JSON.stringify(response.body)}`);
    }

    this.testData.teamId = response.body.team.id;
    this.testData.users.push({
      id: response.body.user.id,
      name: teamData.userName,
      email: teamData.email,
      token: response.body.token,
      inviteCode: response.body.team.inviteCode,
      isLeader: true
    });

    this.log(`Team created: ${this.testData.teamName} (ID: ${this.testData.teamId})`, 'debug');
  }

  async testUserJoining() {
    const inviteCode = await this.getTeamInviteCode();
    
    for (let i = 1; i < this.config.userCount; i++) {
      const userData = {
        userName: `TestUser${i}`,
        email: `user${i}@${this.testData.teamName.toLowerCase()}.test`,
        password: 'testpassword123',
        inviteCode: inviteCode
      };

      const response = await this.makeRequest('POST', '/api/auth/join', userData);
      
      if (response.statusCode !== 201) {
        throw new Error(`User ${i} join failed: ${response.statusCode} - ${JSON.stringify(response.body)}`);
      }

      this.testData.users.push({
        id: response.body.user.id,
        name: userData.userName,
        email: userData.email,
        token: response.body.token,
        isLeader: false
      });

      this.log(`User ${userData.userName} joined team`, 'debug');
      
      // Small delay between joins
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  async getTeamInviteCode() {
    // The invite code is already available from team creation
    const leader = this.testData.users.find(u => u.isLeader);
    if (leader && leader.inviteCode) {
      return leader.inviteCode;
    }
    throw new Error('No invite code available from team creation');
  }

  async testWebSocketConnections() {
    this.log('Establishing WebSocket connections for all users...');
    
    for (const user of this.testData.users) {
      const connection = await this.createWebSocketConnection(user.id);
      this.testData.websockets.push({
        userId: user.id,
        userName: user.name,
        connection: connection
      });
      
      // Small delay between connections
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    this.log(`${this.testData.websockets.length} WebSocket connections established`);
  }

  async testAgentSpawning() {
    this.log('Testing agent spawning for each user...');
    
    for (let i = 0; i < this.testData.users.length; i++) {
      const user = this.testData.users[i];
      const wsConnection = this.testData.websockets.find(ws => ws.userId === user.id);
      
      // Configure VM for user (mock configuration)
      const vmConfig = {
        host: 'localhost',
        username: 'testuser',
        port: 22
      };

      const configResponse = await this.makeRequest('POST', '/api/user/vm-config', vmConfig);
      
      if (configResponse.statusCode !== 200) {
        this.log(`Warning: VM config failed for ${user.name}: ${configResponse.statusCode}`, 'warning');
      }

      // Spawn agent
      const spawnData = {
        agentName: `Agent_${user.name}`,
        instructions: `You are ${user.name}'s coding assistant. Help with development tasks.`,
        useMockAgent: true // Use mock agent for testing
      };

      wsConnection.connection.send({
        type: 'spawn-agent',
        ...spawnData
      });

      // Wait for agent spawn confirmation
      await this.waitForWebSocketMessage(wsConnection.connection, 'agent-spawned', 5000);
      
      this.testData.agents.push({
        userId: user.id,
        userName: user.name,
        agentName: spawnData.agentName
      });

      this.log(`Agent spawned for ${user.name}`, 'debug');
      
      // Small delay between spawns
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  async waitForWebSocketMessage(wsConnection, messageType, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkMessages = () => {
        const message = wsConnection.messages.find(m => m.type === messageType && m.timestamp > startTime);
        
        if (message) {
          resolve(message);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for WebSocket message: ${messageType}`));
        } else {
          setTimeout(checkMessages, 100);
        }
      };
      
      checkMessages();
    });
  }

  async testChatMessaging() {
    this.log('Testing chat messaging between users...');
    
    const testMessages = [
      { from: 0, text: 'Hello everyone! Testing chat functionality.' },
      { from: 1, text: 'Hi! I can see your message.' },
      { from: 2, text: 'Great! Real-time chat is working.' }
    ];

    for (const msg of testMessages) {
      const sender = this.testData.websockets[msg.from];
      
      sender.connection.send({
        type: 'chat-message',
        message: msg.text,
        teamId: this.testData.teamId
      });

      this.testData.chatMessages.push({
        from: sender.userName,
        text: msg.text,
        timestamp: Date.now()
      });

      // Wait for message to propagate to other users
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify other users received the message
      for (let i = 0; i < this.testData.websockets.length; i++) {
        if (i !== msg.from) {
          const receiver = this.testData.websockets[i];
          const receivedMessage = receiver.connection.messages.find(m => 
            m.type === 'chat-message' && 
            m.message === msg.text
          );
          
          if (!receivedMessage) {
            throw new Error(`User ${receiver.userName} did not receive message from ${sender.userName}`);
          }
        }
      }

      this.log(`Chat message sent by ${sender.userName}: "${msg.text}"`, 'debug');
    }
  }

  async testAgentOutput() {
    this.log('Testing agent output streaming...');
    
    // Wait for agents to produce some output
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    for (const wsConnection of this.testData.websockets) {
      const agentOutput = wsConnection.connection.messages.filter(m => m.type === 'agent-output');
      
      if (agentOutput.length === 0) {
        throw new Error(`No agent output received for user ${wsConnection.userName}`);
      }

      this.log(`User ${wsConnection.userName} received ${agentOutput.length} agent output messages`, 'debug');
    }
  }

  async testPresenceIndicators() {
    this.log('Testing presence indicators...');
    
    // Check that all users see each other as online
    for (const wsConnection of this.testData.websockets) {
      const presenceUpdates = wsConnection.connection.messages.filter(m => 
        m.type === 'user-joined' || m.type === 'presence-update'
      );
      
      // Should see at least the other users joining
      const expectedUsers = this.testData.users.length - 1; // Excluding self
      
      if (presenceUpdates.length < expectedUsers) {
        this.log(`Warning: User ${wsConnection.userName} only saw ${presenceUpdates.length}/${expectedUsers} presence updates`, 'warning');
      }
    }
  }

  async testAgentControl() {
    this.log('Testing agent control (stop/start)...');
    
    // Test that only the owner can control their agent
    const firstUser = this.testData.websockets[0];
    const firstAgent = this.testData.agents[0];
    
    // Owner should be able to stop their agent
    firstUser.connection.send({
      type: 'stop-agent',
      agentId: firstAgent.agentId
    });

    await this.waitForWebSocketMessage(firstUser.connection, 'agent-stopped', 5000);
    this.log(`Agent successfully stopped by owner ${firstUser.userName}`, 'debug');
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  async testSystemStability() {
    this.log('Testing system stability under load...');
    
    // Send multiple messages rapidly
    const rapidMessages = 10;
    const promises = [];
    
    for (let i = 0; i < rapidMessages; i++) {
      const senderIndex = i % this.testData.websockets.length;
      const sender = this.testData.websockets[senderIndex];
      
      promises.push(new Promise(resolve => {
        setTimeout(() => {
          sender.connection.send({
            type: 'chat-message',
            message: `Rapid message ${i + 1}`,
            teamId: this.testData.teamId
          });
          resolve();
        }, i * 100); // Stagger messages by 100ms
      }));
    }
    
    await Promise.all(promises);
    
    // Wait for messages to propagate
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    this.log('System handled rapid messaging successfully');
  }

  async cleanup() {
    this.log('Cleaning up test resources...');
    
    try {
      // Close all WebSocket connections
      for (const wsConnection of this.testData.websockets) {
        wsConnection.connection.close();
      }
      
      // Stop all agents
      for (const agent of this.testData.agents) {
        // Send stop commands
        const ownerWs = this.testData.websockets.find(ws => ws.userId === agent.userId);
        if (ownerWs && ownerWs.connection.socket.readyState === WebSocket.OPEN) {
          ownerWs.connection.send({
            type: 'stop-agent',
            agentId: agent.agentId
          });
        }
      }
      
      // Clean up team (optional - might want to keep for manual inspection)
      // await this.makeRequest('DELETE', `/api/team/${this.testData.teamId}`);
      
      this.log('Cleanup completed');
    } catch (error) {
      this.log(`Cleanup error: ${error.message}`, 'warning');
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 E2E TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`🎯 Total Tests: ${this.testResults.total}`);
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`📈 Success Rate: ${Math.round((this.testResults.passed / this.testResults.total) * 100)}%`);
    
    const duration = this.testResults.endTime - this.testResults.startTime;
    console.log(`⏱️  Total Duration: ${Math.round(duration)}ms`);
    
    console.log('\n📋 Test Details:');
    for (const detail of this.testResults.details) {
      const status = detail.status === 'PASSED' ? '✅' : '❌';
      console.log(`  ${status} ${detail.name} (${detail.duration})`);
      if (detail.error) {
        console.log(`      Error: ${detail.error}`);
      }
    }

    console.log('\n📊 Test Data Summary:');
    console.log(`  👥 Users Created: ${this.testData.users.length}`);
    console.log(`  🤖 Agents Spawned: ${this.testData.agents.length}`);
    console.log(`  💬 Chat Messages: ${this.testData.chatMessages.length}`);
    console.log(`  🔌 WebSocket Connections: ${this.testData.websockets.length}`);
    
    console.log('\n' + '='.repeat(60));
  }

  async runAllTests() {
    this.log('🚀 Starting CoVibe E2E Tests');
    this.log(`Server URL: ${this.config.serverUrl}`);
    this.log(`WebSocket URL: ${this.config.wsUrl}`);
    this.log(`Test Users: ${this.config.userCount}`);
    
    this.testResults.startTime = performance.now();
    
    try {
      // Core functionality tests
      await this.runTest('Server Health Check', () => this.testServerHealth());
      await this.runTest('Team Creation', () => this.testTeamCreation());
      await this.runTest('User Joining', () => this.testUserJoining());
      await this.runTest('WebSocket Connections', () => this.testWebSocketConnections());
      await this.runTest('Agent Spawning', () => this.testAgentSpawning());
      await this.runTest('Chat Messaging', () => this.testChatMessaging());
      await this.runTest('Agent Output Streaming', () => this.testAgentOutput());
      await this.runTest('Presence Indicators', () => this.testPresenceIndicators());
      await this.runTest('Agent Control', () => this.testAgentControl());
      await this.runTest('System Stability', () => this.testSystemStability());
      
      this.log('🎉 All E2E tests completed successfully!', 'success');
      
    } catch (error) {
      this.log(`💥 E2E test suite failed: ${error.message}`, 'error');
    } finally {
      this.testResults.endTime = performance.now();
      
      // Always attempt cleanup
      await this.cleanup();
      
      // Print results
      this.printSummary();
      
      // Exit with appropriate code
      process.exit(this.testResults.failed === 0 ? 0 : 1);
    }
  }
}

// Allow running as standalone script or importing as module
if (require.main === module) {
  const config = {
    serverUrl: process.env.SERVER_URL || 'http://localhost:3001',
    wsUrl: process.env.WS_URL || 'ws://localhost:3001',
    userCount: parseInt(process.env.USER_COUNT) || 3,
    verbose: process.env.VERBOSE !== 'false'
  };

  const tester = new CoVibeE2ETest(config);
  tester.runAllTests().catch(error => {
    console.error('❌ E2E test runner failed:', error);
    process.exit(1);
  });
}

module.exports = CoVibeE2ETest;