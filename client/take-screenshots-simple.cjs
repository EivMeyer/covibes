const { chromium } = require('@playwright/test');
const path = require('path');

async function takeScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  
  try {
    console.log('Taking screenshots of ColabVibe React app...');
    
    // 1. Initial load
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Take screenshot of whatever loads (login or error page)
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', '01-app-load.png'),
      fullPage: true 
    });
    console.log('✓ App load screenshot captured');
    
    // 2. Try different viewport sizes
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', '02-tablet-view.png'),
      fullPage: true 
    });
    console.log('✓ Tablet view screenshot captured');
    
    // 3. Mobile view
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', '03-mobile-view.png'),
      fullPage: true 
    });
    console.log('✓ Mobile view screenshot captured');
    
    // 4. Desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', '04-desktop-view.png'),
      fullPage: true 
    });
    console.log('✓ Desktop view screenshot captured');
    
    console.log('\n✅ Screenshots captured successfully!');
    console.log('📁 Screenshots saved in: client/screenshots/');
    
  } catch (error) {
    console.error('Error taking screenshots:', error.message);
  } finally {
    await browser.close();
  }
}

takeScreenshots();