// Quick test to verify terminal width is fixed
// This tests that terminals use full width and not constrained to ~10 columns

import { chromium } from '@playwright/test';

async function testTerminalWidth() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🧪 Testing Terminal Width Fix...');
    
    // Navigate to app
    await page.goto('http://localhost:3000');
    
    // Login (adjust credentials as needed)
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Login")');
    
    // Wait for dashboard
    await page.waitForSelector('[data-testid="dashboard"]', { timeout: 5000 });
    
    // Open terminal tile (adjust selector as needed)
    const terminalTile = await page.locator('.terminal-tile, [data-tile-type="terminal"]').first();
    
    if (await terminalTile.isVisible()) {
      // Check terminal dimensions
      const terminalContent = await terminalTile.locator('.xterm-screen, .terminal-display, pre').first();
      const box = await terminalContent.boundingBox();
      
      console.log('📏 Terminal dimensions:', {
        width: box?.width,
        height: box?.height
      });
      
      // Terminal should be wider than 100px (was ~10 columns = ~80px before fix)
      if (box && box.width > 100) {
        console.log('✅ Terminal using full width:', box.width, 'px');
        
        // Check for proper text rendering
        const textContent = await terminalContent.textContent();
        if (textContent) {
          console.log('✅ Terminal has content displayed');
          
          // Check if lines are properly formatted (not constrained)
          const lines = textContent.split('\n');
          const longLines = lines.filter(line => line.length > 20);
          
          if (longLines.length > 0) {
            console.log('✅ Terminal can display lines longer than 20 chars');
          } else {
            console.log('⚠️  No long lines found - may need to generate more output');
          }
        }
      } else {
        console.error('❌ Terminal width too narrow:', box?.width, 'px');
      }
    } else {
      console.log('ℹ️  Terminal tile not visible - may need to spawn an agent first');
    }
    
    console.log('\n🎉 Terminal width test complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testTerminalWidth().catch(console.error);