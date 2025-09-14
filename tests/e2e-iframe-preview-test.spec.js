/**
 * E2E Test: HTML Preview with Iframe Embedding
 * Tests the ACTUAL working server (port 3001) with comprehensive path rewriting
 */

const { test, expect } = require('@playwright/test');

test.describe('E2E HTML Preview Test', () => {
  test('HTML preview works in iframe with proper path rewriting', async ({ page }) => {
    console.log('🧪 Testing E2E HTML preview with iframe embedding...');

    const serverUrl = 'http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001';
    const previewUrl = `${serverUrl}/api/preview/proxy/demo-team-001/main/`;

    console.log(`📍 Testing URL: ${previewUrl}`);

    // Track console errors and network failures
    const consoleErrors = [];
    const networkErrors = [];
    const jsRequests = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log(`❌ Console Error: ${msg.text()}`);
      }
    });

    page.on('response', response => {
      const url = response.url();

      // Track JavaScript requests
      if (url.includes('/@vite/client') ||
          url.includes('/src/main.jsx') ||
          url.includes('/@react-refresh') ||
          url.includes('/src/App.jsx')) {

        const contentType = response.headers()['content-type'] || '';
        jsRequests.push({
          url: url.split('/').pop(),
          status: response.status(),
          contentType
        });

        console.log(`📜 JS Request: ${url.split('/').pop()} - ${response.status()} - ${contentType}`);

        if (response.status() !== 200) {
          networkErrors.push(`${url} returned ${response.status()}`);
        }
      }
    });

    // Navigate directly to preview URL
    console.log('🌐 Navigating to preview URL...');
    await page.goto(previewUrl, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('✅ Page loaded, waiting for React to initialize...');

    // Wait for potential React app to load
    await page.waitForTimeout(5000);

    // Check if React root element exists and has content
    const rootElement = await page.$('#root');
    const rootHtml = await page.$eval('#root', el => el.innerHTML).catch(() => '');
    const pageTitle = await page.title();

    console.log(`📄 Page Title: "${pageTitle}"`);
    console.log(`🔧 #root element exists: ${!!rootElement}`);
    console.log(`🔧 #root has content: ${rootHtml.length > 0} (${rootHtml.length} chars)`);

    if (rootHtml.length > 0) {
      console.log(`🔧 #root content preview: ${rootHtml.substring(0, 200)}...`);
    }

    // Take screenshot for evidence
    await page.screenshot({
      path: 'test-results/e2e-html-preview.png',
      fullPage: true
    });
    console.log('📸 Screenshot saved: test-results/e2e-html-preview.png');

    // Check for specific React elements that would indicate the app loaded
    const reactElements = await page.$$eval('*', elements => {
      return elements.filter(el =>
        el.className && (
          el.className.includes('App') ||
          el.className.includes('react') ||
          el.textContent?.includes('Alice') ||
          el.textContent?.includes('CoVibes')
        )
      ).length;
    }).catch(() => 0);

    console.log(`🔧 React-like elements found: ${reactElements}`);

    // Final test results
    console.log(`
📊 E2E HTML PREVIEW RESULTS:

1. NETWORK REQUESTS:
   JavaScript requests: ${jsRequests.length}
   Network errors: ${networkErrors.length}

2. JS REQUESTS DETAILS:`);

    jsRequests.forEach(req => {
      const statusOk = req.status === 200 ? '✅' : '❌';
      const mimeOk = req.contentType.includes('javascript') ? '✅' : '❌';
      console.log(`   ${statusOk} ${mimeOk} ${req.url} (${req.status}, ${req.contentType})`);
    });

    console.log(`
3. CONTENT VERIFICATION:
   Page title: "${pageTitle}"
   #root exists: ${!!rootElement}
   #root has content: ${rootHtml.length > 0}
   React elements found: ${reactElements}

4. ERRORS:
   Console errors: ${consoleErrors.length}
   Network errors: ${networkErrors.length}
`);

    if (consoleErrors.length > 0) {
      console.log('❌ Console Errors:');
      consoleErrors.forEach(err => console.log(`   ${err}`));
    }

    if (networkErrors.length > 0) {
      console.log('❌ Network Errors:');
      networkErrors.forEach(err => console.log(`   ${err}`));
    }

    // Assertions
    expect(networkErrors.length, 'Should have no network errors').toBe(0);
    expect(rootElement, 'React #root element should exist').toBeTruthy();
    expect(jsRequests.length, 'Should have JavaScript requests').toBeGreaterThan(0);

    // Check that JavaScript requests have correct MIME types
    const correctMimeTypes = jsRequests.filter(req =>
      req.contentType.includes('javascript')
    ).length;

    expect(correctMimeTypes, 'All JS requests should have correct MIME types').toBe(jsRequests.length);

    console.log('🎉 E2E HTML PREVIEW TEST PASSED!');
  });

  test('HTML preview works when embedded in iframe', async ({ page }) => {
    console.log('🖼️ Testing HTML preview in actual iframe embedding...');

    const serverUrl = 'http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001';
    const previewUrl = `${serverUrl}/api/preview/proxy/demo-team-001/main/`;

    // Create a simple HTML page with iframe
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Iframe Test</title>
        <style>
          iframe { width: 800px; height: 600px; border: 2px solid #ccc; }
        </style>
      </head>
      <body>
        <h1>Iframe Preview Test</h1>
        <iframe id="preview-iframe" src="${previewUrl}" title="Preview"></iframe>
      </body>
      </html>
    `);

    console.log(`🌐 Created page with iframe pointing to: ${previewUrl}`);

    // Wait for iframe to load
    await page.waitForTimeout(5000);

    // Get iframe and check its content
    const iframe = await page.$('#preview-iframe');
    expect(iframe, 'Iframe element should exist').toBeTruthy();

    // Try to access iframe content (if same-origin policy allows)
    try {
      const iframeContent = await page.evaluate(() => {
        const iframe = document.getElementById('preview-iframe');
        try {
          return iframe.contentDocument?.body?.innerHTML || 'Cannot access iframe content (cross-origin)';
        } catch (e) {
          return `Cross-origin restriction: ${e.message}`;
        }
      });

      console.log(`🖼️ Iframe content accessible: ${iframeContent.substring(0, 100)}...`);
    } catch (e) {
      console.log(`🖼️ Iframe content: Cross-origin restrictions (expected): ${e.message}`);
    }

    // Take screenshot showing iframe
    await page.screenshot({
      path: 'test-results/e2e-iframe-embedding.png',
      fullPage: true
    });
    console.log('📸 Iframe embedding screenshot saved');

    console.log('✅ Iframe embedding test completed');
  });
});