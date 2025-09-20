#!/usr/bin/env node

/**
 * Monitor chat agents in real-time via WebSocket
 */

import { io } from 'socket.io-client';
import { execSync } from 'child_process';

// Login and get token
const loginCmd = `curl -s -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"email":"alice@demo.com","password":"demo123"}'`;
const loginResponse = JSON.parse(execSync(loginCmd, { encoding: 'utf-8' }));
const token = loginResponse.token;
const teamId = loginResponse.teamId || 'demo-team-001';

console.log('🔌 Connecting to WebSocket...');

// Connect to WebSocket
const socket = io('http://localhost:3001', {
  auth: { token },
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('✅ Connected to WebSocket');

  // Join team room
  socket.emit('join_team', { teamId, token });
  console.log(`📡 Joined team: ${teamId}\n`);

  // Spawn the agent after connection
  spawnAndTest();
});

// Listen for all agent-related events
socket.on('agent_chat_response', (data) => {
  console.log('💬 CHAT RESPONSE EVENT:');
  console.log('   Agent:', data.agentId);
  console.log('   Response:', data.response);
  console.log('   Timestamp:', data.timestamp);
  console.log('');
});

socket.on('agent-output', (data) => {
  console.log('📤 AGENT OUTPUT EVENT:');
  console.log('   Agent:', data.agentId);
  console.log('   Data:', data.data?.substring(0, 100));
  console.log('');
});

socket.on('message', (data) => {
  if (data.senderId?.startsWith('agent-')) {
    console.log('💬 MESSAGE EVENT (from agent):');
    console.log('   Content:', data.content);
    console.log('');
  }
});

socket.on('agent-spawned', (data) => {
  console.log('🚀 AGENT SPAWNED:', data);
});

socket.on('agent-status', (data) => {
  console.log('📊 AGENT STATUS:', data.status, '-', data.message);
});

async function spawnAndTest() {
  // Spawn chat agent
  const spawnCmd = `curl -s -X POST http://localhost:3001/api/agents/spawn \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -d '{"task":"","mode":"chat","terminalIsolation":"none","agentType":"claude"}'`;

  const spawnResponse = JSON.parse(execSync(spawnCmd, { encoding: 'utf-8' }));
  const agentId = spawnResponse.agent?.id;

  console.log(`🤖 Spawned agent: ${agentId}\n`);

  // Wait a bit for agent to be ready
  await new Promise(r => setTimeout(r, 2000));

  // Send test message
  console.log('📨 Sending test message...\n');
  const inputCmd = `curl -s -X POST http://localhost:3001/api/agents/${agentId}/input \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -d '{"input":"Say exactly: WebSocket monitoring successful"}'`;

  execSync(inputCmd);

  // Wait for response
  console.log('⏳ Waiting for response (10 seconds)...\n');
  await new Promise(r => setTimeout(r, 10000));

  // Clean up
  const killCmd = `curl -s -X DELETE http://localhost:3001/api/agents/${agentId} \
    -H "Authorization: Bearer ${token}"`;
  execSync(killCmd);

  console.log('✅ Test complete!');
  socket.disconnect();
  process.exit(0);
}

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  process.exit(1);
});