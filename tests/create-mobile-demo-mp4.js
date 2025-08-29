/**
 * Create a polished demo video of CoVibe mobile interface
 * Outputs as MP4 format
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function createMobileDemo() {
  const videosDir = path.join(__dirname, 'videos');
  if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
  }

  console.log('🎬 CoVibe Mobile Demo - Recording Started\n');
  console.log('📱 Device: iPhone 14 Pro (393x852)');
  console.log('🎯 Format: MP4 (H.264)\n');

  const browser = await chromium.launch({ 
    headless: true, // Headless for cleaner recording
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3, // High quality
    isMobile: true,
    hasTouch: true,
    recordVideo: {
      dir: videosDir,
      size: { width: 393, height: 852 }
    }
  });
  
  const page = await context.newPage();

  try {
    // === SCENE 1: App Launch ===
    console.log('🎬 Scene 1: App Launch');
    await page.goto('http://localhost:3001/mobile.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // Show splash/login

    // === SCENE 2: Login Animation ===
    console.log('🎬 Scene 2: Login Process');
    
    // Click email field and type with realistic speed
    await page.click('#loginEmail');
    await page.waitForTimeout(500);
    await page.type('#loginEmail', 'sarah@alpha.team', { delay: 80 });
    await page.waitForTimeout(700);
    
    // Tab to password and type
    await page.click('#loginPassword');
    await page.waitForTimeout(500);
    await page.type('#loginPassword', 'SecurePass123', { delay: 80 });
    await page.waitForTimeout(700);
    
    // Sign in with button press animation
    console.log('   ✓ Authenticating...');
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(1500);

    // === SCENE 3: Agents Dashboard ===
    console.log('🎬 Scene 3: Agents Dashboard');
    await page.waitForTimeout(1500);
    
    // Smooth scroll through agents
    await page.evaluate(() => {
      const container = document.querySelector('.tab-content.active .flex-1');
      if (container) {
        container.scrollTo({ top: 100, behavior: 'smooth' });
      }
    });
    await page.waitForTimeout(1000);
    
    // Tap on Agent-1 to show interaction
    await page.click('.agent-card:first-child');
    await page.waitForTimeout(800);
    
    // Show floating action button press
    await page.click('.floating-button');
    await page.waitForTimeout(1000);

    // === SCENE 4: Team Chat ===
    console.log('🎬 Scene 4: Team Chat');
    await page.click('.tab-item:nth-child(2)');
    await page.waitForTimeout(1000);
    
    // Scroll to see chat history
    await page.evaluate(() => {
      const chat = document.querySelector('#chat-tab .flex-1');
      if (chat) {
        chat.scrollTo({ top: 50, behavior: 'smooth' });
      }
    });
    await page.waitForTimeout(1000);
    
    // Type and send a message
    console.log('   ✓ Sending message...');
    await page.click('#chatInput');
    await page.waitForTimeout(300);
    
    const message1 = "Great work on the auth module! 🎉";
    await page.type('#chatInput', message1, { delay: 60 });
    await page.waitForTimeout(500);
    
    // Send with button
    await page.click('button:has(i.fa-paper-plane)');
    await page.waitForTimeout(1000);
    
    // Type another message mentioning agents
    console.log('   ✓ Agent interaction...');
    await page.type('#chatInput', 'How are the agents doing?', { delay: 60 });
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2500); // Wait for agent response

    // === SCENE 5: Live Preview ===
    console.log('🎬 Scene 5: Live Preview');
    await page.click('.tab-item:nth-child(3)');
    await page.waitForTimeout(2000);
    
    // Try to interact with preview
    const frame = page.frameLocator('#previewFrame');
    try {
      await frame.locator('input[type="email"]').click();
      await page.waitForTimeout(500);
      await frame.locator('input[type="email"]').type('demo@user.com', { delay: 70 });
      await page.waitForTimeout(1000);
    } catch (e) {
      // Preview interaction might not work, continue
    }

    // === SCENE 6: Quick Tab Tour ===
    console.log('🎬 Scene 6: Navigation Demo');
    
    // Quick swipe through all tabs
    await page.click('.tab-item:nth-child(1)'); // Agents
    await page.waitForTimeout(600);
    
    await page.click('.tab-item:nth-child(2)'); // Chat
    await page.waitForTimeout(600);
    
    await page.click('.tab-item:nth-child(3)'); // Preview
    await page.waitForTimeout(600);
    
    // Back to agents for ending
    await page.click('.tab-item:nth-child(1)');
    await page.waitForTimeout(1000);
    
    // === SCENE 7: Live Updates ===
    console.log('🎬 Scene 7: Real-time Updates');
    
    // Simulate live agent output update
    await page.evaluate(() => {
      const agent2 = document.querySelectorAll('.agent-card')[1];
      if (agent2) {
        const statusBadge = agent2.querySelector('.status-badge');
        if (statusBadge) {
          statusBadge.textContent = 'COMPLETED';
          statusBadge.className = 'status-badge status-running';
        }
        
        // Add completion message
        const outputArea = agent2.querySelector('.mt-3');
        if (outputArea) {
          const newLine = document.createElement('div');
          newLine.className = 'output-line text-green-400';
          newLine.textContent = '✓ All components built!';
          newLine.style.opacity = '0';
          outputArea.appendChild(newLine);
          
          setTimeout(() => {
            newLine.style.transition = 'opacity 0.5s';
            newLine.style.opacity = '1';
          }, 100);
        }
      }
    });
    await page.waitForTimeout(2000);

    // === END SCENE ===
    console.log('🎬 End Scene: Fade Out');
    await page.evaluate(() => {
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.right = '0';
      overlay.style.bottom = '0';
      overlay.style.background = 'black';
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 1s';
      overlay.style.zIndex = '9999';
      document.body.appendChild(overlay);
      setTimeout(() => { overlay.style.opacity = '1'; }, 100);
    });
    await page.waitForTimeout(1500);

    console.log('\n✅ Recording complete!');

  } catch (error) {
    console.error('❌ Error during recording:', error.message);
  } finally {
    // Close context to save video
    await context.close();
    await browser.close();

    // Convert to MP4
    console.log('\n🎥 Converting to MP4...');
    const files = fs.readdirSync(videosDir);
    const webmFile = files.find(f => f.endsWith('.webm'));
    
    if (webmFile) {
      const webmPath = path.join(videosDir, webmFile);
      const mp4Path = path.join(videosDir, 'colabvibe-mobile-demo.mp4');
      const gifPath = path.join(videosDir, 'colabvibe-mobile-demo.gif');
      
      try {
        // Convert to MP4 with good quality
        console.log('   Converting WebM to MP4...');
        await execPromise(
          `ffmpeg -i "${webmPath}" -c:v libx264 -preset slow -crf 22 -c:a aac -b:a 128k -movflags +faststart "${mp4Path}" -y`
        );
        
        // Get file sizes
        const webmStats = fs.statSync(webmPath);
        const mp4Stats = fs.statSync(mp4Path);
        
        console.log('\n📊 Output Files:');
        console.log(`   ✓ WebM: ${(webmStats.size / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`   ✓ MP4:  ${(mp4Stats.size / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`\n✅ Video saved as: ${mp4Path}`);
        
        // Optional: Create GIF for README
        console.log('\n🎨 Creating GIF preview...');
        try {
          await execPromise(
            `ffmpeg -i "${mp4Path}" -vf "fps=15,scale=393:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 "${gifPath}" -y`
          );
          const gifStats = fs.statSync(gifPath);
          console.log(`   ✓ GIF:  ${(gifStats.size / (1024 * 1024)).toFixed(2)} MB`);
        } catch (gifError) {
          console.log('   ⚠️  GIF creation failed (optional)');
        }
        
        // Clean up WebM
        fs.unlinkSync(webmPath);
        console.log('\n🎬 Demo video creation complete!');
        console.log(`📍 Location: ${mp4Path}`);
        
      } catch (ffmpegError) {
        console.error('❌ FFmpeg conversion failed:', ffmpegError.message);
        console.log('\n💡 To convert manually:');
        console.log(`   ffmpeg -i "${webmPath}" -c:v libx264 -preset slow -crf 22 "${mp4Path}"`);
      }
    } else {
      console.log('⚠️  Video file not found');
    }
  }
}

// Run the demo
createMobileDemo().catch(console.error);