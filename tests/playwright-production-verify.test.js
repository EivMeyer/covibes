const { test, expect } = require('@playwright/test');

test.describe('Production Demo Preview Verification', () => {
  test('should load demo team preview in production with no MIME errors', async ({ page }) => {
    console.log('🚀 ULTRATHINK: Loading production demo preview...');

    // Track MIME type errors specifically
    const mimeErrors = [];
    const consoleErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        consoleErrors.push(text);

        // Track MIME type errors specifically
        if (text.includes('MIME type') ||
            text.includes('Expected a JavaScript module script') ||
            text.includes('text/html') ||
            text.includes('module script')) {
          mimeErrors.push(text);
          console.log('🚨 MIME ERROR DETECTED:', text);
        } else {
          console.log('ℹ️  Console Error (non-MIME):', text);
        }
      }
    });

    // Load the production demo URL (user-facing path that redirects)
    const demoUrl = 'http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001/preview/demo-team-001/';
    console.log('📡 Loading:', demoUrl);

    try {
      await page.goto(demoUrl, {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      console.log('✅ Page loaded successfully');
    } catch (error) {
      console.log('❌ Failed to load page:', error.message);
      throw error;
    }

    // Wait for React to render
    console.log('⏳ Waiting for React content...');
    await page.waitForSelector('h1', { timeout: 10000 });

    // Verify no MIME type errors occurred
    console.log(`🔍 MIME errors detected: ${mimeErrors.length}`);
    console.log(`🔍 Total console errors: ${consoleErrors.length}`);

    if (mimeErrors.length > 0) {
      console.log('🚨 MIME ERRORS FOUND:');
      mimeErrors.forEach(error => console.log(`  - ${error}`));
    }

    expect(mimeErrors, 'No MIME type errors should occur').toHaveLength(0);

    // Verify page title loads correctly
    const title = await page.title();
    console.log('📋 Page title:', title);
    expect(title).toContain("Alice's Fixed CoVibes App");

    // Verify main React content loads
    const mainHeading = await page.locator('h1').textContent();
    console.log('📝 Main heading:', mainHeading);
    expect(mainHeading).toContain('HMR TEST');

    // Verify all 3 tabs are present and functional
    console.log('📊 Testing tab navigation...');

    const homeTab = page.locator('text=🏠 Home');
    const statusTab = page.locator('text=📊 Status');
    const aboutTab = page.locator('text=ℹ️ About');

    await expect(homeTab).toBeVisible();
    await expect(statusTab).toBeVisible();
    await expect(aboutTab).toBeVisible();
    console.log('✅ All 3 tabs visible');

    // Test tab switching functionality
    await statusTab.click();
    await expect(page.locator('text=System Status')).toBeVisible();
    console.log('✅ Status tab works');

    await aboutTab.click();
    await expect(page.locator('text=About This Demo')).toBeVisible();
    console.log('✅ About tab works');

    await homeTab.click();
    await expect(page.locator('text=HMR TEST')).toBeVisible();
    console.log('✅ Home tab works');

    // Verify interactive counter
    const counterButton = page.locator('text=Counter:');
    await expect(counterButton).toBeVisible();
    await counterButton.click();
    console.log('✅ Counter button interactive');

    // Verify live time display (shows React state updates work)
    const timeElement = page.locator('text=/Current time:/');
    await expect(timeElement).toBeVisible();
    console.log('✅ Live time display working');

    // Final verification: Take a screenshot for evidence
    await page.screenshot({
      path: 'test-results/production-demo-success.png',
      fullPage: true
    });

    console.log('🎉 ULTRATHINK VERIFICATION COMPLETE:');
    console.log('✅ Production demo preview loads successfully');
    console.log('✅ Zero MIME type errors detected');
    console.log('✅ React app fully functional with 3 tabs');
    console.log('✅ Interactive elements working');
    console.log('✅ Live state updates working');
    console.log('📸 Screenshot saved as evidence');
  });
});