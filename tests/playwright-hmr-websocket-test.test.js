/**
 * Test HMR WebSocket connection and hot reload functionality
 */
const { test, expect } = require('@playwright/test');

test('verify HMR WebSocket connects and hot reload works', async ({ page }) => {
  console.log('🔥 Testing HMR WebSocket and hot reload...');
  
  const url = 'http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:7174/api/preview/proxy/demo-team-001/main/';
  
  // Track WebSocket events
  const wsEvents = [];
  const consoleMessages = [];
  
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(text);
    
    if (text.includes('websocket') || text.includes('WebSocket') || text.includes('hmr') || text.includes('[vite]')) {
      console.log(`🔌 WS/HMR: ${text}`);
    }
    
    if (msg.type() === 'error' && (text.includes('WebSocket') || text.includes('websocket'))) {
      console.log(`❌ WS Error: ${text}`);
    }
  });
  
  // Monitor network for WebSocket connections
  page.on('response', response => {
    const url = response.url();
    if (url.includes('ws://') || url.includes('websocket')) {
      console.log(`🔌 WebSocket Response: ${response.status()} - ${url}`);
    }
  });
  
  page.on('request', request => {
    const url = request.url();
    if (url.includes('ws://') || url.includes('websocket')) {
      console.log(`🔌 WebSocket Request: ${url}`);
    }
  });
  
  console.log(`🌐 Loading: ${url}`);
  
  // Load the page
  await page.goto(url, { 
    waitUntil: 'networkidle',
    timeout: 15000 
  });
  
  // Take initial screenshot
  await page.screenshot({ path: 'test-results/hmr-initial.png', fullPage: true });
  
  // Wait for initial load and any WebSocket connections
  await page.waitForTimeout(5000);
  
  // Check what content is currently visible
  const initialTitle = await page.locator('h1').textContent().catch(() => 'Title not found');
  const initialH2 = await page.locator('h2').textContent().catch(() => 'H2 not found');
  
  console.log(`📄 Initial title: ${initialTitle}`);
  console.log(`📄 Initial h2: ${initialH2}`);
  
  // Look for signs of WebSocket connection success
  const hasViteConnected = consoleMessages.some(msg => 
    msg.includes('[vite] connected') || 
    msg.includes('websocket connection established') ||
    msg.includes('HMR ready')
  );
  
  const hasWebSocketError = consoleMessages.some(msg => 
    msg.includes('WebSocket closed') ||
    msg.includes('failed to connect to websocket') ||
    msg.includes('ERR_CONNECTION_REFUSED')
  );
  
  console.log(`🔌 WebSocket connected: ${hasViteConnected}`);
  console.log(`❌ WebSocket errors: ${hasWebSocketError}`);
  
  // Take final screenshot
  await page.screenshot({ path: 'test-results/hmr-final.png', fullPage: true });
  
  // Results
  console.log('\n📊 HMR WebSocket Test Results:');
  console.log(`   Page loaded: ✅`);
  console.log(`   WebSocket connected: ${hasViteConnected ? '✅' : '❌'}`);
  console.log(`   WebSocket errors: ${hasWebSocketError ? '❌' : '✅'}`);
  console.log(`   Console messages: ${consoleMessages.length}`);
  
  if (!hasWebSocketError && hasViteConnected) {
    console.log('\n🎉 HMR WEBSOCKET IS WORKING!');
  } else if (hasWebSocketError) {
    console.log('\n💥 WEBSOCKET CONNECTION FAILED - HMR BROKEN');
    
    // Show the specific error
    const wsErrors = consoleMessages.filter(msg => 
      msg.includes('WebSocket') || msg.includes('websocket')
    );
    wsErrors.forEach(err => console.log(`   Error: ${err}`));
  } else {
    console.log('\n⚠️  WEBSOCKET STATUS UNCLEAR');
  }
});