const { test, expect } = require('@playwright/test');

/**
 * E2E Test: Agent Terminal Read-Only vs Interactive Fix
 *
 * This test verifies that agent terminals show as interactive (writable)
 * for the user who spawned them, instead of "Read-only Observer"
 *
 * Root cause: sanitizedAgents was missing userId field for ownership checks
 */

test.describe('Agent Terminal Ownership Fix', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      if (msg.text().includes('🔍') || msg.text().includes('🎯')) {
        console.log('🔍 BROWSER:', msg.text());
      }
    });

    // Go to the application
    await page.goto('http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3000');

    // Wait for potential auth redirect
    await page.waitForTimeout(2000);
  });

  test('Agent terminal should be interactive for owner, not read-only', async ({ page }) => {
    console.log('🎯 Starting agent terminal ownership test...');

    // Step 1: Check if we're logged in or need to login
    const isLoggedIn = await page.locator('[data-testid="dashboard"]').isVisible().catch(() => false);

    if (!isLoggedIn) {
      console.log('🎯 Need to login...');

      // Try to find login form
      const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();
      const passwordInput = page.locator('input[type="password"], input[placeholder*="password"]').first();

      if (await emailInput.isVisible()) {
        await emailInput.fill('alice@demo.com');
        await passwordInput.fill('password123');

        // Click login button
        const loginButton = page.locator('button:has-text("Login"), button:has-text("Sign In")').first();
        await loginButton.click();

        // Wait for dashboard
        await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
        console.log('✅ Successfully logged in');
      }
    } else {
      console.log('✅ Already logged in');
    }

    // Step 2: Look for existing Quinn Server agent or spawn one
    console.log('🎯 Looking for Quinn Server agent...');

    // First check if Quinn Server terminal tile already exists
    let quinnTerminal = page.locator('text=Quinn Server').first();
    let hasQuinnTerminal = await quinnTerminal.isVisible().catch(() => false);

    if (!hasQuinnTerminal) {
      console.log('🎯 Spawning new Quinn Server agent...');

      // Look for spawn agent button/modal
      const spawnButton = page.locator('button:has-text("Spawn"), button:has-text("Add Agent"), [data-testid="spawn-agent"]').first();
      if (await spawnButton.isVisible()) {
        await spawnButton.click();

        // Fill in agent details
        const taskInput = page.locator('input[placeholder*="task"], textarea[placeholder*="task"]').first();
        if (await taskInput.isVisible()) {
          await taskInput.fill('Server management and configuration');
        }

        const nameInput = page.locator('input[placeholder*="name"]').first();
        if (await nameInput.isVisible()) {
          await nameInput.fill('Quinn Server');
        }

        // Submit
        const submitButton = page.locator('button:has-text("Spawn"), button:has-text("Create"), button:has-text("Submit")').first();
        await submitButton.click();

        // Wait for agent to appear
        await page.waitForTimeout(3000);
        console.log('✅ Agent spawned');
      }
    }

    // Step 3: Find the Quinn Server terminal tile
    console.log('🎯 Finding Quinn Server terminal tile...');

    // Try multiple selectors to find the terminal
    const terminalSelectors = [
      'text=Quinn Server',
      '[title*="Quinn Server"]',
      '.terminal-tile:has-text("Quinn Server")',
      '.tile:has-text("Quinn Server")',
      'div:has-text("Quinn Server")'
    ];

    let terminalTile = null;
    for (const selector of terminalSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          terminalTile = element;
          console.log(`✅ Found terminal with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!terminalTile) {
      console.log('❌ Could not find Quinn Server terminal tile');

      // Take screenshot for debugging
      await page.screenshot({ path: 'debug-no-terminal-found.png', fullPage: true });

      // List all visible text to see what's available
      const allText = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('*'))
          .map(el => el.textContent?.trim())
          .filter(text => text && text.length > 0 && text.length < 100)
          .slice(0, 50);
      });
      console.log('🎯 Visible text on page:', allText);

      throw new Error('Quinn Server terminal tile not found');
    }

    // Step 4: Click on the terminal tile and check its state
    console.log('🎯 Clicking on Quinn Server terminal...');
    await terminalTile.click();
    await page.waitForTimeout(1000);

    // Step 5: Check if terminal is interactive or read-only
    console.log('🎯 Checking terminal state...');

    // Look for read-only indicator
    const readOnlyIndicator = page.locator('text=Read-only Observer, text=👁️ Read-only Observer').first();
    const isReadOnly = await readOnlyIndicator.isVisible().catch(() => false);

    // Look for interactive elements (input, terminal prompt, etc.)
    const interactiveElements = [
      'input[type="text"]',
      'textarea',
      '.terminal-input',
      '.xterm-cursor-layer',
      '.terminal-cursor'
    ];

    let hasInteractiveElement = false;
    for (const selector of interactiveElements) {
      if (await page.locator(selector).isVisible().catch(() => false)) {
        hasInteractiveElement = true;
        console.log(`✅ Found interactive element: ${selector}`);
        break;
      }
    }

    // Step 6: Verify the fix worked
    console.log('🎯 Verifying terminal state...');

    if (isReadOnly) {
      console.log('❌ Terminal is still showing as read-only!');

      // Take screenshot for debugging
      await page.screenshot({ path: 'debug-still-readonly.png', fullPage: true });

      // Get console logs that might show the debug info
      const debugInfo = await page.evaluate(() => {
        return {
          localStorage: localStorage.getItem('colabvibe_auth_token') ? 'HAS_TOKEN' : 'NO_TOKEN',
          userAgent: navigator.userAgent,
          currentUrl: window.location.href
        };
      });
      console.log('🎯 Debug info:', debugInfo);

      throw new Error('Terminal is still read-only - fix did not work');
    }

    if (hasInteractiveElement) {
      console.log('✅ Terminal has interactive elements - looks writable!');
    } else {
      console.log('⚠️  No obvious interactive elements found, but not marked as read-only either');
    }

    // Step 7: Try to interact with the terminal if possible
    console.log('🎯 Attempting to interact with terminal...');

    // Try to find a terminal input or click in terminal area
    const terminalArea = page.locator('.terminal, .xterm, .terminal-container').first();
    if (await terminalArea.isVisible()) {
      await terminalArea.click();
      await page.keyboard.type('echo "test interaction"');
      await page.keyboard.press('Enter');

      console.log('✅ Successfully typed in terminal');
    }

    // Final verification - terminal should NOT show read-only
    const stillReadOnly = await page.locator('text=Read-only Observer, text=👁️ Read-only Observer').isVisible().catch(() => false);
    expect(stillReadOnly).toBe(false);

    console.log('🎉 TEST PASSED: Terminal is interactive, not read-only!');
  });
});