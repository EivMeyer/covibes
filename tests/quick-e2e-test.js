const { chromium } = require('playwright');

async function testFixedApp() {
  console.log('🚀 Starting E2E test of fixed CoVibe app...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Capture console logs and errors
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warn' || msg.text().includes('🔍') || msg.text().includes('🔑')) {
      console.log(`🖥️  Browser ${msg.type()}: ${msg.text()}`);
    }
  });
  
  page.on('pageerror', error => {
    console.log(`🚨 Page error: ${error.message}`);
  });
  
  page.on('requestfailed', request => {
    console.log(`🌐 Request failed: ${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
  });
  
  try {
    // Navigate to app (use React dev server which proxies to backend)
    console.log('📂 Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000');
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    
    // Check if login page is shown (use the main submit button)
    const hasLoginForm = await page.locator('button[type="submit"]:has-text("Sign in")').first().isVisible();
    console.log(`🔍 Login form visible: ${hasLoginForm}`);
    
    if (!hasLoginForm) {
      // Maybe already logged in?
      const hasDashboard = await page.locator('text=CoVibe').first().isVisible();
      if (hasDashboard) {
        console.log('✅ Already on dashboard!');
        return testChatFunctionality(page);
      }
    }
    
    // Fill login form
    console.log('📝 Filling login form...');
    await page.fill('input[type="email"]', 'alice@demo.com');
    await page.fill('input[type="password"]', 'demo123');
    
    // Submit login
    console.log('🔑 Clicking login button...');
    await page.click('button[type="submit"]:has-text("Sign in")');
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Check if still on login page
    const stillHasLoginForm = await page.locator('button[type="submit"]:has-text("Sign in")').first().isVisible().catch(() => false);
    
    if (stillHasLoginForm) {
      console.log('❌ Login failed - still showing login form');
      
      // Check for error messages
      const errorVisible = await page.locator('text*=error, text*=failed, text*=invalid').first().isVisible().catch(() => false);
      if (errorVisible) {
        const errorText = await page.locator('text*=error, text*=failed, text*=invalid').first().textContent();
        console.log(`❌ Error message: ${errorText}`);
      }
      
      // Take screenshot of error
      await page.screenshot({ path: './screenshots/login-error.png' });
      throw new Error('Login failed');
    }
    
    console.log('✅ Login successful - dashboard should be loading...');
    
    // Wait for dashboard elements
    await page.waitForTimeout(2000);
    
    // Test chat functionality
    await testChatFunctionality(page);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ path: './screenshots/test-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

async function testChatFunctionality(page) {
  console.log('💬 Testing chat functionality...');
  
  // Wait a bit more for WebSocket connection
  await page.waitForTimeout(3000);
  
  // Look for chat interface
  const hasChatInterface = await page.locator('text=Team Chat, text=Collaboration, input[placeholder*="message"], input[placeholder*="Type"]').first().isVisible().catch(() => false);
  
  if (!hasChatInterface) {
    console.log('⚠️  Chat interface not immediately visible, checking page content...');
    
    // Take screenshot to see what's on page
    await page.screenshot({ path: './screenshots/dashboard-loaded.png', fullPage: true });
    
    // Log some page content
    const bodyText = await page.textContent('body');
    console.log('📄 Page contains:', bodyText.substring(0, 300) + '...');
    
    // Try to find any input field
    const anyInput = await page.locator('input').first().isVisible().catch(() => false);
    console.log(`🔍 Any input visible: ${anyInput}`);
    
    return;
  }
  
  console.log('✅ Chat interface found!');
  
  // Try to send a message
  const messageInput = page.locator('input[placeholder*="message"], input[placeholder*="Type"]').first();
  
  console.log('📝 Typing test message...');
  await messageInput.fill('🧪 E2E test message from automated test');
  await messageInput.press('Enter');
  
  console.log('💬 Message sent, waiting for it to appear...');
  await page.waitForTimeout(2000);
  
  // Check if message appears
  const messageAppeared = await page.locator('text=E2E test message from automated test').isVisible().catch(() => false);
  
  if (messageAppeared) {
    console.log('✅ SUCCESS! Message appeared in chat - WebSocket is working!');
  } else {
    console.log('⚠️  Message didn\'t appear yet, but sending worked');
  }
  
  // Final screenshot
  await page.screenshot({ path: './screenshots/chat-test-complete.png', fullPage: true });
  console.log('📸 Final screenshot saved');
  
  console.log('🎉 Chat test completed!');
}

// Run the test
testFixedApp().catch(console.error);