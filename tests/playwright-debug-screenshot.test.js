const { test, expect } = require('@playwright/test');

test('debug screenshot - what is actually rendering', async ({ page }) => {
  console.log('🔍 Loading preview and taking screenshot...');
  
  // Set up error monitoring
  const consoleMessages = [];
  const errors = [];
  
  page.on('console', msg => {
    consoleMessages.push(`${msg.type()}: ${msg.text()}`);
  });
  
  page.on('pageerror', error => {
    errors.push(error.message);
    console.log('❌ JavaScript error:', error.message);
  });
  
  try {
    await page.goto('http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:8000', {
      waitUntil: 'networkidle',
      timeout: 15000
    });
    
    console.log('✅ Page loaded successfully');
  } catch (error) {
    console.log('❌ Failed to load page:', error.message);
    
    // Take screenshot of error
    await page.screenshot({ 
      path: 'screenshot-error.png', 
      fullPage: true 
    });
    throw error;
  }
  
  // Wait for potential React rendering
  await page.waitForTimeout(5000);
  
  // Take screenshot of what's actually visible
  await page.screenshot({ 
    path: 'screenshot-debug.png', 
    fullPage: true 
  });
  
  console.log('📸 Screenshot taken: screenshot-debug.png');
  
  // Check what's actually in the DOM
  const bodyText = await page.evaluate(() => document.body.innerText || 'EMPTY BODY');
  console.log('📝 Body text:', JSON.stringify(bodyText));
  
  const rootExists = await page.evaluate(() => !!document.getElementById('root'));
  console.log('🌱 Root element exists:', rootExists);
  
  const rootContent = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML : 'NO ROOT ELEMENT';
  });
  console.log('🌱 Root innerHTML:', JSON.stringify(rootContent.substring(0, 200)));
  
  // Check if React actually mounted
  const reactMounted = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root && root.children.length > 0;
  });
  console.log('⚛️ React appears mounted:', reactMounted);
  
  // Check for h1 element specifically
  const h1Exists = await page.evaluate(() => !!document.querySelector('h1'));
  const h1Text = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    return h1 ? h1.textContent : 'NO H1 FOUND';
  });
  console.log('📋 H1 exists:', h1Exists);
  console.log('📋 H1 text:', JSON.stringify(h1Text));
  
  // Log all console messages
  console.log('💬 Console messages:', JSON.stringify(consoleMessages, null, 2));
  
  // Log errors
  if (errors.length > 0) {
    console.log('❌ JavaScript errors found:', JSON.stringify(errors, null, 2));
  } else {
    console.log('✅ No JavaScript errors');
  }
  
  // Final verification
  if (!reactMounted) {
    console.log('❌ PROBLEM: React did not mount properly!');
  } else if (!h1Exists) {
    console.log('❌ PROBLEM: H1 element not found in DOM!');
  } else {
    console.log('✅ Content appears to be rendering correctly');
  }
});