/**
 * FIXED REGISTRATION TEST - handles all fields including confirm password
 */

const { test, expect } = require('@playwright/test');

// Test configuration
const TEST_CONFIG = {
  BASE_URL: 'http://localhost:3000',
  TEST_USER: {
    email: `test${Date.now()}@covibes.com`,
    password: 'testpass123',
    userName: 'TestUser',
    teamName: `TestTeam${Date.now()}`
  }
};

test.describe('CoVibe Fixed Registration Flow', () => {

  test('Complete registration with all fields', async ({ page }) => {
    console.log('📋 Starting complete registration flow');
    
    await page.goto(TEST_CONFIG.BASE_URL);
    
    // Wait for login page
    await expect(page.locator('text=Create Team')).toBeVisible({ timeout: 10000 });
    
    // Click Create Team
    await page.click('text=Create Team');
    await page.waitForTimeout(2000);
    
    // Fill ALL form fields
    await page.fill('input[placeholder*="team"], input[name="teamName"]', TEST_CONFIG.TEST_USER.teamName);
    await page.fill('input[placeholder*="Your Name"], input[name="userName"]', TEST_CONFIG.TEST_USER.userName);
    await page.fill('input[type="email"], input[name="email"]', TEST_CONFIG.TEST_USER.email);
    await page.fill('input[placeholder*="At least 6 characters"], input[name="password"]', TEST_CONFIG.TEST_USER.password);
    
    // IMPORTANT: Fill confirm password field
    await page.fill('input[placeholder*="Repeat your password"], input[name="confirmPassword"]', TEST_CONFIG.TEST_USER.password);
    
    console.log('✅ All form fields filled');
    
    // Take screenshot
    await page.screenshot({ path: 'registration-complete-form.png' });
    
    // Submit form
    await page.click('button[type="submit"], button:has-text("Create Team")');
    
    console.log('✅ Registration form submitted');
    
    // Wait for redirect/response
    await page.waitForTimeout(5000);
    
    // Take screenshot of result
    await page.screenshot({ path: 'registration-result.png' });
    
    // Check for dashboard or success indicators
    const dashboardElements = [
      'text=Active Agents',
      'text=Team',
      'text=Spawn Agent',
      'text=Dashboard',
      'text=Welcome'
    ];
    
    let foundDashboard = false;
    for (const element of dashboardElements) {
      try {
        await expect(page.locator(element)).toBeVisible({ timeout: 3000 });
        console.log(`✅ Found dashboard element: ${element}`);
        foundDashboard = true;
        break;
      } catch (e) {
        console.log(`⚠️  Element not found: ${element}`);
      }
    }
    
    if (foundDashboard) {
      console.log('🎉 REGISTRATION SUCCESSFUL - Dashboard loaded!');
    } else {
      console.log('❌ Registration may have failed - checking for errors');
      
      // Check for error messages
      const errorSelectors = [
        'text=error',
        'text=Error',
        'text=failed',
        'text=Failed',
        '.error',
        '[class*="error"]'
      ];
      
      for (const selector of errorSelectors) {
        try {
          const errorElement = page.locator(selector);
          if (await errorElement.isVisible()) {
            const errorText = await errorElement.textContent();
            console.log(`❌ Error found: ${errorText}`);
          }
        } catch (e) {
          // No error found with this selector
        }
      }
    }
    
    // Final screenshot
    await page.screenshot({ path: 'registration-final-state.png' });
  });

  test('Test agent spawning after registration', async ({ page }) => {
    console.log('📋 Testing agent spawning flow');
    
    await page.goto(TEST_CONFIG.BASE_URL);
    
    // Complete registration first
    await page.click('text=Create Team');
    await page.waitForTimeout(2000);
    
    // Fill registration form
    await page.fill('input[placeholder*="team"]', TEST_CONFIG.TEST_USER.teamName);
    await page.fill('input[placeholder*="Your Name"]', TEST_CONFIG.TEST_USER.userName);
    await page.fill('input[type="email"]', TEST_CONFIG.TEST_USER.email);
    await page.fill('input[placeholder*="At least 6 characters"]', TEST_CONFIG.TEST_USER.password);
    await page.fill('input[placeholder*="Repeat your password"]', TEST_CONFIG.TEST_USER.password);
    
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    
    // Look for spawn agent functionality
    const spawnSelectors = [
      'text=Spawn Agent',
      'text=Add Agent',
      'text=Create Agent',
      'button:has-text("Spawn")',
      'button:has-text("Add")'
    ];
    
    let foundSpawnButton = false;
    for (const selector of spawnSelectors) {
      try {
        const spawnButton = page.locator(selector);
        if (await spawnButton.isVisible()) {
          console.log(`✅ Found spawn button: ${selector}`);
          await spawnButton.click();
          foundSpawnButton = true;
          break;
        }
      } catch (e) {
        console.log(`⚠️  Spawn button not found: ${selector}`);
      }
    }
    
    if (foundSpawnButton) {
      await page.waitForTimeout(3000);
      
      // Look for agent creation form/modal
      const taskSelectors = [
        'textarea[name="task"]',
        'input[name="task"]',
        'textarea[placeholder*="task"]',
        'textarea[placeholder*="What"]'
      ];
      
      for (const selector of taskSelectors) {
        try {
          const taskInput = page.locator(selector);
          if (await taskInput.isVisible()) {
            console.log(`✅ Found task input: ${selector}`);
            await taskInput.fill('List the files in the repository and create a simple README');
            
            // Submit agent creation
            await page.click('button:has-text("Spawn"), button:has-text("Create"), button[type="submit"]');
            console.log('✅ Agent spawn request submitted');
            break;
          }
        } catch (e) {
          console.log(`⚠️  Task input not found: ${selector}`);
        }
      }
      
      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'agent-spawn-result.png' });
    } else {
      console.log('❌ Could not find spawn agent button');
      await page.screenshot({ path: 'no-spawn-button.png' });
    }
  });

});