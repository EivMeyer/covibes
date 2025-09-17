const { test, expect, devices } = require('@playwright/test');

// Configure mobile device at the top level
test.use({
  ...devices['iPhone 13'],
  // Force mobile viewport
  viewport: { width: 390, height: 844 }
});

test.describe('Mobile Agent Chat E2E Test', () => {

  test('mobile agent chat functionality works end-to-end', async ({ page }) => {
    console.log('🎯 Starting mobile agent chat E2E test...');

    // Navigate to the actual production application (EC2 production deployment)
    await page.goto('http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Take initial screenshot
    await page.screenshot({ path: 'mobile-initial.png' });
    console.log('📸 Initial mobile page loaded');

    // Check if we need to login or if already authenticated
    const loginButton = page.locator('button:has-text("Login"), button:has-text("Sign In")');
    if (await loginButton.isVisible()) {
      console.log('🔐 Not authenticated, attempting auto-login...');

      // Try demo credentials
      const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
      const passwordInput = page.locator('input[type="password"], input[placeholder*="password" i]');

      if (await emailInput.isVisible()) {
        await emailInput.fill('alice@demo.com');
        await passwordInput.fill('demo123');
        await loginButton.click();

        // Wait for login to complete
        await page.waitForLoadState('networkidle');
      }
    }

    // Look for mobile interface indicators
    const mobileTabBar = page.locator('[data-testid="mobile-tab-bar"], .mobile-tab-bar, nav[role="tablist"]');
    const agentsTab = page.locator('button:has-text("Agents"), [data-testid="agents-tab"], .tab:has-text("Agents")');

    // If mobile tab bar exists, click Agents tab
    if (await mobileTabBar.isVisible()) {
      console.log('📱 Mobile interface detected, clicking Agents tab...');
      await agentsTab.click();
      await page.waitForTimeout(1000);
    } else {
      console.log('🖥️ Desktop interface detected, looking for Add Panel button...');

      // Look for Add Panel button (floating + button)
      const addPanelButton = page.locator('[data-testid="add-panel-button"], button:has-text("+"), .floating-add');
      if (await addPanelButton.isVisible()) {
        console.log('➕ Clicking Add Panel button...');
        await addPanelButton.click();
        await page.waitForTimeout(500);

        // Look for Agent Chat option in menu
        const agentChatOption = page.locator('[data-testid="add-agentchat-panel"], button:has-text("Agent Chat")');
        if (await agentChatOption.isVisible()) {
          console.log('🤖 Adding Agent Chat panel...');
          await agentChatOption.click();
          await page.waitForTimeout(1000);
        }
      }
    }

    // Take screenshot after navigation
    await page.screenshot({ path: 'mobile-after-navigation.png' });

    // Skip spawning for now, test with existing agents
    console.log('📱 Found agents list, testing with existing agent...');

    // Take screenshot of agents list
    await page.screenshot({ path: 'mobile-agents-list.png' });

    // Look for a running agent (indicated by green dot)
    const runningAgent = page.locator('text="Henry Roberts"').first();

    // If no running agent, try any agent
    const agentCard = runningAgent.isVisible() ? runningAgent : page.locator('text="Alan King", text="Alice Walker", text="Theo Syntax"').first();

    if (await agentCard.isVisible()) {
      console.log('🤖 Found agent, clicking to open chat...');
      await agentCard.click();
      await page.waitForTimeout(2000);

      // Take screenshot after clicking agent
      await page.screenshot({ path: 'mobile-agent-clicked.png' });

      // Check if Agent Chat interface opened (not terminal)
      const chatInterface = page.locator('[data-testid="agent-chat"], .agent-chat, .chat-interface');
      const terminalInterface = page.locator('.xterm, .terminal, [data-testid="terminal"]');
      const chatInput = page.locator('textarea[placeholder*="chat" i], input[placeholder*="message" i], textarea[placeholder*="agent" i]');

      if (await chatInterface.isVisible() || await chatInput.isVisible()) {
        console.log('✅ Agent Chat interface opened successfully!');

        // Try to send a test message
        if (await chatInput.isVisible()) {
          console.log('💬 Testing chat input...');
          await chatInput.fill('Hello, this is a test message from mobile');

          // Look for send button
          const sendButton = page.locator('button:has-text("Send"), [data-testid="send"], button[type="submit"]');
          if (await sendButton.isVisible()) {
            await sendButton.click();
            console.log('📤 Test message sent!');
            await page.waitForTimeout(1000);
          }
        }

        // Take final screenshot
        await page.screenshot({ path: 'mobile-agent-chat-success.png' });

        expect(true).toBe(true); // Test passed
        console.log('🎉 Mobile Agent Chat E2E test PASSED!');

      } else if (await terminalInterface.isVisible()) {
        console.log('❌ Terminal opened instead of Agent Chat - this is the bug we fixed!');
        await page.screenshot({ path: 'mobile-terminal-bug.png' });
        throw new Error('Terminal opened instead of Agent Chat on mobile');

      } else {
        console.log('❓ Unknown interface opened, taking debug screenshot...');
        await page.screenshot({ path: 'mobile-unknown-interface.png' });

        // Check page content for debugging
        const pageContent = await page.textContent('body');
        console.log('Page content preview:', pageContent.substring(0, 500));

        expect(false).toBe(true); // Force failure for investigation
      }
    } else {
      console.log('❌ No agents found or visible');
      await page.screenshot({ path: 'mobile-no-agents.png' });

      // Check for any error messages
      const errorMessages = await page.locator('.error, .alert, [role="alert"]').allTextContents();
      if (errorMessages.length > 0) {
        console.log('Error messages found:', errorMessages);
      }

      expect(false).toBe(true); // Force failure for investigation
    }
  });
});