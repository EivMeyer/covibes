const { chromium } = require('@playwright/test');
const path = require('path');

async function takeScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  
  try {
    console.log('Taking screenshots of ColabVibe React app...');
    
    // 1. Login Page
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', '01-login-page.png'),
      fullPage: true 
    });
    console.log('✓ Login page screenshot captured');
    
    // 2. Register Form
    await page.click('button:has-text("Create Team")');
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', '02-register-form.png'),
      fullPage: true 
    });
    console.log('✓ Register form screenshot captured');
    
    // 3. Join Team Form
    await page.click('button:has-text("Join Team")');
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', '03-join-team-form.png'),
      fullPage: true 
    });
    console.log('✓ Join team form screenshot captured');
    
    // Go back to login and log in with test user
    await page.click('button:has-text("Login")');
    await page.fill('input[name="email"]', 'test@colabvibe.dev');
    await page.fill('input[name="password"]', 'test123');
    
    // Mock the login response since we're not connected to real backend
    await page.route('**/api/auth/login', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'mock-token',
          user: { id: '1', name: 'Test User', email: 'test@colabvibe.dev' },
          team: { id: '1', name: 'Test Team', inviteCode: 'TEST123' }
        })
      });
    });
    
    // Mock other API endpoints
    await page.route('**/api/auth/me', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { 
            id: '1', 
            name: 'Test User', 
            email: 'test@colabvibe.dev',
            hasVMConfig: true 
          },
          team: { 
            id: '1', 
            name: 'Test Team', 
            inviteCode: 'TEST123',
            repositoryUrl: 'https://github.com/test/colabvibe-test-repo'
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
            task: 'Analyze codebase and suggest improvements',
            status: 'running',
            agentType: 'claude',
            userName: 'Alice Developer',
            createdAt: new Date().toISOString()
          },
          {
            id: '2',
            task: 'Write unit tests for authentication',
            status: 'completed',
            agentType: 'mock',
            userName: 'Bob Coder',
            createdAt: new Date().toISOString()
          }
        ])
      });
    });
    
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    // 4. Dashboard Main View
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', '04-dashboard-main.png'),
      fullPage: true 
    });
    console.log('✓ Dashboard main view screenshot captured');
    
    // 5. Spawn Agent Modal
    await page.click('button:has-text("Spawn Agent")');
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', '05-spawn-agent-modal.png'),
      fullPage: true 
    });
    console.log('✓ Spawn agent modal screenshot captured');
    await page.click('button:has-text("Cancel")');
    
    // 6. VM Configuration Modal
    await page.click('button:has-text("Configure VM")');
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', '06-vm-config-modal.png'),
      fullPage: true 
    });
    console.log('✓ VM configuration modal screenshot captured');
    await page.keyboard.press('Escape');
    
    // 7. Repository Configuration Modal
    await page.click('button:has-text("Configure Repository")');
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', '07-repo-config-modal.png'),
      fullPage: true 
    });
    console.log('✓ Repository configuration modal screenshot captured');
    await page.keyboard.press('Escape');
    
    // 8. Mobile Responsive View
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', '08-mobile-view.png'),
      fullPage: true 
    });
    console.log('✓ Mobile view screenshot captured');
    
    // 9. Tablet View
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', '09-tablet-view.png'),
      fullPage: true 
    });
    console.log('✓ Tablet view screenshot captured');
    
    console.log('\n✅ All screenshots captured successfully!');
    console.log('📁 Screenshots saved in: client/screenshots/');
    
  } catch (error) {
    console.error('Error taking screenshots:', error);
  } finally {
    await browser.close();
  }
}

takeScreenshots();