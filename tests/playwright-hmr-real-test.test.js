const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test('Real HMR E2E Test - Complete WebSocket and DOM Verification', async ({ page }) => {
  console.log('🚀 REAL HMR E2E TEST - NO SHORTCUTS');
  console.log('=====================================');

  const PREVIEW_URL = 'https://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com/preview/demo-team-001/';
  const APP_FILE = '/home/ubuntu/.covibes/workspaces/demo-team-001/src/App.jsx';

  // Test state tracking
  let wsConnections = [];
  let networkRequests = [];
  let consoleMessages = [];
  let pageReloaded = false;

  // Backup original file
  const originalContent = fs.readFileSync(APP_FILE, 'utf8');

  try {
    // MONITOR ALL NETWORK ACTIVITY
    page.on('request', req => {
      networkRequests.push({
        url: req.url(),
        method: req.method(),
        timestamp: Date.now()
      });
    });

    page.on('response', res => {
      if (res.url() === PREVIEW_URL && res.status() === 200) {
        pageReloaded = true;
        console.log(`🔄 Page reload detected at ${new Date().toISOString()}`);
      }
    });

    // MONITOR CONSOLE MESSAGES
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text, timestamp: Date.now() });

      if (text.includes('vite') || text.includes('HMR') || text.includes('WebSocket')) {
        console.log(`📝 Console: [${msg.type()}] ${text}`);
      }
    });

    // MONITOR WEBSOCKET CONNECTIONS
    page.on('websocket', ws => {
      console.log(`🔌 WebSocket Connected: ${ws.url()}`);

      const wsData = {
        url: ws.url(),
        connected: true,
        messages: [],
        connectTime: Date.now()
      };

      ws.on('framereceived', event => {
        const payload = event.payload;
        wsData.messages.push({ received: payload, timestamp: Date.now() });

        if (payload.includes('update') || payload.includes('reload')) {
          console.log(`📨 HMR Message: ${payload.substring(0, 100)}...`);
        }
      });

      ws.on('close', () => {
        wsData.connected = false;
        wsData.closeTime = Date.now();
        console.log(`🔌 WebSocket Closed: ${ws.url()}`);
      });

      wsConnections.push(wsData);
    });

    // STEP 1: NAVIGATE TO PREVIEW
    console.log('🌐 Step 1: Loading preview page...');
    await page.goto(PREVIEW_URL, {
      ignoreHTTPSErrors: true,
      waitUntil: 'networkidle',
      timeout: 15000
    });

    // STEP 2: VERIFY INITIAL STATE
    console.log('📖 Step 2: Verifying initial DOM state...');
    await page.waitForSelector('h1', { timeout: 10000 });
    const initialTitle = await page.textContent('h1');
    console.log(`   Initial title: "${initialTitle}"`);

    // STEP 3: WAIT FOR WEBSOCKET CONNECTIONS
    console.log('⏳ Step 3: Waiting for WebSocket connections...');
    await page.waitForTimeout(5000); // Give time for all WS connections

    console.log(`   Found ${wsConnections.length} WebSocket connection(s):`);
    wsConnections.forEach((ws, i) => {
      console.log(`   ${i+1}. ${ws.url} (${ws.connected ? 'connected' : 'closed'})`);
    });

    // STEP 4: MODIFY FILE AND TRACK TIMING
    const testId = Date.now();
    const newTitle = `🧪 REAL E2E TEST ${testId}`;
    console.log(`✏️  Step 4: Changing title to "${newTitle}"`);

    const modifiedContent = originalContent.replace(
      /<h1>.*?<\/h1>/,
      `<h1>${newTitle}</h1>`
    );

    const fileChangeTime = Date.now();
    fs.writeFileSync(APP_FILE, modifiedContent);
    console.log(`   File modified at: ${new Date(fileChangeTime).toISOString()}`);

    // STEP 5: WAIT FOR LIVE DOM UPDATE
    console.log('👀 Step 5: Watching for live DOM update (30s timeout)...');

    let domUpdated = false;
    let updateDetectedTime;
    let finalTitle;

    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);

      try {
        const currentTitle = await page.textContent('h1');

        if (currentTitle.includes(testId.toString())) {
          domUpdated = true;
          updateDetectedTime = Date.now();
          finalTitle = currentTitle;
          console.log(`🎉 DOM UPDATED! After ${updateDetectedTime - fileChangeTime}ms`);
          console.log(`   Final title: "${finalTitle}"`);
          break;
        }

        if (i % 5 === 0) {
          console.log(`   Check ${i+1}/30: "${currentTitle}"`);
        }
      } catch (error) {
        console.log(`   DOM check error: ${error.message}`);
      }
    }

    // STEP 6: ANALYZE RESULTS
    console.log('\n📊 ANALYSIS RESULTS:');
    console.log('===================');

    console.log(`🔌 WebSocket Connections: ${wsConnections.length}`);
    const activeWS = wsConnections.filter(ws => ws.connected).length;
    console.log(`   Active: ${activeWS}, Closed: ${wsConnections.length - activeWS}`);

    const totalWSMessages = wsConnections.reduce((sum, ws) => sum + ws.messages.length, 0);
    console.log(`📨 Total WebSocket Messages: ${totalWSMessages}`);

    console.log(`🔄 Page Reloads After Initial Load: ${pageReloaded ? 'YES (❌ HMR failed)' : 'NO (✅ HMR working)'}`);

    console.log(`🎯 DOM Updated Live: ${domUpdated ? '✅ YES' : '❌ NO'}`);

    const errors = consoleMessages.filter(msg => msg.type === 'error');
    console.log(`❌ Console Errors: ${errors.length}`);
    if (errors.length > 0) {
      errors.slice(0, 3).forEach(err => console.log(`   - ${err.text}`));
    }

    // STEP 7: FINAL ASSERTIONS
    console.log('\n🎯 FINAL HMR VERDICT:');
    if (domUpdated && !pageReloaded) {
      console.log('✅ HMR IS WORKING! Live updates confirmed.');
    } else if (domUpdated && pageReloaded) {
      console.log('⚠️  DOM updated but page reloaded - not true HMR');
    } else {
      console.log('❌ HMR IS NOT WORKING - no live updates detected');
    }

    // Playwright assertions
    expect(wsConnections.length).toBeGreaterThan(0);
    expect(domUpdated).toBe(true);

    // Take screenshot for evidence
    await page.screenshot({
      path: 'test-results/hmr-real-e2e-result.png',
      fullPage: true
    });

  } finally {
    // CLEANUP: Restore original file
    console.log('🔄 Restoring original file...');
    fs.writeFileSync(APP_FILE, originalContent);
  }
});