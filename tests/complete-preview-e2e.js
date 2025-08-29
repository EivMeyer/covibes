/**
 * Complete E2E Test for Preview Feature
 * Tests the entire flow from registration to showing a working preview
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Test repository as specified
const TEST_REPO = 'https://github.com/EivMeyer/colabvibe-test-repo';

async function completePreviewTest() {
  console.log('🚀 Complete Preview E2E Test\n');
  console.log(`📦 Using test repository: ${TEST_REPO}\n`);
  
  const browser = await chromium.launch({ 
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    slowMo: 100 // Slow down for visibility
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  // Test credentials
  const timestamp = Date.now();
  const testUser = {
    userName: `preview_test_${timestamp}`,
    email: `preview_${timestamp}@test.com`,
    password: 'test123',
    teamName: `PreviewTeam_${timestamp}`
  };
  
  try {
    // 1. Navigate to the frontend (Vite dev server on port 3000)
    console.log('1. Loading ColabVibe frontend...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'screenshots/preview-e2e-01-initial.png',
      fullPage: true 
    });
    console.log('📸 Saved: preview-e2e-01-initial.png');
    
    // 2. Register new user
    console.log('\n2. Registering new user...');
    
    // Check if we see login or register form
    const loginForm = await page.locator('form').first();
    if (await loginForm.isVisible()) {
      // Look for register button/link
      const registerLink = await page.locator('text=/register|sign up|create account/i').first();
      if (await registerLink.isVisible()) {
        await registerLink.click();
        await page.waitForTimeout(1000);
      }
      
      // Fill registration form
      console.log('   Filling registration form...');
      
      // Try different selectors for form fields
      const usernameSelectors = ['input[name="userName"]', 'input[placeholder*="username" i]', 'input[type="text"]'];
      for (const selector of usernameSelectors) {
        try {
          const field = await page.locator(selector).first();
          if (await field.isVisible()) {
            await field.fill(testUser.userName);
            break;
          }
        } catch {}
      }
      
      const emailSelectors = ['input[name="email"]', 'input[type="email"]', 'input[placeholder*="email" i]'];
      for (const selector of emailSelectors) {
        try {
          const field = await page.locator(selector).first();
          if (await field.isVisible()) {
            await field.fill(testUser.email);
            break;
          }
        } catch {}
      }
      
      const passwordSelectors = ['input[name="password"]', 'input[type="password"]', 'input[placeholder*="password" i]'];
      for (const selector of passwordSelectors) {
        try {
          const field = await page.locator(selector).first();
          if (await field.isVisible()) {
            await field.fill(testUser.password);
            break;
          }
        } catch {}
      }
      
      const teamSelectors = ['input[name="teamName"]', 'input[placeholder*="team" i]'];
      for (const selector of teamSelectors) {
        try {
          const field = await page.locator(selector).first();
          if (await field.isVisible()) {
            await field.fill(testUser.teamName);
            break;
          }
        } catch {}
      }
      
      // Submit form
      const submitButton = await page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        console.log('   Submitted registration...');
        await page.waitForTimeout(3000);
      }
    }
    
    // Take screenshot after registration
    await page.screenshot({ 
      path: 'screenshots/preview-e2e-02-after-register.png',
      fullPage: true 
    });
    console.log('📸 Saved: preview-e2e-02-after-register.png');
    
    // 3. Set repository URL using the API directly
    console.log('\n3. Setting repository URL via API...');
    
    // Get the token from localStorage
    const token = await page.evaluate(() => localStorage.getItem('token'));
    if (token) {
      console.log('   Found auth token');
      
      // Update team repository using API
      const response = await page.evaluate(async (repoUrl) => {
        const token = localStorage.getItem('token');
        try {
          const res = await fetch('http://localhost:3001/api/team/repository', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ repositoryUrl: repoUrl })
          });
          return { status: res.status, ok: res.ok };
        } catch (e) {
          return { error: e.message };
        }
      }, TEST_REPO);
      
      if (response.ok || response.status === 200) {
        console.log('✅ Repository URL set successfully');
      } else {
        console.log('⚠️  Could not set repository via API, will try UI');
      }
    }
    
    // 4. Look for preview panel
    console.log('\n4. Looking for preview panel...');
    await page.waitForTimeout(2000);
    
    // Take screenshot of main dashboard
    await page.screenshot({ 
      path: 'screenshots/preview-e2e-03-dashboard.png',
      fullPage: true 
    });
    console.log('📸 Saved: preview-e2e-03-dashboard.png');
    
    // Look for preview elements
    const previewSelectors = [
      'iframe',
      '.preview-panel',
      '[data-testid="preview"]',
      '.preview-container',
      'div:has-text("Preview")',
      'div:has-text("No running preview")',
      'div:has-text("preview")'
    ];
    
    let foundPreview = false;
    for (const selector of previewSelectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          console.log(`✅ Found preview element: ${selector}`);
          foundPreview = true;
          
          // Take screenshot of preview area
          await element.screenshot({ 
            path: `screenshots/preview-e2e-04-preview-panel.png`
          }).catch(() => {});
          break;
        }
      } catch {}
    }
    
    // 5. Start preview using API
    console.log('\n5. Starting preview...');
    
    const createResponse = await page.evaluate(async () => {
      const token = localStorage.getItem('token');
      try {
        const res = await fetch('http://localhost:3001/api/preview/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ branch: 'main' })
        });
        const data = await res.json();
        return { status: res.status, data };
      } catch (e) {
        return { error: e.message };
      }
    });
    
    if (createResponse.status === 200) {
      console.log('✅ Preview started successfully!');
      console.log(`   Port: ${createResponse.data.port}`);
      console.log(`   Status: ${createResponse.data.status}`);
      
      // Wait for preview to start
      console.log('   Waiting for preview to clone and start...');
      await page.waitForTimeout(10000); // Give it time to clone and start
    } else {
      console.log('⚠️  Preview creation response:', createResponse);
    }
    
    // 6. Check preview status
    console.log('\n6. Checking preview status...');
    
    const statusResponse = await page.evaluate(async () => {
      const token = localStorage.getItem('token');
      try {
        const res = await fetch('http://localhost:3001/api/preview/status', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        return await res.json();
      } catch (e) {
        return { error: e.message };
      }
    });
    
    console.log('Preview status:', statusResponse);
    
    // 7. Take final screenshots
    console.log('\n7. Taking final screenshots...');
    
    // Reload page to see updated preview
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: 'screenshots/preview-e2e-05-with-preview.png',
      fullPage: true 
    });
    console.log('📸 Saved: preview-e2e-05-with-preview.png');
    
    // Try to find and screenshot the preview iframe specifically
    const iframe = await page.locator('iframe').first();
    if (await iframe.isVisible()) {
      console.log('✅ Preview iframe is visible!');
      
      // Get iframe URL
      const iframeSrc = await iframe.getAttribute('src');
      console.log(`   Preview URL: ${iframeSrc}`);
      
      // Take screenshot of just the iframe
      await iframe.screenshot({ 
        path: 'screenshots/preview-e2e-06-iframe-content.png'
      }).catch(() => {});
    }
    
    // 8. Try to access the preview directly
    if (statusResponse.main && statusResponse.main.port) {
      console.log(`\n8. Accessing preview directly at port ${statusResponse.main.port}...`);
      
      const previewPage = await context.newPage();
      try {
        await previewPage.goto(`http://localhost:${statusResponse.main.port}`, { 
          waitUntil: 'networkidle',
          timeout: 10000 
        });
        
        await previewPage.screenshot({ 
          path: 'screenshots/preview-e2e-07-direct-preview.png',
          fullPage: true 
        });
        console.log('📸 Saved: preview-e2e-07-direct-preview.png');
        console.log('✅ Preview is running and accessible!');
      } catch (e) {
        console.log('⚠️  Could not access preview directly:', e.message);
      } finally {
        await previewPage.close();
      }
    }
    
    console.log('\n✅ Preview E2E test complete!');
    console.log('📁 Check screenshots/ directory for results');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Take error screenshot
    await page.screenshot({ 
      path: 'screenshots/preview-e2e-error.png',
      fullPage: true 
    });
    
  } finally {
    // Keep browser open for 5 seconds to see the result
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

// Run the test
completePreviewTest().catch(console.error);