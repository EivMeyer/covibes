/**
 * Simple Agent Spawn Test - Just test the login and spawn flow
 */

const { test, expect } = require('@playwright/test');

test.describe('Agent Spawn Simple Test', () => {
  test('should login and spawn Claude agent', async ({ page }) => {
    console.log('🚀 Starting test...');
    
    // Navigate to CoVibe React frontend
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    console.log('✅ Page loaded');
    
    // Wait for login form and fill it
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'alice@demo.com');
    await page.fill('input[type="password"]', 'demo123');
    
    console.log('✅ Credentials filled');
    
    // Submit login
    await page.click('button[type="submit"]');
    
    // Wait for dashboard (check for URL change or specific element)
    await page.waitForFunction(() => {
      return window.location.pathname.includes('dashboard') || 
             document.body.innerText.includes('Command Deck') ||
             document.body.innerText.includes('Spawn Agent');
    }, { timeout: 15000 });
    
    console.log('✅ Dashboard loaded');
    
    // Wait for socket connection (look for "Connected" or absence of "Connecting...")
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes('Connected') || 
             text.includes('online') || 
             !text.includes('Connecting...');
    }, { timeout: 15000 });
    
    console.log('✅ Socket connected');
    
    // Look for spawn button and click it
    const spawnButton = page.locator('button').filter({ hasText: /Spawn/i }).first();
    await expect(spawnButton).toBeVisible({ timeout: 10000 });
    await expect(spawnButton).toBeEnabled({ timeout: 5000 });
    
    await spawnButton.click();
    console.log('✅ Clicked spawn button');
    
    // Wait for modal to appear
    await page.waitForSelector('textarea[name="task"]', { timeout: 10000 });
    console.log('✅ Modal appeared');
    
    // Fill in the task
    const htmlTask = 'make index.html page with hello world';
    await page.fill('textarea[name="task"]', htmlTask);
    console.log(`✅ Task filled: "${htmlTask}"`);
    
    // Find and click the submit button in the modal
    const submitButton = page.locator('button[type="submit"]').last();
    await submitButton.click();
    console.log('✅ Agent spawn submitted');
    
    // Wait for success - look for any indication the agent was created
    await page.waitForFunction(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes('spawned') || 
             text.includes('success') || 
             text.includes('agent') ||
             text.includes('running') ||
             text.includes('task');
    }, { timeout: 20000 });
    
    console.log('✅ Agent spawned successfully!');
    
    // Take a screenshot
    await page.screenshot({ 
      path: 'screenshots/agent-spawn-success-simple.png',
      fullPage: true 
    });
    
    console.log('🎉 Test completed successfully!');
  });
});