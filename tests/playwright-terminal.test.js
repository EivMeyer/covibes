import { test, expect } from '@playwright/test';

test.describe('Agent Terminal Integration', () => {
  const BASE_URL = 'http://localhost:3001';
  
  test('should spawn agent and interact via terminal', async ({ page }) => {
    // Go to login page
    await page.goto(BASE_URL);
    
    // Login
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to load
    await page.waitForURL(/dashboard/, { timeout: 10000 });
    
    // Wait for socket connection
    await page.waitForFunction(() => {
      const statusElement = document.querySelector('[data-testid="connection-status"]');
      return statusElement?.textContent?.includes('Connected') || 
             !document.body.textContent?.includes('Connecting to server');
    }, { timeout: 15000 });
    
    // Click spawn agent button
    const spawnButton = page.locator('button:has-text("Spawn Agent"), button:has-text("Spawn")').first();
    await expect(spawnButton).toBeEnabled({ timeout: 10000 });
    await spawnButton.click();
    
    // Wait for modal
    await expect(page.locator('text="Spawn New Agent"')).toBeVisible({ timeout: 5000 });
    
    // Select agent type
    await page.click('button:has-text("Claude")');
    
    // Enter task
    const taskInput = page.locator('textarea[name="task"]');
    await taskInput.fill('Create a simple hello world HTML file');
    
    // Submit
    await page.click('button:has-text("Spawn Agent")');
    
    // Wait for agent to appear in list
    await expect(page.locator('text="Active Agents"')).toBeVisible({ timeout: 10000 });
    
    // Wait for the agent to appear in the list and click it
    const agentItem = page.locator('div[role="button"]:has-text("Create a simple hello world")').first();
    await expect(agentItem).toBeVisible({ timeout: 15000 });
    await agentItem.click();
    
    // Wait for agent output modal
    await expect(page.locator('text="Agent"')).toBeVisible({ timeout: 5000 });
    
    // Check if terminal is visible or switch to terminal mode
    const terminalSwitchButton = page.locator('button:has-text("Switch to Terminal")');
    if (await terminalSwitchButton.isVisible()) {
      await terminalSwitchButton.click();
    }
    
    // Verify terminal is active
    await expect(page.locator('text="Terminal mode"')).toBeVisible({ timeout: 5000 });
    
    // The terminal should be visible now
    const terminal = page.locator('div.xterm');
    await expect(terminal).toBeVisible({ timeout: 10000 });
    
    // Type a command in the terminal
    await page.keyboard.type('hello claude');
    await page.keyboard.press('Enter');
    
    // Wait for response in terminal
    await page.waitForTimeout(2000);
    
    // Verify we can see terminal content
    const terminalContent = await terminal.textContent();
    console.log('Terminal content:', terminalContent);
    
    // Test terminal keyboard shortcuts
    await page.keyboard.press('Control+C'); // Interrupt
    await page.waitForTimeout(1000);
    
    await page.keyboard.type('help');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    
    // Switch back to output view
    const outputSwitchButton = page.locator('button:has-text("Switch to Output View")');
    if (await outputSwitchButton.isVisible()) {
      await outputSwitchButton.click();
      await expect(page.locator('button:has-text("Switch to Terminal")')).toBeVisible({ timeout: 5000 });
    }
    
    // Close modal
    await page.keyboard.press('Escape');
    
    console.log('✅ Terminal integration test completed successfully!');
  });
});