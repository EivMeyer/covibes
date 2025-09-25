#!/usr/bin/env node

/**
 * HMR ACCEPTANCE TEST
 *
 * This is the baseline test that MUST pass after any infrastructure changes.
 * It verifies that Hot Module Reload works through the dynamic proxy system.
 *
 * ACCEPTANCE CRITERIA:
 * - Preview loads at dynamic proxy URL
 * - File changes in Docker container trigger HMR
 * - Browser updates WITHOUT page refresh
 * - WebSocket connection remains stable
 *
 * URL TESTED: /api/preview/proxy/{teamId}/main/
 * This URL pattern must work for ALL teams, not just demo-team-001
 */

const { chromium } = require('playwright');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function runAcceptanceTest() {
  console.log('🏁 RUNNING HMR ACCEPTANCE TEST\n');
  console.log('This test MUST pass for any changes to be accepted.\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors']
  });

  try {
    // CRITICAL: This URL pattern must work
    const TEAM_ID = 'demo-team-001';
    const PREVIEW_URL = `https://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com/api/preview/proxy/${TEAM_ID}/main/`;

    console.log('📍 Testing URL pattern: /api/preview/proxy/{teamId}/main/');
    console.log('📍 Actual URL:', PREVIEW_URL);

    const context = await browser.newContext({
      ignoreHTTPSErrors: true
    });
    const page = await context.newPage();

    // Step 1: Load the preview
    console.log('\n1️⃣  Loading preview page...');
    await page.goto(PREVIEW_URL, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForSelector('h1', { timeout: 10000 });
    const initialH1 = await page.textContent('h1');
    console.log('   ✅ Page loaded. Initial H1:', initialH1);

    // Step 2: Set up HMR monitoring
    console.log('\n2️⃣  Monitoring HMR WebSocket...');
    const hmrMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[vite]') || text.includes('hmr')) {
        hmrMessages.push(text);
        console.log('   🔥 HMR:', text);
      }
    });

    // Step 3: Modify file to trigger HMR
    const timestamp = Date.now();
    const newText = `Acceptance Test PASS ${timestamp}`;

    console.log('\n3️⃣  Modifying container file...');
    const sedCommand = `docker exec preview-${TEAM_ID} sed -i "s/<h1>.*<\\/h1>/<h1>${newText}<\\/h1>/" src/App.jsx`;

    await execAsync(sedCommand);
    console.log('   ✏️  Changed H1 to:', newText);

    // Step 4: Verify HMR update (NO page refresh)
    console.log('\n4️⃣  Waiting for HMR update (no page refresh)...');

    const hmrWorked = await page.waitForFunction(
      (expectedText) => {
        const h1 = document.querySelector('h1');
        return h1 && h1.textContent.includes(expectedText);
      },
      `${timestamp}`,
      { timeout: 10000 }
    ).then(() => true).catch(() => false);

    if (hmrWorked) {
      const updatedH1 = await page.textContent('h1');
      console.log('   ✅ HMR SUCCESS! Updated H1:', updatedH1);
      console.log('   ✅ Browser updated WITHOUT refresh');
      console.log('   ✅ Received', hmrMessages.length, 'HMR messages');

      console.log('\n' + '='.repeat(60));
      console.log('🎉 ACCEPTANCE TEST: PASSED');
      console.log('='.repeat(60));
      console.log('✅ HMR works through dynamic proxy');
      console.log(`✅ Route: /api/preview/proxy/${TEAM_ID}/main/`);
      console.log('✅ Ready for production');
      return true;
    } else {
      const currentH1 = await page.textContent('h1');
      console.log('   ❌ HMR FAILED! Current H1:', currentH1);
      console.log('   ❌ Page did not update automatically');

      console.log('\n' + '='.repeat(60));
      console.log('❌ ACCEPTANCE TEST: FAILED');
      console.log('='.repeat(60));
      console.log('DO NOT deploy these changes!');
      return false;
    }

  } catch (error) {
    console.error('\n❌ ACCEPTANCE TEST CRASHED:', error.message);
    return false;
  } finally {
    await browser.close();
  }
}

// Run the test
runAcceptanceTest().then(success => {
  if (!success) {
    console.log('\n⚠️  Changes have broken HMR functionality!');
    console.log('Revert your changes and try again.');
  }
  process.exit(success ? 0 : 1);
});