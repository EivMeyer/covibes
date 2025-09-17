const { chromium, devices } = require('playwright');

(async () => {
  console.log('📱 Taking mobile screenshot to confirm Agent Chat...');

  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    viewport: { width: 390, height: 844 }
  });

  const page = await context.newPage();

  try {
    // Navigate to actual production site (EC2 production deployment)
    console.log('🌐 Navigating to production site...');
    await page.goto('http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com');
    await page.waitForLoadState('networkidle');

    // Take initial screenshot
    await page.screenshot({ path: '/home/ubuntu/covibes/mobile-main-page.png', fullPage: true });
    console.log('📸 Main page screenshot saved');

    // Check if we need to login
    const loginButton = page.locator('button:has-text("Login"), button:has-text("Sign In")');
    if (await loginButton.isVisible()) {
      console.log('🔐 Logging in...');
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');

      await emailInput.fill('alice@demo.com');
      await passwordInput.fill('demo123');
      await loginButton.click();
      await page.waitForLoadState('networkidle');
    }

    // Look for mobile tabs or agents section
    console.log('📱 Looking for agents section...');

    // Try clicking on Agents tab if it exists
    const agentsTab = page.locator('button:has-text("Agents"), [data-testid="agents-tab"]');
    if (await agentsTab.isVisible()) {
      console.log('📂 Clicking Agents tab...');
      await agentsTab.click();
      await page.waitForTimeout(1000);
    }

    // Take screenshot of agents view
    await page.screenshot({ path: '/home/ubuntu/covibes/mobile-agents-view.png', fullPage: true });
    console.log('📸 Agents view screenshot saved');

    // Look for an existing agent to click
    const agentItems = page.locator('text="Henry Roberts", text="Alan King", text="Alice Walker"');
    if (await agentItems.first().isVisible()) {
      console.log('🤖 Found agent, clicking to test chat...');
      await agentItems.first().click();
      await page.waitForTimeout(2000);

      // Take screenshot after clicking agent
      await page.screenshot({ path: '/home/ubuntu/covibes/mobile-agent-clicked.png', fullPage: true });
      console.log('📸 Agent clicked screenshot saved');

      // Check what opened - chat or terminal
      const chatInterface = await page.locator('textarea[placeholder*="chat"], textarea[placeholder*="agent"], .agent-chat').isVisible();
      const terminalInterface = await page.locator('.xterm, .terminal-container').isVisible();

      if (chatInterface) {
        console.log('✅ SUCCESS: Agent Chat interface opened!');
      } else if (terminalInterface) {
        console.log('❌ ISSUE: Terminal opened instead of chat');
      } else {
        console.log('❓ Unknown interface opened');
      }
    }

    console.log('📁 Screenshots saved in /home/ubuntu/covibes/');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();