const { test, expect } = require('@playwright/test');

test.describe('Demo Team Production E2E Verification', () => {
  test('should load demo team preview without MIME errors and verify correct paths', async ({ page, browser }) => {
    console.log('🚀 Starting E2E test for demo team preview');

    // Track console errors, especially MIME type issues
    const consoleErrors = [];
    const networkErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log('❌ Console Error:', msg.text());
      }
    });

    page.on('response', response => {
      if (!response.ok() && !response.url().includes('favicon')) {
        networkErrors.push(`${response.status()} ${response.url()}`);
        console.log('❌ Network Error:', response.status(), response.url());
      }
    });

    // Navigate to demo team preview
    console.log('📡 Loading demo team preview URL...');
    const demoUrl = 'http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001/api/preview/proxy/demo-team-001/main/';
    await page.goto(demoUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for React to load and render
    console.log('⏳ Waiting for React app to render...');
    await page.waitForSelector('div', { timeout: 10000 });

    // Verify no MIME type errors in console
    const mimeErrors = consoleErrors.filter(error =>
      error.includes('MIME type') ||
      error.includes('text/html') ||
      error.includes('module script') ||
      error.includes('Expected a JavaScript module')
    );

    console.log('🔍 MIME type errors found:', mimeErrors.length);
    mimeErrors.forEach(error => console.log('🚨 MIME Error:', error));
    expect(mimeErrors).toHaveLength(0);

    // Verify page title
    console.log('📄 Checking page title...');
    const title = await page.title();
    console.log('📋 Page title:', title);
    expect(title).toContain("Alice's Fixed CoVibes App");

    // Verify React app loaded by checking for main content
    console.log('🔍 Verifying React content loaded...');

    // Wait for and verify main content
    const mainHeading = await page.waitForSelector('h1', { timeout: 10000 });
    const headingText = await mainHeading.textContent();
    console.log('📝 Main heading:', headingText);
    expect(headingText).toContain('HMR TEST');

    // Verify 3 tabs are present
    console.log('📊 Verifying tab navigation...');
    const homeTab = await page.locator('text=🏠 Home');
    const statusTab = await page.locator('text=📊 Status');
    const aboutTab = await page.locator('text=ℹ️ About');

    await expect(homeTab).toBeVisible();
    await expect(statusTab).toBeVisible();
    await expect(aboutTab).toBeVisible();
    console.log('✅ All 3 tabs found and visible');

    // Test tab functionality
    console.log('🖱️ Testing tab switching...');
    await statusTab.click();
    await page.waitForSelector('text=System Status', { timeout: 5000 });
    console.log('✅ Status tab working');

    await aboutTab.click();
    await page.waitForSelector('text=About This Demo', { timeout: 5000 });
    console.log('✅ About tab working');

    await homeTab.click();
    await page.waitForSelector('text=HMR TEST', { timeout: 5000 });
    console.log('✅ Home tab working');

    // Verify counter button works
    console.log('🧮 Testing counter functionality...');
    const counterButton = await page.locator('text=Counter:');
    await expect(counterButton).toBeVisible();
    await counterButton.click();
    console.log('✅ Counter button clickable');

    // Verify time updates (shows React is working)
    console.log('⏰ Verifying live time updates...');
    const timeElement = await page.locator('text=/Current time:/');
    await expect(timeElement).toBeVisible();
    console.log('✅ Time display found');

    // Check for critical network errors
    const criticalErrors = networkErrors.filter(error =>
      !error.includes('favicon') &&
      !error.includes('404') ||
      error.includes('500') ||
      error.includes('ECONNREFUSED')
    );

    console.log('🌐 Critical network errors:', criticalErrors.length);
    criticalErrors.forEach(error => console.log('🚨 Network Error:', error));
    expect(criticalErrors).toHaveLength(0);

    // Verify JavaScript modules load with correct MIME types by checking network
    console.log('📦 Verifying JavaScript module responses...');
    const jsRequests = [];

    page.on('response', response => {
      if (response.url().includes('.js') || response.url().includes('.jsx') || response.url().includes('@vite/client')) {
        jsRequests.push({
          url: response.url(),
          status: response.status(),
          contentType: response.headers()['content-type'] || 'unknown'
        });
      }
    });

    // Reload to capture all JS requests
    await page.reload({ waitUntil: 'networkidle' });

    // Wait a moment for requests to complete
    await page.waitForTimeout(2000);

    console.log(`📊 JavaScript requests captured: ${jsRequests.length}`);
    jsRequests.forEach(req => {
      console.log(`📄 ${req.status} ${req.contentType} - ${req.url.substring(0, 100)}...`);
      expect(req.status).toBe(200);
      if (req.url.includes('.js') || req.url.includes('.jsx') || req.url.includes('@vite/client')) {
        expect(req.contentType).toMatch(/javascript|application\/javascript|text\/javascript/);
      }
    });

    console.log('🎉 E2E test completed successfully!');
    console.log('✅ No MIME type errors detected');
    console.log('✅ All tabs functional');
    console.log('✅ React app fully working');
    console.log('✅ JavaScript modules loading with correct MIME types');
  });
});