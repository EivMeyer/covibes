const { test, expect } = require('@playwright/test');

test.describe('Demo Team Preview - Database Functionality', () => {
  const PREVIEW_URL = 'http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001/preview/demo-team-001/';
  const TEST_VALUE = 'E2E Test Value from Playwright';

  test.beforeEach(async ({ page }) => {
    // Set longer timeout for network requests
    page.setDefaultTimeout(10000);

    // Navigate to preview URL
    await page.goto(PREVIEW_URL);

    // Wait for React app to load
    await page.waitForSelector('h1', { timeout: 15000 });

    // Switch to Database tab
    await page.click('button:has-text("🗄️ Database")');

    // Wait for database tab content to load
    await page.waitForSelector('h1:has-text("Database")', { timeout: 10000 });
  });

  test('should show database tab loads correctly', async ({ page }) => {
    // Verify database tab is active
    const databaseTab = page.locator('button:has-text("🗄️ Database")');
    await expect(databaseTab).toHaveCSS('border', '2px solid white');

    // Verify page shows database content
    await expect(page.locator('h1')).toContainText('Database');
    await expect(page.locator('h2')).toContainText('Add and View Values');

    // Verify form elements are present
    await expect(page.locator('input[placeholder*="Enter a value"]')).toBeVisible();
    await expect(page.locator('button:has-text("Add Value")')).toBeVisible();
  });

  test('should fetch existing stored values (NOT show stored values 0)', async ({ page }) => {
    // Wait for values to be fetched
    await page.waitForTimeout(2000);

    // Check the stored values count in the heading
    const valuesHeading = page.locator('h3');
    await expect(valuesHeading).toBeVisible({ timeout: 10000 });

    const headingText = await valuesHeading.textContent();
    console.log('📊 Values heading text:', headingText);

    // The critical test: it should NOT say "Stored Values (0)"
    expect(headingText).not.toContain('Stored Values (0)');

    // It should show at least 1 value (we added "Test message" earlier)
    expect(headingText).toMatch(/Stored Values \(([1-9]\d*)\)/);

    console.log('✅ SUCCESS: Database shows stored values, not zero!');
  });

  test('should successfully add a new value via the form', async ({ page }) => {
    // Get initial count
    const initialHeading = await page.locator('h3').textContent();
    const initialMatch = initialHeading.match(/Stored Values \((\d+)\)/);
    const initialCount = initialMatch ? parseInt(initialMatch[1]) : 0;

    console.log('📊 Initial count:', initialCount);

    // Fill in the form
    await page.fill('input[placeholder*="Enter a value"]', TEST_VALUE);

    // Submit the form
    await page.click('button:has-text("Add Value")');

    // Wait for the form to be submitted and list to update
    await page.waitForTimeout(3000);

    // Verify the count increased
    const newHeading = await page.locator('h3').textContent();
    const newMatch = newHeading.match(/Stored Values \((\d+)\)/);
    const newCount = newMatch ? parseInt(newMatch[1]) : 0;

    console.log('📊 New count:', newCount);

    expect(newCount).toBe(initialCount + 1);

    // Verify the new value appears in the list
    await expect(page.locator('div').filter({ hasText: TEST_VALUE })).toBeVisible();

    console.log('✅ SUCCESS: Added new value and it appears in the list!');
  });

  test('should show values with timestamps', async ({ page }) => {
    // Wait for values to load
    await page.waitForTimeout(2000);

    // Check if there are any values displayed
    const valuesList = page.locator('div').filter({ hasText: /\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/ });

    // Verify at least one value with timestamp exists
    const count = await valuesList.count();
    expect(count).toBeGreaterThan(0);

    console.log(`✅ SUCCESS: Found ${count} values with timestamps!`);
  });

  test('should handle API communication correctly', async ({ page }) => {
    // Listen for API requests
    const apiRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/values')) {
        apiRequests.push({
          method: request.method(),
          url: request.url()
        });
      }
    });

    // Wait for initial load
    await page.waitForTimeout(3000);

    // Verify GET request was made
    const getRequests = apiRequests.filter(req => req.method === 'GET');
    expect(getRequests.length).toBeGreaterThan(0);

    console.log('✅ SUCCESS: API GET request intercepted:', getRequests[0].url);

    // Add a value to trigger POST
    await page.fill('input[placeholder*="Enter a value"]', 'API Test Value');
    await page.click('button:has-text("Add Value")');

    // Wait for POST request
    await page.waitForTimeout(2000);

    // Verify POST request was made
    const postRequests = apiRequests.filter(req => req.method === 'POST');
    expect(postRequests.length).toBeGreaterThan(0);

    console.log('✅ SUCCESS: API POST request intercepted:', postRequests[0].url);
    console.log('📊 Total API requests captured:', apiRequests.length);
  });

  test('should show proper error handling if API fails', async ({ page }) => {
    // Block API requests to simulate failure
    await page.route('**/api/values', route => {
      route.abort();
    });

    // Try to add a value
    await page.fill('input[placeholder*="Enter a value"]', 'This should fail');
    await page.click('button:has-text("Add Value")');

    // Wait a bit
    await page.waitForTimeout(2000);

    // The form should still be there (not crash the app)
    await expect(page.locator('input[placeholder*="Enter a value"]')).toBeVisible();

    console.log('✅ SUCCESS: App handles API failures gracefully!');
  });
});

