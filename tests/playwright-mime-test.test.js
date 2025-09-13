const { test, expect } = require('@playwright/test');

test('Preview MIME type test', async ({ page }) => {
  console.log('🧪 Testing preview page for MIME errors...');
  
  // Track console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Console error:', msg.text());
      consoleErrors.push(msg.text());
    }
  });
  
  // Track network responses
  const responses = [];
  page.on('response', response => {
    responses.push({
      url: response.url(),
      status: response.status(),
      contentType: response.headers()['content-type'],
    });
    
    // Log JavaScript file responses
    if (response.url().match(/\.(js|jsx|ts|tsx|mjs)(\?.*)?$/) || 
        response.url().includes('/@vite/') || 
        response.url().includes('/src/')) {
      const contentType = response.headers()['content-type'] || 'MISSING';
      const isCorrectMime = contentType.includes('javascript');
      console.log(`${isCorrectMime ? '✅' : '❌'} ${response.url()}`);
      console.log(`   Status: ${response.status()}`);
      console.log(`   Content-Type: ${contentType}`);
    }
  });
  
  try {
    console.log('📄 Loading preview page...');
    await page.goto('http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com/api/preview/proxy/demo-team-001/main/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    console.log('⏳ Waiting for JavaScript modules to load...');
    await page.waitForTimeout(5000);
    
    // Check for MIME type errors
    const mimeErrors = consoleErrors.filter(error => 
      error.includes('MIME type') || 
      error.includes('module script') ||
      error.includes('text/html')
    );
    
    console.log(`\n📊 Results:`);
    console.log(`   Total responses: ${responses.length}`);
    console.log(`   Console errors: ${consoleErrors.length}`);
    console.log(`   MIME errors: ${mimeErrors.length}`);
    
    if (mimeErrors.length > 0) {
      console.log('\n❌ MIME TYPE ERRORS FOUND:');
      mimeErrors.forEach((error, i) => {
        console.log(`${i + 1}. ${error}`);
      });
    } else {
      console.log('\n✅ No MIME type errors detected!');
    }
    
    // Check if page loaded successfully
    const title = await page.title();
    console.log(`\n📄 Page title: "${title}"`);
    
    // Look for React app content
    try {
      await page.waitForSelector('div[id="root"]', { timeout: 10000 });
      console.log('✅ React root div found');
    } catch {
      console.log('❌ React root div not found');
    }
    
    // Test if we can find expected Vite content
    const bodyText = await page.textContent('body');
    if (bodyText.includes('Live Preview') || bodyText.includes('Vite') || bodyText.includes('React')) {
      console.log('✅ Preview content loaded successfully');
    } else {
      console.log('❌ Preview content not detected');
      console.log('Body preview:', bodyText.substring(0, 200) + '...');
    }
    
    // Final assertion
    expect(mimeErrors.length).toBe(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
});