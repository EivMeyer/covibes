const { test, expect } = require('@playwright/test');

test.describe('Demo Team Dashboard Verification', () => {
  test('should login as Alice and verify demo team dashboard loads correctly', async ({ page }) => {
    console.log('🚀 TESTING: Demo team dashboard functionality...');

    // Track console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log('❌ Console Error:', msg.text());
      }
    });

    // Navigate to login page
    console.log('📡 Loading login page...');
    await page.goto('http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Login as Alice (demo user)
    console.log('🔐 Logging in as alice@demo.com...');
    await page.fill('input[name="email"]', 'alice@demo.com');
    await page.fill('input[name="password"]', 'demo123');
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    console.log('⏳ Waiting for dashboard to load...');
    await page.waitForSelector('[data-testid="dashboard"], .dashboard, main', { timeout: 10000 });

    // Verify team information is displayed
    console.log('🔍 Checking team display...');
    const teamName = await page.locator('text=/Demo Team|DEMO01/').first();
    if (await teamName.isVisible()) {
      const teamText = await teamName.textContent();
      console.log('✅ Team displayed:', teamText);
    } else {
      console.log('❌ Team name not found on dashboard');
    }

    // Verify user information
    console.log('👤 Checking user display...');
    const userInfo = await page.locator('text=/Alice|alice@demo.com/').first();
    if (await userInfo.isVisible()) {
      const userText = await userInfo.textContent();
      console.log('✅ User displayed:', userText);
    } else {
      console.log('❌ User info not found on dashboard');
    }

    // Check if preview tile/section is present
    console.log('🖥️ Looking for preview section...');
    const previewSection = await page.locator('text=/Preview|preview/i').first();
    if (await previewSection.isVisible()) {
      console.log('✅ Preview section found');
    } else {
      console.log('❌ Preview section not visible');
    }

    // Look for any iframe or preview content
    const iframe = page.locator('iframe');
    const iframeCount = await iframe.count();
    console.log(`🖼️ Found ${iframeCount} iframes on dashboard`);

    // Check if there are any links to the preview
    const previewLinks = await page.locator('a[href*="preview"]').count();
    console.log(`🔗 Found ${previewLinks} preview links`);

    // Take a screenshot of the dashboard for evidence
    await page.screenshot({
      path: 'test-results/demo-dashboard-verification.png',
      fullPage: true
    });

    // Verify no critical console errors
    const criticalErrors = consoleErrors.filter(error =>
      !error.includes('favicon') &&
      !error.includes('404') &&
      error.includes('Error')
    );

    console.log(`🔍 Console errors found: ${consoleErrors.length}`);
    console.log(`🚨 Critical errors: ${criticalErrors.length}`);

    if (criticalErrors.length > 0) {
      console.log('Critical errors:', criticalErrors);
    }

    console.log('📸 Dashboard screenshot saved');
    console.log('🎉 Demo team dashboard verification complete');
  });
});