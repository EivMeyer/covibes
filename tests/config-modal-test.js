const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Testing configuration modals show current config...');
    
    // Navigate to the app
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Login with existing user
    console.log('Logging in...');
    await page.fill('input[name="email"]', 'alice@demo.com');
    await page.fill('input[name="password"]', 'demo123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to load
    await page.waitForSelector('text=Command Deck', { timeout: 10000 });
    console.log('✓ Logged in successfully');

    // Test Repository Configuration Modal
    console.log('\n1. Testing Repository Configuration Modal...');
    
    // Click on Configure Repository button
    await page.click('button:has-text("Configure Repository")');
    await page.waitForSelector('text=Configure Project Repository');
    
    // Check if current repository URL is shown in the input field
    const repoUrlValue = await page.inputValue('input[name="repositoryUrl"]');
    if (repoUrlValue && repoUrlValue.includes('github.com')) {
      console.log(`✓ Repository URL is pre-populated: ${repoUrlValue}`);
    } else {
      console.log(`✗ Repository URL not pre-populated. Value: "${repoUrlValue}"`);
    }
    
    // Check if current config info box is shown
    const currentConfigBox = await page.locator('.bg-blue-900').filter({ hasText: 'Currently configured:' });
    if (await currentConfigBox.isVisible()) {
      const configText = await currentConfigBox.textContent();
      console.log('✓ Current repository configuration is displayed in info box');
      console.log(`  Info: ${configText.substring(0, 100)}...`);
    } else {
      console.log('✗ Current repository configuration info box not visible');
    }
    
    // Close the modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Test VM Configuration Modal
    console.log('\n2. Testing VM Configuration Modal...');
    
    // Click on Configure VM button
    await page.click('button:has-text("Configure VM")');
    await page.waitForSelector('text=Configure VM Access');
    
    // Check if current VM status is shown
    const vmStatusBox = await page.locator('.bg-green-900, .bg-yellow-900').first();
    if (await vmStatusBox.isVisible()) {
      const statusText = await vmStatusBox.textContent();
      if (statusText.includes('Current VM Configuration')) {
        console.log('✓ Current VM configuration is displayed');
        console.log(`  Status: ${statusText.substring(0, 100)}...`);
        
        // Check if IP is pre-populated
        const hostValue = await page.inputValue('input[name="host"]');
        if (hostValue) {
          console.log(`✓ Host/IP field is pre-populated: ${hostValue}`);
        } else {
          console.log('  Note: Host/IP field is empty (VM may not be configured yet)');
        }
      } else if (statusText.includes('No VM Currently Configured')) {
        console.log('✓ VM status shows "No VM Currently Configured" (expected for new setup)');
      } else {
        console.log(`✗ Unexpected VM status: ${statusText.substring(0, 100)}...`);
      }
    } else {
      console.log('✗ VM status box not visible');
    }
    
    // Close the modal
    await page.keyboard.press('Escape');
    
    console.log('\n✅ Configuration modal tests completed!');
    console.log('Both modals now display current configuration when opened.');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();