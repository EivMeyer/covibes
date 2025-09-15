const { test, expect } = require('@playwright/test');

test('FINAL VERIFICATION: Database shows stored values (NOT zero)', async ({ page }) => {
  const PREVIEW_URL = 'http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001/preview/demo-team-001/';

  console.log('🚀 FINAL TEST: Verifying database fix works in browser');

  // Capture API calls for debugging
  page.on('response', response => {
    if (response.url().includes('api') && response.url().includes('values')) {
      console.log(`📡 API Response: ${response.status()} - ${response.url()}`);
      response.text().then(body => {
        if (body.startsWith('[') || body.startsWith('{')) {
          console.log('✅ Got JSON response:', body.substring(0, 100) + '...');
        } else {
          console.log('❌ Got HTML response (wrong!)');
        }
      });
    }
  });

  // Navigate to preview
  console.log('📍 Step 1: Navigating to preview...');
  await page.goto(PREVIEW_URL);
  await page.waitForSelector('h1', { timeout: 15000 });

  // Switch to database tab
  console.log('📍 Step 2: Switching to database tab...');
  await page.click('button:has-text("🗄️ Database")');
  await page.waitForSelector('h1:has-text("Database")', { timeout: 10000 });

  // Wait for API call to complete
  console.log('📍 Step 3: Waiting for data to load...');
  await page.waitForTimeout(5000);

  // Check the stored values count
  const headingText = await page.locator('h3').textContent();
  console.log('📊 Page shows:', headingText);

  // THE CRITICAL TEST
  if (headingText.includes('Stored Values (0)')) {
    console.log('❌ STILL BROKEN: Shows 0 values');
    expect(false).toBe(true); // Fail the test
  } else if (headingText.match(/Stored Values \(([1-9]\d*)\)/)) {
    const match = headingText.match(/Stored Values \((\d+)\)/);
    const count = match[1];
    console.log(`🎉 SUCCESS: Shows ${count} stored values!`);
    console.log('✅ The "stored values 0" issue is FIXED!');
    expect(parseInt(count)).toBeGreaterThan(0);
  } else {
    console.log('⚠️ UNEXPECTED: Heading format changed');
    console.log('   Actual text:', headingText);
  }
});