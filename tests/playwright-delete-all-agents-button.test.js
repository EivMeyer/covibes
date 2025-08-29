const { test, expect } = require('@playwright/test');

test.describe('Delete All Agents Button', () => {
  test('should show Delete All Agents button when agents are present', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000');
    
    // Handle login - fill in test user credentials
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'testuser@example.com');
    await page.fill('input[type="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to load
    await page.waitForSelector('.dashboard', { timeout: 15000 });
    
    // Look for the agents section
    await page.waitForSelector('h3:has-text("Agents")', { timeout: 10000 });
    
    // Check if there are any existing agents
    const agentRows = await page.locator('[data-testid="agent-row"], .group.flex.items-center.h-8').count();
    
    if (agentRows === 0) {
      // No agents present - spawn one first
      console.log('No agents found, spawning a test agent...');
      
      // Look for spawn agent button or modal trigger
      const spawnButton = page.locator('button:has-text("Spawn"), button:has-text("Add"), button:has-text("+")').first();
      if (await spawnButton.isVisible()) {
        await spawnButton.click();
        
        // Fill in agent task if modal appears
        const taskInput = page.locator('input[placeholder*="task"], textarea[placeholder*="task"], input[name="task"]').first();
        if (await taskInput.isVisible({ timeout: 5000 })) {
          await taskInput.fill('Test agent for delete button test');
          
          // Submit the form
          const submitButton = page.locator('button[type="submit"], button:has-text("Spawn"), button:has-text("Create")').first();
          await submitButton.click();
          
          // Wait for agent to appear
          await page.waitForTimeout(3000);
        }
      }
    }
    
    // Now check for the Delete All Agents button
    // Based on the AgentList component, it should be a trash icon button in the header
    const deleteAllButton = page.locator('button[title="Delete All Agents"]');
    
    // Verify the button is visible
    await expect(deleteAllButton).toBeVisible();
    
    // Verify it has the correct icon (SVG with trash icon)
    const trashIcon = deleteAllButton.locator('svg');
    await expect(trashIcon).toBeVisible();
    
    // Verify the button is in the agents header section
    const agentsHeader = page.locator('.flex.items-center.justify-between.mb-1\\.5:has(h3:has-text("Agents"))');
    await expect(agentsHeader).toContainText('Agents');
    
    // Test button interaction (click but cancel the confirmation)
    await deleteAllButton.click();
    
    // Handle the confirmation dialog
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('delete ALL');
      expect(dialog.message()).toContain('cannot be undone');
      await dialog.dismiss(); // Cancel the deletion
    });
    
    // Wait a moment to ensure dialog was handled
    await page.waitForTimeout(1000);
    
    // Verify agents still exist (since we canceled)
    const remainingAgents = await page.locator('[data-testid="agent-row"], .group.flex.items-center.h-8').count();
    expect(remainingAgents).toBeGreaterThan(0);
    
    console.log('✅ Delete All Agents button is visible and functional');
  });

  test('should not show Delete All Agents button when no agents present', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000');
    
    // Handle login
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'testuser@example.com');
    await page.fill('input[type="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to load
    await page.waitForSelector('.dashboard', { timeout: 15000 });
    
    // Look for the agents section
    await page.waitForSelector('h3:has-text("Agents")', { timeout: 10000 });
    
    // If there are agents, we need to delete them first for this test
    const agentRows = await page.locator('[data-testid="agent-row"], .group.flex.items-center.h-8').count();
    
    if (agentRows > 0) {
      console.log('Found agents, need to clear them for this test...');
      
      // Click delete all button if it exists
      const deleteAllButton = page.locator('button[title="Delete All Agents"]');
      if (await deleteAllButton.isVisible()) {
        await deleteAllButton.click();
        
        // Confirm deletion
        page.on('dialog', async dialog => {
          await dialog.accept();
        });
        
        // Wait for deletion to complete
        await page.waitForTimeout(2000);
      }
    }
    
    // Verify no agents are present
    const noAgentsMessage = page.locator('text=No agents running');
    await expect(noAgentsMessage).toBeVisible();
    
    // Verify Delete All Agents button is not visible when no agents
    const deleteAllButton = page.locator('button[title="Delete All Agents"]');
    await expect(deleteAllButton).not.toBeVisible();
    
    console.log('✅ Delete All Agents button correctly hidden when no agents present');
  });
});