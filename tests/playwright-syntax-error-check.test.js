const { test, expect } = require('@playwright/test');

test('Check main application for syntax errors', async ({ page }) => {
  // Listen for console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Listen for page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });

  console.log('Testing main application at: http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com/');
  
  try {
    await page.goto('http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com/');
    await page.waitForTimeout(3000);
    
    // Check if page loaded successfully
    const title = await page.title();
    console.log('Page title:', title);
    
    // Get page content
    const content = await page.content();
    console.log('Page content length:', content.length);
    console.log('First 500 chars:', content.substring(0, 500));
    
    // Check for specific JavaScript asset
    const response = await page.goto('http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com/assets/index-FoYnYnbi.js');
    const contentType = response.headers()['content-type'];
    const jsContent = await response.text();
    
    console.log('JS asset content-type:', contentType);
    console.log('JS asset content length:', jsContent.length);
    console.log('JS asset first 200 chars:', jsContent.substring(0, 200));
    
    // Report errors
    console.log('Console errors:', consoleErrors);
    console.log('Page errors:', pageErrors);
    
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.filter(err => err.includes('Unexpected token')).length).toBe(0);
    
  } catch (error) {
    console.error('Test failed:', error.message);
    throw error;
  }
});