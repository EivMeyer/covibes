#!/usr/bin/env node

import fetch from 'node-fetch';
import io from 'socket.io-client';

async function testDirectTerminal() {
  console.log('🧪 Direct Terminal Connection Test\n');
  
  // 1. Register user
  const user = {
    userName: 'DirectTest',
    email: `direct-${Date.now()}@test.com`,
    password: 'Test123!',
    teamName: 'Direct Test Team'
  };
  
  console.log('📝 Registering user...');
  const regResp = await fetch('http://localhost:3001/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  });
  
  const regData = await regResp.json();
  const token = regData.token;
  const userId = regData.user?.id;
  const teamId = regData.user?.teamId;
  
  console.log('✅ User registered');
  console.log('   User ID:', userId);
  console.log('   Team ID:', teamId);
  
  // 2. Spawn agent
  console.log('\n🤖 Spawning agent...');
  const spawnResp = await fetch('http://localhost:3001/api/agents/spawn', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      agentType: 'claude',
      task: 'Interactive terminal session for testing'
    })
  });
  
  const spawnData = await spawnResp.json();
  const agent = spawnData.agent;
  console.log('✅ Agent spawned');
  console.log('   Agent ID:', agent.id);
  console.log('   Status:', agent.status);
  
  // 3. Connect WebSocket
  console.log('\n🔌 Connecting WebSocket...');
  const socket = io('http://localhost:3001', {
    transports: ['websocket'],
    reconnection: false
  });
  
  await new Promise((resolve, reject) => {
    socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      resolve();
    });
    
    socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection failed:', error.message);
      reject(error);
    });
    
    setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
  });
  
  // 4. Join team
  console.log('\n👥 Joining team...');
  socket.emit('join-team', { teamId, token });
  
  await new Promise(resolve => {
    socket.once('team-joined', (data) => {
      console.log('✅ Joined team');
      console.log('   Team name:', data.teamData.name);
      resolve();
    });
  });
  
  // 5. Connect to terminal
  console.log('\n🖥️ Connecting to agent terminal...');
  
  // Set up terminal event listeners
  let terminalConnected = false;
  let claudeStarted = false;
  let outputBuffer = '';
  
  socket.on('terminal_connected', (data) => {
    console.log('✅ Terminal connected!');
    console.log('   Message:', data.message);
    terminalConnected = true;
  });
  
  socket.on('terminal_output', (data) => {
    if (data.agentId === agent.id) {
      outputBuffer += data.output;
      console.log('📤 Output:', data.output.replace(/\r?\n/g, '\\n').substring(0, 100));
    }
  });
  
  socket.on('claude_started', (data) => {
    console.log('🤖 Claude started!');
    claudeStarted = true;
  });
  
  socket.on('terminal_error', (data) => {
    console.error('❌ Terminal error:', data.error);
  });
  
  // Emit terminal connect
  socket.emit('terminal_connect', { agentId: agent.id });
  
  // Wait for terminal to connect
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  if (terminalConnected) {
    console.log('\n✅ SUCCESS! Terminal is connected');
    
    // Wait for Claude to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (claudeStarted || outputBuffer.includes('Claude') || outputBuffer.includes('claude')) {
      console.log('✅ Claude is running!');
      
      // Wait for Claude prompt to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 6. Send a prompt to Claude
      console.log('\n💬 Sending prompt to Claude...');
      const prompt = 'Write a simple Python hello world function';
      
      // Send each character slowly
      for (const char of prompt) {
        socket.emit('terminal_input', { 
          agentId: agent.id, 
          data: char
        });
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Send Enter
      socket.emit('terminal_input', { 
        agentId: agent.id, 
        data: '\r'
      });
      
      console.log('   Prompt sent:', prompt);
      
      // Wait for response
      console.log('\n⏳ Waiting for Claude response...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Check if we got Python code in response
      if (outputBuffer.includes('def') || outputBuffer.includes('print') || outputBuffer.includes('python') || outputBuffer.includes('Hello')) {
        console.log('\n✅ Claude responded with code!');
        console.log('\n📝 Full terminal output (last 2000 chars):');
        console.log('---');
        console.log(outputBuffer.substring(outputBuffer.length - 2000));
        console.log('---');
      } else {
        console.log('\n⚠️ No code detected in response');
        console.log('Output buffer (last 1000 chars):', outputBuffer.substring(outputBuffer.length - 1000));
      }
      
    } else {
      console.log('⚠️ Claude may not have started');
      console.log('Output so far:', outputBuffer.substring(0, 500));
    }
    
  } else {
    console.log('\n❌ Terminal failed to connect');
    
    // Check agent status
    const listResp = await fetch('http://localhost:3001/api/agents/list', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const { agents } = await listResp.json();
    
    if (agents && agents[0]) {
      console.log('\nAgent status:');
      console.log('  Status:', agents[0].status);
      console.log('  Output:', agents[0].output?.substring(0, 200));
    }
  }
  
  // 7. Disconnect
  console.log('\n🔌 Disconnecting...');
  socket.disconnect();
  
  console.log('\n✅ Test complete');
}

// Run test
testDirectTerminal()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });