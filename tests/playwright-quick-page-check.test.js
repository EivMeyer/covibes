/**
 * Quick test to verify the fucking page actually works
 */
const { test, expect } = require('@playwright/test');

test('verify the damn page actually loads and works', async ({ page }) => {
  console.log('🔍 Testing if the page actually fucking works...');
  
  const url = 'http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:7174/api/preview/proxy/demo-team-001/main/';
  
  // Track errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log(`❌ Console Error: ${msg.text()}`);
    }
  });
  
  page.on('pageerror', error => {
    errors.push(error.message);
    console.log(`❌ Page Error: ${error.message}`);
  });
  
  try {
    console.log(`🌐 Loading: ${url}`);
    
    // Go to the page
    await page.goto(url, { 
      waitUntil: 'networkidle', 
      timeout: 15000 
    });
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/page-check.png', fullPage: true });
    console.log('📸 Screenshot saved: test-results/page-check.png');
    
    // Check if page loaded
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);
    
    // Wait for React to load
    await page.waitForTimeout(3000);
    
    // Check if React root exists
    const rootExists = await page.locator('#root').isVisible();
    console.log(`🔧 React #root visible: ${rootExists}`);
    
    if (!rootExists) {
      console.log('❌ React root not found - page may not be working');
      throw new Error('React root div not found');
    }
    
    // Check for our updated content
    const hasUpdatedTitle = await page.locator('text=MIME TYPE FIX VERIFIED').isVisible();
    console.log(`🎯 Updated title visible: ${hasUpdatedTitle}`);
    
    // Check for interactive elements
    const hasButton = await page.locator('button').isVisible();
    console.log(`🔘 Buttons visible: ${hasButton}`);
    
    // Try clicking a button if it exists
    if (hasButton) {
      const buttonText = await page.locator('button').first().textContent();
      console.log(`🖱️  Found button: "${buttonText}"`);
      
      await page.locator('button').first().click();
      console.log('✅ Button click successful');
      
      await page.waitForTimeout(500);
    }
    
    // Final screenshot after interaction
    await page.screenshot({ path: 'test-results/page-after-interaction.png', fullPage: true });
    console.log('📸 Final screenshot: test-results/page-after-interaction.png');
    
    // Summary
    console.log('\n📊 PAGE CHECK RESULTS:');
    console.log(`   Page loaded: ✅`);
    console.log(`   React working: ${rootExists ? '✅' : '❌'}`);
    console.log(`   Updated content: ${hasUpdatedTitle ? '✅' : '❌'}`);
    console.log(`   Interactive: ${hasButton ? '✅' : '❌'}`);
    console.log(`   Console errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ ERRORS FOUND:');
      errors.forEach((err, i) => {
        console.log(`   ${i + 1}. ${err}`);
      });
    }
    
    // Final verdict
    if (rootExists && errors.length === 0) {
      console.log('\n🎉 THE FUCKING PAGE WORKS! 🎉');
    } else {
      console.log('\n💥 HOUSTON, WE HAVE A PROBLEM');
      throw new Error(`Page issues: React visible=${rootExists}, errors=${errors.length}`);
    }
    
  } catch (error) {
    console.log(`💥 FUCK - Page failed to load: ${error.message}`);
    
    // Take error screenshot
    await page.screenshot({ path: 'test-results/page-error.png', fullPage: true });
    console.log('📸 Error screenshot: test-results/page-error.png');
    
    throw error;
  }
});