/**
 * Simple screenshot capture for CoVibe
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

async function captureScreenshots() {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  
  const page = await context.newPage();
  
  console.log('📸 Capturing screenshots...\n');

  try {
    // 1. Homepage/Login
    console.log('1. Capturing homepage...');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '01-homepage.png'),
      fullPage: true 
    });

    // 2. Try to capture visible elements
    console.log('2. Checking for UI elements...');
    
    // Check what's actually on the page
    const pageContent = await page.content();
    const hasLogin = pageContent.includes('login') || pageContent.includes('Login');
    const hasRegister = pageContent.includes('register') || pageContent.includes('Register');
    
    console.log(`   - Login form found: ${hasLogin}`);
    console.log(`   - Register option found: ${hasRegister}`);

    // 3. Try different screen sizes
    console.log('3. Capturing mobile view...');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ 
      path: path.join(screenshotsDir, '02-mobile-view.png'),
      fullPage: true 
    });

    console.log('4. Capturing tablet view...');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ 
      path: path.join(screenshotsDir, '03-tablet-view.png'),
      fullPage: true 
    });

    console.log('5. Capturing desktop view...');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.screenshot({ 
      path: path.join(screenshotsDir, '04-desktop-view.png'),
      fullPage: true 
    });

    // 6. Try to interact with forms if they exist
    console.log('6. Checking for forms...');
    
    // Try to find and fill login form
    const emailInput = await page.$('#loginEmail');
    if (emailInput) {
      console.log('   - Found login form, filling it...');
      await page.fill('#loginEmail', 'demo@example.com');
      const passwordInput = await page.$('#loginPassword');
      if (passwordInput) {
        await page.fill('#loginPassword', 'DemoPassword123');
      }
      await page.screenshot({ 
        path: path.join(screenshotsDir, '05-login-filled.png'),
        fullPage: true 
      });
    }

    // 7. Mock logged-in state
    console.log('7. Mocking logged-in state...');
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
      localStorage.setItem('team', JSON.stringify({
        id: 'team-123',
        name: 'Demo Team'
      }));
      localStorage.setItem('user', JSON.stringify({
        id: 'user-123',
        name: 'John Doe'
      }));
    });
    
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '06-logged-in.png'),
      fullPage: true 
    });

    // 8. Check what elements are visible after login
    const mainApp = await page.$('#appScreen');
    if (mainApp) {
      console.log('   - Main application screen found');
    }
    
    const commandDeck = await page.$('#commandDeck');
    if (commandDeck) {
      console.log('   - Command deck found');
    }
    
    const workshop = await page.$('#workshop');
    if (workshop) {
      console.log('   - Workshop area found');
    }

    console.log('\n✅ Screenshots captured!');
    console.log(`📁 Location: ${screenshotsDir}`);
    
    // List generated files
    const files = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png'));
    console.log('\n📸 Generated files:');
    files.sort().forEach(file => {
      const stats = fs.statSync(path.join(screenshotsDir, file));
      const size = (stats.size / 1024).toFixed(1);
      console.log(`   - ${file} (${size} KB)`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

captureScreenshots().catch(console.error);