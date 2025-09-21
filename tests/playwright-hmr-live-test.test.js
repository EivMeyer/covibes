const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test('HMR Live Test - NO Page Reload', async ({ page }) => {
  console.log('🔥 TESTING TRUE HMR - NO RELOAD ALLOWED');

  const PREVIEW_URL = 'https://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com/preview/demo-team-001/';
  const APP_FILE = '/home/ubuntu/.covibes/workspaces/demo-team-001/src/App.jsx';

  // Backup original file
  const originalContent = fs.readFileSync(APP_FILE, 'utf8');

  let pageReloadCount = 0;
  let wsConnected = false;
  let hmrMessagesReceived = 0;

  try {
    // Monitor page navigation (reloads)
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        pageReloadCount++;
        console.log(`🔄 Page navigation detected! Count: ${pageReloadCount}`);
      }
    });

    // Monitor WebSocket connections and messages
    page.on('websocket', ws => {
      console.log(`🔌 WebSocket: ${ws.url()}`);
      if (ws.url().includes('token=') || ws.url().includes('vite')) {
        wsConnected = true;

        ws.on('framereceived', event => {
          const payload = event.payload;
          if (payload.includes('update') || payload.includes('reload') || payload.includes('full-reload')) {
            hmrMessagesReceived++;
            console.log(`📨 HMR Message ${hmrMessagesReceived}: ${payload.substring(0, 150)}...`);
          }
        });
      }
    });

    // Load page (this counts as navigation #1)
    console.log('🌐 Loading preview page...');
    await page.goto(PREVIEW_URL, {
      ignoreHTTPSErrors: true,
      waitUntil: 'networkidle'
    });

    // Get initial title
    await page.waitForSelector('h1', { timeout: 10000 });
    const initialTitle = await page.textContent('h1');
    console.log(`📖 Initial title: "${initialTitle}"`);

    // Wait for WebSocket connection
    console.log('⏳ Waiting for WebSocket connection...');
    await page.waitForTimeout(3000);

    console.log(`🔌 WebSocket connected: ${wsConnected}`);

    // Modify file
    const testId = Date.now();
    const newTitle = `🚀 LIVE HMR ${testId}`;
    console.log(`✏️  Changing title to: "${newTitle}"`);

    const modifiedContent = originalContent.replace(
      /<h1>.*?<\/h1>/,
      `<h1>${newTitle}</h1>`
    );

    const beforeReloadCount = pageReloadCount;
    fs.writeFileSync(APP_FILE, modifiedContent);
    console.log(`📝 File modified. Reload count before: ${beforeReloadCount}`);

    // Wait for change to appear
    console.log('👀 Waiting for live update (NO RELOAD)...');
    let titleUpdated = false;

    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(1000);

      try {
        const currentTitle = await page.textContent('h1');
        if (currentTitle.includes(testId.toString())) {
          titleUpdated = true;
          const afterReloadCount = pageReloadCount;

          console.log(`🎉 Title updated to: "${currentTitle}"`);
          console.log(`📊 Reload count after: ${afterReloadCount}`);
          console.log(`🔥 HMR Messages received: ${hmrMessagesReceived}`);

          if (afterReloadCount > beforeReloadCount + 1) {
            console.log(`❌ FAILED: Page reloaded ${afterReloadCount - beforeReloadCount} times!`);
          } else {
            console.log(`✅ SUCCESS: No additional reloads detected!`);
          }
          break;
        }

        if (i % 3 === 0) {
          console.log(`   Waiting... ${i+1}/15 - Current: "${currentTitle}"`);
        }
      } catch (error) {
        console.log(`   Check failed: ${error.message}`);
      }
    }

    // Final verdict
    const totalReloads = pageReloadCount - 1; // Subtract initial page load
    console.log(`\n🎯 FINAL RESULT:`);
    console.log(`   Title Updated: ${titleUpdated ? '✅' : '❌'}`);
    console.log(`   Page Reloads: ${totalReloads} ${totalReloads === 0 ? '✅' : '❌'}`);
    console.log(`   HMR Messages: ${hmrMessagesReceived}`);
    console.log(`   WebSocket Connected: ${wsConnected ? '✅' : '❌'}`);

    if (titleUpdated && totalReloads === 0) {
      console.log(`🔥 TRUE HMR WORKING! 🔥`);
    } else if (titleUpdated && totalReloads > 0) {
      console.log(`⚠️  Update works but uses page reload - NOT true HMR`);
    } else {
      console.log(`❌ HMR NOT WORKING`);
    }

    // Assertions
    expect(titleUpdated).toBe(true);
    expect(totalReloads).toBe(0); // This will fail if page reloads

  } finally {
    // Restore original file
    fs.writeFileSync(APP_FILE, originalContent);
    console.log('🔄 File restored');
  }
});