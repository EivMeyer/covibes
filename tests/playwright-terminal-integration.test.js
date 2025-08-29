import { test, expect } from '@playwright/test';

test.describe('Terminal Integration E2E Tests', () => {
  const BASE_URL = 'http://localhost:3002';
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto(BASE_URL);
    
    // Login
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForURL(/dashboard/, { timeout: 10000 });
    
    // Wait for socket connection
    await page.waitForFunction(() => {
      return !document.body.textContent?.includes('Connecting to server');
    }, { timeout: 15000 });
  });

  test('should spawn agent and open interactive terminal', async ({ page }) => {
    // Click spawn agent button
    const spawnButton = page.locator('button:has-text("Spawn Agent"), button:has-text("Spawn")').first();
    await expect(spawnButton).toBeEnabled({ timeout: 10000 });
    await spawnButton.click();
    
    // Wait for modal
    await expect(page.locator('text="Spawn New Agent"')).toBeVisible({ timeout: 5000 });
    
    // Select Claude agent type
    await page.click('button:has-text("Claude")');
    
    // Enter a task
    const taskInput = page.locator('textarea[name="task"]');
    await taskInput.fill('Help me create a hello world HTML file');
    
    // Spawn the agent
    await page.click('button:has-text("Spawn Agent")');
    
    // Wait for success message
    await expect(page.locator('text="Agent spawned successfully"')).toBeVisible({ timeout: 10000 });
    
    // Check that Active Agents section is expanded
    const activeAgentsSection = page.locator('text="Active Agents"').locator('..');
    await expect(activeAgentsSection).toBeVisible();
    
    // Click on the spawned agent to open it
    const agentItem = page.locator('div[role="button"]:has-text("Help me create")').first();
    await expect(agentItem).toBeVisible({ timeout: 15000 });
    await agentItem.click();
    
    // Verify agent modal opens
    await expect(page.locator('text=/Agent/')).toBeVisible({ timeout: 5000 });
    
    // Check if we need to switch to terminal mode
    const switchToTerminal = page.locator('button:has-text("Switch to Terminal")');
    if (await switchToTerminal.isVisible()) {
      await switchToTerminal.click();
      console.log('Switched to terminal mode');
    }
    
    // Verify terminal is visible
    const terminal = page.locator('div.xterm, canvas.xterm-text-layer').first();
    await expect(terminal).toBeVisible({ timeout: 10000 });
    
    // Verify terminal status indicators
    await expect(page.locator('text="Terminal mode"')).toBeVisible();
    await expect(page.locator('text="Connected"')).toBeVisible();
    
    console.log('✅ Terminal opened successfully');
  });

  test('should interact with agent through terminal', async ({ page }) => {
    // First spawn an agent without a task for interactive mode
    const spawnButton = page.locator('button:has-text("Spawn Agent"), button:has-text("Spawn")').first();
    await spawnButton.click();
    
    await expect(page.locator('text="Spawn New Agent"')).toBeVisible();
    await page.click('button:has-text("Claude")');
    
    // Leave task empty for interactive mode
    const taskInput = page.locator('textarea[name="task"]');
    await taskInput.clear();
    
    await page.click('button:has-text("Spawn Agent")');
    await expect(page.locator('text="Agent spawned successfully"')).toBeVisible({ timeout: 10000 });
    
    // Open the agent
    const agentItem = page.locator('div[role="button"]:has-text("Claude")').first();
    await expect(agentItem).toBeVisible({ timeout: 15000 });
    await agentItem.click();
    
    // Switch to terminal if needed
    const switchToTerminal = page.locator('button:has-text("Switch to Terminal")');
    if (await switchToTerminal.isVisible()) {
      await switchToTerminal.click();
    }
    
    // Wait for terminal
    const terminal = page.locator('div.xterm, canvas.xterm-text-layer').first();
    await expect(terminal).toBeVisible({ timeout: 10000 });
    
    // Type a command
    await page.keyboard.type('hello');
    await page.keyboard.press('Enter');
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Type another command
    await page.keyboard.type('help');
    await page.keyboard.press('Enter');
    
    await page.waitForTimeout(3000);
    
    // Test Ctrl+C interrupt
    await page.keyboard.press('Control+C');
    await page.waitForTimeout(1000);
    
    console.log('✅ Terminal interaction successful');
  });

  test('should toggle between terminal and output view', async ({ page }) => {
    // Spawn an agent with a task
    const spawnButton = page.locator('button:has-text("Spawn Agent")').first();
    await spawnButton.click();
    
    await page.click('button:has-text("Claude")');
    await page.fill('textarea[name="task"]', 'Create index.html');
    await page.click('button:has-text("Spawn Agent")');
    
    await expect(page.locator('text="Agent spawned successfully"')).toBeVisible({ timeout: 10000 });
    
    // Open the agent
    const agentItem = page.locator('div[role="button"]:has-text("Create index.html")').first();
    await expect(agentItem).toBeVisible({ timeout: 15000 });
    await agentItem.click();
    
    // Check initial view (might be terminal or output)
    const switchToTerminal = page.locator('button:has-text("Switch to Terminal")');
    const switchToOutput = page.locator('button:has-text("Switch to Output View")');
    
    if (await switchToTerminal.isVisible()) {
      // Currently in output view, switch to terminal
      await switchToTerminal.click();
      await expect(switchToOutput).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text="Terminal mode"')).toBeVisible();
      
      // Switch back to output
      await switchToOutput.click();
      await expect(switchToTerminal).toBeVisible({ timeout: 5000 });
    } else if (await switchToOutput.isVisible()) {
      // Currently in terminal view, switch to output
      await switchToOutput.click();
      await expect(switchToTerminal).toBeVisible({ timeout: 5000 });
      
      // Switch back to terminal
      await switchToTerminal.click();
      await expect(switchToOutput).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text="Terminal mode"')).toBeVisible();
    }
    
    console.log('✅ View toggle successful');
  });

  test('should handle multiple agents with terminals', async ({ page }) => {
    // Spawn first agent
    let spawnButton = page.locator('button:has-text("Spawn Agent")').first();
    await spawnButton.click();
    await page.click('button:has-text("Claude")');
    await page.fill('textarea[name="task"]', 'First agent task');
    await page.click('button:has-text("Spawn Agent")');
    await expect(page.locator('text="Agent spawned successfully"')).toBeVisible();
    
    // Spawn second agent
    await page.waitForTimeout(2000);
    spawnButton = page.locator('button:has-text("Spawn Agent")').first();
    await spawnButton.click();
    await page.click('button:has-text("Claude")');
    await page.fill('textarea[name="task"]', 'Second agent task');
    await page.click('button:has-text("Spawn Agent")');
    await expect(page.locator('text="Agent spawned successfully"')).toBeVisible();
    
    // Verify both agents appear in the list
    await expect(page.locator('text="First agent task"')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text="Second agent task"')).toBeVisible({ timeout: 10000 });
    
    // Open first agent
    await page.locator('div[role="button"]:has-text("First agent task")').click();
    await expect(page.locator('text=/First agent task/')).toBeVisible();
    
    // Close modal
    await page.keyboard.press('Escape');
    
    // Open second agent
    await page.locator('div[role="button"]:has-text("Second agent task")').click();
    await expect(page.locator('text=/Second agent task/')).toBeVisible();
    
    console.log('✅ Multiple agents handled successfully');
  });

  test('should show terminal keyboard shortcuts', async ({ page }) => {
    // Spawn an agent
    const spawnButton = page.locator('button:has-text("Spawn Agent")').first();
    await spawnButton.click();
    await page.click('button:has-text("Claude")');
    await page.click('button:has-text("Spawn Agent")');
    await expect(page.locator('text="Agent spawned successfully"')).toBeVisible();
    
    // Open the agent
    const agentItem = page.locator('div[role="button"]:has-text("Claude")').first();
    await expect(agentItem).toBeVisible({ timeout: 15000 });
    await agentItem.click();
    
    // Switch to terminal if needed
    const switchToTerminal = page.locator('button:has-text("Switch to Terminal")');
    if (await switchToTerminal.isVisible()) {
      await switchToTerminal.click();
    }
    
    // Verify keyboard shortcuts are displayed
    await expect(page.locator('text="Ctrl+C (interrupt)"')).toBeVisible();
    await expect(page.locator('text="Ctrl+D (exit)"')).toBeVisible();
    await expect(page.locator('text="Ctrl+L (clear)"')).toBeVisible();
    
    console.log('✅ Keyboard shortcuts displayed');
  });
});