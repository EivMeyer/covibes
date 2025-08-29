/**
 * Create an interactive demo video of CoVibe mobile interface
 * This script simulates realistic user interactions and records them
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

async function createMobileDemo() {
  const videosDir = path.join(__dirname, 'videos');
  if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
  }

  console.log('🎬 Starting CoVibe Mobile Demo Recording...\n');

  const browser = await chromium.launch({ 
    headless: false, // Show browser for better recording
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  // iPhone 14 Pro viewport
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    recordVideo: {
      dir: videosDir,
      size: { width: 393, height: 852 }
    }
  });
  
  const page = await context.newPage();

  try {
    console.log('📱 Scene 1: Login Screen');
    await page.goto('http://localhost:3001/mobile.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Type email with realistic typing speed
    console.log('   - Typing email...');
    await page.click('#loginEmail');
    await page.type('#loginEmail', 'sarah@colabvibe.io', { delay: 100 });
    await page.waitForTimeout(500);

    // Type password
    console.log('   - Typing password...');
    await page.click('#loginPassword');
    await page.type('#loginPassword', '••••••••', { delay: 100 });
    await page.waitForTimeout(500);

    // Click sign in
    console.log('   - Signing in...');
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(1500);

    console.log('\n📱 Scene 2: Agents Tab');
    // The app should now be showing with agents tab active
    await page.waitForTimeout(2000);

    // Scroll through agents
    console.log('   - Scrolling through agents...');
    await page.evaluate(() => {
      const container = document.querySelector('.tab-content.active');
      if (container) {
        container.scrollTo({ top: 200, behavior: 'smooth' });
      }
    });
    await page.waitForTimeout(1500);

    // Click on Agent-1 to show it's interactive
    console.log('   - Clicking on Agent-1...');
    await page.click('.agent-card:first-child');
    await page.waitForTimeout(1000);

    // Click the floating action button
    console.log('   - Clicking spawn agent button...');
    await page.click('.floating-button');
    await page.waitForTimeout(1500);

    console.log('\n📱 Scene 3: Chat Tab');
    // Switch to chat tab
    console.log('   - Switching to Chat tab...');
    await page.click('.tab-item:nth-child(2)');
    await page.waitForTimeout(1500);

    // Scroll through messages
    console.log('   - Reading chat messages...');
    await page.evaluate(() => {
      const chat = document.querySelector('#chat-tab .flex-1');
      if (chat) {
        chat.scrollTo({ top: 100, behavior: 'smooth' });
      }
    });
    await page.waitForTimeout(1500);

    // Type a message
    console.log('   - Typing a message...');
    const chatInput = await page.$('#chat-tab input[type="text"]');
    if (chatInput) {
      await chatInput.click();
      await page.type('#chat-tab input[type="text"]', 'Agents are doing great! 🚀', { delay: 80 });
      await page.waitForTimeout(1000);
      
      // Send message
      console.log('   - Sending message...');
      await page.click('#chat-tab button:has-text("Send")');
      await page.waitForTimeout(1500);
    }

    console.log('\n📱 Scene 4: Preview Tab');
    // Switch to preview tab
    console.log('   - Switching to Preview tab...');
    await page.click('.tab-item:nth-child(3)');
    await page.waitForTimeout(2000);

    // Interact with the preview
    console.log('   - Interacting with live preview...');
    const frame = page.frameLocator('#previewFrame');
    if (frame) {
      try {
        await frame.locator('input[type="email"]').click();
        await frame.locator('input[type="email"]').type('user@example.com', { delay: 100 });
        await page.waitForTimeout(1000);
      } catch (e) {
        console.log('   - Preview interaction skipped');
      }
    }

    console.log('\n📱 Scene 5: Quick Tab Navigation');
    // Quick navigation between tabs to show smooth transitions
    console.log('   - Quick tab switching demo...');
    
    await page.click('.tab-item:nth-child(1)'); // Agents
    await page.waitForTimeout(800);
    
    await page.click('.tab-item:nth-child(2)'); // Chat
    await page.waitForTimeout(800);
    
    await page.click('.tab-item:nth-child(3)'); // Preview
    await page.waitForTimeout(800);
    
    await page.click('.tab-item:nth-child(1)'); // Back to Agents
    await page.waitForTimeout(1500);

    console.log('\n📱 Scene 6: Agent Output Animation');
    // Add some dynamic content to show real-time updates
    console.log('   - Simulating real-time agent output...');
    await page.evaluate(() => {
      const agent1 = document.querySelector('.agent-card:first-child');
      if (agent1) {
        const outputArea = agent1.querySelector('.mt-3');
        if (outputArea) {
          // Add new output line with animation
          const newLine = document.createElement('div');
          newLine.className = 'output-line text-green-400';
          newLine.textContent = '✓ Authentication complete!';
          newLine.style.opacity = '0';
          outputArea.appendChild(newLine);
          
          // Animate in
          setTimeout(() => {
            newLine.style.transition = 'opacity 0.5s';
            newLine.style.opacity = '1';
          }, 100);
        }
      }
    });
    await page.waitForTimeout(2000);

    console.log('\n✅ Demo recording complete!');

  } catch (error) {
    console.error('❌ Error during recording:', error.message);
  } finally {
    // Close context to save video
    await context.close();
    await browser.close();

    // Find and rename the video file
    console.log('\n📹 Processing video...');
    const files = fs.readdirSync(videosDir);
    const videoFile = files.find(f => f.endsWith('.webm'));
    
    if (videoFile) {
      const oldPath = path.join(videosDir, videoFile);
      const newPath = path.join(videosDir, 'colabvibe-mobile-demo.webm');
      fs.renameSync(oldPath, newPath);
      
      const stats = fs.statSync(newPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      console.log(`✅ Video saved: ${newPath}`);
      console.log(`📊 File size: ${sizeMB} MB`);
      console.log('\n🎯 Next steps:');
      console.log('1. Convert to MP4: ffmpeg -i colabvibe-mobile-demo.webm -c:v libx264 -preset fast -crf 22 colabvibe-mobile-demo.mp4');
      console.log('2. Create GIF: ffmpeg -i colabvibe-mobile-demo.webm -vf "fps=10,scale=393:-1" -loop 0 colabvibe-mobile-demo.gif');
    } else {
      console.log('⚠️  Video file not found. Make sure recording completed properly.');
    }
  }
}

// Run the demo
createMobileDemo().catch(console.error);