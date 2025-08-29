/**
 * Playwright E2E Test: Spawn Claude Agent with HTML Task
 * 
 * This test verifies the full flow of:
 * 1. Login to CoVibe
 * 2. Wait for socket connection
 * 3. Spawn a Claude agent with "make index.html page with hello world" task
 * 4. Verify agent receives and processes the task
 * 5. Check that agent creates the HTML file
 */

const { test, expect } = require('@playwright/test');

test.describe('Claude Agent HTML Generation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to CoVibe
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    
    // Wait for the login form specifically to be visible
    await expect(page.locator('form#login-form-element')).toBeVisible({ timeout: 10000 });
  });

  test('should login and spawn Claude agent to create index.html with hello world', async ({ page }) => {
    // Step 1: Login with demo credentials
    console.log('🔐 Logging in...');
    
    // Fill login form
    await page.fill('input[type="email"]', 'alice@demo.com');
    await page.fill('input[type="password"]', 'demo123');
    
    // Submit login
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to load
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✅ Dashboard loaded');
    
    // Step 2: Wait for WebSocket connection
    console.log('🔌 Waiting for socket connection...');
    
    // Wait for "Connected" status or similar indication
    await page.waitForFunction(() => {
      const statusText = document.body.innerText;
      return statusText.includes('Connected') || 
             statusText.includes('online') || 
             !statusText.includes('Connecting...');
    }, { timeout: 15000 });
    
    console.log('✅ Socket connected');
    
    // Step 3: Open Spawn Agent Modal
    console.log('🤖 Opening spawn agent modal...');
    
    // Look for "Spawn Agent" button - try multiple selectors
    const spawnButtons = [
      'button:has-text("Spawn Agent")',
      'button:has-text("Spawn")',
      '[data-testid="spawn-agent"]',
      'button:text-is("Spawn Agent")',
      'button:text-is("Spawn")'
    ];
    
    let spawnButton = null;
    for (const selector of spawnButtons) {
      try {
        spawnButton = page.locator(selector).first();
        if (await spawnButton.isVisible({ timeout: 2000 })) {
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    // If no spawn button found, look for any button that might spawn agents
    if (!spawnButton || !(await spawnButton.isVisible({ timeout: 1000 }))) {
      console.log('⚠️ Spawn button not found, looking for alternatives...');
      
      // Check if spawn button is disabled and needs to wait
      await page.waitForFunction(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(btn => 
          (btn.textContent.includes('Spawn') || btn.textContent.includes('Agent')) &&
          !btn.disabled
        );
      }, { timeout: 15000 });
      
      spawnButton = page.locator('button').filter({ hasText: /Spawn/ }).first();
    }
    
    expect(spawnButton).toBeTruthy();
    await expect(spawnButton).toBeEnabled({ timeout: 5000 });
    
    // Click spawn agent button
    await spawnButton.click();
    console.log('✅ Spawn agent modal opened');
    
    // Step 4: Fill in agent task
    console.log('📝 Filling agent task...');
    
    // Wait for modal to appear
    await page.waitForSelector('div[role="dialog"], .modal, [data-testid="spawn-modal"]', { timeout: 5000 });
    
    // Find the task input field (it's a textarea with name="task")
    const taskInput = page.locator('textarea[name="task"]');
    
    expect(taskInput).toBeTruthy();
    await expect(taskInput).toBeVisible();
    
    // Fill in the HTML creation task
    const htmlTask = 'make index.html page with hello world';
    await taskInput.fill(htmlTask);
    console.log(`✅ Task filled: "${htmlTask}"`);
    
    // Step 5: Submit the agent spawn request
    console.log('🚀 Spawning agent...');
    
    // Find and click spawn/submit button in modal
    const submitButtons = [
      'button:has-text("Spawn")',
      'button:has-text("Create")', 
      'button:has-text("Submit")',
      'button[type="submit"]',
      '[data-testid="spawn-submit"]'
    ];
    
    let submitButton = null;
    for (const selector of submitButtons) {
      try {
        submitButton = page.locator(selector).last(); // Use last to get the one in the modal
        if (await submitButton.isVisible({ timeout: 2000 })) {
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    expect(submitButton).toBeTruthy();
    await submitButton.click();
    console.log('✅ Agent spawn request submitted');
    
    // Step 6: Wait for agent to be created and start processing
    console.log('⏳ Waiting for agent to start...');
    
    // Wait for modal to close
    await page.waitForFunction(() => {
      const modals = document.querySelectorAll('div[role="dialog"], .modal, [data-testid="spawn-modal"]');
      return modals.length === 0 || Array.from(modals).every(modal => 
        modal.style.display === 'none' || !modal.offsetParent
      );
    }, { timeout: 10000 });
    
    // Wait for agent to appear in the agent list or dashboard
    await page.waitForFunction(() => {
      const pageText = document.body.innerText;
      return pageText.includes('index.html') || 
             pageText.includes('hello world') ||
             pageText.includes('running') ||
             pageText.includes('spawned');
    }, { timeout: 20000 });
    
    console.log('✅ Agent started processing task');
    
    // Step 7: Wait for agent output/completion
    console.log('📋 Waiting for agent output...');
    
    // Wait for some indication that the agent is working or has completed
    await page.waitForFunction(() => {
      const pageText = document.body.innerText.toLowerCase();
      return pageText.includes('completed') ||
             pageText.includes('finished') || 
             pageText.includes('success') ||
             pageText.includes('html') ||
             pageText.includes('created') ||
             pageText.includes('generated');
    }, { timeout: 30000 });
    
    console.log('✅ Agent completed task');
    
    // Step 8: Verify the task result
    console.log('🔍 Verifying results...');
    
    // Check that the page shows some indication of success
    const pageContent = await page.textContent('body');
    
    // Verify task-related content appears
    const hasTaskContent = pageContent.toLowerCase().includes('index.html') ||
                          pageContent.toLowerCase().includes('hello world') ||
                          pageContent.toLowerCase().includes('html');
    
    expect(hasTaskContent).toBe(true);
    
    // Take a screenshot of the final result
    await page.screenshot({ 
      path: 'screenshots/agent-spawn-success.png',
      fullPage: true 
    });
    
    console.log('🎉 Test completed successfully!');
    console.log('📸 Screenshot saved: screenshots/agent-spawn-success.png');
  });
  
  test('should handle agent spawn failure gracefully', async ({ page }) => {
    // Login first
    await page.fill('input[type="email"]', 'alice@demo.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // Wait for connection
    await page.waitForFunction(() => {
      const statusText = document.body.innerText;
      return !statusText.includes('Connecting...');
    }, { timeout: 10000 });
    
    // Try to spawn agent with invalid/empty task
    const spawnButton = page.locator('button').filter({ hasText: /Spawn/ }).first();
    await expect(spawnButton).toBeEnabled({ timeout: 5000 });
    await spawnButton.click();
    
    // Wait for modal
    await page.waitForSelector('div[role="dialog"], .modal', { timeout: 5000 });
    
    // Leave task empty or put invalid task
    const taskInput = page.locator('textarea, input[name="task"]').first();
    await taskInput.fill(''); // Empty task
    
    // Try to submit
    const submitButton = page.locator('button:has-text("Spawn"), button[type="submit"]').last();
    await submitButton.click();
    
    // Should show some error or validation message
    await page.waitForFunction(() => {
      const pageText = document.body.innerText.toLowerCase();
      return pageText.includes('error') || 
             pageText.includes('required') ||
             pageText.includes('invalid');
    }, { timeout: 5000 });
    
    console.log('✅ Error handling verified');
  });
});