test.describe('Demo Team Preview - Full Integration Test', () => {
  test('should demonstrate complete database workflow', async ({ page }) => {
    const PREVIEW_URL = 'http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001/preview/demo-team-001/';
    const WORKFLOW_VALUE = `Integration Test ${Date.now()}`;

    console.log('🚀 Starting complete database workflow test...');

    // Step 1: Navigate to preview
    console.log('📍 Step 1: Navigating to preview URL...');
    await page.goto(PREVIEW_URL);
    await page.waitForSelector('h1', { timeout: 15000 });
    console.log('✅ Preview loaded successfully');

    // Step 2: Switch to database tab
    console.log('📍 Step 2: Switching to database tab...');
    await page.click('button:has-text("🗄️ Database")');
    await page.waitForSelector('h1:has-text("Database")', { timeout: 10000 });
    console.log('✅ Database tab activated');

    // Step 3: Verify initial state (NOT zero values)
    console.log('📍 Step 3: Checking initial stored values count...');
    await page.waitForTimeout(3000);
    const initialHeading = await page.locator('h3').textContent();
    console.log('📊 Initial heading:', initialHeading);

    // This is the CRITICAL test - verify it's NOT "Stored Values (0)"
    expect(initialHeading).not.toContain('Stored Values (0)');
    console.log('🎉 CRITICAL SUCCESS: Does NOT show "Stored Values (0)"!');

    // Step 4: Add a new value
    console.log('📍 Step 4: Adding new value via form...');
    await page.fill('input[placeholder*="Enter a value"]', WORKFLOW_VALUE);
    await page.click('button:has-text("Add Value")');
    await page.waitForTimeout(3000);
    console.log('✅ Value added via form');

    // Step 5: Verify value appears in list
    console.log('📍 Step 5: Verifying value appears in list...');
    await expect(page.locator('div').filter({ hasText: WORKFLOW_VALUE })).toBeVisible();
    console.log('✅ New value visible in list');

    // Step 6: Verify count increased
    console.log('📍 Step 6: Verifying count increased...');
    const finalHeading = await page.locator('h3').textContent();
    console.log('📊 Final heading:', finalHeading);

    const initialMatch = initialHeading.match(/Stored Values \((\d+)\)/);
    const finalMatch = finalHeading.match(/Stored Values \((\d+)\)/);

    if (initialMatch && finalMatch) {
      const initialCount = parseInt(initialMatch[1]);
      const finalCount = parseInt(finalMatch[1]);
      expect(finalCount).toBe(initialCount + 1);
      console.log(`📈 Count increased from ${initialCount} to ${finalCount}`);
    }

    console.log('🎉 COMPLETE SUCCESS: Full database workflow verified!');
    console.log('🔥 The "stored values 0" issue is DEFINITIVELY FIXED!');
  });
});