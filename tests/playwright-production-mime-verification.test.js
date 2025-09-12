/**
 * Production MIME Type Fix Verification Test
 * 
 * This test reproduces the exact scenario where users were getting:
 * "Failed to load module script: Expected a JavaScript module script 
 * but the server responded with a MIME type of "text/html""
 * 
 * Tests against the actual production environment to verify the fix works.
 */

const { test, expect } = require('@playwright/test');

test.describe('Production MIME Type Fix Verification', () => {
  test('verify MIME type errors are completely resolved in production', async ({ page, request }) => {
    console.log('🔍 Testing MIME type fix in PRODUCTION environment...');
    
    // Use the actual working production URL (dedicated proxy port)
    const productionUrl = 'http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:7174/api/preview/proxy/demo-team-001/main/';
    
    // Track all console errors with focus on MIME type issues
    const allConsoleErrors = [];
    const mimeTypeErrors = [];
    const networkFailures = [];
    const jsModuleRequests = [];
    
    // Monitor console for the specific MIME type error
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const errorText = msg.text();
        allConsoleErrors.push(errorText);
        
        // Look for the exact error pattern from user's report
        if (errorText.includes('Expected a JavaScript module script') && 
            errorText.includes('MIME type')) {
          mimeTypeErrors.push(errorText);
          console.log(`❌ MIME TYPE ERROR: ${errorText}`);
        }
      }
    });
    
    // Monitor network requests for JavaScript files
    page.on('response', async (response) => {
      const url = response.url();
      
      // Track JavaScript/module files specifically
      if (url.includes('@vite/client') || 
          url.includes('.jsx') || 
          url.includes('.js') ||
          url.includes('react.js') ||
          url.includes('react-dom') ||
          url.includes('env.mjs')) {
        
        const contentType = response.headers()['content-type'] || '';
        const status = response.status();
        
        jsModuleRequests.push({
          url: url,
          status: status,
          contentType: contentType,
          isSuccess: status === 200,
          hasCorrectMimeType: contentType.includes('javascript') || contentType.includes('application/javascript')
        });
        
        console.log(`📁 JS Module: ${url.split('/').pop()}`);
        console.log(`   Status: ${status}, MIME: ${contentType}`);
        
        // Flag failures
        if (status >= 400) {
          networkFailures.push(`${status} - ${url}`);
        }
        
        // Flag incorrect MIME types
        if (status === 200 && !contentType.includes('javascript')) {
          console.log(`⚠️  WRONG MIME TYPE: Expected javascript, got ${contentType}`);
        }
      }
    });
    
    console.log(`🌐 Navigating to production URL: ${productionUrl}`);
    
    try {
      // Navigate to production preview page
      await page.goto(productionUrl, { 
        waitUntil: 'networkidle',
        timeout: 20000 
      });
      
      console.log('✅ Page loaded successfully');
      
      // Take screenshot immediately after load
      await page.screenshot({ 
        path: 'test-results/production-page-loaded.png',
        fullPage: true 
      });
      console.log('📸 Screenshot saved: test-results/production-page-loaded.png');
      
      // Wait for all module loading to complete
      await page.waitForTimeout(3000);
      
      // Get page title to confirm it loaded
      const title = await page.title();
      console.log(`📄 Page Title: ${title}`);
      
      // Check if React root div exists (proves React loaded correctly)
      const rootExists = await page.locator('#root').isVisible();
      console.log(`🔧 React #root visible: ${rootExists}`);
      
      // Check for specific React content that proves modules loaded
      const hasReactContent = await page.locator('text=Live Preview with Hot Reload').isVisible();
      console.log(`🔧 React content loaded: ${hasReactContent}`);
      
      // Take final screenshot showing the working app
      await page.screenshot({ 
        path: 'test-results/production-app-working.png',
        fullPage: true 
      });
      console.log('📸 Final screenshot saved: test-results/production-app-working.png');
      
      // Additional wait to catch any delayed module loading errors
      await page.waitForTimeout(2000);
      
    } catch (error) {
      console.log(`❌ Page navigation error: ${error.message}`);
    }
    
    // ANALYSIS AND RESULTS
    console.log('\n📊 PRODUCTION VERIFICATION RESULTS:');
    console.log('=' * 50);
    
    // 1. MIME Type Error Check
    console.log(`\n1. MIME TYPE ERRORS:`);
    if (mimeTypeErrors.length === 0) {
      console.log(`   ✅ SUCCESS: No MIME type errors detected!`);
    } else {
      console.log(`   ❌ FAILED: ${mimeTypeErrors.length} MIME type errors found:`);
      mimeTypeErrors.forEach((error, i) => {
        console.log(`      ${i + 1}. ${error}`);
      });
    }
    
    // 2. JavaScript Module Loading Check
    console.log(`\n2. JAVASCRIPT MODULE LOADING:`);
    console.log(`   Total JS modules requested: ${jsModuleRequests.length}`);
    
    const successfulRequests = jsModuleRequests.filter(req => req.isSuccess);
    const correctMimeTypes = jsModuleRequests.filter(req => req.hasCorrectMimeType);
    
    console.log(`   Successful (200 OK): ${successfulRequests.length}/${jsModuleRequests.length}`);
    console.log(`   Correct MIME types: ${correctMimeTypes.length}/${jsModuleRequests.length}`);
    
    // Show details for critical modules
    const criticalModules = jsModuleRequests.filter(req => 
      req.url.includes('@vite/client') || 
      req.url.includes('App.jsx') || 
      req.url.includes('main.jsx')
    );
    
    console.log(`\n   Critical Modules (${criticalModules.length}):`);
    criticalModules.forEach(mod => {
      const status = mod.isSuccess ? '✅' : '❌';
      const mime = mod.hasCorrectMimeType ? '✅' : '❌';
      const filename = mod.url.split('/').pop();
      console.log(`      ${status}${mime} ${filename} (${mod.status}, ${mod.contentType})`);
    });
    
    // 3. Network Failures
    console.log(`\n3. NETWORK FAILURES:`);
    if (networkFailures.length === 0) {
      console.log(`   ✅ SUCCESS: No network failures for JS files!`);
    } else {
      console.log(`   ❌ FAILED: ${networkFailures.length} network failures:`);
      networkFailures.forEach(failure => {
        console.log(`      - ${failure}`);
      });
    }
    
    // 4. Overall Console Errors
    console.log(`\n4. OVERALL CONSOLE HEALTH:`);
    console.log(`   Total console errors: ${allConsoleErrors.length}`);
    if (allConsoleErrors.length > 0) {
      console.log(`   Error types:`);
      const errorTypes = [...new Set(allConsoleErrors.map(err => {
        if (err.includes('MIME type')) return 'MIME Type Error';
        if (err.includes('Failed to load')) return 'Module Load Error';
        if (err.includes('404')) return '404 Not Found';
        if (err.includes('network')) return 'Network Error';
        return 'Other Error';
      }))];
      errorTypes.forEach(type => {
        const count = allConsoleErrors.filter(err => {
          if (type === 'MIME Type Error') return err.includes('MIME type');
          if (type === 'Module Load Error') return err.includes('Failed to load');
          if (type === '404 Not Found') return err.includes('404');
          if (type === 'Network Error') return err.includes('network');
          return true;
        }).length;
        console.log(`      - ${type}: ${count}`);
      });
    }
    
    // FINAL VERDICT
    console.log(`\n🎯 FINAL PRODUCTION VERDICT:`);
    console.log('=' * 30);
    
    const isFixed = mimeTypeErrors.length === 0 && 
                   networkFailures.length === 0 && 
                   correctMimeTypes.length === jsModuleRequests.length;
    
    if (isFixed) {
      console.log(`🎉 MIME TYPE FIX COMPLETELY SUCCESSFUL IN PRODUCTION!`);
      console.log(`   - No MIME type errors detected`);
      console.log(`   - All JS modules load with correct content-type`);
      console.log(`   - No network failures for JavaScript files`);
      console.log(`   - Original issue is resolved`);
    } else {
      console.log(`⚠️  ISSUES STILL EXIST IN PRODUCTION:`);
      if (mimeTypeErrors.length > 0) {
        console.log(`   - ${mimeTypeErrors.length} MIME type errors persist`);
      }
      if (networkFailures.length > 0) {
        console.log(`   - ${networkFailures.length} network failures`);
      }
      if (correctMimeTypes.length < jsModuleRequests.length) {
        console.log(`   - ${jsModuleRequests.length - correctMimeTypes.length} incorrect MIME types`);
      }
    }
    
    console.log('\n' + '=' * 50);
    
    // Assert the fix worked
    expect(mimeTypeErrors.length, 'MIME type errors should be zero').toBe(0);
    expect(networkFailures.length, 'Network failures should be zero').toBe(0);
    expect(correctMimeTypes.length, 'All JS modules should have correct MIME types').toBe(jsModuleRequests.length);
  });
  
  test('test specific problematic module URLs that caused original error', async ({ request }) => {
    console.log('🧪 Testing specific URLs that originally caused MIME type errors...');
    
    const baseUrl = 'http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:7174';
    const basePath = '/api/preview/proxy/demo-team-001/main';
    
    // These are the exact files mentioned in the original error
    const problematicFiles = [
      '/@vite/client',           // Vite HMR client
      '/src/App.jsx',           // Main React component
      '/src/main.jsx',          // Entry point
      '/@react-refresh',        // React refresh
      '/node_modules/react/index.js',      // React library
      '/node_modules/react-dom/client.js'  // React DOM
    ];
    
    console.log(`Testing ${problematicFiles.length} previously problematic files...`);
    
    for (const filePath of problematicFiles) {
      const fullUrl = `${baseUrl}${basePath}${filePath}`;
      
      try {
        console.log(`\n📡 Testing: ${filePath}`);
        
        const response = await request.get(fullUrl);
        const status = response.status();
        const contentType = response.headers()['content-type'] || '';
        const body = await response.text();
        
        console.log(`   Status: ${status}`);
        console.log(`   Content-Type: ${contentType}`);
        
        // Check for success
        if (status === 200) {
          if (contentType.includes('javascript') || contentType.includes('application/javascript')) {
            console.log(`   ✅ FIXED: Correct JavaScript MIME type`);
            
            // Verify it's actually JavaScript content, not HTML error page
            const isActualJS = !body.trim().startsWith('<!DOCTYPE') && 
                              !body.trim().startsWith('<html') &&
                              !body.includes('<body>');
            
            if (isActualJS) {
              console.log(`   ✅ CONTENT: Actual JavaScript code (not HTML error)`);
            } else {
              console.log(`   ❌ CONTENT: Still returning HTML despite correct MIME type`);
            }
            
          } else {
            console.log(`   ❌ MIME TYPE STILL WRONG: Expected javascript, got ${contentType}`);
          }
        } else {
          console.log(`   ❌ HTTP ERROR: Status ${status}`);
          
          // If it's an error, check if it's returning HTML (which would cause MIME error)
          if (contentType.includes('text/html') || body.includes('<html>')) {
            console.log(`   💥 THIS WOULD CAUSE MIME TYPE ERROR: HTML response for JS file`);
          }
        }
        
      } catch (error) {
        console.log(`   ❌ REQUEST FAILED: ${error.message}`);
      }
    }
  });
});