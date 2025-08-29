#!/usr/bin/env node

import { chromium } from 'playwright';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:3001/api';
const APP_URL = 'http://localhost:3000';

// Test user credentials
const testUser = {
  userName: 'ScreenshotDemo',
  email: `screenshot-demo-${Date.now()}@test.com`,
  password: 'TestPassword123!',
  teamName: 'Screenshot Demo Team'
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function registerUser() {
  console.log('📝 Registering test user...');
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser)
  });

  if (!response.ok) {
    throw new Error(`Registration failed: ${await response.text()}`);
  }

  const data = await response.json();
  console.log('✅ User registered:', data.user.email);
  return data;
}

async function captureScreenshots() {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--window-size=1920,1080']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    // Register user
    const { token, team } = await registerUser();
    
    // Navigate to app
    console.log('🌐 Navigating to application...');
    await page.goto(APP_URL);
    
    // Set auth token in localStorage
    await page.evaluate((authToken) => {
      localStorage.setItem('authToken', authToken);
    }, token);
    
    // Reload to apply auth
    await page.reload();
    await page.waitForLoadState('networkidle');
    await delay(2000);
    
    // Take screenshot of dashboard
    console.log('📸 Capturing dashboard...');
    await page.screenshot({ 
      path: 'screenshots/01-dashboard.png',
      fullPage: false 
    });
    
    // Navigate to Agents tab
    console.log('🤖 Navigating to Agents...');
    await page.click('text=Agents');
    await delay(1000);
    
    // Take screenshot of agents page
    await page.screenshot({ 
      path: 'screenshots/02-agents-page.png',
      fullPage: false 
    });
    
    // Click spawn agent button
    console.log('🚀 Opening spawn agent modal...');
    const spawnButton = page.locator('button:has-text("Spawn Agent")').first();
    await spawnButton.click();
    await delay(1000);
    
    // Take screenshot of spawn modal
    await page.screenshot({ 
      path: 'screenshots/03-spawn-modal.png',
      fullPage: false 
    });
    
    // Fill in agent details
    await page.selectOption('select[name="agentType"]', 'general');
    await page.fill('textarea[name="task"]', 'Demo: Show EC2 terminal connection with Claude');
    
    // Take screenshot with filled form
    await page.screenshot({ 
      path: 'screenshots/04-spawn-form-filled.png',
      fullPage: false 
    });
    
    // Submit form
    console.log('🤖 Spawning agent...');
    await page.click('button:has-text("Spawn")');
    await delay(3000);
    
    // Take screenshot with agent spawned
    await page.screenshot({ 
      path: 'screenshots/05-agent-spawned.png',
      fullPage: false 
    });
    
    // Click on the agent card to open terminal
    console.log('🖥️ Opening agent terminal...');
    const agentCard = page.locator('.agent-card').first();
    await agentCard.click();
    
    // Wait for terminal modal
    await page.waitForSelector('[data-testid="agent-output-modal"]', { timeout: 5000 });
    await delay(2000);
    
    // Take screenshot of terminal modal opening
    await page.screenshot({ 
      path: 'screenshots/06-terminal-modal.png',
      fullPage: false 
    });
    
    // Wait for terminal to connect
    console.log('⏳ Waiting for terminal connection...');
    await page.waitForSelector('.xterm-screen', { timeout: 15000 });
    await delay(5000); // Give time for SSH connection and Claude to start
    
    // Take screenshot of connected terminal
    console.log('📸 Capturing connected terminal...');
    await page.screenshot({ 
      path: 'screenshots/07-terminal-connected.png',
      fullPage: false 
    });
    
    // Type a command in terminal
    console.log('⌨️ Typing command in terminal...');
    await page.keyboard.type('echo "Hello from EC2 instance!"');
    await delay(1000);
    
    // Take screenshot with typed command
    await page.screenshot({ 
      path: 'screenshots/08-terminal-command.png',
      fullPage: false 
    });
    
    // Press Enter to execute
    await page.keyboard.press('Enter');
    await delay(2000);
    
    // Take screenshot with command output
    await page.screenshot({ 
      path: 'screenshots/09-terminal-output.png',
      fullPage: false 
    });
    
    // Type Claude interaction
    console.log('🤖 Interacting with Claude...');
    await page.keyboard.type('Hi Claude, can you tell me about yourself?');
    await delay(1000);
    
    // Take screenshot with Claude query
    await page.screenshot({ 
      path: 'screenshots/10-claude-query.png',
      fullPage: false 
    });
    
    // Press Enter
    await page.keyboard.press('Enter');
    await delay(5000); // Wait for Claude response
    
    // Take final screenshot with Claude response
    console.log('📸 Capturing Claude response...');
    await page.screenshot({ 
      path: 'screenshots/11-claude-response.png',
      fullPage: false 
    });
    
    console.log('\n✅ All screenshots captured successfully!');
    console.log('📁 Screenshots saved in: screenshots/');
    console.log('\nScreenshots:');
    console.log('  01-dashboard.png - Main dashboard');
    console.log('  02-agents-page.png - Agents tab');
    console.log('  03-spawn-modal.png - Spawn agent modal');
    console.log('  04-spawn-form-filled.png - Filled spawn form');
    console.log('  05-agent-spawned.png - Agent in list');
    console.log('  06-terminal-modal.png - Terminal modal opened');
    console.log('  07-terminal-connected.png - EC2 terminal connected');
    console.log('  08-terminal-command.png - Command typed');
    console.log('  09-terminal-output.png - Command output');
    console.log('  10-claude-query.png - Claude query');
    console.log('  11-claude-response.png - Claude response');
    
    // Keep browser open for 5 seconds to view
    console.log('\n👀 Keeping browser open for viewing...');
    await delay(5000);
    
  } catch (error) {
    console.error('❌ Error capturing screenshots:', error);
    
    // Take error screenshot
    await page.screenshot({ 
      path: 'screenshots/error-screenshot.png',
      fullPage: false 
    });
    
    throw error;
  } finally {
    await browser.close();
  }
}

// Create screenshots directory
const screenshotsDir = path.join(process.cwd(), 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir);
}

// Run the capture
console.log('🎬 Starting screenshot capture...');
console.log('=====================================\n');

captureScreenshots()
  .then(() => {
    console.log('\n✅ Screenshot capture completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Screenshot capture failed:', error);
    process.exit(1);
  });