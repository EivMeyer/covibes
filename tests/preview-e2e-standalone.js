#!/usr/bin/env node

/**
 * Standalone E2E Test for Preview Feature with Screenshots
 * This test demonstrates the full preview feature working with the test repository
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Test repository as specified in CLAUDE.md
const TEST_REPO = 'https://github.com/EivMeyer/covibes-test-repo';

// Create screenshots directory if it doesn't exist
const screenshotsDir = path.join(__dirname, 'screenshots', 'preview-e2e');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function runPreviewE2ETest() {
  console.log('🚀 Preview Feature E2E Test\n');
  console.log(`📦 Using test repository: ${TEST_REPO}\n`);
  
  const browser = await chromium.launch({ 
    headless: false, // Show browser for visibility
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  // Generate unique test credentials
  const timestamp = Date.now();
  const testUser = {
    userName: `preview_e2e_${timestamp}`,
    email: `preview_e2e_${timestamp}@test.com`,
    password: 'test123',
    teamName: `PreviewTeam_${timestamp}`
  };
  
  let authToken, teamId;
  
  try {
    // 1. Navigate to the application
    console.log('1. Loading application...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    await page.screenshot({ 
      path: path.join(screenshotsDir, '01-initial.png'),
      fullPage: true 
    });
    console.log('📸 Saved: 01-initial.png');
    
    // 2. Register via API to bypass UI complexities
    console.log('\n2. Registering user via API...');
    const registerResponse = await page.evaluate(async (userData) => {
      const res = await fetch('http://localhost:3001/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      return res.json();
    }, testUser);
    
    if (!registerResponse.token || !registerResponse.team) {
      throw new Error('Registration failed: ' + JSON.stringify(registerResponse));
    }
    
    authToken = registerResponse.token;
    teamId = registerResponse.team.id;
    console.log(`✅ Registered successfully`);
    console.log(`   Team ID: ${teamId}`);
    
    // Store token in localStorage to authenticate the UI
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, authToken);
    
    // 3. Set repository URL
    console.log('\n3. Setting repository URL...');
    const repoResponse = await page.evaluate(async (token, repoUrl) => {
      const res = await fetch('http://localhost:3001/api/team/repository', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ repositoryUrl: repoUrl })
      });
      return res.json();
    }, authToken, TEST_REPO);
    
    console.log(`✅ Repository URL set: ${repoResponse.repositoryUrl || 'OK'}`);
    
    // 4. Start the preview
    console.log('\n4. Starting preview...');
    const createResponse = await page.evaluate(async (token) => {
      const res = await fetch('http://localhost:3001/api/preview/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ branch: 'main' })
      });
      return res.json();
    }, authToken);
    
    if (!createResponse.port) {
      throw new Error('Preview creation failed: ' + JSON.stringify(createResponse));
    }
    
    const previewPort = createResponse.port;
    console.log(`✅ Preview started on port ${previewPort}`);
    console.log(`   Status: ${createResponse.status}`);
    
    // 5. Wait for preview to start and clone repository
    console.log('\n5. Waiting for preview to start (15 seconds)...');
    await page.waitForTimeout(15000);
    
    // 6. Check preview status
    console.log('\n6. Checking preview status...');
    const statusResponse = await page.evaluate(async (token) => {
      const res = await fetch('http://localhost:3001/api/preview/status', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return res.json();
    }, authToken);
    
    console.log(`   Main branch status: ${statusResponse.main?.status || 'unknown'}`);
    
    if (statusResponse.main?.status !== 'running') {
      console.log('⚠️  Preview not running yet, waiting longer...');
      await page.waitForTimeout(10000);
    }
    
    // 7. Reload the page to see the preview in UI
    console.log('\n7. Reloading page to see preview...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: path.join(screenshotsDir, '02-dashboard.png'),
      fullPage: true 
    });
    console.log('📸 Saved: 02-dashboard.png');
    
    // 8. Test preview through proxy
    console.log('\n8. Testing preview through proxy...');
    const proxyUrl = `http://localhost:3001/api/preview/${teamId}/main/`;
    
    const proxyResponse = await page.evaluate(async (url, token) => {
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return {
        status: res.status,
        text: await res.text()
      };
    }, proxyUrl, authToken);
    
    if (proxyResponse.status === 200) {
      console.log('✅ Preview proxy is working!');
      const hasContent = proxyResponse.text.includes('Covibes Live Preview');
      console.log(`   Content check: ${hasContent ? '✅ Valid' : '❌ Invalid'}`);
    } else {
      console.log(`⚠️  Proxy returned status: ${proxyResponse.status}`);
    }
    
    // 9. Test API endpoint through proxy
    console.log('\n9. Testing API endpoint through proxy...');
    const apiProxyUrl = `http://localhost:3001/api/preview/${teamId}/main/api/status`;
    
    const apiResponse = await page.evaluate(async (url, token) => {
      try {
        const res = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        return await res.json();
      } catch (e) {
        return { error: e.message };
      }
    }, apiProxyUrl, authToken);
    
    if (apiResponse.status === 'healthy') {
      console.log('✅ API endpoint working through proxy!');
      console.log(`   Service: ${apiResponse.service}`);
      console.log(`   Version: ${apiResponse.version}`);
    } else {
      console.log('⚠️  API response:', apiResponse);
    }
    
    // 10. Navigate to preview directly and screenshot
    console.log('\n10. Navigating to preview directly...');
    const previewPage = await context.newPage();
    
    try {
      await previewPage.goto(`http://localhost:${previewPort}`, { 
        waitUntil: 'networkidle',
        timeout: 10000 
      });
      
      await previewPage.screenshot({ 
        path: path.join(screenshotsDir, '03-preview-direct.png'),
        fullPage: true 
      });
      console.log('📸 Saved: 03-preview-direct.png');
      
      // Verify preview content
      const title = await previewPage.title();
      console.log(`   Title: ${title}`);
      
      const heading = await previewPage.textContent('h1');
      console.log(`   Heading: ${heading}`);
      
      if (title.includes('Covibes Live Preview') || heading?.includes('Covibes Live Preview')) {
        console.log('✅ Preview content verified!');
      }
      
      // Test the refresh button
      const button = await previewPage.$('button');
      if (button) {
        await button.click();
        await previewPage.waitForTimeout(1000);
        
        await previewPage.screenshot({ 
          path: path.join(screenshotsDir, '04-preview-refreshed.png'),
          fullPage: true 
        });
        console.log('📸 Saved: 04-preview-refreshed.png');
      }
      
    } catch (error) {
      console.log(`⚠️  Could not access preview directly: ${error.message}`);
    } finally {
      await previewPage.close();
    }
    
    // 11. Check if preview iframe is visible in main app
    console.log('\n11. Checking for preview iframe in main app...');
    const iframeInfo = await page.evaluate(() => {
      const iframe = document.querySelector('iframe');
      if (iframe) {
        return {
          visible: true,
          src: iframe.src,
          width: iframe.offsetWidth,
          height: iframe.offsetHeight
        };
      }
      
      // Also check for preview divs or containers
      const previewElement = document.querySelector('[class*="preview"], [id*="preview"]');
      if (previewElement) {
        return {
          visible: false,
          hasPreviewElement: true,
          elementClass: previewElement.className,
          elementId: previewElement.id
        };
      }
      
      return { visible: false, hasPreviewElement: false };
    });
    
    if (iframeInfo.visible) {
      console.log('✅ Preview iframe found in UI');
      console.log(`   Source: ${iframeInfo.src}`);
      console.log(`   Dimensions: ${iframeInfo.width}x${iframeInfo.height}`);
      
      await page.screenshot({ 
        path: path.join(screenshotsDir, '05-with-iframe.png'),
        fullPage: true 
      });
      console.log('📸 Saved: 05-with-iframe.png');
    } else if (iframeInfo.hasPreviewElement) {
      console.log('ℹ️  Preview element found but no iframe');
      console.log(`   Element: ${iframeInfo.elementClass || iframeInfo.elementId}`);
    } else {
      console.log('ℹ️  No iframe or preview element found in UI');
    }
    
    // 12. Final summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Preview E2E Test Complete!');
    console.log('='.repeat(60));
    console.log(`📁 Screenshots saved in: ${screenshotsDir}`);
    console.log(`🌐 Preview running on port: ${previewPort}`);
    console.log(`🔗 Proxy URL: ${proxyUrl}`);
    console.log(`📦 Repository: ${TEST_REPO}`);
    console.log(`🏷️  Team ID: ${teamId}`);
    
    // List all screenshots
    const screenshots = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png'));
    if (screenshots.length > 0) {
      console.log('\n📸 Screenshots created:');
      screenshots.forEach(s => console.log(`   - ${s}`));
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    // Take error screenshot
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'error.png'),
      fullPage: true 
    });
    console.log('📸 Error screenshot saved: error.png');
    
    process.exit(1);
    
  } finally {
    // Keep browser open for 3 seconds to see the result
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

// Run the test
runPreviewE2ETest().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});