const { test, expect } = require('@playwright/test');

test('Debug login issue', async ({ page }) => {
  console.log('🔍 Starting login debug test...');
  
  // Go to login page
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  
  console.log('📄 Page loaded, looking for login form...');
  
  // Take screenshot of current state
  await page.screenshot({ path: 'tests/screenshots/debug-login-1-initial.png', fullPage: true });
  
  // Check what's on the page
  const title = await page.title();
  console.log(`📝 Page title: "${title}"`);
  
  const bodyText = await page.locator('body').textContent();
  console.log(`📝 Page contains login form: ${bodyText.includes('Email') && bodyText.includes('Password')}`);
  
  // Look for email and password inputs
  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i], input[name*="email" i]');
  const passwordInput = page.locator('input[type="password"], input[placeholder*="password" i], input[name*="password" i]');
  
  const emailExists = await emailInput.count() > 0;
  const passwordExists = await passwordInput.count() > 0;
  
  console.log(`📧 Email input found: ${emailExists}`);
  console.log(`🔐 Password input found: ${passwordExists}`);
  
  if (emailExists && passwordExists) {
    console.log('✅ Login form found, attempting login...');
    
    // Fill credentials
    await emailInput.fill('test@example.com');
    await passwordInput.fill('password123');
    
    console.log('📝 Credentials filled');
    
    // Take screenshot before submission
    await page.screenshot({ path: 'tests/screenshots/debug-login-2-filled.png', fullPage: true });
    
    // Listen for network requests
    page.on('request', request => {
      if (request.url().includes('/api/auth/login')) {
        console.log(`🌐 Login request: ${request.method()} ${request.url()}`);
        console.log(`📤 Request data:`, request.postData());
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('/api/auth/login')) {
        console.log(`📥 Login response: ${response.status()}`);
        response.text().then(text => {
          console.log(`📄 Response body:`, text);
        });
      }
    });
    
    // Find and click submit button
    const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    const buttonExists = await submitButton.count() > 0;
    
    console.log(`🔘 Submit button found: ${buttonExists}`);
    
    if (buttonExists) {
      await submitButton.click();
      console.log('🔘 Submit button clicked');
      
      // Wait for response
      await page.waitForTimeout(2000);
      
      // Take screenshot after submission
      await page.screenshot({ path: 'tests/screenshots/debug-login-3-after-submit.png', fullPage: true });
      
      // Check for error messages or success
      const currentUrl = page.url();
      const bodyTextAfter = await page.locator('body').textContent();
      
      console.log(`🌍 Current URL: ${currentUrl}`);
      console.log(`❌ Page contains error: ${bodyTextAfter.includes('failed') || bodyTextAfter.includes('error')}`);
      console.log(`✅ Login successful: ${currentUrl.includes('/dashboard') || bodyTextAfter.includes('Dashboard')}`);
      
      if (bodyTextAfter.includes('failed') || bodyTextAfter.includes('error')) {
        console.log('❌ Login failed - checking for specific error messages');
        
        // Look for error elements
        const errorElements = await page.locator('.error, .alert, [role="alert"]').allTextContents();
        console.log('🔍 Error messages found:', errorElements);
      }
      
    } else {
      console.log('❌ No submit button found');
    }
    
  } else {
    console.log('❌ Login form not found');
    
    // Check if we're on a different page type
    if (bodyText.includes('Register') || bodyText.includes('Sign Up')) {
      console.log('📝 Appears to be registration page');
    }
    if (bodyText.includes('GitHub') || bodyText.includes('OAuth')) {
      console.log('📝 Appears to have OAuth options');
    }
  }
  
  console.log('🏁 Debug test completed');
});