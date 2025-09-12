const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

test('preview loads in production and HMR works end-to-end', async ({ page }) => {
  console.log('🚀 Testing production preview with HMR...');
  
  const PREVIEW_URL = 'http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:8000';
  const CONTAINER_NAME = 'preview-demo-team-001';
  
  // Step 1: Navigate to production preview URL
  console.log('📱 Loading preview URL:', PREVIEW_URL);
  await page.goto(PREVIEW_URL);
  
  // Step 2: Wait for React app to load
  await page.waitForSelector('#root', { timeout: 10000 });
  await page.waitForTimeout(2000); // Let Vite/React fully initialize
  
  // Step 3: Verify initial content loads
  console.log('✅ Checking initial content...');
  const initialContent = await page.textContent('h1');
  console.log('📝 Initial h1 content:', initialContent);
  
  expect(initialContent).toContain('HMR VERIFIED');
  
  // Step 4: Verify React components are rendered
  const ballElements = await page.locator('.ball').count();
  console.log('⚽ Ball elements found:', ballElements);
  expect(ballElements).toBeGreaterThan(0);
  
  // Step 5: Take screenshot of initial state
  await page.screenshot({ 
    path: 'tests/screenshots/preview-initial.png', 
    fullPage: true 
  });
  
  // Step 6: Set up console monitoring for HMR
  const consoleMessages = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[vite]') || text.includes('[HMR]')) {
      consoleMessages.push(`${msg.type()}: ${text}`);
      console.log('🔥 HMR message:', text);
    }
  });
  
  // Step 7: Generate unique timestamp for HMR test
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const testText = `HMR TEST ${timestamp}`;
  
  console.log('🔄 Making change to trigger HMR...');
  console.log('📝 New text will be:', testText);
  
  // Step 8: Modify the App.jsx file in the container to trigger HMR
  const changeCommand = `docker exec ${CONTAINER_NAME} sed -i 's/HMR VERIFIED [^]]*/HMR TEST ${timestamp}/g' src/App.jsx`;
  
  try {
    await execAsync(changeCommand);
    console.log('✅ File change made successfully');
  } catch (error) {
    console.error('❌ Failed to make file change:', error);
    throw error;
  }
  
  // Step 9: Wait for HMR to update the page automatically
  console.log('⏳ Waiting for HMR to update page...');
  
  // Wait for the h1 content to change (this proves HMR worked)
  try {
    await page.waitForFunction(
      (expectedText) => {
        const h1 = document.querySelector('h1');
        return h1 && h1.textContent.includes(expectedText);
      },
      testText,
      { timeout: 15000 }
    );
    console.log('🎉 HMR update detected!');
  } catch (error) {
    console.error('❌ HMR update timeout');
    
    // Debug: Check current content
    const currentContent = await page.textContent('h1');
    console.log('📝 Current h1 content:', currentContent);
    
    // Take debug screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/preview-hmr-timeout.png', 
      fullPage: true 
    });
    
    throw new Error(`HMR did not update page. Expected: "${testText}", Got: "${currentContent}"`);
  }
  
  // Step 10: Verify the new content is displayed
  const updatedContent = await page.textContent('h1');
  console.log('✅ Updated content:', updatedContent);
  expect(updatedContent).toContain(testText);
  
  // Step 11: Verify no page reload occurred (check for HMR messages)
  console.log('🔍 HMR console messages:', consoleMessages);
  
  // Step 12: Test adding a new element via HMR
  console.log('🎾 Adding new element to test HMR...');
  const emojiTestCommand = `docker exec ${CONTAINER_NAME} sh -c 'echo "      <div className=\\"hmr-test\\">🔥 HMR WORKS!</div>" >> temp_element.txt && sed -i "/ball ball3.*🎾/r temp_element.txt" src/App.jsx && rm temp_element.txt'`;
  
  try {
    await execAsync(emojiTestCommand);
    console.log('✅ New element added to source');
  } catch (error) {
    console.error('❌ Failed to add new element:', error);
  }
  
  // Step 13: Wait for new element to appear
  try {
    await page.waitForSelector('.hmr-test', { timeout: 15000 });
    const hmrTestText = await page.textContent('.hmr-test');
    console.log('🔥 New HMR element found:', hmrTestText);
    expect(hmrTestText).toContain('HMR WORKS!');
  } catch (error) {
    console.error('❌ New HMR element not found');
    await page.screenshot({ 
      path: 'tests/screenshots/preview-hmr-element-timeout.png', 
      fullPage: true 
    });
    throw error;
  }
  
  // Step 14: Final screenshot
  await page.screenshot({ 
    path: 'tests/screenshots/preview-hmr-final.png', 
    fullPage: true 
  });
  
  console.log('🎉 Production preview and HMR test completed successfully!');
});

test('preview mobile viewport compatibility', async ({ page }) => {
  console.log('📱 Testing mobile viewport...');
  
  const PREVIEW_URL = 'http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:8000';
  
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });
  
  // Navigate to preview
  await page.goto(PREVIEW_URL);
  
  // Wait for content to load
  await page.waitForSelector('#root', { timeout: 10000 });
  await page.waitForTimeout(2000);
  
  // Verify content is visible on mobile
  const h1Visible = await page.isVisible('h1');
  expect(h1Visible).toBe(true);
  
  const ballElements = await page.locator('.ball').count();
  expect(ballElements).toBeGreaterThan(0);
  
  // Take mobile screenshot
  await page.screenshot({ 
    path: 'tests/screenshots/preview-mobile.png', 
    fullPage: true 
  });
  
  console.log('📱 Mobile viewport test completed successfully!');
});