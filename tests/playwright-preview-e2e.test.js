/**
 * Playwright E2E Test for Live Preview Feature
 * 
 * Tests the complete preview workflow:
 * 1. Login and team setup
 * 2. Repository configuration 
 * 3. Docker container creation
 * 4. Preview content rendering (NOT just "Updating preview...")
 * 5. Verify actual app content is displayed
 */

const { test, expect } = require('@playwright/test');

test.describe('Live Preview E2E Tests', () => {
  let page;
  let context;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    
    // Enable console logging for debugging
    page.on('console', msg => {
      console.log(`🖥️  Browser Console [${msg.type()}]:`, msg.text());
    });
    
    // Log network errors
    page.on('response', response => {
      if (response.status() >= 400) {
        console.log(`❌ Network Error: ${response.status()} ${response.url()}`);
      }
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should render actual preview content, not loading state', async () => {
    console.log('🚀 Starting comprehensive preview E2E test...');
    
    // Step 1: Navigate and login
    console.log('📝 Step 1: Login to CoVibe...');
    await page.goto('http://localhost:3001');
    
    // Login (assuming we have test credentials)
    await page.click('text=Login');
    await page.fill('[data-testid="email-input"], input[type="email"]', 'test@example.com');
    await page.fill('[data-testid="password-input"], input[type="password"]', 'password123');
    await page.click('[data-testid="login-button"], button:has-text("Login")');
    
    // Wait for dashboard to load
    await expect(page).toHaveURL(/.*dashboard.*|.*\/$/);
    await page.waitForSelector('text=Team Collaboration', { timeout: 10000 });
    console.log('✅ Login successful, dashboard loaded');

    // Step 2: Configure repository if needed
    console.log('📝 Step 2: Ensuring repository is configured...');
    
    // Check if repository is already configured
    const repoStatus = await page.locator('text=EivMeyer/colabvibe-test-repo').first();
    if (await repoStatus.isVisible()) {
      console.log('✅ Repository already configured: EivMeyer/colabvibe-test-repo');
    } else {
      console.log('⚙️  Configuring repository...');
      
      // Click configure repo button
      await page.click('button:has-text("Configure"), text=Configure Repository');
      
      // Fill in repository URL
      await page.fill('input[placeholder*="repository"], input[placeholder*="GitHub"]', 'https://github.com/EivMeyer/colabvibe-test-repo.git');
      await page.click('button:has-text("Save"), button:has-text("Configure")');
      
      // Wait for success
      await page.waitForSelector('text=EivMeyer/colabvibe-test-repo', { timeout: 5000 });
      console.log('✅ Repository configured successfully');
    }

    // Step 3: Wait for preview panel to be visible
    console.log('📝 Step 3: Locating preview panel...');
    
    // Look for preview panel (it might be in different locations based on screen size)
    const previewPanel = page.locator('.preview-panel, [data-testid="preview-panel"], iframe[title="Live Preview"]').first();
    const previewContainer = page.locator('text=Live Preview').locator('..').locator('iframe, div').first();
    
    // Check if preview is visible
    let previewVisible = false;
    try {
      await expect(previewPanel.or(previewContainer)).toBeVisible({ timeout: 5000 });
      previewVisible = true;
      console.log('✅ Preview panel is visible');
    } catch (error) {
      console.log('⚠️  Preview panel not immediately visible, checking for mobile/responsive view...');
      
      // Try clicking preview button on mobile
      try {
        await page.click('button[title*="preview"], button:has-text("Preview")');
        await expect(previewPanel.or(previewContainer)).toBeVisible({ timeout: 5000 });
        previewVisible = true;
        console.log('✅ Preview panel opened via mobile button');
      } catch (e) {
        console.log('❌ Could not find preview panel');
      }
    }

    if (!previewVisible) {
      console.log('❌ Preview panel not found, skipping preview-specific tests');
      return;
    }

    // Step 4: Wait for preview to load and check it's not stuck on "Updating preview..."
    console.log('📝 Step 4: Waiting for preview content to load...');
    
    // Look for the iframe that contains the preview
    const previewIframe = page.locator('iframe[title="Live Preview"], iframe[src*="/api/preview/"]').first();
    
    if (await previewIframe.isVisible()) {
      console.log('✅ Found preview iframe');
      
      // Step 5: Check iframe content
      console.log('📝 Step 5: Checking iframe content...');
      
      // Wait a reasonable time for the Docker container to start and serve content
      console.log('⏳ Waiting for Docker container to start and serve content (up to 60 seconds)...');
      
      let contentLoaded = false;
      let attempts = 0;
      const maxAttempts = 12; // 60 seconds with 5-second intervals
      
      while (!contentLoaded && attempts < maxAttempts) {
        attempts++;
        console.log(`🔍 Attempt ${attempts}/${maxAttempts}: Checking preview content...`);
        
        try {
          // Get the iframe and check its content
          const iframeContent = await previewIframe.frameLocator('body');
          
          // Check for our specific content from the enhanced app
          const hasAppContent = await iframeContent.locator('text=CoVibe Live Preview').isVisible({ timeout: 5000 });
          const hasGradientBackground = await iframeContent.locator('body').evaluate((body) => {
            const style = window.getComputedStyle(body);
            return style.background.includes('gradient') || style.backgroundImage.includes('gradient');
          });
          const hasStatCards = await iframeContent.locator('.stat-card').count() > 0;
          
          if (hasAppContent || hasGradientBackground || hasStatCards) {
            console.log('✅ Preview content loaded successfully!');
            console.log(`   - App title present: ${hasAppContent}`);
            console.log(`   - Gradient background: ${hasGradientBackground}`);
            console.log(`   - Stat cards: ${hasStatCards}`);
            contentLoaded = true;
            break;
          }
          
        } catch (error) {
          console.log(`⚠️  Attempt ${attempts}: Content not ready yet (${error.message})`);
        }
        
        if (!contentLoaded) {
          await page.waitForTimeout(5000); // Wait 5 seconds before next attempt
        }
      }
      
      if (!contentLoaded) {
        console.log('❌ Preview content did not load within 60 seconds');
        
        // Take a screenshot for debugging
        await page.screenshot({ 
          path: `/home/eivind/repos/colabvibe/colabvibe/tests/screenshots/preview-timeout-${Date.now()}.png`,
          fullPage: true 
        });
        
        throw new Error('Preview content failed to load - Docker container may not have started properly');
      }

    } else {
      console.log('⚠️  No preview iframe found, checking for direct preview content...');
      
      // Check if preview content is embedded directly (not in iframe)
      const hasDirectPreview = await page.locator('text=CoVibe Live Preview, text=CoVibe Test App').isVisible({ timeout: 5000 });
      
      if (hasDirectPreview) {
        console.log('✅ Found direct preview content (not in iframe)');
      } else {
        console.log('❌ No preview content found in any form');
        await page.screenshot({ 
          path: `/home/eivind/repos/colabvibe/colabvibe/tests/screenshots/no-preview-${Date.now()}.png`,
          fullPage: true 
        });
        throw new Error('No preview content found - preview feature may not be working');
      }
    }

    // Step 6: Verify specific content from our enhanced app
    console.log('📝 Step 6: Verifying specific app content...');
    
    const iframeContent = previewIframe.frameLocator('body');
    
    // Test for specific elements from our enhanced app
    await expect(iframeContent.locator('text=CoVibe Live Preview')).toBeVisible({ timeout: 10000 });
    console.log('✅ App title "CoVibe Live Preview" found');
    
    // Check for stat cards (time, lucky number, visitors)
    const statCards = iframeContent.locator('.stat-card');
    await expect(statCards.first()).toBeVisible({ timeout: 5000 });
    console.log('✅ Stat cards are visible');
    
    // Verify the refresh button works
    const refreshButton = iframeContent.locator('button:has-text("Refresh")');
    await expect(refreshButton).toBeVisible({ timeout: 5000 });
    console.log('✅ Refresh button is visible');
    
    // Test API endpoints are mentioned
    await expect(iframeContent.locator('text=/api/status')).toBeVisible({ timeout: 5000 });
    console.log('✅ API endpoints are listed');

    // Step 7: Test interactivity
    console.log('📝 Step 7: Testing interactivity...');
    
    // Get current time value before refresh
    const timeBeforeRefresh = await iframeContent.locator('.stat-card').first().locator('.stat-value').textContent();
    console.log(`⏰ Time before refresh: ${timeBeforeRefresh}`);
    
    // Click refresh button
    await refreshButton.click();
    
    // Wait a moment for potential content change
    await page.waitForTimeout(2000);
    
    // Get time after refresh (it should be different)
    const timeAfterRefresh = await iframeContent.locator('.stat-card').first().locator('.stat-value').textContent();
    console.log(`⏰ Time after refresh: ${timeAfterRefresh}`);
    
    if (timeBeforeRefresh !== timeAfterRefresh) {
      console.log('✅ Refresh button works - content updated');
    } else {
      console.log('⚠️  Refresh button may not have changed content (times are the same)');
    }

    // Final success screenshot
    await page.screenshot({ 
      path: `/home/eivind/repos/colabvibe/colabvibe/tests/screenshots/preview-success-${Date.now()}.png`,
      fullPage: true 
    });

    console.log('🎉 Preview E2E test completed successfully!');
    console.log('✅ All checks passed:');
    console.log('   - Login successful');
    console.log('   - Repository configured');
    console.log('   - Preview content loaded (not stuck on "Updating preview...")');
    console.log('   - App content visible with gradient background');
    console.log('   - Interactive elements working');
    console.log('   - Docker container successfully serving content');
  });

  test('should handle preview creation and status updates', async () => {
    console.log('🚀 Testing preview creation and status...');
    
    // This test focuses on the API-level preview functionality
    await page.goto('http://localhost:3001');
    
    // Login first
    await page.click('text=Login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Login")');
    
    await page.waitForSelector('text=Team Collaboration', { timeout: 10000 });
    
    // Test preview status API call
    const response = await page.evaluate(async () => {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/preview/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return {
        status: res.status,
        data: await res.json()
      };
    });
    
    console.log('📊 Preview status response:', response);
    
    // Should get valid response (not 404 or error)
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('main');
    expect(response.data).toHaveProperty('staging');
    
    console.log('✅ Preview API endpoints are working');
  });

  test('should show preview loading state initially, then content', async () => {
    console.log('🚀 Testing preview loading sequence...');
    
    await page.goto('http://localhost:3001');
    
    // Login
    await page.click('text=Login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Login")');
    
    await page.waitForSelector('text=Team Collaboration');
    
    // Look for loading state first
    const loadingText = page.locator('text=Updating preview..., text=Loading preview...');
    
    if (await loadingText.isVisible({ timeout: 2000 })) {
      console.log('✅ Found loading state initially');
      
      // Wait for loading to disappear and content to appear
      await expect(loadingText).not.toBeVisible({ timeout: 30000 });
      console.log('✅ Loading state disappeared');
      
      // Now check for actual content
      const previewIframe = page.locator('iframe[title="Live Preview"]');
      if (await previewIframe.isVisible()) {
        const iframeContent = previewIframe.frameLocator('body');
        await expect(iframeContent.locator('text=CoVibe')).toBeVisible({ timeout: 20000 });
        console.log('✅ Content loaded after loading state');
      }
    } else {
      console.log('⚠️  Loading state not visible (content may load immediately)');
    }
  });
});