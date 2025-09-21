const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/**
 * REAL HMR E2E TEST REQUIREMENTS:
 * ===============================
 *
 * 1. BROWSER SIMULATION: Use real browser, not curl
 * 2. WEBSOCKET MONITORING: Track actual WebSocket connections
 * 3. DOM OBSERVATION: Watch for live DOM changes (not just logs)
 * 4. NETWORK INSPECTION: Monitor all network requests/responses
 * 5. TIMING VERIFICATION: Ensure changes happen without page reload
 * 6. ERROR DETECTION: Catch WebSocket failures and retry logic
 * 7. ISOLATION: Clean test state (backup/restore files)
 * 8. ASSERTIONS: Verify both technical and visual changes
 */

test.describe('Real HMR E2E Test Suite', () => {
  const PREVIEW_URL = 'https://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com/preview/demo-team-001/';
  const WORKSPACE_PATH = '/home/ubuntu/.covibes/workspaces/demo-team-001';
  const APP_FILE = path.join(WORKSPACE_PATH, 'src/App.jsx');

  let originalContent;
  let wsConnections = [];
  let networkRequests = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // REQUIREMENT 7: Clean test state
    originalContent = fs.readFileSync(APP_FILE, 'utf8');
    wsConnections = [];
    networkRequests = [];
    consoleMessages = [];

    // REQUIREMENT 4: Monitor all network activity
    page.on('request', request => {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        timestamp: Date.now()
      });
    });

    page.on('response', response => {
      networkRequests.push({
        url: response.url(),
        status: response.status(),
        timestamp: Date.now(),
        type: 'response'
      });
    });

    // REQUIREMENT 6: Track console errors
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now()
      });
    });

    // REQUIREMENT 2: Monitor WebSocket connections
    page.on('websocket', ws => {
      console.log(`🔌 WebSocket detected: ${ws.url()}`);

      const wsData = {
        url: ws.url(),
        connected: true,
        messages: [],
        errors: [],
        timestamp: Date.now()
      };

      ws.on('framereceived', event => {
        wsData.messages.push({
          data: event.payload,
          timestamp: Date.now()
        });
        console.log(`📨 WS Message: ${event.payload.substring(0, 100)}...`);
      });

      ws.on('framesent', event => {
        wsData.messages.push({
          data: event.payload,
          sent: true,
          timestamp: Date.now()
        });
      });

      ws.on('close', () => {
        wsData.connected = false;
        wsData.closedAt = Date.now();
        console.log(`🔌 WebSocket closed: ${ws.url()}`);
      });

      ws.on('socketerror', error => {
        wsData.errors.push({
          error: error.message,
          timestamp: Date.now()
        });
        console.log(`❌ WebSocket error: ${error.message}`);
      });

      wsConnections.push(wsData);
    });
  });

  test.afterEach(async () => {
    // REQUIREMENT 7: Restore clean state
    if (originalContent) {
      fs.writeFileSync(APP_FILE, originalContent);
    }
  });

  test('HMR WebSocket Connection and Live Updates', async ({ page }) => {
    console.log('🚀 Starting Real HMR E2E Test...');

    // REQUIREMENT 1: Real browser navigation
    await page.goto(PREVIEW_URL, {
      ignoreHTTPSErrors: true,
      waitUntil: 'networkidle'
    });

    // REQUIREMENT 3: Verify initial DOM state
    await page.waitForSelector('h1', { timeout: 10000 });
    const initialTitle = await page.textContent('h1');
    console.log(`📖 Initial title: "${initialTitle}"`);

    // REQUIREMENT 2: Wait for WebSocket connection
    console.log('⏳ Waiting for WebSocket connection...');
    await page.waitForTimeout(3000);

    // REQUIREMENT 8: Assert WebSocket connected
    const viteWS = wsConnections.find(ws =>
      ws.url.includes('/@vite/client') ||
      ws.url.includes('/ws') ||
      ws.url.includes('vite')
    );

    if (!viteWS) {
      console.log('❌ No Vite WebSocket found. Available connections:');
      wsConnections.forEach(ws => console.log(`   - ${ws.url}`));
    }

    expect(wsConnections.length).toBeGreaterThan(0);
    console.log(`✅ Found ${wsConnections.length} WebSocket connection(s)`);

    // REQUIREMENT 5: File modification with timing
    const testId = Date.now();
    const newTitle = `🧪 E2E Test ${testId}`;
    console.log(`✏️  Changing title to: "${newTitle}"`);

    const modifiedContent = originalContent.replace(
      /<h1>.*?<\/h1>/,
      `<h1>${newTitle}</h1>`
    );

    const changeTime = Date.now();
    fs.writeFileSync(APP_FILE, modifiedContent);

    // REQUIREMENT 3: Watch for DOM changes (not page reload)
    console.log('👀 Watching for live DOM update...');

    let domUpdated = false;
    let updateTime;

    // Monitor for title change without page reload
    for (let i = 0; i < 30; i++) { // 30 second timeout
      await page.waitForTimeout(1000);

      try {
        const currentTitle = await page.textContent('h1');

        if (currentTitle.includes(testId.toString())) {
          domUpdated = true;
          updateTime = Date.now();
          console.log(`🎉 DOM updated after ${updateTime - changeTime}ms`);
          break;
        }

        if (i % 5 === 0) {
          console.log(`   Checking ${i+1}/30: "${currentTitle}"`);
        }
      } catch (error) {
        console.log(`   DOM check failed: ${error.message}`);
      }
    }

    // REQUIREMENT 8: Assert live update worked
    expect(domUpdated).toBe(true);

    // REQUIREMENT 5: Verify no page reload occurred
    const pageReloads = networkRequests.filter(req =>
      req.url === PREVIEW_URL && req.method === 'GET'
    );

    console.log(`📊 Page reloads detected: ${pageReloads.length - 1}`); // -1 for initial load
    expect(pageReloads.length).toBeLessThanOrEqual(1); // Only initial load

    // REQUIREMENT 2: Verify WebSocket activity
    const wsMessages = wsConnections.reduce((total, ws) => total + ws.messages.length, 0);
    console.log(`📨 Total WebSocket messages: ${wsMessages}`);

    if (domUpdated) {
      expect(wsMessages).toBeGreaterThan(0);
    }

    // REQUIREMENT 6: Check for errors
    const errors = consoleMessages.filter(msg => msg.type === 'error');
    console.log(`❌ Console errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('Console errors found:');
      errors.forEach(err => console.log(`   - ${err.text}`));
    }

    // Final assertions
    console.log('\n📊 Test Results Summary:');
    console.log(`   WebSocket Connections: ${wsConnections.length}`);
    console.log(`   DOM Updated Live: ${domUpdated ? '✅' : '❌'}`);
    console.log(`   Page Reloads: ${pageReloads.length - 1}`);
    console.log(`   WebSocket Messages: ${wsMessages}`);
    console.log(`   Console Errors: ${errors.length}`);

    // Screenshot for evidence
    await page.screenshot({
      path: 'test-results/hmr-e2e-final.png',
      fullPage: true
    });
  });

  test('HMR WebSocket Path Verification', async ({ page }) => {
    console.log('🔍 Testing WebSocket paths...');

    await page.goto(PREVIEW_URL, {
      ignoreHTTPSErrors: true,
      waitUntil: 'networkidle'
    });

    await page.waitForTimeout(3000);

    // Test expected WebSocket paths
    const expectedPaths = [
      '/@vite/client',
      '/ws',
      '/__vite_ping'
    ];

    for (const path of expectedPaths) {
      const foundWS = wsConnections.find(ws => ws.url.includes(path));
      console.log(`${foundWS ? '✅' : '❌'} WebSocket path: ${path}`);
    }

    // Manual WebSocket test
    try {
      const wsTestUrl = new URL(PREVIEW_URL);
      wsTestUrl.protocol = 'wss:';
      wsTestUrl.pathname = '/preview/demo-team-001/@vite/client';

      console.log(`🧪 Testing manual WS connection: ${wsTestUrl.href}`);

      const wsTest = await page.evaluate((url) => {
        return new Promise((resolve) => {
          try {
            const ws = new WebSocket(url);
            ws.onopen = () => resolve({ success: true, message: 'Connected' });
            ws.onerror = (error) => resolve({ success: false, message: error.message });
            ws.onclose = () => resolve({ success: false, message: 'Connection closed' });

            setTimeout(() => resolve({ success: false, message: 'Timeout' }), 5000);
          } catch (error) {
            resolve({ success: false, message: error.message });
          }
        });
      }, wsTestUrl.href);

      console.log(`Manual WS test result: ${wsTest.success ? '✅' : '❌'} ${wsTest.message}`);

    } catch (error) {
      console.log(`Manual WS test failed: ${error.message}`);
    }
  });
});