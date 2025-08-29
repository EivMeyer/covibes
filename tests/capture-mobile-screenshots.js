/**
 * Capture screenshots of the new mobile design
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

async function captureMobileScreenshots() {
  const screenshotsDir = path.join(__dirname, 'screenshots', 'mobile');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  // iPhone 14 Pro viewport
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  
  const page = await context.newPage();
  
  console.log('📱 Capturing Mobile Screenshots...\n');

  try {
    // 1. Mobile Login
    console.log('1. Mobile Login Screen');
    await page.goto('http://localhost:3001/mobile.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'mobile-01-login.png'),
      fullPage: false 
    });

    // 2. Mobile App - Agents Tab
    console.log('2. Mobile App - Agents Tab');
    await page.evaluate(() => showScreen('app'));
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'mobile-02-agents.png'),
      fullPage: false 
    });

    // 3. Mobile App - Chat Tab
    console.log('3. Mobile App - Chat Tab');
    await page.evaluate(() => {
      document.querySelectorAll('.tab-item')[1].click();
    });
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'mobile-03-chat.png'),
      fullPage: false 
    });

    // 4. Mobile App - Preview Tab
    console.log('4. Mobile App - Preview Tab');
    await page.evaluate(() => {
      document.querySelectorAll('.tab-item')[2].click();
    });
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'mobile-04-preview.png'),
      fullPage: false 
    });

    // 5. Different device sizes
    console.log('5. iPad Mini');
    await page.setViewportSize({ width: 744, height: 1133 });
    await page.goto('http://localhost:3001/mobile.html');
    await page.evaluate(() => showScreen('app'));
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'tablet-01-agents.png'),
      fullPage: false 
    });

    // 6. Android Phone (Pixel 7)
    console.log('6. Android Phone');
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto('http://localhost:3001/mobile.html');
    await page.evaluate(() => showScreen('app'));
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'android-01-agents.png'),
      fullPage: false 
    });

    // 7. Small Phone (iPhone SE)
    console.log('7. Small Phone');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:3001/mobile.html');
    await page.evaluate(() => showScreen('app'));
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'small-phone-01.png'),
      fullPage: false 
    });

    console.log('\n✅ Mobile screenshots captured successfully!');
    console.log(`📁 Location: ${screenshotsDir}`);
    
    // List files
    const files = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png'));
    console.log('\n📸 Generated screenshots:');
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

captureMobileScreenshots().catch(console.error);