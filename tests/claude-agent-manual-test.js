#!/usr/bin/env node

/**
 * Manual Claude Agent Interaction Test
 * 
 * This script provides a manual test to verify that Claude agent interaction works.
 * Run this script and follow the instructions to test the complete flow.
 */

import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

console.log('🧪 Manual Claude Agent Interaction Test');
console.log('=====================================');
console.log('');

const BASE_URL = 'http://localhost:3000';
const API_BASE = 'http://localhost:3001';

// Helper function to check if services are running
async function checkServices() {
  console.log('🔍 Checking services...');
  
  try {
    // Check frontend
    const frontendResp = await fetch(BASE_URL).then(r => r.ok).catch(() => false);
    console.log(`Frontend (${BASE_URL}): ${frontendResp ? '✅ Running' : '❌ Down'}`);
    
    // Check backend API
    const backendResp = await fetch(`${API_BASE}/api/health`).then(r => r.ok).catch(() => false);
    console.log(`Backend API (${API_BASE}): ${backendResp ? '✅ Running' : '❌ Down'}`);
    
    return frontendResp && backendResp;
  } catch (error) {
    console.error('Service check failed:', error.message);
    return false;
  }
}

// Test API endpoints directly
async function testApiEndpoints() {
  console.log('');
  console.log('🔧 Testing API endpoints...');
  
  try {
    // Test login
    const loginResp = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@demo.com', password: 'demo123' })
    });
    
    if (loginResp.ok) {
      const loginData = await loginResp.json();
      console.log('✅ Login API works');
      
      // Test agents API
      const agentsResp = await fetch(`${API_BASE}/api/agents`, {
        headers: { 'Authorization': `Bearer ${loginData.token}` }
      });
      
      if (agentsResp.ok) {
        const agentsData = await agentsResp.json();
        console.log(`✅ Agents API works - Found ${agentsData.agents?.length || 0} agents`);
        return { token: loginData.token, agents: agentsData.agents };
      } else {
        console.log('❌ Agents API failed');
      }
    } else {
      console.log('❌ Login API failed');
    }
  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
  
  return null;
}

// Manual test instructions
function printManualTestInstructions() {
  console.log('');
  console.log('📝 MANUAL TEST INSTRUCTIONS');
  console.log('===========================');
  console.log('');
  console.log('1. Open your browser and go to: http://localhost:3000');
  console.log('2. Login with: alice@demo.com / demo123');
  console.log('3. Look for existing Claude agents or spawn a new one');
  console.log('4. Click on an agent to open the terminal modal');
  console.log('5. Verify you see:');
  console.log('   - "Connecting to agent terminal..." message initially');
  console.log('   - Then either:');
  console.log('     a) A working terminal with Claude running, OR');
  console.log('     b) An appropriate error message');
  console.log('');
  console.log('6. If terminal connects, try these commands:');
  console.log('   - Type: ls -la');
  console.log('   - Press Enter');
  console.log('   - Type: echo "Hello Claude!"');
  console.log('   - Press Enter');
  console.log('');
  console.log('✅ SUCCESS CRITERIA:');
  console.log('   - Terminal modal opens');
  console.log('   - Connection attempt is made (shows connecting message)');
  console.log('   - Either successful connection OR clear error message');
  console.log('   - If connected: commands work and show output');
  console.log('');
  console.log('❌ FAILURE INDICATORS:');
  console.log('   - Modal doesn\'t open');
  console.log('   - Stuck on "Connecting..." forever');
  console.log('   - No error message when connection fails');
  console.log('   - Terminal shows but doesn\'t respond to input');
}

// Main test function
async function runManualTest() {
  console.log('Starting manual Claude agent test...');
  console.log('');
  
  // Check if services are running
  const servicesUp = await checkServices();
  if (!servicesUp) {
    console.log('❌ Services are not running properly!');
    console.log('');
    console.log('🚀 To start services, run:');
    console.log('   cd /home/eivind/repos/colabvibe/colabvibe && ./demo.sh');
    console.log('');
    return false;
  }
  
  // Test API endpoints
  const apiTest = await testApiEndpoints();
  if (!apiTest) {
    console.log('❌ API endpoints are not working properly!');
    return false;
  }
  
  console.log('');
  console.log('✅ Services appear to be running correctly!');
  console.log(`✅ Found ${apiTest.agents.length} existing agents`);
  
  if (apiTest.agents.length > 0) {
    console.log('');
    console.log('📊 Existing agents:');
    apiTest.agents.slice(0, 3).forEach((agent, i) => {
      console.log(`   ${i + 1}. ${agent.task} (${agent.status}) - ${agent.agentType}`);
    });
  }
  
  printManualTestInstructions();
  return true;
}

// Run the test
runManualTest().then(success => {
  if (success) {
    console.log('🎉 Manual test setup complete - follow the instructions above!');
    process.exit(0);
  } else {
    console.log('❌ Manual test setup failed - fix the issues above first');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});