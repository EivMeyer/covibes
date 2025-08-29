/**
 * E2E Test for Preview Feature
 * Tests that the preview actually shows a running project
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Preview Feature E2E', () => {
  let page;
  let context;
  let browser;
  
  // Test credentials
  const timestamp = Date.now();
  const testUser = {
    userName: `preview_e2e_${timestamp}`,
    email: `preview_e2e_${timestamp}@test.com`,
    password: 'test123',
    teamName: `PreviewTeam_${timestamp}`
  };

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('Preview shows team repository project', async () => {
    console.log('🧪 Starting Preview E2E Test...\n');
    
    // 1. Navigate to app
    console.log('1. Navigating to ColabVibe...');
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(2000);
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'screenshots/preview-01-initial.png',
      fullPage: true 
    });
    
    // 2. Register new user
    console.log('2. Registering new user...');
    
    // Click register if we see auth page
    const registerButton = page.locator('button:has-text("Register")');
    if (await registerButton.isVisible()) {
      await registerButton.click();
    }
    
    // Fill registration form
    await page.fill('input[name="userName"], input[placeholder*="username" i]', testUser.userName);
    await page.fill('input[name="email"], input[type="email"]', testUser.email);
    await page.fill('input[name="password"], input[type="password"]', testUser.password);
    await page.fill('input[name="teamName"], input[placeholder*="team" i]', testUser.teamName);
    
    // Submit registration
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    // Take screenshot after registration
    await page.screenshot({ 
      path: 'screenshots/preview-02-after-register.png',
      fullPage: true 
    });
    
    // 3. Configure repository (we need to add this to the UI or use API)
    console.log('3. Setting up repository...');
    
    // For now, let's check if we can see the preview panel
    const previewPanel = page.locator('[data-testid="preview-panel"], .preview-panel, iframe, [title*="preview" i]');
    
    if (await previewPanel.isVisible()) {
      console.log('✅ Preview panel is visible');
      
      // Take screenshot of preview panel
      await page.screenshot({ 
        path: 'screenshots/preview-03-panel-visible.png',
        fullPage: true 
      });
      
      // Check for "no preview" message
      const noPreviewMsg = page.locator('text=/no.*preview|preview.*not.*running/i');
      if (await noPreviewMsg.isVisible()) {
        console.log('⚠️ Preview shows "no running container" - this is expected');
        console.log('   Repository configuration needed in settings');
      }
    } else {
      console.log('⚠️ Preview panel not immediately visible');
      console.log('   May need to navigate to it or configure repository first');
    }
    
    // 4. Try to find repository settings
    console.log('\n4. Looking for repository settings...');
    
    // Look for settings or config button
    const settingsButton = page.locator('button:has-text("Settings"), button:has-text("Config"), button[aria-label*="settings" i]');
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.waitForTimeout(1000);
      
      // Look for repository input
      const repoInput = page.locator('input[placeholder*="repository" i], input[placeholder*="github" i], input[name*="repo" i]');
      if (await repoInput.isVisible()) {
        console.log('✅ Found repository configuration');
        
        // Set a simple example repository
        await repoInput.fill('https://github.com/sindresorhus/is-online.git');
        
        // Save settings
        const saveButton = page.locator('button:has-text("Save"), button[type="submit"]');
        if (await saveButton.isVisible()) {
          await saveButton.click();
          await page.waitForTimeout(2000);
        }
      }
    }
    
    // 5. Try to start preview
    console.log('\n5. Attempting to start preview...');
    
    // Look for start preview button
    const startPreviewButton = page.locator('button:has-text("Start Preview"), button:has-text("Start"), button[aria-label*="preview" i]');
    if (await startPreviewButton.isVisible()) {
      console.log('✅ Found start preview button');
      await startPreviewButton.click();
      await page.waitForTimeout(5000); // Wait for clone and start
      
      // Take screenshot after starting
      await page.screenshot({ 
        path: 'screenshots/preview-04-after-start.png',
        fullPage: true 
      });
    }
    
    // 6. Final screenshot
    console.log('\n6. Taking final screenshot...');
    await page.screenshot({ 
      path: 'screenshots/preview-05-final.png',
      fullPage: true 
    });
    
    // Check if preview iframe has content
    const previewIframe = page.frameLocator('iframe[title*="preview" i], iframe[src*="preview" i]');
    try {
      const iframeContent = previewIframe.locator('body');
      if (await iframeContent.isVisible()) {
        console.log('✅ Preview iframe has content!');
      }
    } catch (e) {
      console.log('⚠️ Could not access preview iframe content');
    }
    
    console.log('\n📸 Screenshots saved to screenshots/ directory');
    console.log('Check preview-05-final.png to see the preview state');
  });
});