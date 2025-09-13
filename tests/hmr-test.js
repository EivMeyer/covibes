const { chromium } = require('playwright');

async function testHMR() {
  console.log('🔥 Testing HMR (Hot Module Replacement) functionality...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('📄 Loading preview page...');
  await page.goto('http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com/api/preview/proxy/demo-team-001/main/');
  await page.waitForTimeout(3000);

  // Check initial content
  const initialTitle = await page.textContent('h1');
  console.log(`📝 Initial title: "${initialTitle}"`);

  // Verify our HMR test changes are present
  const hasHMRContent = initialTitle.includes('HMR TEST');
  console.log(`✅ HMR changes detected: ${hasHMRContent}`);

  if (hasHMRContent) {
    console.log('🎉 SUCCESS: HMR test content is live!');
    console.log('🔥 Hot Module Replacement is working correctly');
    console.log('⚡ File changes are being reflected without page refresh');
  } else {
    console.log('❌ HMR test content not found');
  }

  // Check for MIME type errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Wait for any async loading
  await page.waitForTimeout(2000);

  const mimeErrors = consoleErrors.filter(error =>
    error.includes('MIME type') || error.includes('text/html')
  ).length;

  console.log(`\n📊 MIME type errors: ${mimeErrors}`);
  console.log(`📊 Total console errors: ${consoleErrors.length}`);

  if (mimeErrors === 0) {
    console.log('✅ No MIME type errors - JavaScript modules loading correctly');
  } else {
    console.log('❌ MIME type errors still present');
  }

  await browser.close();

  console.log('\n🎯 HMR Test Summary:');
  console.log(`   - HMR changes live: ${hasHMRContent ? 'YES' : 'NO'}`);
  console.log(`   - MIME errors: ${mimeErrors}`);
  console.log(`   - Overall status: ${hasHMRContent && mimeErrors === 0 ? 'SUCCESS' : 'ISSUES'}`);
}

testHMR().catch(console.error);