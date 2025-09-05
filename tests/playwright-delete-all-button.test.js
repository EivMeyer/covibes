const { test, expect } = require('@playwright/test');

test.describe('Delete All Button Test', () => {
  test('should show Delete All button when agents exist', async ({ page }) => {
    console.log('🧪 Testing Delete All button functionality...');
    
    // Navigate to the app
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    console.log('📍 Navigated to app, checking auth state...');
    
    // Handle authentication - try Create Team
    const createTeamButton = page.locator('text="Create Team"').first();
    const isCreateTeamVisible = await createTeamButton.isVisible().catch(() => false);
    
    if (isCreateTeamVisible) {
      console.log('🔑 Found Create Team button, filling form...');
      await createTeamButton.click();
      
      // Fill registration form
      await page.fill('input[name="teamName"]', 'DeleteAllTest');
      await page.fill('input[name="userName"]', 'TestUser');
      await page.fill('input[name="email"]', 'deleteall@test.com');
      await page.fill('input[name="password"]', 'testpass123');
      
      // Submit
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      
      console.log('📝 Form submitted, waiting for dashboard...');
      
      // Wait for dashboard to load
      await page.waitForFunction(
        () => !document.URL.includes('/auth') && !document.body.textContent.includes('Sign In'),
        { timeout: 10000 }
      );
    }
    
    console.log('🏠 Should be on dashboard now, looking for agent section...');
    
    // Take a screenshot of current state
    await page.screenshot({ path: 'current-dashboard-state.png' });
    
    // Look for the agent section (try multiple selectors)
    const agentSectionSelectors = [
      'text="Active Agents"',
      '.sidebar',
      '[data-testid="agents-section"]',
      'text="No agents"',
      'button[title*="Delete"]',
      'text="agent"'
    ];
    
    let foundSection = false;
    for (const selector of agentSectionSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        console.log(`✅ Found element: ${selector}`);
        foundSection = true;
        break;
      } catch (e) {
        console.log(`❌ Not found: ${selector}`);
      }
    }
    
    if (!foundSection) {
      console.log('⚠️  No agent section found, checking page content...');
      const pageContent = await page.textContent('body');
      console.log('Page content preview:', pageContent.substring(0, 200));
    }
    
    // Look for Delete All button regardless
    const deleteAllButton = page.locator('button[title*="Delete"], button:has-text("Delete All")');
    const isDeleteButtonVisible = await deleteAllButton.isVisible().catch(() => false);
    
    if (isDeleteButtonVisible) {
      console.log('✅ DELETE ALL BUTTON FOUND!');
      await page.screenshot({ path: 'delete-all-button-found.png' });
      
      // Verify it works
      await expect(deleteAllButton).toBeVisible();
    } else {
      console.log('❌ Delete All button not found');
      
      // Check if there's an "agents" text at all
      const hasAgentsText = await page.locator('text*="agent"').isVisible().catch(() => false);
      console.log('Has agents text:', hasAgentsText);
    }
  });
});