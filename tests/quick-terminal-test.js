#!/usr/bin/env node

import fetch from 'node-fetch';
import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:3001/api';
const WS_URL = 'http://localhost:3001';

async function quickTerminalTest() {
  console.log('🚀 Quick Terminal Test\n');
  
  // 1. Register user
  const user = {
    userName: 'TestUser',
    email: `test-${Date.now()}@test.com`,
    password: 'Test123!',
    teamName: 'Test Team'
  };
  
  console.log('📝 Registering user...');
  const regResp = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  });
  
  const { token, team } = await regResp.json();
  console.log('✅ User registered');
  console.log('   Email:', user.email);
  console.log('   Password:', user.password);
  console.log('   Team ID:', team.id);
  
  // 2. Spawn agent
  console.log('\n🤖 Spawning agent...');
  const spawnResp = await fetch(`${API_BASE}/agents/spawn`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      type: 'general',
      task: 'Terminal Test'
    })
  });
  
  const agent = await spawnResp.json();
  console.log('✅ Agent spawned');
  console.log('   Agent ID:', agent.id || 'No ID returned');
  
  // 3. Connect WebSocket and test terminal
  console.log('\n🔌 Connecting WebSocket...');
  const socket = io(WS_URL, {
    transports: ['websocket', 'polling']
  });
  
  return new Promise((resolve) => {
    socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      
      // Join team
      socket.emit('join-team', { teamId: team.id, token });
      
      socket.once('team-joined', () => {
        console.log('✅ Joined team');
        
        // Request terminal connection
        console.log('\n📡 Requesting terminal connection...');
        socket.emit('terminal_connect', { agentId: agent.id || 'test-agent' });
        
        // Listen for terminal events
        socket.on('terminal_connected', (data) => {
          console.log('✅ TERMINAL CONNECTED!');
          console.log('   Message:', data.message);
        });
        
        socket.on('terminal_output', (data) => {
          console.log('📟 Terminal Output:');
          console.log('   ', data.output.substring(0, 100).replace(/\n/g, ' '));
          
          // Send a test command after getting initial output
          setTimeout(() => {
            console.log('\n⌨️ Sending command: "echo Hello EC2"');
            socket.emit('terminal_input', {
              agentId: agent.id || 'test-agent',
              data: 'echo Hello EC2\r'
            });
          }, 2000);
        });
        
        socket.on('terminal_error', (data) => {
          console.log('❌ Terminal Error:', data.error);
        });
        
        socket.on('claude_started', () => {
          console.log('🤖 Claude started on EC2!');
        });
      });
    });
    
    // Auto-close after 10 seconds
    setTimeout(() => {
      console.log('\n✅ Test completed');
      console.log('\n📝 To test manually:');
      console.log('   1. Go to http://localhost:3000');
      console.log('   2. Login with:');
      console.log('      Email:', user.email);
      console.log('      Password:', user.password);
      console.log('   3. Click on the agent in the sidebar');
      console.log('   4. The terminal should connect to EC2\n');
      
      socket.disconnect();
      resolve();
    }, 10000);
  });
}

quickTerminalTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });