/**
 * Main Server MIME Type Test
 *
 * Tests the main server proxy route (port 3001) that users actually access
 * This is different from the dedicated proxy (port 7174) and should be fixed now
 */

const { test, expect } = require('@playwright/test');

test.describe('Main Server MIME Type Verification', () => {
  test('verify main server proxy has correct MIME types', async ({ page, request }) => {
    console.log('🔍 Testing MAIN SERVER MIME type fix (port 3001)...');

    // Use the main server URL that users actually access
    const mainServerUrl = 'http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001/api/preview/proxy/demo-team-001/main/';

    console.log(`🌐 Testing main server URL: ${mainServerUrl}`);

    // Test specific problematic module URLs directly
    const problematicFiles = [
      '/@vite/client',           // Vite HMR client
      '/src/main.jsx',          // Entry point
      '/src/App.jsx',           // Main React component
      '/@react-refresh',        // React refresh
    ];

    console.log(`Testing ${problematicFiles.length} JS modules for correct MIME types...`);

    let allCorrect = true;
    const results = [];

    for (const filePath of problematicFiles) {
      const fullUrl = `http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001/api/preview/proxy/demo-team-001/main${filePath}`;

      try {
        console.log(`\n📡 Testing: ${filePath}`);

        const response = await request.get(fullUrl);
        const status = response.status();
        const contentType = response.headers()['content-type'] || '';

        console.log(`   Status: ${status}`);
        console.log(`   Content-Type: ${contentType}`);

        const hasCorrectMimeType = contentType.includes('javascript') || contentType.includes('application/javascript');

        if (status === 200 && hasCorrectMimeType) {
          console.log(`   ✅ CORRECT: JavaScript MIME type`);
          results.push({ file: filePath, status, contentType, correct: true });
        } else if (status === 200) {
          console.log(`   ❌ WRONG MIME TYPE: Expected javascript, got ${contentType}`);
          results.push({ file: filePath, status, contentType, correct: false });
          allCorrect = false;
        } else {
          console.log(`   ❌ HTTP ERROR: Status ${status}`);
          results.push({ file: filePath, status, contentType, correct: false });
          allCorrect = false;
        }

      } catch (error) {
        console.log(`   ❌ REQUEST FAILED: ${error.message}`);
        results.push({ file: filePath, status: 0, contentType: 'error', correct: false });
        allCorrect = false;
      }
    }

    // Summary
    console.log(`\n📊 MAIN SERVER MIME TYPE TEST RESULTS:`);
    console.log('=' * 40);

    const correctCount = results.filter(r => r.correct).length;
    console.log(`✅ Correct MIME types: ${correctCount}/${results.length}`);

    if (allCorrect) {
      console.log(`🎉 ALL JAVASCRIPT MODULES HAVE CORRECT MIME TYPES!`);
      console.log(`   Main server proxy (port 3001) is working correctly`);
    } else {
      console.log(`❌ SOME MODULES STILL HAVE WRONG MIME TYPES:`);
      results.filter(r => !r.correct).forEach(r => {
        console.log(`   - ${r.file}: ${r.contentType} (status: ${r.status})`);
      });
    }

    // Test assertions
    expect(allCorrect, 'All JavaScript modules should have correct MIME types').toBe(true);
    expect(correctCount, 'Number of correct MIME types').toBe(problematicFiles.length);
  });
});