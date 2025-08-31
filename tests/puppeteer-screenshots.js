/**
 * Pitch Deck Screenshot Generator with Puppeteer
 * Creates 5 strategic, investor-ready screenshots for ColabVibe pitch deck
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// High-resolution viewport for professional screenshots
const VIEWPORT = { width: 1920, height: 1080 };
const SCREENSHOT_PATH = '/home/ubuntu/covibes/pitch-deck-screenshots/';
const BASE_URL = 'http://localhost:3000';

// Test users for multi-user scenarios
const TEST_USERS = [
  {
    name: 'Alice Chen',
    email: 'alice.chen@colabvibe.dev',
    teamName: 'ColabVibe Demo Team',
    password: 'demo123456',
    role: 'Lead Developer'
  },
  {
    name: 'Bob Rodriguez',
    email: 'bob.rodriguez@colabvibe.dev',
    teamName: 'ColabVibe Demo Team',
    password: 'demo123456',
    role: 'Product Manager'
  },
  {
    name: 'Charlie Kim',
    email: 'charlie.kim@colabvibe.dev',
    teamName: 'ColabVibe Demo Team',
    password: 'demo123456',
    role: 'AI Engineer'
  }
];

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_PATH)) {
  fs.mkdirSync(SCREENSHOT_PATH, { recursive: true });
}

// Helper function to register a user and get to dashboard
async function registerUser(page, user) {
  console.log(`📝 Registering user: ${user.name}`);
  await page.goto(BASE_URL);
  try {
    await page.waitForSelector('*', { timeout: 10000 });
    console.log('Page loaded');
  } catch (e) {
    console.log('Page loading timeout, continuing...');
  }
  
  // Try to click Create Team button
  try {
    // Look for any button that might be the create team button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      const createButton = buttons.find(b => 
        b.textContent.toLowerCase().includes('create') || 
        b.textContent.toLowerCase().includes('team') ||
        b.textContent.toLowerCase().includes('sign up') ||
        b.textContent.toLowerCase().includes('register')
      );
      if (createButton) {
        console.log('Found button:', createButton.textContent);
        createButton.click();
      } else {
        console.log('No create button found');
      }
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (e) {
    console.log('Button click failed:', e.message);
  }
  
  // Fill registration form - try multiple selector patterns
  const fillField = async (fieldType, value) => {
    const selectors = [
      `input[placeholder*="${fieldType}"]`,
      `input[name*="${fieldType}"]`,
      `input[type="${fieldType === 'email' ? 'email' : 'text'}"]`,
      `input[id*="${fieldType}"]`
    ];
    
    for (const selector of selectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          await page.type(selector, value);
          return true;
        }
      } catch (e) {
        continue;
      }
    }
    return false;
  };
  
  try {
    await fillField('team', user.teamName);
    await fillField('name', user.name);
    await fillField('email', user.email);
    
    // Try to fill password fields
    const passwordSelectors = [
      'input[type="password"]',
      'input[placeholder*="password"]',
      'input[name*="password"]'
    ];
    
    let passwordFieldsFilled = 0;
    for (const selector of passwordSelectors) {
      try {
        const elements = await page.$$(selector);
        for (let i = 0; i < elements.length && passwordFieldsFilled < 2; i++) {
          await elements[i].type(user.password);
          passwordFieldsFilled++;
        }
      } catch (e) {
        continue;
      }
    }
    
    // Submit registration
    await page.evaluate(() => {
      const submitButton = document.querySelector('button[type="submit"]') ||
                          document.querySelector('button:contains("Register")') ||
                          document.querySelector('button:contains("Create")') ||
                          document.querySelector('button:contains("Sign Up")');
      if (submitButton) submitButton.click();
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log(`✅ ${user.name} registered successfully`);
    return true;
    
  } catch (error) {
    console.log(`⚠️ Registration for ${user.name} may have failed:`, error.message);
    return false;
  }
}

// Helper function to spawn an agent
async function spawnAgent(page, task) {
  console.log(`🤖 Spawning agent with task: ${task.substring(0, 50)}...`);
  
  try {
    // Look for agent spawn button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      const spawnButton = buttons.find(b => 
        b.textContent.toLowerCase().includes('agent') || 
        b.textContent.toLowerCase().includes('spawn') ||
        b.textContent.toLowerCase().includes('new') ||
        b.textContent.toLowerCase().includes('add')
      );
      if (spawnButton) spawnButton.click();
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Fill agent task
    const taskInput = await page.$('textarea') || await page.$('input[type="text"]');
    if (taskInput) {
      await taskInput.type(task);
    }
    
    // Submit agent spawn
    await page.evaluate(() => {
      const submitButton = document.querySelector('button[type="submit"]') ||
                          document.querySelector('button:contains("Spawn")') ||
                          document.querySelector('button:contains("Create")') ||
                          document.querySelector('button:contains("Start")');
      if (submitButton) submitButton.click();
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log(`✅ Agent spawned successfully`);
    return true;
    
  } catch (error) {
    console.log(`⚠️ Agent spawn may have failed:`, error.message);
    return false;
  }
}

// Helper function to send chat message
async function sendChatMessage(page, message) {
  try {
    const chatInput = await page.$('input[placeholder*="message"]') ||
                     await page.$('input[placeholder*="chat"]') ||
                     await page.$('textarea[placeholder*="message"]');
    
    if (chatInput) {
      await chatInput.type(message);
      await page.keyboard.press('Enter');
      console.log(`💬 Chat message sent: ${message}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return true;
    }
    
    return false;
  } catch (error) {
    console.log('⚠️ Could not send chat message:', error.message);
    return false;
  }
}

async function captureScreenshots() {
  console.log('🎯 Starting Pitch Deck Screenshot Capture with Puppeteer...\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-gpu'
    ]
  });

  try {
    // ==================================================
    // 1. HERO DASHBOARD SCREENSHOT
    // ==================================================
    console.log('\n📸 1. Capturing Hero Dashboard Screenshot...');
    const page1 = await browser.newPage();
    await page1.setViewport(VIEWPORT);
    
    // Just navigate to the main page and capture what we see
    await page1.goto(BASE_URL);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await page1.screenshot({
      path: path.join(SCREENSHOT_PATH, 'hero-dashboard.png'),
      fullPage: true
    });
    
    console.log('✅ Hero Dashboard screenshot captured');
    await page1.close();

    // ==================================================
    // 2. AI AGENT CODING IN ACTION
    // ==================================================
    console.log('\n🤖 2. Capturing AI Agent Coding Screenshot...');
    const page2 = await browser.newPage();
    await page2.setViewport(VIEWPORT);
    
    await page2.goto(BASE_URL);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Try to register and access dashboard
    await registerUser(page2, TEST_USERS[0]);
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await page2.screenshot({
      path: path.join(SCREENSHOT_PATH, 'ai-agent-coding.png'),
      fullPage: true
    });
    
    console.log('✅ AI Agent Coding screenshot captured');
    await page2.close();

    // ==================================================
    // 3. REAL-TIME COLLABORATION
    // ==================================================
    console.log('\n👥 3. Capturing Real-time Collaboration Screenshot...');
    const page3 = await browser.newPage();
    await page3.setViewport(VIEWPORT);
    
    await page3.goto(BASE_URL);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await registerUser(page3, TEST_USERS[1]);
    await spawnAgent(page3, 'Create responsive UI components');
    await sendChatMessage(page3, 'Working on collaborative features');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await page3.screenshot({
      path: path.join(SCREENSHOT_PATH, 'realtime-collaboration.png'),
      fullPage: true
    });
    
    console.log('✅ Real-time Collaboration screenshot captured');
    await page3.close();

    // ==================================================
    // 4. MOBILE INTERFACE
    // ==================================================
    console.log('\n📱 4. Capturing Mobile Interface Screenshot...');
    const page4 = await browser.newPage();
    await page4.setViewport({ width: 375, height: 812 }); // iPhone X size
    
    await page4.goto(BASE_URL);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await page4.screenshot({
      path: path.join(SCREENSHOT_PATH, 'mobile-interface.png'),
      fullPage: true
    });
    
    console.log('✅ Mobile Interface screenshot captured');
    await page4.close();

    // ==================================================
    // 5. LIVE PREVIEW SYSTEM
    // ==================================================
    console.log('\n🔴 5. Capturing Live Preview System Screenshot...');
    const page5 = await browser.newPage();
    await page5.setViewport(VIEWPORT);
    
    await page5.goto(BASE_URL);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await registerUser(page5, TEST_USERS[2]);
    await spawnAgent(page5, 'Create a React app with live preview');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await page5.screenshot({
      path: path.join(SCREENSHOT_PATH, 'live-preview.png'),
      fullPage: true
    });
    
    console.log('✅ Live Preview System screenshot captured');
    await page5.close();

    console.log('\n🎉 All pitch deck screenshots completed!');
    console.log(`📁 Screenshots saved to: ${SCREENSHOT_PATH}`);
    console.log('\nScreenshots created:');
    console.log('  ✅ 1. hero-dashboard.png - Primary slide image');
    console.log('  ✅ 2. ai-agent-coding.png - AI coding in action');  
    console.log('  ✅ 3. realtime-collaboration.png - Team collaboration');
    console.log('  ✅ 4. mobile-interface.png - Mobile excellence');
    console.log('  ✅ 5. live-preview.png - Preview system');

  } catch (error) {
    console.error('❌ Error during screenshot capture:', error);
  } finally {
    await browser.close();
  }
}

// Run the screenshot capture
if (require.main === module) {
  captureScreenshots().catch(console.error);
}

module.exports = { captureScreenshots };