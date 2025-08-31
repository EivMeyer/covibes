const { test, expect } = require('@playwright/test');

test('pitch deck loads and displays correctly', async ({ page }) => {
  console.log('🔍 Testing pitch deck...');
  
  // Navigate to pitch deck
  await page.goto('http://localhost:3001/pitch');
  
  // Wait for page to load
  await page.waitForTimeout(2000);
  
  // Take screenshot to debug
  await page.screenshot({ 
    path: 'tests/screenshots/pitch-debug.png', 
    fullPage: true 
  });
  
  // Check if Reveal.js loaded
  const revealLoaded = await page.evaluate(() => {
    return typeof window.Reveal !== 'undefined';
  });
  console.log('🔧 Reveal.js loaded:', revealLoaded);
  
  // Check slide content
  const slideInfo = await page.evaluate(() => {
    const slides = document.querySelectorAll('.reveal .slides section');
    const firstSlide = slides[0];
    
    return {
      slideCount: slides.length,
      firstSlideVisible: firstSlide ? window.getComputedStyle(firstSlide).display !== 'none' : false,
      firstSlideContent: firstSlide ? firstSlide.innerText.substring(0, 100) : 'No content',
      revealContainer: !!document.querySelector('.reveal'),
      slidesContainer: !!document.querySelector('.reveal .slides'),
      bodyStyles: {
        background: window.getComputedStyle(document.body).background,
        color: window.getComputedStyle(document.body).color
      }
    };
  });
  
  console.log('📊 Slide info:', JSON.stringify(slideInfo, null, 2));
  
  // Check if CSS loaded properly
  const cssStatus = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    return links.map(link => ({
      href: link.href,
      loaded: link.sheet !== null
    }));
  });
  
  console.log('🎨 CSS status:', JSON.stringify(cssStatus, null, 2));
  
  // Check console errors
  const consoleMessages = [];
  page.on('console', msg => consoleMessages.push(`${msg.type()}: ${msg.text()}`));
  
  await page.reload();
  await page.waitForTimeout(1000);
  
  console.log('🚨 Console messages:', consoleMessages);
});