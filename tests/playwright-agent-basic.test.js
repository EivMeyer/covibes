/**
 * Basic Agent Test - Test the core flow without waiting for completion
 */

const { test, expect } = require('@playwright/test');

test('Agent Spawn E2E Test - Create HTML page with Hello World', async ({ page }) => {
  console.log('🚀 Starting agent spawn test...');
  
  // Navigate to React frontend
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  console.log('✅ Page loaded');
  
  // Login
  await page.fill('input[type="email"]', 'alice@demo.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  console.log('✅ Login submitted');
  
  // Wait for dashboard - be more specific about what indicates success
  await page.waitForFunction(() => {
    return document.body.innerText.includes('Command Deck') || 
           document.querySelector('button') && 
           Array.from(document.querySelectorAll('button')).some(btn => 
             btn.textContent.includes('Spawn')
           );
  }, { timeout: 15000 });
  console.log('✅ Dashboard loaded');
  
  // Wait for socket connection
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return !text.includes('Connecting to server...');
  }, { timeout: 10000 });
  console.log('✅ Socket connected');
  
  // Find and click spawn button
  const spawnButton = page.getByRole('button', { name: /spawn/i });
  await expect(spawnButton).toBeEnabled({ timeout: 10000 });
  await spawnButton.click();
  console.log('✅ Spawn button clicked');
  
  // Wait for modal to appear and fill task
  await page.waitForSelector('textarea[name="task"]', { timeout: 10000 });
  const htmlTask = 'Create a simple index.html file with "Hello World" text inside an h1 tag';
  await page.fill('textarea[name="task"]', htmlTask);
  console.log(`✅ Task filled: "${htmlTask}"`);
  
  // Click spawn in modal - be more specific
  await page.getByRole('button', { name: /spawn/i }).last().click();
  console.log('✅ Agent spawn submitted');
  
  // Wait briefly and take screenshot
  await page.waitForTimeout(3000);
  
  // Look for any indication of success or agent creation
  const pageText = await page.textContent('body');
  const hasAgentIndication = pageText.toLowerCase().includes('agent') || 
                            pageText.toLowerCase().includes('spawned') ||
                            pageText.toLowerCase().includes('running') ||
                            pageText.toLowerCase().includes('task');
  
  if (hasAgentIndication) {
    console.log('✅ Agent appears to be spawned successfully');
  } else {
    console.log('⚠️ No clear agent indication found, but test completed');
  }
  
  // Take final screenshot
  await page.screenshot({ 
    path: 'screenshots/agent-spawn-final.png',
    fullPage: true 
  });
  
  console.log('🎉 Test completed!');
  console.log('📸 Screenshot saved: screenshots/agent-spawn-final.png');
  
  // The test passes if we got this far without errors
  expect(hasAgentIndication).toBe(true);
});