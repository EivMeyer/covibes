#!/usr/bin/env node

import { chromium } from 'playwright';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:3001/api';
const APP_URL = 'http://localhost:3000';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureTerminalDemo() {
  // First, register a user and spawn an agent via API
  console.log('📝 Setting up test data...');
  
  const testUser = {
    userName: 'DemoUser',
    email: `demo-${Date.now()}@test.com`,
    password: 'DemoPass123!',
    teamName: 'Demo Team'
  };
  
  // Register user
  const registerResp = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser)
  });
  
  if (!registerResp.ok) {
    throw new Error('Failed to register user');
  }
  
  const { token, user, team } = await registerResp.json();
  console.log('✅ User registered:', user.email);
  
  // Spawn an agent
  const spawnResp = await fetch(`${API_BASE}/agents/spawn`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      type: 'general',
      task: 'Demo: EC2 Terminal with Claude'
    })
  });
  
  if (!spawnResp.ok) {
    throw new Error('Failed to spawn agent');
  }
  
  const agent = await spawnResp.json();
  console.log('✅ Agent spawned:', agent.id);
  
  // Now open browser
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--window-size=1920,1080']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    console.log('🌐 Opening application...');
    await page.goto(APP_URL);
    
    // Wait for login page
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    
    // Fill login form
    console.log('🔐 Logging in...');
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    
    // Take screenshot of login
    await page.screenshot({ 
      path: 'screenshots/terminal-demo-01-login.png'
    });
    
    // Click login
    await page.click('button:has-text("Sign In")');
    
    // Wait for dashboard
    await page.waitForSelector('text=Dashboard', { timeout: 10000 });
    await delay(2000);
    
    console.log('📸 Dashboard loaded');
    await page.screenshot({ 
      path: 'screenshots/terminal-demo-02-dashboard.png'
    });
    
    // Navigate to Agents
    await page.click('text=Agents');
    await delay(2000);
    
    console.log('📸 Agents page');
    await page.screenshot({ 
      path: 'screenshots/terminal-demo-03-agents.png'
    });
    
    // Find and click the agent card
    console.log('🖥️ Opening agent terminal...');
    
    // Look for agent card with our task text or agent status
    const agentCard = page.locator('.bg-gray-800').filter({ hasText: 'Demo: EC2 Terminal' }).first()
      .or(page.locator('.bg-gray-800').filter({ hasText: 'running' }).first())
      .or(page.locator('.bg-gray-800').filter({ hasText: 'completed' }).first());
    
    await agentCard.waitFor({ timeout: 5000 });
    await agentCard.click();
    
    console.log('⏳ Waiting for terminal modal...');
    await delay(2000);
    
    // Take screenshot of terminal modal
    await page.screenshot({ 
      path: 'screenshots/terminal-demo-04-modal.png'
    });
    
    // Wait for terminal to appear
    const terminalExists = await page.locator('.xterm-screen').count() > 0;
    
    if (terminalExists) {
      console.log('✅ Terminal found!');
      await delay(3000); // Wait for connection
      
      // Take screenshot of connected terminal
      await page.screenshot({ 
        path: 'screenshots/terminal-demo-05-terminal.png'
      });
      
      // Get terminal content
      const terminalContent = await page.evaluate(() => {
        const terminal = document.querySelector('.xterm-screen');
        return terminal ? terminal.textContent : 'No terminal content';
      });
      
      console.log('\n📟 Terminal Content Preview:');
      console.log(terminalContent.substring(0, 500));
      
      // Type a command
      await page.keyboard.type('pwd');
      await delay(1000);
      
      await page.screenshot({ 
        path: 'screenshots/terminal-demo-06-command.png'
      });
      
      await page.keyboard.press('Enter');
      await delay(2000);
      
      await page.screenshot({ 
        path: 'screenshots/terminal-demo-07-output.png'
      });
      
    } else {
      console.log('⚠️ Terminal not visible, checking status...');
      
      // Take screenshot of whatever is shown
      await page.screenshot({ 
        path: 'screenshots/terminal-demo-05-status.png'
      });
      
      // Get the modal content
      const modalContent = await page.textContent('body');
      if (modalContent.includes('Connecting to agent terminal')) {
        console.log('📡 Terminal is connecting...');
      } else if (modalContent.includes('Mock Terminal Connected')) {
        console.log('🎭 Mock terminal detected');
      } else {
        console.log('❓ Unknown terminal state');
      }
    }
    
    console.log('\n✅ Screenshots captured successfully!');
    console.log('\n📁 Screenshots saved:');
    console.log('  terminal-demo-01-login.png');
    console.log('  terminal-demo-02-dashboard.png');
    console.log('  terminal-demo-03-agents.png');
    console.log('  terminal-demo-04-modal.png');
    console.log('  terminal-demo-05-terminal.png (or status)');
    console.log('  terminal-demo-06-command.png');
    console.log('  terminal-demo-07-output.png');
    
    // Keep browser open
    console.log('\n👀 Keeping browser open for 10 seconds...');
    await delay(10000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Take error screenshot
    await page.screenshot({ 
      path: 'screenshots/terminal-demo-error.png'
    });
    
    throw error;
  } finally {
    await browser.close();
  }
}

// Create screenshots directory if needed
const screenshotsDir = path.join(process.cwd(), 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir);
}

// Run the demo
console.log('🎬 Starting Terminal Demo Capture');
console.log('=====================================\n');

captureTerminalDemo()
  .then(() => {
    console.log('\n✅ Demo completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Demo failed:', error);
    process.exit(1);
  });