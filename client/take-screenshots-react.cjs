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
    console.log('Taking screenshots of ColabVibe React app...\n');
    
    // Go to the React app
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // 1. Login Page Screenshot
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', 'react-01-login-page.png'),
      fullPage: true 
    });
    console.log('✓ Login page screenshot captured');
    
    // Fill in login form
    await page.fill('input[name="email"]', 'demo@colabvibe.dev');
    await page.fill('input[name="password"]', 'demo123');
    
    // Mock the API responses for demo
    await page.route('**/api/auth/login', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'mock-jwt-token',
          user: { id: '1', name: 'Demo User', email: 'demo@colabvibe.dev' },
          team: { id: '1', name: 'Demo Team', inviteCode: 'DEMO123' }
        })
      });
    });
    
    await page.route('**/api/auth/me', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { 
            id: '1', 
            name: 'Demo User', 
            email: 'demo@colabvibe.dev',
            hasVMConfig: true 
          },
          team: { 
            id: '1', 
            name: 'Demo Team', 
            inviteCode: 'DEMO123',
            repositoryUrl: 'https://github.com/demo/colabvibe-test'
          }
        })
      });
    });
    
    await page.route('**/api/agents', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: '1',
            task: 'Analyzing codebase and suggesting performance improvements',
            status: 'running',
            agentType: 'claude',
            userName: 'Alice Developer',
            createdAt: new Date().toISOString(),
            startedAt: new Date().toISOString()
          },
          {
            id: '2',
            task: 'Writing comprehensive unit tests for authentication module',
            status: 'completed',
            agentType: 'mock',
            userName: 'Bob Coder',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            startedAt: new Date(Date.now() - 3600000).toISOString(),
            completedAt: new Date(Date.now() - 1800000).toISOString()
          },
          {
            id: '3',
            task: 'Refactoring database queries for better performance',
            status: 'running',
            agentType: 'claude',
            userName: 'Charlie Dev',
            createdAt: new Date(Date.now() - 7200000).toISOString(),
            startedAt: new Date(Date.now() - 7200000).toISOString()
          }
        ])
      });
    });
    
    // 2. Submit login and wait for dashboard
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    // 3. Dashboard Screenshot
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', 'react-02-dashboard.png'),
      fullPage: true 
    });
    console.log('✓ Dashboard screenshot captured');
    
    // 4. Try to click spawn agent button if it exists
    try {
      await page.click('button:has-text("Spawn Agent")', { timeout: 2000 });
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(__dirname, 'screenshots', 'react-03-spawn-modal.png'),
        fullPage: true 
      });
      console.log('✓ Spawn agent modal screenshot captured');
      await page.keyboard.press('Escape');
    } catch (e) {
      console.log('⚠ Spawn agent button not found, skipping modal screenshot');
    }
    
    // 5. Mobile View
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', 'react-04-mobile.png'),
      fullPage: true 
    });
    console.log('✓ Mobile view screenshot captured');
    
    // 6. Tablet View
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', 'react-05-tablet.png'),
      fullPage: true 
    });
    console.log('✓ Tablet view screenshot captured');
    
    console.log('\n✅ All React app screenshots captured successfully!');
    console.log('📁 Screenshots saved in: client/screenshots/');
    
  } catch (error) {
    console.error('Error taking screenshots:', error.message);
    console.error('Make sure the React dev server is running on http://localhost:3000');
  } finally {
    await browser.close();
  }
}

takeScreenshots();