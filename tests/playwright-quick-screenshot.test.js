const { test, expect } = require('@playwright/test');

test('Take screenshot to see current UI', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  
  // Take a screenshot
  await page.screenshot({ path: 'current-ui-state.png', fullPage: true });
  
  console.log('Screenshot saved as current-ui-state.png');
});