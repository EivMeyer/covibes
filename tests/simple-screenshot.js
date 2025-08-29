#!/usr/bin/env node

import { chromium } from 'playwright';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

async function captureWorkingTerminal() {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100
  });
  
  const page = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  }).then(ctx => ctx.newPage());
  
  // Create screenshots directory
  const screenshotDir = './terminal-working';
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir);
  }
  
  try {
    console.log('📸 Capturing Working Terminal\n');
    
    // Use the test credentials from the previous successful test
    const user = {
      email: 'fixed-1754948506584@test.com',
      password: 'Fixed123!'
    };
    
    // Or create a new user
    const newUser = {
      userName: 'ScreenshotDemo',
      email: `screenshot-${Date.now()}@test.com`,
      password: 'Demo123!',
      teamName: 'Screenshot Team'
    };
    
    console.log('📝 Creating new user...');
    const regResp = await fetch('http://localhost:3001/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser)
    });
    
    const { token } = await regResp.json();
    console.log('✅ User created');
    console.log('   Email:', newUser.email);
    console.log('   Password:', newUser.password);
    
    // Navigate and login
    console.log('\n🌐 Opening application...');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Screenshot 1: Login page
    await page.screenshot({ 
      path: path.join(screenshotDir, '01-login.png'),
      fullPage: true 
    });
    
    // Login
    await page.fill('input[type="email"]', newUser.email);
    await page.fill('input[type="password"]', newUser.password);
    await page.click('button:has-text("Sign In")');
    
    await page.waitForTimeout(3000);
    
    // Screenshot 2: Dashboard
    await page.screenshot({ 
      path: path.join(screenshotDir, '02-dashboard.png'),
      fullPage: true 
    });
    
    // Spawn agent via API for speed
    console.log('\n🤖 Spawning agent...');
    const spawnResp = await fetch('http://localhost:3001/api/agents/spawn', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        agentType: 'claude',
        task: 'Help me write a Python fibonacci function'
      })
    });
    
    const { agent } = await spawnResp.json();
    console.log('✅ Agent spawned:', agent.id);
    
    // Refresh page to see agent
    await page.reload();
    await page.waitForTimeout(3000);
    
    // Screenshot 3: Dashboard with agent
    await page.screenshot({ 
      path: path.join(screenshotDir, '03-with-agent.png'),
      fullPage: true 
    });
    
    // Click on agent card
    console.log('\n🖥️ Opening terminal...');
    // Try multiple possible selectors
    const agentCard = await page.locator('.cursor-pointer, .border-gray-700, [class*="agent"]').first();
    await agentCard.click();
    
    await page.waitForTimeout(5000); // Give terminal time to connect
    
    // Screenshot 4: Terminal modal
    await page.screenshot({ 
      path: path.join(screenshotDir, '04-terminal-modal.png'),
      fullPage: true 
    });
    
    // Check if terminal is visible
    const terminalVisible = await page.locator('.xterm, .terminal, canvas').count() > 0;
    
    if (terminalVisible) {
      console.log('✅ Terminal is visible!');
      
      // Click to focus terminal
      await page.click('.xterm, .terminal, [role="dialog"]');
      
      // Type a prompt
      await page.keyboard.type('def fibonacci(n):');
      await page.keyboard.press('Enter');
      await page.keyboard.type('    if n <= 1: return n');
      await page.keyboard.press('Enter');
      
      await page.waitForTimeout(3000);
      
      // Screenshot 5: Terminal with input
      await page.screenshot({ 
        path: path.join(screenshotDir, '05-terminal-with-input.png'),
        fullPage: true 
      });
      
      console.log('\n✅ Screenshots captured successfully!');
      console.log('📁 Check the', screenshotDir, 'directory');
      
    } else {
      console.log('⚠️ Terminal not visible, checking modal content...');
      const modalText = await page.textContent('[role="dialog"]');
      console.log('Modal shows:', modalText?.substring(0, 200));
      
      await page.screenshot({ 
        path: path.join(screenshotDir, 'debug-no-terminal.png'),
        fullPage: true 
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ 
      path: path.join(screenshotDir, 'error.png'),
      fullPage: true 
    });
  } finally {
    console.log('\n⏸️ Keeping browser open for 10 seconds...');
    await page.waitForTimeout(10000);
    await browser.close();
  }
}

captureWorkingTerminal()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });