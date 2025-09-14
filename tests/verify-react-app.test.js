import { test, expect } from '@playwright/test';

test('verify actual React app structure', async ({ page }) => {
  // Test the VITE DEV SERVER (port 3000) - where React runs
  await page.goto('http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3000');

  // Wait for React to load
  await page.waitForSelector('#root', { timeout: 10000 });

  // Check if React rendered content
  const rootHasContent = await page.locator('#root').innerHTML();
  console.log('React root has content:', rootHasContent.length > 50);

  // Check for OLD hardcoded elements that DON'T exist
  const showcaseExists = await page.locator('#showcase').count();
  const previewFrameExists = await page.locator('#previewFrame').count();

  console.log('❌ Old #showcase element exists:', showcaseExists > 0);
  console.log('❌ Old #previewFrame element exists:', previewFrameExists > 0);

  // Check for actual React component elements
  const hasIframes = await page.locator('iframe').count();
  const hasPreviewTile = await page.locator('[data-testid*="preview"], [class*="preview"]').count();

  console.log('✅ Has iframes (React components):', hasIframes > 0);
  console.log('✅ Has preview-related elements:', hasPreviewTile > 0);

  // Print what actually exists
  const allIds = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[id]')).map(el => el.id);
  });
  console.log('🔍 Actual element IDs:', allIds);
});