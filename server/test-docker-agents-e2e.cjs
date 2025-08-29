#!/usr/bin/env node

/**
 * End-to-End Test for Docker Multi-Agent System
 * Tests the complete flow from login to agent spawning to container verification
 */

const http = require('http');

// Test configuration
const API_BASE = 'http://localhost:3001';
const TEST_USER = {
  email: 'e2etest@example.com',
  password: 'testpass123'
};

let authToken = null;
let teamId = null;
let spawnedAgentId = null;

// Utility function to make HTTP requests
function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test functions
async function testLogin() {
  console.log('🔐 Testing user login...');
  
  const response = await makeRequest('POST', '/api/auth/login', TEST_USER);
  
  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }
  
  if (!response.data.token) {
    throw new Error('No token received from login');
  }
  
  authToken = response.data.token;
  teamId = response.data.user.teamId;
  
  console.log(`✅ Login successful! User: ${response.data.user.userName}, Team: ${teamId.slice(0,8)}`);
}

async function testAgentSpawn() {
  console.log('🚀 Testing agent spawn with Docker containers...');
  
  const agentData = {
    task: 'E2E Test: Create a simple Python hello world script',
    agentType: 'claude'
  };
  
  const response = await makeRequest('POST', '/api/agents/spawn', agentData, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (response.status !== 201) {
    throw new Error(`Agent spawn failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }
  
  spawnedAgentId = response.data.agent.id;
  
  console.log(`✅ Agent spawned! ID: ${spawnedAgentId.slice(0,8)}, Status: ${response.data.agent.status}`);
  console.log(`   Task: ${response.data.agent.task.slice(0,50)}...`);
}

async function testAgentList() {
  console.log('📋 Testing agent list retrieval...');
  
  const response = await makeRequest('GET', '/api/agents', null, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (response.status !== 200) {
    throw new Error(`Agent list failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }
  
  const agents = response.data.agents;
  const ourAgent = agents.find(a => a.id === spawnedAgentId);
  
  if (!ourAgent) {
    throw new Error('Spawned agent not found in agent list');
  }
  
  console.log(`✅ Agent list retrieved! Found ${agents.length} agents`);
  console.log(`   Our agent status: ${ourAgent.status}`);
  
  return ourAgent;
}

async function testContainerInfo() {
  console.log('🐳 Testing container information retrieval...');
  
  const response = await makeRequest('GET', `/api/agents/${spawnedAgentId}/container`, null, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (response.status === 404) {
    console.log('⚠️  No container found for this agent (may be expected if spawn failed)');
    return null;
  }
  
  if (response.status !== 200) {
    throw new Error(`Container info failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }
  
  const container = response.data.container;
  console.log(`✅ Container info retrieved!`);
  console.log(`   Container ID: ${container.containerId || 'none'}`);
  console.log(`   Status: ${container.status}`);
  console.log(`   Terminal Port: ${container.terminalPort || 'none'}`);
  
  return container;
}

async function testAgentDetails() {
  console.log('🔍 Testing agent details and output...');
  
  const response = await makeRequest('GET', `/api/agents/${spawnedAgentId}`, null, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (response.status !== 200) {
    throw new Error(`Agent details failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }
  
  const agent = response.data.agent;
  console.log(`✅ Agent details retrieved!`);
  console.log(`   Status: ${agent.status}`);
  console.log(`   Owner: ${agent.isOwner ? 'Yes' : 'No'}`);
  console.log(`   Output lines: ${agent.outputLines}`);
  
  if (agent.status === 'error') {
    console.log(`❌ Agent Error Output:`);
    console.log(agent.output.slice(0, 500) + '...');
  } else if (agent.status === 'running') {
    console.log(`✅ Agent Running! Output:`);
    console.log(agent.output.slice(0, 500) + '...');
  }
  
  return agent;
}

async function waitForAgentToStart(maxWaitSeconds = 30) {
  console.log(`⏳ Waiting for agent to start (max ${maxWaitSeconds}s)...`);
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    try {
      const agent = await testAgentList();
      
      if (agent.status === 'running') {
        console.log('✅ Agent is now running!');
        return agent;
      } else if (agent.status === 'error') {
        console.log('❌ Agent failed to start');
        return agent;
      }
      
      console.log(`   Agent status: ${agent.status}, continuing to wait...`);
    } catch (error) {
      console.log(`   Error checking status: ${error.message}`);
    }
  }
  
  console.log('⏰ Timeout waiting for agent to start');
  return null;
}

// Main test execution
async function runE2ETest() {
  console.log('🧪 Starting End-to-End Docker Multi-Agent Test');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Authentication
    await testLogin();
    
    console.log('');
    
    // Step 2: Spawn agent
    await testAgentSpawn();
    
    console.log('');
    
    // Step 3: Wait for agent to process
    const finalAgent = await waitForAgentToStart();
    
    console.log('');
    
    // Step 4: Check agent details
    const agentDetails = await testAgentDetails();
    
    console.log('');
    
    // Step 5: Check container info
    const containerInfo = await testContainerInfo();
    
    console.log('');
    console.log('📊 TEST SUMMARY');
    console.log('=' .repeat(60));
    
    if (agentDetails.status === 'running' && containerInfo && containerInfo.containerId) {
      console.log('🎉 SUCCESS: Docker multi-agent system is working!');
      console.log(`   ✅ Agent spawned and running`);
      console.log(`   ✅ Docker container created: ${containerInfo.containerId.slice(0,12)}`);
      console.log(`   ✅ Terminal accessible on port: ${containerInfo.terminalPort}`);
      console.log('');
      console.log('🔗 Agent should now be available for:');
      console.log('   • Drag & drop to terminal');
      console.log('   • Connect Agent dropdown selection');
      console.log('   • SSH connection to container');
    } else if (agentDetails.status === 'error') {
      console.log('❌ FAILURE: Agent failed to start');
      console.log('   Docker container creation failed');
      console.log('   Check server logs for detailed error messages');
    } else {
      console.log('⚠️  PARTIAL: Agent spawned but status unclear');
      console.log(`   Agent Status: ${agentDetails.status}`);
      console.log(`   Container: ${containerInfo ? 'Found' : 'Not found'}`);
    }
    
  } catch (error) {
    console.log('');
    console.log('💥 TEST FAILED');
    console.log('=' .repeat(60));
    console.log(`Error: ${error.message}`);
    console.log('');
    console.log('Check that:');
    console.log('• ColabVibe server is running on port 3001');
    console.log('• Database is accessible');
    console.log('• EC2 VM SSH connection works');
    console.log('• Docker image exists on EC2 VM');
    
    process.exit(1);
  }
}

// Run the test
runE2ETest();