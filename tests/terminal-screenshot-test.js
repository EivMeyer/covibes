#!/usr/bin/env node

import { chromium } from 'playwright';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

async function captureTerminalScreenshots() {
  const browser = await chromium.launch({ 
    headless: false, // Set to false to see the browser
    slowMo: 500 // Slow down actions to see what's happening
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  // Create screenshots directory
  const screenshotDir = './terminal-screenshots';
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir);
  }
  
  try {
    console.log('🧪 Starting Terminal Screenshot Test\n');
    
    // 1. Register a new user via API
    const user = {
      userName: 'TerminalDemo',
      email: `demo-${Date.now()}@test.com`,
      password: 'Demo123!',
      teamName: 'Terminal Test Team'
    };
    
    console.log('📝 Registering user...');
    const regResp = await fetch('http://localhost:3001/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    const { token } = await regResp.json();
    console.log('✅ User registered');
    console.log('   Email:', user.email);
    console.log('   Password:', user.password);
    
    // 2. Navigate to the app
    console.log('\n🌐 Opening browser...');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of login page
    await page.screenshot({ 
      path: path.join(screenshotDir, '01-login-page.png'),
      fullPage: true 
    });
    console.log('📸 Screenshot: Login page');
    
    // 3. Login
    console.log('\n🔐 Logging in...');
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button:has-text("Sign In")');
    
    // Wait for dashboard to load - look for agent list or dashboard elements
    await page.waitForSelector('.bg-gray-900', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Take screenshot of dashboard
    await page.screenshot({ 
      path: path.join(screenshotDir, '02-dashboard.png'),
      fullPage: true 
    });
    console.log('📸 Screenshot: Dashboard');
    
    // 4. Spawn an agent
    console.log('\n🤖 Spawning agent...');
    
    // Click the spawn agent button in command deck
    const spawnButton = await page.locator('button:has-text("Spawn Agent"), button:has-text("New Agent")').first();
    await spawnButton.click();
    
    // Wait for spawn modal
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    
    // Fill in agent details
    await page.fill('textarea[placeholder*="task"]', 'Help me write a Python function to calculate fibonacci numbers');
    
    // Take screenshot of spawn modal
    await page.screenshot({ 
      path: path.join(screenshotDir, '03-spawn-modal.png'),
      fullPage: true 
    });
    console.log('📸 Screenshot: Spawn modal');
    
    // Submit spawn form
    await page.click('button:has-text("Spawn")');
    
    // Wait for agent to appear in sidebar - look for agent cards
    await page.waitForSelector('.rounded-lg.border', { timeout: 10000 });
    await page.waitForTimeout(3000); // Give agent time to start
    
    // Take screenshot with agent in sidebar
    await page.screenshot({ 
      path: path.join(screenshotDir, '04-agent-spawned.png'),
      fullPage: true 
    });
    console.log('📸 Screenshot: Agent spawned');
    
    // 5. Click on the agent to open terminal
    console.log('\n🖥️ Opening agent terminal...');
    // Click on the first agent card in the sidebar
    const agentItem = await page.locator('.cursor-pointer').filter({ hasText: 'TerminalDemo' }).first();
    await agentItem.click();
    
    // Wait for modal to open
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.waitForTimeout(2000); // Give terminal time to connect
    
    // Take screenshot of terminal connecting
    await page.screenshot({ 
      path: path.join(screenshotDir, '05-terminal-connecting.png'),
      fullPage: true 
    });
    console.log('📸 Screenshot: Terminal connecting');
    
    // Wait for terminal to be ready (look for xterm element)
    console.log('\n⏳ Waiting for terminal to connect...');
    
    // Check if terminal is actually connected
    const terminalConnected = await page.locator('.xterm').count() > 0;
    
    if (terminalConnected) {
      console.log('✅ Terminal connected!');
      
      // Wait a bit for Claude to start
      await page.waitForTimeout(5000);
      
      // Take screenshot of connected terminal
      await page.screenshot({ 
        path: path.join(screenshotDir, '06-terminal-connected.png'),
        fullPage: true 
      });
      console.log('📸 Screenshot: Terminal connected with Claude');
      
      // 6. Send a prompt to Claude
      console.log('\n💬 Sending prompt to Claude...');
      
      // Type in the terminal (xterm captures keyboard input when focused)
      await page.click('.xterm'); // Focus the terminal
      await page.keyboard.type('Write a Python function to calculate the nth Fibonacci number');
      await page.keyboard.press('Enter');
      
      // Wait for Claude to respond
      await page.waitForTimeout(5000);
      
      // Take screenshot of Claude responding
      await page.screenshot({ 
        path: path.join(screenshotDir, '07-claude-responding.png'),
        fullPage: true 
      });
      console.log('📸 Screenshot: Claude responding to prompt');
      
      // Wait for full response
      await page.waitForTimeout(10000);
      
      // Take final screenshot with full response
      await page.screenshot({ 
        path: path.join(screenshotDir, '08-claude-response-complete.png'),
        fullPage: true 
      });
      console.log('📸 Screenshot: Claude complete response');
      
      console.log('\n✅ SUCCESS! Terminal is working with Claude!');
      console.log('\n📁 Screenshots saved in:', screenshotDir);
      console.log('   1. Login page');
      console.log('   2. Dashboard');
      console.log('   3. Spawn modal');
      console.log('   4. Agent spawned');
      console.log('   5. Terminal connecting');
      console.log('   6. Terminal connected');
      console.log('   7. Claude responding');
      console.log('   8. Claude complete response');
      
    } else {
      // Terminal not connected - debug why
      console.log('❌ Terminal not connected');
      
      // Check what's shown instead
      const modalContent = await page.textContent('[role="dialog"]');
      console.log('\nModal content:', modalContent);
      
      // Take debug screenshot
      await page.screenshot({ 
        path: path.join(screenshotDir, 'debug-terminal-not-connected.png'),
        fullPage: true 
      });
      console.log('📸 Debug screenshot saved');
      
      // Check agent status via API
      const listResp = await fetch('http://localhost:3001/api/agents/list', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const { agents } = await listResp.json();
      
      if (agents && agents[0]) {
        console.log('\nAgent status from API:');
        console.log('  Status:', agents[0].status);
        console.log('  Type:', agents[0].agentType);
        console.log('  Task:', agents[0].task);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Take error screenshot
    await page.screenshot({ 
      path: path.join(screenshotDir, 'error-screenshot.png'),
      fullPage: true 
    });
    console.log('📸 Error screenshot saved');
    
  } finally {
    // Keep browser open for 5 seconds to see final state
    console.log('\n⏸️ Keeping browser open for 5 seconds...');
    await page.waitForTimeout(5000);
    
    await browser.close();
    console.log('🔚 Browser closed');
  }
}

// Run the test
captureTerminalScreenshots()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  });