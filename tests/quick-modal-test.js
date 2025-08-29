const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false }); // Show browser for debugging
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Quick test of configuration modals...');
    
    // Navigate to the app
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);

    // Login
    console.log('Logging in...');
    await page.fill('input[name="email"]', 'alice@demo.com');
    await page.fill('input[name="password"]', 'demo123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForSelector('text=Command Deck', { timeout: 10000 });
    console.log('✓ Logged in');

    // Open Repository Config Modal
    console.log('\nOpening Repository Config Modal...');
    await page.click('button:has-text("Configure Repository")');
    await page.waitForTimeout(1000);
    
    // Take screenshot of repo modal
    await page.screenshot({ path: 'repo-modal.png' });
    console.log('✓ Screenshot saved as repo-modal.png');
    
    // Check if input is pre-populated
    const repoUrl = await page.inputValue('input[name="repositoryUrl"]');
    console.log(`Repository URL field value: "${repoUrl}"`);
    
    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Open VM Config Modal
    console.log('\nOpening VM Config Modal...');
    await page.click('button:has-text("Configure VM")');
    await page.waitForTimeout(1000);
    
    // Take screenshot of VM modal
    await page.screenshot({ path: 'vm-modal.png' });
    console.log('✓ Screenshot saved as vm-modal.png');
    
    // Check if host is pre-populated
    const hostValue = await page.inputValue('input[name="host"]');
    console.log(`Host field value: "${hostValue}"`);
    
    console.log('\n✅ Test completed! Check the screenshots to verify modals show current config.');
    
  } catch (error) {
    console.error('Test failed:', error.message);
    await page.screenshot({ path: 'error-screenshot.png' });
  } finally {
    await page.waitForTimeout(3000); // Keep browser open for a moment
    await browser.close();
  }
})();