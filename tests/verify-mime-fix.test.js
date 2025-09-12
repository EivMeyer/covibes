/**
 * Test to verify the MIME type fix is working
 */
const { test, expect } = require('@playwright/test');

test.describe('Verify MIME Type Fix', () => {
  test('verify Vite base path fix resolves MIME type errors', async ({ page, request }) => {
    const testTeamId = 'demo-team-001';
    const baseUrl = 'http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001';
    
    // Track console errors to catch any remaining MIME type errors
    const consoleErrors = [];
    const networkFailures = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log(`🚨 Console Error: ${msg.text()}`);
      }
    });
    
    page.on('response', response => {
      if (response.status() >= 400 && response.url().includes('.js')) {
        networkFailures.push(`${response.status()} - ${response.url()}`);
        console.log(`❌ Network Failure: ${response.status()} - ${response.url()}`);
      }
    });
    
    console.log('🔍 Testing preview page with fixed base path...');
    
    const previewUrl = `${baseUrl}/api/preview/proxy/${testTeamId}/main/`;
    
    try {
      // Navigate to preview
      await page.goto(previewUrl, { 
        waitUntil: 'networkidle',
        timeout: 15000 
      });
      
      // Wait for any async loading
      await page.waitForTimeout(3000);
      
      // Check if page loaded successfully
      const title = await page.title();
      console.log(`📄 Page Title: ${title}`);
      
      // Check for MIME type errors
      const mimeTypeErrors = consoleErrors.filter(error => 
        error.includes('Expected a JavaScript module script') && 
        error.includes('MIME type')
      );
      
      if (mimeTypeErrors.length === 0) {
        console.log('✅ SUCCESS: No MIME type errors detected!');
      } else {
        console.log('❌ STILL BROKEN: MIME type errors found:');
        mimeTypeErrors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error}`);
        });
      }
      
      // Check network failures
      if (networkFailures.length === 0) {
        console.log('✅ SUCCESS: No JavaScript network failures!');
      } else {
        console.log('❌ JavaScript files failed to load:');
        networkFailures.forEach(failure => {
          console.log(`   - ${failure}`);
        });
      }
      
      // Test specific module imports that were problematic
      console.log('🧪 Testing specific module URLs...');
      
      const moduleUrls = [
        '/@vite/client',
        '/src/App.jsx',
        '/src/main.jsx'
      ];
      
      for (const moduleUrl of moduleUrls) {
        const fullUrl = `${baseUrl}/api/preview/proxy/${testTeamId}/main${moduleUrl}`;
        
        try {
          const response = await request.get(fullUrl);
          const contentType = response.headers()['content-type'] || '';
          
          console.log(`📁 ${moduleUrl}:`);
          console.log(`   Status: ${response.status()}`);
          console.log(`   Content-Type: ${contentType}`);
          
          if (response.status() === 200 && contentType.includes('javascript')) {
            console.log(`   ✅ FIXED: Correct MIME type`);
          } else {
            console.log(`   ❌ ISSUE: Status ${response.status()}, MIME: ${contentType}`);
          }
          
        } catch (error) {
          console.log(`   ❌ ERROR: ${error.message}`);
        }
      }
      
      // Summary
      console.log('\n📊 SUMMARY:');
      console.log(`   Console Errors: ${consoleErrors.length}`);
      console.log(`   MIME Type Errors: ${mimeTypeErrors.length}`);
      console.log(`   Network Failures: ${networkFailures.length}`);
      
      if (mimeTypeErrors.length === 0 && networkFailures.length === 0) {
        console.log('   🎉 MIME TYPE FIX SUCCESSFUL!');
      } else {
        console.log('   ⚠️  Issues still exist - further debugging needed');
      }
      
    } catch (error) {
      console.log(`❌ Page load error: ${error.message}`);
      
      // Still test individual URLs even if page load fails
      const testUrl = `${baseUrl}/api/preview/proxy/${testTeamId}/main/@vite/client`;
      try {
        const response = await request.get(testUrl);
        console.log(`🔧 Direct test - Status: ${response.status()}, MIME: ${response.headers()['content-type']}`);
      } catch (directError) {
        console.log(`🔧 Direct test failed: ${directError.message}`);
      }
    }
  });
});