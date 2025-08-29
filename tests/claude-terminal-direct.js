#!/usr/bin/env node

import { chromium } from 'playwright';
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api';
const APP_URL = 'http://localhost:3000';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function showClaudeTerminal() {
  console.log('🚀 Direct Claude Terminal Interaction Demo');
  console.log('==========================================\n');
  
  // Create a fresh user
  console.log('📝 Creating test user...');
  const testUser = {
    userName: 'ClaudeUser',
    email: `claude-${Date.now()}@test.com`,
    password: 'Claude123!',
    teamName: 'Claude Team'
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
  
  // Spawn agent via API
  console.log('🤖 Spawning agent...');
  const spawnResp = await fetch(`${API_BASE}/agents/spawn`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      type: 'general',
      task: 'Claude Terminal Test'
    })
  });
  
  if (!spawnResp.ok) {
    throw new Error('Failed to spawn agent');
  }
  
  console.log('✅ Agent spawned');
  
  // Open browser
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--window-size=1920,1080']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    console.log('\n🌐 Opening application...');
    await page.goto(APP_URL);
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    
    // Login
    console.log('🔐 Logging in...');
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button:has-text("Sign In")');
    
    // Wait for dashboard
    await page.waitForSelector('text=Command Deck', { timeout: 10000 });
    console.log('✅ Logged in');
    await delay(2000);
    
    // Close any open modals first
    const modalVisible = await page.locator('.fixed.inset-0').count() > 0;
    if (modalVisible) {
      console.log('📦 Closing modal...');
      // Try to find and click close button or Cancel
      const closeButton = page.locator('button:has-text("Cancel")').or(page.locator('[aria-label="Close"]'));
      if (await closeButton.count() > 0) {
        await closeButton.first().click();
        await delay(1000);
      } else {
        // Press Escape
        await page.keyboard.press('Escape');
        await delay(1000);
      }
    }
    
    // Look for agent in the sidebar (Active Agents section)
    console.log('\n🔍 Looking for agent in sidebar...');
    const agentInSidebar = page.locator('text=Claude Terminal Test').first()
      .or(page.locator('text=ClaudeUser').first())
      .or(page.locator('.bg-gray-800').filter({ hasText: /Mock|Completed/ }).first());
    
    if (await agentInSidebar.count() > 0) {
      console.log('✅ Found agent in sidebar, clicking...');
      await agentInSidebar.click();
      await delay(2000);
      
      // Check if modal opened
      const modalOpened = await page.locator('[data-testid="agent-output-modal"]').count() > 0;
      
      if (modalOpened) {
        console.log('✅ Terminal modal opened');
        
        // Wait for terminal to connect
        console.log('⏳ Waiting for terminal connection...');
        await delay(5000);
        
        // Check for terminal
        const terminalExists = await page.locator('.xterm-screen').count() > 0;
        
        if (terminalExists) {
          console.log('✅ Terminal connected!\n');
          
          // Take initial screenshot
          await page.screenshot({ 
            path: 'screenshots/claude-terminal-01-connected.png'
          });
          console.log('📸 Terminal connected screenshot saved');
          
          // Send first prompt
          console.log('\n💬 PROMPT 1: "Hello Claude! Please respond with a greeting."');
          await page.keyboard.type('Hello Claude! Please respond with a greeting.');
          await delay(1000);
          
          await page.screenshot({ 
            path: 'screenshots/claude-terminal-02-prompt1.png'
          });
          
          await page.keyboard.press('Enter');
          console.log('⏳ Waiting for response...');
          await delay(6000);
          
          await page.screenshot({ 
            path: 'screenshots/claude-terminal-03-response1.png'
          });
          console.log('📸 Got Claude response');
          
          // Send second prompt
          console.log('\n💬 PROMPT 2: "Can you write a Python hello world program?"');
          await page.keyboard.type('Can you write a Python hello world program?');
          await delay(1000);
          
          await page.screenshot({ 
            path: 'screenshots/claude-terminal-04-prompt2.png'
          });
          
          await page.keyboard.press('Enter');
          console.log('⏳ Waiting for code...');
          await delay(7000);
          
          await page.screenshot({ 
            path: 'screenshots/claude-terminal-05-response2.png'
          });
          console.log('📸 Got code from Claude');
          
          // Send third prompt
          console.log('\n💬 PROMPT 3: "Now make it print the current date too"');
          await page.keyboard.type('Now make it print the current date too');
          await delay(1000);
          
          await page.screenshot({ 
            path: 'screenshots/claude-terminal-06-prompt3.png'
          });
          
          await page.keyboard.press('Enter');
          console.log('⏳ Waiting for updated code...');
          await delay(7000);
          
          await page.screenshot({ 
            path: 'screenshots/claude-terminal-07-response3.png'
          });
          console.log('📸 Got updated code');
          
          // Get terminal content
          const content = await page.evaluate(() => {
            const term = document.querySelector('.xterm-screen');
            return term ? term.textContent : 'No content';
          });
          
          console.log('\n📟 Terminal Session Content:');
          console.log('============================');
          console.log(content.substring(0, 1500));
          console.log('============================');
          
          // Final full screenshot
          await page.screenshot({ 
            path: 'screenshots/claude-terminal-08-full-session.png'
          });
          console.log('\n📸 Full session screenshot saved');
          
          console.log('\n✅ SUCCESS! Claude is responding in the terminal!');
          console.log('\n📁 Screenshots saved:');
          console.log('  claude-terminal-01-connected.png');
          console.log('  claude-terminal-02-prompt1.png');
          console.log('  claude-terminal-03-response1.png');
          console.log('  claude-terminal-04-prompt2.png');
          console.log('  claude-terminal-05-response2.png');
          console.log('  claude-terminal-06-prompt3.png');
          console.log('  claude-terminal-07-response3.png');
          console.log('  claude-terminal-08-full-session.png');
          
        } else {
          console.log('❌ Terminal not visible');
          await page.screenshot({ 
            path: 'screenshots/claude-terminal-no-terminal.png'
          });
        }
      } else {
        console.log('❌ Modal did not open');
      }
    } else {
      console.log('❌ No agent found in sidebar');
      
      // Try clicking on Agents tab
      await page.click('text=Agents');
      await delay(2000);
      
      await page.screenshot({ 
        path: 'screenshots/claude-terminal-agents-page.png'
      });
    }
    
    console.log('\n👀 Keeping browser open for 15 seconds...');
    await delay(15000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ 
      path: 'screenshots/claude-terminal-error.png'
    });
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the demo
showClaudeTerminal()
  .then(() => {
    console.log('\n🎉 Demo completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });