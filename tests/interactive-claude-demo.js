#!/usr/bin/env node

import { chromium } from 'playwright';
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api';
const APP_URL = 'http://localhost:3000';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function interactiveClaudeDemo() {
  console.log('🚀 Starting Interactive Claude Terminal Demo');
  console.log('==========================================\n');
  
  // 1. Register user and spawn agent
  console.log('📝 Creating test user...');
  const testUser = {
    userName: 'ClaudeDemo',
    email: `claude-demo-${Date.now()}@test.com`,
    password: 'Claude123!',
    teamName: 'Claude Demo Team'
  };
  
  const registerResp = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser)
  });
  
  if (!registerResp.ok) {
    throw new Error('Failed to register user');
  }
  
  const { token, user } = await registerResp.json();
  console.log('✅ User created:', user.email);
  
  // 2. Spawn agent via API
  console.log('🤖 Spawning Claude agent...');
  const spawnResp = await fetch(`${API_BASE}/agents/spawn`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      type: 'general',
      task: 'Interactive Claude Demo'
    })
  });
  
  if (!spawnResp.ok) {
    throw new Error('Failed to spawn agent');
  }
  
  const agent = await spawnResp.json();
  console.log('✅ Agent spawned successfully');
  
  // 3. Open browser and login
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--window-size=1920,1080']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    console.log('\n🌐 Opening ColabVibe...');
    await page.goto(APP_URL);
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    
    // Login
    console.log('🔐 Logging in...');
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button:has-text("Sign In")');
    
    // Wait for dashboard
    await page.waitForSelector('text=Command Deck', { timeout: 10000 });
    console.log('✅ Logged in successfully');
    await delay(2000);
    
    // Navigate to Agents
    console.log('\n📋 Opening Agents panel...');
    await page.click('text=Agents');
    await delay(2000);
    
    // Find and click on our agent
    console.log('🖥️ Opening agent terminal...');
    const agentCard = page.locator('.bg-gray-800').filter({ hasText: 'Interactive Claude Demo' }).first()
      .or(page.locator('text=ClaudeDemo').first())
      .or(page.locator('.agent-card').first());
    
    await agentCard.waitFor({ timeout: 5000 });
    await agentCard.click();
    
    // Wait for modal to open
    console.log('⏳ Waiting for terminal modal...');
    await page.waitForSelector('[data-testid="agent-output-modal"]', { timeout: 10000 });
    await delay(3000);
    
    // Check if terminal is visible
    const terminalVisible = await page.locator('.xterm-screen').count() > 0;
    
    if (terminalVisible) {
      console.log('✅ Terminal connected to EC2!\n');
      
      // Wait for SSH connection and Claude to start
      console.log('⏳ Waiting for Claude to initialize...');
      await delay(5000);
      
      // Take initial screenshot
      await page.screenshot({ 
        path: 'screenshots/claude-01-terminal-ready.png'
      });
      console.log('📸 Screenshot: claude-01-terminal-ready.png');
      
      // INTERACTION 1: Simple greeting
      console.log('\n💬 Sending: "Hello Claude! Can you see this?"');
      await page.keyboard.type('Hello Claude! Can you see this?');
      await delay(1000);
      
      await page.screenshot({ 
        path: 'screenshots/claude-02-typed-greeting.png'
      });
      
      await page.keyboard.press('Enter');
      console.log('⏳ Waiting for Claude response...');
      await delay(5000);
      
      await page.screenshot({ 
        path: 'screenshots/claude-03-greeting-response.png'
      });
      console.log('📸 Claude responded to greeting');
      
      // INTERACTION 2: Ask about capabilities
      console.log('\n💬 Sending: "What programming languages can you help with?"');
      await page.keyboard.type('What programming languages can you help with?');
      await delay(1000);
      
      await page.screenshot({ 
        path: 'screenshots/claude-04-typed-languages.png'
      });
      
      await page.keyboard.press('Enter');
      console.log('⏳ Waiting for Claude response...');
      await delay(6000);
      
      await page.screenshot({ 
        path: 'screenshots/claude-05-languages-response.png'
      });
      console.log('📸 Claude listed programming languages');
      
      // INTERACTION 3: Code request
      console.log('\n💬 Sending: "Write a simple Python function to calculate fibonacci numbers"');
      await page.keyboard.type('Write a simple Python function to calculate fibonacci numbers');
      await delay(1000);
      
      await page.screenshot({ 
        path: 'screenshots/claude-06-typed-code-request.png'
      });
      
      await page.keyboard.press('Enter');
      console.log('⏳ Waiting for Claude to write code...');
      await delay(8000);
      
      await page.screenshot({ 
        path: 'screenshots/claude-07-code-response.png'
      });
      console.log('📸 Claude provided code');
      
      // INTERACTION 4: Follow-up question
      console.log('\n💬 Sending: "Can you explain how that function works?"');
      await page.keyboard.type('Can you explain how that function works?');
      await delay(1000);
      
      await page.screenshot({ 
        path: 'screenshots/claude-08-typed-explain.png'
      });
      
      await page.keyboard.press('Enter');
      console.log('⏳ Waiting for explanation...');
      await delay(7000);
      
      await page.screenshot({ 
        path: 'screenshots/claude-09-explanation.png'
      });
      console.log('📸 Claude explained the code');
      
      // Get terminal content
      const terminalContent = await page.evaluate(() => {
        const terminal = document.querySelector('.xterm-screen');
        return terminal ? terminal.textContent : 'No terminal content';
      });
      
      console.log('\n📟 Terminal Session Preview:');
      console.log('================================');
      console.log(terminalContent.substring(0, 1000));
      console.log('================================\n');
      
      // Final screenshot
      await page.screenshot({ 
        path: 'screenshots/claude-10-full-conversation.png',
        fullPage: false
      });
      console.log('📸 Final screenshot: claude-10-full-conversation.png');
      
    } else {
      console.log('❌ Terminal not visible!');
      
      // Check what's shown instead
      const modalContent = await page.textContent('[data-testid="agent-output-modal"]');
      console.log('Modal content:', modalContent.substring(0, 200));
      
      await page.screenshot({ 
        path: 'screenshots/claude-error-no-terminal.png'
      });
    }
    
    console.log('\n✅ Interactive demo completed!');
    console.log('\n📁 Screenshots saved:');
    console.log('  claude-01-terminal-ready.png - Terminal connected');
    console.log('  claude-02-typed-greeting.png - First prompt typed');
    console.log('  claude-03-greeting-response.png - Claude greeting response');
    console.log('  claude-04-typed-languages.png - Languages question');
    console.log('  claude-05-languages-response.png - Languages response');
    console.log('  claude-06-typed-code-request.png - Code request');
    console.log('  claude-07-code-response.png - Code provided');
    console.log('  claude-08-typed-explain.png - Explanation request');
    console.log('  claude-09-explanation.png - Code explanation');
    console.log('  claude-10-full-conversation.png - Full conversation');
    
    console.log('\n👀 Keeping browser open for 20 seconds to review...');
    await delay(20000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ 
      path: 'screenshots/claude-demo-error.png'
    });
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the demo
interactiveClaudeDemo()
  .then(() => {
    console.log('\n🎉 Demo completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Demo failed:', error);
    process.exit(1);
  });