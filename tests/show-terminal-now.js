#!/usr/bin/env node

import { chromium } from 'playwright';

async function showTerminal() {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--window-size=1920,1080']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    // Go directly to the logged-in state using the existing session
    console.log('🌐 Opening application...');
    await page.goto('http://localhost:3000');
    
    // Wait for page load
    await page.waitForTimeout(3000);
    
    // Check if we see an agent in the sidebar (from your screenshot)
    const agentVisible = await page.locator('text=Demo: EC2 Terminal').count() > 0;
    
    if (agentVisible) {
      console.log('✅ Found agent in sidebar!');
      
      // Click on the agent
      await page.click('text=Demo: EC2 Terminal');
      console.log('🖥️ Clicked on agent');
      
      // Wait for modal
      await page.waitForTimeout(3000);
      
      // Take screenshot
      await page.screenshot({ 
        path: 'screenshots/terminal-modal-opened.png'
      });
      console.log('📸 Screenshot: terminal-modal-opened.png');
      
      // Wait for terminal to connect
      await page.waitForTimeout(5000);
      
      // Take screenshot of connected terminal
      await page.screenshot({ 
        path: 'screenshots/terminal-connected-ec2.png'
      });
      console.log('📸 Screenshot: terminal-connected-ec2.png');
      
      // Check for terminal
      const hasTerminal = await page.locator('.xterm-screen').count() > 0;
      
      if (hasTerminal) {
        console.log('✅ Terminal is visible!');
        
        // Get terminal content
        const content = await page.evaluate(() => {
          const term = document.querySelector('.xterm-screen');
          return term ? term.textContent : 'No content';
        });
        
        console.log('\n📟 Terminal Content:');
        console.log(content.substring(0, 800));
        
        // Type a command
        await page.keyboard.type('hostname');
        await page.waitForTimeout(1000);
        
        await page.screenshot({ 
          path: 'screenshots/terminal-with-command.png'
        });
        console.log('📸 Screenshot: terminal-with-command.png');
        
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        
        await page.screenshot({ 
          path: 'screenshots/terminal-command-output.png'
        });
        console.log('📸 Screenshot: terminal-command-output.png');
        
        // Type Claude interaction
        await page.keyboard.type('Hi Claude!');
        await page.waitForTimeout(1000);
        
        await page.screenshot({ 
          path: 'screenshots/terminal-claude-input.png'
        });
        console.log('📸 Screenshot: terminal-claude-input.png');
        
        await page.keyboard.press('Enter');
        await page.waitForTimeout(5000);
        
        await page.screenshot({ 
          path: 'screenshots/terminal-claude-response.png'
        });
        console.log('📸 Screenshot: terminal-claude-response.png');
        
      } else {
        console.log('⚠️ Terminal not visible');
        
        // Get modal content
        const modalText = await page.textContent('body');
        if (modalText.includes('Connecting')) {
          console.log('📡 Still connecting...');
        }
      }
      
    } else {
      console.log('❌ No agent found in sidebar');
      
      // Take screenshot of current state
      await page.screenshot({ 
        path: 'screenshots/terminal-no-agent.png'
      });
    }
    
    console.log('\n✅ Done! Check screenshots folder');
    console.log('👀 Keeping browser open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ 
      path: 'screenshots/terminal-error-state.png'
    });
  } finally {
    await browser.close();
  }
}

console.log('🎬 Showing Terminal Connection to EC2');
console.log('=====================================\n');

showTerminal()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });