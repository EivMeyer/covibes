/**
 * Complete E2E Test for Preview Feature with Screenshots
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

describe('Preview Feature E2E Test', () => {
  let browser;
  let context;
  let page;
  let testUser;
  let authToken;
  let teamId;

  beforeAll(async () => {
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    page = await context.newPage();
    
    // Generate unique test credentials
    const timestamp = Date.now();
    testUser = {
      userName: `preview_e2e_${timestamp}`,
      email: `preview_e2e_${timestamp}@test.com`,
      password: 'test123',
      teamName: `PreviewTeam_${timestamp}`
    };
  });

  afterAll(async () => {
    await browser.close();
  });

  test('Complete preview flow from registration to working preview', async () => {
    // 1. Navigate to the application
    console.log('1. Loading application...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    await page.screenshot({ 
      path: path.join(screenshotsDir, '01-initial.png'),
      fullPage: true 
    });
    
    // 2. Register via API to bypass UI complexities
    console.log('2. Registering user via API...');
    const registerResponse = await page.evaluate(async (userData) => {
      const res = await fetch('http://localhost:3001/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      return res.json();
    }, testUser);
    
    expect(registerResponse.token).toBeDefined();
    expect(registerResponse.team).toBeDefined();
    
    authToken = registerResponse.token;
    teamId = registerResponse.team.id;
    
    // Store token in localStorage to authenticate the UI
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, authToken);
    
    // 3. Set repository URL
    console.log('3. Setting repository URL...');
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
    
    expect(repoResponse.repositoryUrl).toBe(TEST_REPO);
    
    // 4. Start the preview
    console.log('4. Starting preview...');
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
    
    expect(createResponse.port).toBeDefined();
    expect(createResponse.status).toBe('starting');
    
    const previewPort = createResponse.port;
    
    // 5. Wait for preview to start and clone repository
    console.log('5. Waiting for preview to start (15 seconds)...');
    await page.waitForTimeout(15000);
    
    // 6. Check preview status
    console.log('6. Checking preview status...');
    const statusResponse = await page.evaluate(async (token) => {
      const res = await fetch('http://localhost:3001/api/preview/status', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return res.json();
    }, authToken);
    
    expect(statusResponse.main).toBeDefined();
    expect(statusResponse.main.status).toBe('running');
    
    // 7. Reload the page to see the preview in UI
    console.log('7. Reloading page to see preview...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: path.join(screenshotsDir, '02-dashboard.png'),
      fullPage: true 
    });
    
    // 8. Test preview through proxy
    console.log('8. Testing preview through proxy...');
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
    
    expect(proxyResponse.status).toBe(200);
    expect(proxyResponse.text).toContain('Covibes Live Preview');
    
    // 9. Test API endpoint through proxy
    console.log('9. Testing API endpoint through proxy...');
    const apiProxyUrl = `http://localhost:3001/api/preview/${teamId}/main/api/status`;
    
    const apiResponse = await page.evaluate(async (url, token) => {
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return res.json();
    }, apiProxyUrl, authToken);
    
    expect(apiResponse.status).toBe('healthy');
    expect(apiResponse.service).toBe('covibes-test-app');
    
    // 10. Navigate to preview directly and screenshot
    console.log('10. Navigating to preview directly...');
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
      
      // Verify preview content
      const title = await previewPage.title();
      expect(title).toContain('Covibes Live Preview');
      
      const heading = await previewPage.textContent('h1');
      expect(heading).toContain('Covibes Live Preview');
      
      // Test the refresh button
      await previewPage.click('button');
      await previewPage.waitForTimeout(1000);
      
      await previewPage.screenshot({ 
        path: path.join(screenshotsDir, '04-preview-refreshed.png'),
        fullPage: true 
      });
      
    } finally {
      await previewPage.close();
    }
    
    // 11. Check if preview iframe is visible in main app
    console.log('11. Checking for preview iframe in main app...');
    const iframeVisible = await page.evaluate(() => {
      const iframe = document.querySelector('iframe');
      return iframe ? {
        visible: true,
        src: iframe.src,
        width: iframe.offsetWidth,
        height: iframe.offsetHeight
      } : { visible: false };
    });
    
    if (iframeVisible.visible) {
      console.log('✅ Preview iframe found in UI');
      console.log(`   Source: ${iframeVisible.src}`);
      console.log(`   Dimensions: ${iframeVisible.width}x${iframeVisible.height}`);
      
      await page.screenshot({ 
        path: path.join(screenshotsDir, '05-with-iframe.png'),
        fullPage: true 
      });
    } else {
      console.log('ℹ️  No iframe found in UI (preview may be in a different panel)');
    }
    
    // 12. Final summary
    console.log('\n✅ Preview E2E Test Complete!');
    console.log(`📁 Screenshots saved in: ${screenshotsDir}`);
    console.log(`🌐 Preview running on port: ${previewPort}`);
    console.log(`🔗 Proxy URL: ${proxyUrl}`);
    console.log(`📦 Repository: ${TEST_REPO}`);
  }, 60000); // 60 second timeout for the entire test
});

// Run the test if this file is executed directly
if (require.main === module) {
  const { execSync } = require('child_process');
  
  console.log('🚀 Running Preview E2E Test...\n');
  
  try {
    // Run the test with Jest
    execSync('npx jest preview-e2e-complete.test.js --verbose', {
      stdio: 'inherit',
      cwd: __dirname
    });
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}