/**
 * Playwright test to reproduce MIME type error for JavaScript modules
 * 
 * Error: "Failed to load module script: Expected a JavaScript module script 
 * but the server responded with a MIME type of "text/html". Strict MIME type 
 * checking is enforced for module scripts per HTML spec."
 */

const { test, expect } = require('@playwright/test');

test.describe('Preview MIME Type Error Reproduction', () => {
  test('reproduce JavaScript module MIME type error', async ({ page, request }) => {
    const testTeamId = 'demo-team-001';
    const baseUrl = 'http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001';
    
    // Test 1: Verify what happens when we request JavaScript files through the proxy
    // when preview is NOT running or unhealthy
    
    console.log('🔍 Testing proxy responses for JavaScript module files...');
    
    // Test files that would normally be JavaScript modules
    const jsModuleFiles = [
      '/@vite/client',
      '/src/main.jsx',
      '/src/App.jsx',
      '/node_modules/react/index.js',
      '/node_modules/react-dom/client.js'
    ];
    
    for (const filePath of jsModuleFiles) {
      const proxyUrl = `${baseUrl}/api/preview/proxy/${testTeamId}/main${filePath}`;
      
      console.log(`📡 Requesting: ${proxyUrl}`);
      
      try {
        const response = await request.get(proxyUrl);
        const contentType = response.headers()['content-type'] || '';
        const status = response.status();
        const body = await response.text();
        
        console.log(`📋 ${filePath}:`);
        console.log(`   Status: ${status}`);
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Body preview: ${body.slice(0, 200)}...`);
        
        // This is the root cause - when preview is not running,
        // JavaScript files return JSON error responses with wrong MIME type
        if (status === 404 || status === 500) {
          if (contentType.includes('application/json') || contentType.includes('text/html')) {
            console.log(`❌ MIME TYPE ERROR: JavaScript file "${filePath}" returned "${contentType}" instead of "application/javascript"`);
            
            // This would cause the browser error:
            // "Expected a JavaScript module script but the server responded with a MIME type of "text/html""
          }
        }
        
      } catch (error) {
        console.log(`❌ Error requesting ${filePath}: ${error.message}`);
      }
    }
    
    // Test 2: Simulate browser trying to load a page that imports these modules
    console.log('\n🌐 Testing browser loading page with module imports...');
    
    // Track console errors to catch the MIME type errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Navigate to the preview proxy URL
    const previewUrl = `${baseUrl}/api/preview/proxy/${testTeamId}/main/`;
    
    try {
      await page.goto(previewUrl, { 
        waitUntil: 'networkidle',
        timeout: 10000 
      });
      
      // Wait a bit for all module loading attempts
      await page.waitForTimeout(2000);
      
      // Check for MIME type errors
      const mimeTypeErrors = consoleErrors.filter(error => 
        error.includes('Expected a JavaScript module script') && 
        error.includes('MIME type')
      );
      
      if (mimeTypeErrors.length > 0) {
        console.log('🎯 SUCCESSFULLY REPRODUCED MIME TYPE ERRORS:');
        mimeTypeErrors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error}`);
        });
      } else {
        console.log('ℹ️  No MIME type errors detected (preview might be running correctly)');
      }
      
      // Also check network failures
      const networkFailures = await page.evaluate(() => {
        return window.performance.getEntriesByType('navigation')
          .concat(window.performance.getEntriesByType('resource'))
          .filter(entry => entry.transferSize === 0 && entry.name.includes('.js'))
          .map(entry => entry.name);
      });
      
      if (networkFailures.length > 0) {
        console.log('🚨 Network failures for JS files:');
        networkFailures.forEach(url => console.log(`   - ${url}`));
      }
      
    } catch (error) {
      console.log(`📄 Page load error (expected if preview not running): ${error.message}`);
    }
    
    // Test 3: Verify the specific error pattern
    console.log('\n🔬 Testing specific MIME type error pattern...');
    
    // Request a Vite client module specifically
    const viteClientUrl = `${baseUrl}/api/preview/proxy/${testTeamId}/main/@vite/client`;
    
    try {
      const viteResponse = await request.get(viteClientUrl);
      const viteContentType = viteResponse.headers()['content-type'] || '';
      const viteBody = await viteResponse.text();
      
      console.log('🔧 Vite client module request:');
      console.log(`   URL: ${viteClientUrl}`);
      console.log(`   Status: ${viteResponse.status()}`);
      console.log(`   Content-Type: ${viteContentType}`);
      console.log(`   Response body type: ${typeof viteBody === 'string' && viteBody.startsWith('{') ? 'JSON' : 'Other'}`);
      
      // This is the smoking gun - when preview proxy returns JSON for JS module requests
      if (viteResponse.status() === 404 && viteContentType.includes('application/json')) {
        console.log('✅ CONFIRMED: Root cause identified!');
        console.log('   - JavaScript module file requested from proxy');
        console.log('   - Preview container not running/healthy');  
        console.log('   - Proxy returns 404 JSON error response');
        console.log('   - Browser expects application/javascript MIME type');
        console.log('   - Result: "Expected a JavaScript module script" error');
      }
      
    } catch (error) {
      console.log(`❌ Vite client test error: ${error.message}`);
    }
  });
  
  test('test preview health check impact on MIME types', async ({ request }) => {
    const testTeamId = 'demo-team-001';
    const baseUrl = 'http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001';
    
    console.log('🏥 Testing preview health check responses...');
    
    // First check preview status
    const statusUrl = `${baseUrl}/api/preview/status`;
    
    try {
      const statusResponse = await request.get(statusUrl, {
        headers: {
          'Authorization': 'Bearer test-token'  // This will likely fail but shows the pattern
        }
      });
      
      console.log(`📊 Preview status check: ${statusResponse.status()}`);
      
      if (statusResponse.status() === 401) {
        console.log('ℹ️  Authentication required (expected in test environment)');
      }
      
    } catch (error) {
      console.log(`⚠️  Status check error: ${error.message}`);
    }
    
    // Test the health check logic by directly requesting proxy
    const jsFileUrl = `${baseUrl}/api/preview/proxy/${testTeamId}/main/src/App.jsx`;
    
    const response = await request.get(jsFileUrl);
    const contentType = response.headers()['content-type'] || '';
    const body = await response.text();
    
    console.log('🧪 Direct proxy JavaScript file test:');
    console.log(`   Status: ${response.status()}`);
    console.log(`   Content-Type: ${contentType}`);
    console.log(`   Body type: ${typeof body === 'string' && body.startsWith('{') ? 'JSON' : 'Text'}`);
    
    // Show the exact error message that would cause MIME type issues
    if (response.status() === 404 && contentType === 'application/json') {
      const errorJson = JSON.parse(body);
      console.log(`🎯 ERROR MESSAGE: ${errorJson.message}`);
      console.log('💡 This JSON response causes MIME type error when browser expects JavaScript');
    }
  });
});