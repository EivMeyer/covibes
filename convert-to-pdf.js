const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Set a wide viewport to ensure columns render side-by-side
  // This forces the responsive design to use desktop layout
  await page.setViewportSize({ width: 1440, height: 900 });
  
  // Load the HTML file
  const htmlPath = path.resolve(__dirname, 'pitch.html');
  const fileUrl = `file://${htmlPath}`;
  
  console.log('Loading HTML file with desktop viewport (1440px wide)...');
  await page.goto(fileUrl, { waitUntil: 'networkidle' });
  
  // Wait for charts to render
  await page.waitForTimeout(2000);
  
  // Add CSS to emulate print media
  await page.emulateMedia({ media: 'print' });
  
  // Generate PDF with settings optimized for preserving links
  console.log('Generating PDF...');
  const pdfPath = path.resolve(__dirname, 'ColabVibe_Pitch.pdf');
  
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    landscape: true, // Landscape orientation for better column layout
    printBackground: true,
    preferCSSPageSize: true, // Respect CSS page size settings
    scale: 0.9, // Slightly larger scale
    margin: {
      top: '15px',
      bottom: '15px',
      left: '20px',
      right: '20px'
    },
    // This ensures links remain clickable in the PDF
    displayHeaderFooter: false,
  });
  
  console.log(`PDF saved to: ${pdfPath}`);
  
  await browser.close();
  
  // Verify the PDF was created
  if (fs.existsSync(pdfPath)) {
    const stats = fs.statSync(pdfPath);
    console.log(`✓ PDF created successfully (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  } else {
    console.error('✗ PDF creation failed');
    process.exit(1);
  }
})().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});