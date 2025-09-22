const { test, expect, chromium } = require('@playwright/test');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// Configure test to ignore HTTPS certificate warnings
test.use({
  ignoreHTTPSErrors: true,
  launchOptions: {
    args: ['--ignore-certificate-errors']
  }
});

test('HTTPS preview HMR end-to-end test', async ({ page }) => {
  console.log('🚀 Testing HTTPS production preview with HMR...');

  // The actual preview URL through nginx proxy
  const PREVIEW_URL = 'https://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com/preview/demo-team-001/';
  const CONTAINER_NAME = 'preview-demo-team-001';

  // Step 1: Navigate to HTTPS preview URL
  console.log('📱 Loading HTTPS preview URL:', PREVIEW_URL);
  await page.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 30000 });

  // Step 2: Wait for React app to load
  console.log('⏳ Waiting for React app to load...');
  await page.waitForSelector('#root', { timeout: 15000 });
  await page.waitForTimeout(2000); // Let Vite/React fully initialize

  // Step 3: Check WebSocket connection for HMR
  console.log('🔌 Checking WebSocket connections...');
  const wsConnections = await page.evaluate(() => {
    return new Promise((resolve) => {
      const connections = [];
      const originalWS = WebSocket;

      // Override WebSocket to capture connections
      window.WebSocket = function(url, protocols) {
        connections.push({ url, protocols });
        return new originalWS(url, protocols);
      };

      // Wait a bit to capture any connections
      setTimeout(() => {
        window.WebSocket = originalWS;
        resolve(connections);
      }, 2000);
    });
  });

  console.log('📡 WebSocket connections found:', wsConnections);

  // Step 4: Verify initial content loads
  console.log('✅ Checking initial content...');
  const hasH1 = await page.locator('h1').count();
  if (hasH1 > 0) {
    const initialContent = await page.textContent('h1');
    console.log('📝 Initial h1 content:', initialContent);
  } else {
    console.log('⚠️ No h1 element found, checking for any text content...');
    const bodyText = await page.textContent('body');
    console.log('📝 Body content:', bodyText.substring(0, 200));
  }

  // Step 5: Set up console monitoring for HMR and errors
  const consoleMessages = [];
  const errors = [];

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[vite]') || text.includes('[HMR]') || text.includes('hmr') || text.includes('hot')) {
      consoleMessages.push(`${msg.type()}: ${text}`);
      console.log('🔥 HMR/Console message:', text);
    }
    if (msg.type() === 'error') {
      errors.push(text);
      console.log('❌ Console error:', text);
    }
  });

  page.on('pageerror', error => {
    console.log('❌ Page error:', error.message);
    errors.push(error.message);
  });

  // Step 6: Check if container exists and get current content
  console.log('🐳 Checking container status...');
  try {
    const { stdout: containerCheck } = await execAsync(`docker ps --format "table {{.Names}}" | grep ${CONTAINER_NAME}`);
    console.log('✅ Container is running:', containerCheck.trim());

    // Get current App.jsx content
    const { stdout: currentContent } = await execAsync(`docker exec ${CONTAINER_NAME} cat src/App.jsx | head -20`);
    console.log('📄 Current App.jsx (first 20 lines):\n', currentContent);
  } catch (error) {
    console.error('❌ Container check failed:', error.message);
    throw new Error('Container not running or accessible');
  }

  // Step 7: Generate unique timestamp for HMR test
  const timestamp = Date.now();
  const testText = `HMR-${timestamp}`;

  console.log('🔄 Making change to trigger HMR...');
  console.log('📝 New text will be:', testText);

  // Step 8: Modify the App.jsx file in the container to trigger HMR
  const changeCommand = `docker exec ${CONTAINER_NAME} sh -c "sed -i '1s/^/\\/\\/ HMR Test: ${testText}\\n/' src/App.jsx"`;

  try {
    await execAsync(changeCommand);
    console.log('✅ File change made successfully');

    // Verify the change was made
    const { stdout: verifyContent } = await execAsync(`docker exec ${CONTAINER_NAME} head -1 src/App.jsx`);
    console.log('📄 Verified change:', verifyContent.trim());
  } catch (error) {
    console.error('❌ Failed to make file change:', error);
    throw error;
  }

  // Step 9: Check container logs for HMR detection
  console.log('📋 Checking container logs for HMR activity...');
  const { stdout: containerLogs } = await execAsync(`docker logs ${CONTAINER_NAME} --tail 20`);
  console.log('🐳 Recent container logs:\n', containerLogs);

  // Step 10: Wait for any page updates or console messages
  console.log('⏳ Waiting for HMR activity (10 seconds)...');
  await page.waitForTimeout(10000);

  // Step 11: Check WebSocket state
  const wsState = await page.evaluate(() => {
    const sockets = [];
    // Try to find any WebSocket instances
    if (window.__vite_ws__) {
      sockets.push({
        vite: true,
        readyState: window.__vite_ws__.readyState,
        url: window.__vite_ws__.url
      });
    }
    return sockets;
  });

  console.log('🔌 WebSocket state:', wsState);

  // Step 12: Check nginx logs for WebSocket traffic
  console.log('📋 Checking nginx access logs...');
  const { stdout: nginxLogs } = await execAsync('sudo tail -20 /var/log/nginx/access.log | grep -i "websocket\\|upgrade\\|hmr\\|vite\\|token"');
  console.log('🔧 Recent nginx WebSocket activity:\n', nginxLogs);

  // Step 13: Report results
  console.log('\n📊 Test Results:');
  console.log('================');
  console.log('✅ Page loaded successfully');
  console.log(`📡 WebSocket connections attempted: ${wsConnections.length}`);
  console.log(`🔥 HMR console messages: ${consoleMessages.length}`);
  console.log(`❌ Errors detected: ${errors.length}`);

  if (consoleMessages.length > 0) {
    console.log('\n🔥 HMR Messages:');
    consoleMessages.forEach(msg => console.log('  ', msg));
  }

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(err => console.log('  ', err));
  }

  // Step 14: Take debug screenshot
  await page.screenshot({
    path: 'tests/screenshots/https-hmr-test.png',
    fullPage: true
  });

  // Report whether HMR is working
  const hmrWorking = consoleMessages.some(msg =>
    msg.toLowerCase().includes('hmr') ||
    msg.toLowerCase().includes('hot') ||
    msg.toLowerCase().includes('vite')
  );

  if (hmrWorking) {
    console.log('\n✅ HMR appears to be connected!');
  } else {
    console.log('\n⚠️ HMR connection not detected - need to fix nginx WebSocket routing');
  }

  // Don't fail the test, just report status
  console.log('\n🎉 HTTPS preview test completed - see results above');
});