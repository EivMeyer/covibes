/**
 * Test the ORIGINAL URL on port 3001 to see if the Express proxy fix worked
 */
const { test, expect } = require('@playwright/test');

test('verify port 3001 original URL works after Express proxy fix', async ({ page }) => {
  console.log('🔥 Testing ORIGINAL URL on port 3001...');
  
  // The original problematic URL that should now work
  const originalUrl = 'http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001/api/preview/proxy/demo-team-001/main/';
  
  // Track errors and responses
  const consoleErrors = [];
  const networkResponses = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log(`❌ Console Error: ${msg.text()}`);
    }
  });
  
  page.on('response', response => {
    networkResponses.push({
      url: response.url(),
      status: response.status(),
      contentType: response.headers()['content-type'] || ''
    });
    
    if (response.url().includes('3001') && response.status() >= 200 && response.status() < 300) {
      console.log(`✅ Port 3001 Success: ${response.status()} - ${response.url()}`);
    }
    
    if (response.url().includes('3001') && response.status() >= 300 && response.status() < 400) {
      console.log(`🔄 Port 3001 Redirect: ${response.status()} - ${response.url()}`);
    }
  });
  
  console.log(`🌐 Testing: ${originalUrl}`);
  
  try {
    // Navigate to the original URL
    await page.goto(originalUrl, { 
      waitUntil: 'networkidle',
      timeout: 15000 
    });
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/port-3001-test.png', fullPage: true });
    console.log('📸 Screenshot: test-results/port-3001-test.png');
    
    // Check if page loaded
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);
    
    // Check if React loaded
    const hasRoot = await page.locator('#root').isVisible();
    console.log(`🔧 React #root: ${hasRoot}`);
    
    // Check for our content
    const hasContent = await page.locator('text=LIVE HMR CHANGE').isVisible();
    console.log(`📝 Content loaded: ${hasContent}`);
    
    // Analyze network responses
    const port3001Responses = networkResponses.filter(r => r.url.includes('3001'));
    const successResponses = port3001Responses.filter(r => r.status >= 200 && r.status < 300);
    const redirectResponses = port3001Responses.filter(r => r.status >= 300 && r.status < 400);
    
    console.log('\n📊 PORT 3001 TEST RESULTS:');
    console.log(`   Page loaded: ${title ? '✅' : '❌'}`);
    console.log(`   React working: ${hasRoot ? '✅' : '❌'}`);
    console.log(`   Content visible: ${hasContent ? '✅' : '❌'}`);
    console.log(`   Total port 3001 requests: ${port3001Responses.length}`);
    console.log(`   Successful (2xx): ${successResponses.length}`);
    console.log(`   Redirects (3xx): ${redirectResponses.length}`);
    console.log(`   Console errors: ${consoleErrors.length}`);
    
    // Check for JavaScript modules loading correctly
    const jsModules = networkResponses.filter(r => 
      r.url.includes('3001') && 
      (r.url.includes('.js') || r.url.includes('.jsx') || r.url.includes('@vite/client'))
    );
    
    const jsSuccess = jsModules.filter(r => r.status === 200 && r.contentType.includes('javascript'));
    
    console.log(`   JS modules requested: ${jsModules.length}`);
    console.log(`   JS modules successful: ${jsSuccess.length}`);
    
    if (jsSuccess.length > 0) {
      console.log('   ✅ JavaScript modules loading with correct MIME types');
    }
    
    if (hasRoot && hasContent && successResponses.length > 0) {
      console.log('\n🎉 PORT 3001 ORIGINAL URL IS WORKING!');
    } else {
      console.log('\n⚠️  Port 3001 may still have issues');
    }
    
  } catch (error) {
    console.log(`❌ Port 3001 test failed: ${error.message}`);
    
    // Take error screenshot
    await page.screenshot({ path: 'test-results/port-3001-error.png', fullPage: true });
    console.log('📸 Error screenshot: test-results/port-3001-error.png');
    
    throw error;
  }
});