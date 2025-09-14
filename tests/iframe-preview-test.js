/**
 * Iframe Preview End-to-End Test
 *
 * Tests the actual iframe preview functionality that users experience
 */

const { test, expect } = require('@playwright/test');

test('verify iframe preview loads React app correctly', async ({ page }) => {
  console.log('🔍 Testing iframe preview functionality...');

  // Navigate to the preview URL that would be loaded in an iframe
  const previewUrl = 'http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001/api/preview/proxy/demo-team-001/main/';

  console.log(`🌐 Testing preview URL: ${previewUrl}`);

  // Go to the preview page
  await page.goto(previewUrl, {
    waitUntil: 'networkidle',
    timeout: 15000
  });

  console.log('✅ Preview page loaded');

  // Take a screenshot
  await page.screenshot({
    path: 'test-results/iframe-preview-test.png',
    fullPage: true
  });
  console.log('📸 Screenshot saved: test-results/iframe-preview-test.png');

  // Check if React root element exists
  const rootElement = await page.locator('#root');
  const rootExists = await rootElement.isVisible();
  console.log(`🔧 React #root visible: ${rootExists}`);

  // Wait a bit for React to render
  await page.waitForTimeout(3000);

  // Check if any React content has rendered inside root
  const rootContent = await page.locator('#root').innerHTML();
  const hasContent = rootContent.trim().length > 0;
  console.log(`🔧 React #root has content: ${hasContent}`);

  if (hasContent) {
    console.log(`📄 Root content preview: ${rootContent.substring(0, 100)}...`);
  }

  // Check for any console errors
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push(`${msg.type()}: ${msg.text()}`);
  });

  // Wait for any late-loading content
  await page.waitForTimeout(2000);

  // Check specific React app content
  const appContent = await page.textContent('body');
  const hasReactApp = appContent && (
    appContent.includes('Alice') ||
    appContent.includes('CoVibes') ||
    appContent.includes('Fixed') ||
    rootContent.includes('<div') // Any React-rendered content
  );

  console.log(`🔧 React app content detected: ${hasReactApp}`);

  // Log console messages
  if (consoleLogs.length > 0) {
    console.log('📋 Console messages:');
    consoleLogs.forEach(log => console.log(`   ${log}`));
  }

  // Final verification
  console.log('\n📊 IFRAME PREVIEW TEST RESULTS:');
  console.log('================================');
  console.log(`✅ Page loaded: ${true}`);
  console.log(`✅ Root element exists: ${rootExists}`);
  console.log(`✅ Root has content: ${hasContent}`);
  console.log(`✅ React app detected: ${hasReactApp}`);
  console.log(`📋 Console logs: ${consoleLogs.length}`);

  // Assertions
  expect(rootExists, 'React root element should be visible').toBe(true);
  expect(hasContent || hasReactApp, 'React app should render content').toBe(true);
});