/**
 * SIMPLIFIED STEP-BY-STEP FLOW TEST
 * 
 * Testing the exact user flow with precise selectors
 */

const { test, expect } = require('@playwright/test');

// Test configuration
const TEST_CONFIG = {
  BASE_URL: 'http://localhost:3000',
  TEST_USER: {
    email: `test${Date.now()}@covibes.com`, // Unique email to avoid conflicts
    password: 'testpass123',
    userName: 'TestUser',
    teamName: `TestTeam${Date.now()}` // Unique team name
  },
  TIMEOUT: 30000 // 30 seconds for each step
};

test.describe('CoVibe Step-by-Step User Flow', () => {

  test('Step 1: Load login page', async ({ page }) => {
    console.log('📋 Step 1: Loading CoVibe login page');
    await page.goto(TEST_CONFIG.BASE_URL);
    
    // Verify login page loads
    await expect(page.locator('text=Welcome back')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Create Team')).toBeVisible();
    await expect(page.locator('text=Join Team')).toBeVisible();
    
    console.log('✅ Login page loaded successfully');
    
    // Take screenshot for verification
    await page.screenshot({ path: 'test-step-01-login.png' });
  });

  test('Step 2: Create team registration', async ({ page }) => {
    console.log('📋 Step 2: Starting team creation');
    await page.goto(TEST_CONFIG.BASE_URL);
    
    // Wait for page to load
    await expect(page.locator('text=Create Team')).toBeVisible({ timeout: 10000 });
    
    // Click Create Team
    await page.click('text=Create Team');
    
    // Wait for registration form to appear
    await page.waitForTimeout(2000);
    
    // Take screenshot to see what appears
    await page.screenshot({ path: 'test-step-02-after-create-team-click.png' });
    
    console.log('✅ Clicked Create Team');
  });

  test('Step 3: Fill registration form', async ({ page }) => {
    console.log('📋 Step 3: Filling registration form');
    await page.goto(TEST_CONFIG.BASE_URL);
    
    // Click Create Team
    await page.click('text=Create Team');
    await page.waitForTimeout(2000);
    
    // Look for form fields with various selectors
    const teamNameField = page.locator('input[name="teamName"]').or(
      page.locator('input[placeholder*="team"]')).or(
      page.locator('input[placeholder*="Team"]')).first();
    
    const userNameField = page.locator('input[name="userName"]').or(
      page.locator('input[placeholder*="name"]')).or(
      page.locator('input[placeholder*="Name"]')).first();
    
    const emailField = page.locator('input[name="email"]').or(
      page.locator('input[type="email"]')).or(
      page.locator('input[placeholder*="email"]')).first();
    
    const passwordField = page.locator('input[name="password"]').or(
      page.locator('input[type="password"]')).or(
      page.locator('input[placeholder*="password"]')).first();

    // Check if fields are visible
    try {
      await expect(teamNameField).toBeVisible({ timeout: 5000 });
      console.log('✅ Team name field found');
      
      await teamNameField.fill(TEST_CONFIG.TEST_USER.teamName);
      await userNameField.fill(TEST_CONFIG.TEST_USER.userName);
      await emailField.fill(TEST_CONFIG.TEST_USER.email);
      await passwordField.fill(TEST_CONFIG.TEST_USER.password);
      
      console.log('✅ Registration form filled');
      
      // Take screenshot
      await page.screenshot({ path: 'test-step-03-form-filled.png' });
      
      // Submit form
      const submitButton = page.locator('button[type="submit"]').or(
        page.locator('button:has-text("Create")')).or(
        page.locator('button:has-text("Register")')).first();
      
      await submitButton.click();
      
      console.log('✅ Registration form submitted');
      
      // Wait for result
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'test-step-03-after-submit.png' });
      
    } catch (error) {
      console.log('❌ Registration form not found or not visible');
      await page.screenshot({ path: 'test-step-03-error.png' });
      throw error;
    }
  });

  test('Step 4: Verify dashboard loads', async ({ page }) => {
    console.log('📋 Step 4: Verifying dashboard loads after registration');
    await page.goto(TEST_CONFIG.BASE_URL);
    
    // Go through registration
    await page.click('text=Create Team');
    await page.waitForTimeout(2000);
    
    // Fill form
    const teamNameField = page.locator('input[name="teamName"]').or(
      page.locator('input[placeholder*="team"]')).first();
    
    if (await teamNameField.isVisible()) {
      await teamNameField.fill(TEST_CONFIG.TEST_USER.teamName);
      await page.locator('input[name="userName"], input[placeholder*="name"]').first().fill(TEST_CONFIG.TEST_USER.userName);
      await page.locator('input[type="email"], input[placeholder*="email"]').first().fill(TEST_CONFIG.TEST_USER.email);
      await page.locator('input[type="password"], input[placeholder*="password"]').first().fill(TEST_CONFIG.TEST_USER.password);
      
      // Submit
      await page.locator('button[type="submit"], button:has-text("Create")').first().click();
      
      // Wait for dashboard
      await page.waitForTimeout(5000);
      
      // Check for dashboard elements
      const dashboardIndicators = [
        'text=Active Agents',
        'text=Spawn Agent',
        'text=Team',
        'text=Dashboard',
        'text=CoVibe', // Main header
      ];
      
      let foundDashboard = false;
      for (const indicator of dashboardIndicators) {
        try {
          await expect(page.locator(indicator)).toBeVisible({ timeout: 2000 });
          console.log(`✅ Found dashboard element: ${indicator}`);
          foundDashboard = true;
          break;
        } catch (e) {
          console.log(`⚠️  Dashboard element not found: ${indicator}`);
        }
      }
      
      await page.screenshot({ path: 'test-step-04-dashboard-check.png' });
      
      if (!foundDashboard) {
        console.log('❌ Dashboard not detected');
        throw new Error('Dashboard did not load after registration');
      }
      
      console.log('✅ Dashboard loaded successfully');
    } else {
      console.log('❌ Registration form not found');
      await page.screenshot({ path: 'test-step-04-no-form.png' });
      throw new Error('Could not find registration form');
    }
  });

});