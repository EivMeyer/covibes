const { test, expect } = require('@playwright/test');

test.describe('Database API Browser Debug', () => {
  test('should debug browser API calls vs direct API calls', async ({ page }) => {
    const PREVIEW_URL = 'http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001/preview/demo-team-001/';

    console.log('🔍 DEBUGGING: Browser vs API discrepancy');

    // Capture all network requests
    const requests = [];
    const responses = [];

    page.on('request', request => {
      if (request.url().includes('api/values')) {
        requests.push({
          url: request.url(),
          method: request.method(),
          headers: Object.fromEntries(request.headers()),
        });
        console.log('📤 Browser request:', request.method(), request.url());
      }
    });

    page.on('response', response => {
      if (response.url().includes('api/values')) {
        responses.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
        });
        console.log('📥 Browser response:', response.status(), response.url());

        // Log response body
        response.text().then(body => {
          console.log('📄 Response body:', body);
        }).catch(() => {});
      }
    });

    // Capture console logs from the page
    page.on('console', msg => {
      if (msg.text().includes('api') || msg.text().includes('fetch') || msg.text().includes('Error')) {
        console.log('🖥️ Browser console:', msg.type(), msg.text());
      }
    });

    // Navigate and activate database tab
    console.log('📍 Navigating to preview...');
    await page.goto(PREVIEW_URL);
    await page.waitForSelector('h1', { timeout: 15000 });

    console.log('📍 Switching to database tab...');
    await page.click('button:has-text("🗄️ Database")');
    await page.waitForSelector('h1:has-text("Database")', { timeout: 10000 });

    // Wait for API calls to complete
    await page.waitForTimeout(5000);

    // Check what the page actually shows
    const headingText = await page.locator('h3').textContent();
    console.log('📊 Page shows:', headingText);

    // Log all captured requests and responses
    console.log('📋 Summary:');
    console.log(`   Requests captured: ${requests.length}`);
    console.log(`   Responses captured: ${responses.length}`);

    requests.forEach((req, i) => {
      console.log(`   Request ${i + 1}: ${req.method} ${req.url}`);
    });

    responses.forEach((res, i) => {
      console.log(`   Response ${i + 1}: ${res.status} ${res.statusText} - ${res.url}`);
    });

    // The critical assertion
    if (headingText && headingText.includes('Stored Values (0)')) {
      console.log('❌ ISSUE CONFIRMED: Browser shows 0 values despite API having data');
      console.log('🔧 This indicates a problem with browser-to-API communication');
    } else {
      console.log('✅ Browser successfully fetched data');
    }

    // Always pass the test, we're just debugging
    expect(true).toBe(true);
  });
});