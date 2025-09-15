const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Testing demo dashboard after layout fix...');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Track console errors
  let hasErrors = false;
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Console Error:', msg.text());
      if (msg.text().includes('Maximum call stack') || msg.text().includes('ErrorBoundary')) {
        hasErrors = true;
      }
    }
  });

  try {
    // Navigate and login
    console.log('📡 Loading login page...');
    await page.goto('http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001/', { waitUntil: 'load', timeout: 30000 });

    // Login as Alice
    console.log('🔐 Logging in as Alice...');
    await page.fill('input[name="email"]', 'alice@demo.com');
    await page.fill('input[name="password"]', 'demo123');
    await page.click('button[type="submit"]');

    // Wait and check for dashboard vs error
    console.log('⏳ Waiting for dashboard...');

    await page.waitForTimeout(5000); // Wait 5 seconds

    // Check if we have an error boundary
    const errorBoundary = await page.locator('text=Something went wrong').first();
    const isErrorVisible = await errorBoundary.isVisible();

    if (isErrorVisible) {
      console.log('❌ Dashboard still showing error boundary');
    } else {
      console.log('✅ Dashboard loaded without error boundary!');

      // Try to find dashboard elements
      const dashboardElements = await page.locator('[data-testid*="dashboard"], .dashboard, main, [class*="workspace"]').count();
      console.log(`🔍 Found ${dashboardElements} potential dashboard elements`);

      // Look for team/user info
      const teamInfo = await page.locator('text=/Demo Team|DEMO01|Alice/').count();
      console.log(`👤 Found ${teamInfo} team/user elements`);

      // Look for preview/terminal
      const workspaceElements = await page.locator('text=/Preview|Terminal|preview|terminal/i').count();
      console.log(`🖥️ Found ${workspaceElements} workspace elements`);
    }

    // Take final screenshot
    await page.screenshot({ path: 'test-results/dashboard-after-fix.png', fullPage: true });
    console.log('📸 Screenshot saved');

    if (hasErrors) {
      console.log('❌ Still has console errors');
    } else {
      console.log('✅ No critical console errors detected');
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }

  await browser.close();
  console.log('🏁 Test complete');
})();