/**
 * Pitch Deck Screenshot Generator
 * Creates 5 strategic, investor-ready screenshots for ColabVibe pitch deck
 */

const { chromium } = require('@playwright/test');
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
  await page.waitForSelector('text=Welcome back', { timeout: 10000 });
  
  // Click Create Team button
  await page.click('text=Create Team');
  await page.waitForTimeout(2000);
  
  // Fill registration form
  await page.fill('input[placeholder*="team"]', user.teamName);
  await page.fill('input[placeholder*="Your Name"]', user.name);
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[placeholder*="At least 6 characters"]', user.password);
  await page.fill('input[placeholder*="Repeat your password"]', user.password);
  
  // Submit registration
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  
  // Wait for dashboard to load
  await page.waitForSelector('text=Active Agents', { timeout: 15000 });
  await page.waitForSelector('text=Connected', { timeout: 10000 });
  console.log(`✅ ${user.name} registered successfully`);
}

// Helper function to spawn an agent
async function spawnAgent(page, task) {
  console.log(`🤖 Spawning agent with task: ${task.substring(0, 50)}...`);
  
  // Find and click spawn agent button
  const spawnButtonSelectors = [
    'text=New Agent',
    'button:has-text("Spawn")',
    'button:has-text("Add Agent")',
    '[data-testid="spawn-agent-button"]'
  ];
  
  let buttonClicked = false;
  for (const selector of spawnButtonSelectors) {
    try {
      const button = page.locator(selector);
      if (await button.isVisible({ timeout: 3000 })) {
        await button.click();
        buttonClicked = true;
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  if (!buttonClicked) {
    console.log('⚠️ Could not find spawn button, trying generic button search');
    await page.click('button >> text=/.*agent.*/i');
  }
  
  await page.waitForTimeout(2000);
  
  // Fill agent task
  const taskSelectors = [
    'textarea[name="task"]',
    'textarea[placeholder*="task"]',
    'textarea[placeholder*="What"]',
    'input[name="task"]',
    '[data-testid="agent-task-input"]'
  ];
  
  let taskFilled = false;
  for (const selector of taskSelectors) {
    try {
      const taskInput = page.locator(selector);
      if (await taskInput.isVisible({ timeout: 3000 })) {
        await taskInput.fill(task);
        taskFilled = true;
        console.log(`✅ Task filled using: ${selector}`);
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  if (!taskFilled) {
    console.log('⚠️ Could not find task input field');
    return false;
  }
  
  // Submit agent spawn
  const submitSelectors = [
    'button[type="submit"]',
    'text=Spawn',
    'text=Create',
    'text=Start',
    '[data-testid="spawn-confirm-button"]'
  ];
  
  for (const selector of submitSelectors) {
    try {
      const submitButton = page.locator(selector);
      if (await submitButton.isVisible({ timeout: 3000 })) {
        await submitButton.click();
        console.log(`✅ Agent spawned using: ${selector}`);
        await page.waitForTimeout(3000);
        return true;
      }
    } catch (e) {
      continue;
    }
  }
  
  return false;
}

// Helper function to send chat message
async function sendChatMessage(page, message) {
  const chatSelectors = [
    'input[placeholder*="message"]',
    'input[placeholder*="chat"]',
    'textarea[placeholder*="message"]',
    '[data-testid="chat-input"]'
  ];
  
  for (const selector of chatSelectors) {
    try {
      const chatInput = page.locator(selector);
      if (await chatInput.isVisible({ timeout: 3000 })) {
        await chatInput.fill(message);
        await chatInput.press('Enter');
        console.log(`💬 Chat message sent: ${message}`);
        await page.waitForTimeout(1000);
        return true;
      }
    } catch (e) {
      continue;
    }
  }
  
  console.log('⚠️ Could not find chat input');
  return false;
}

async function captureScreenshots() {
  console.log('🎯 Starting Pitch Deck Screenshot Capture...\n');
  
  const browser = await chromium.launch({ 
    headless: true, // Headless mode for server environment
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-web-security']
  });

  try {
    // ==================================================
    // 1. HERO DASHBOARD SCREENSHOT
    // ==================================================
    console.log('\n📸 1. Capturing Hero Dashboard Screenshot...');
    const page1 = await browser.newPage();
    await page1.setViewportSize(VIEWPORT);
    
    await registerUser(page1, TEST_USERS[0]);
    
    // Spawn multiple AI agents with different tasks
    const agentTasks = [
      'Create a modern React component library with TypeScript interfaces and comprehensive documentation',
      'Build a real-time WebSocket chat system with message persistence and user presence indicators',
      'Implement JWT authentication middleware with OAuth integration and role-based permissions'
    ];
    
    for (const task of agentTasks) {
      await spawnAgent(page1, task);
    }
    
    // Add some realistic chat messages
    const chatMessages = [
      'Alice: Starting work on the component library - focusing on reusable UI elements',
      'Alice: The authentication flow is looking good, JWT tokens are working perfectly',
      'Alice: Real-time features are responding well, WebSocket connections are stable'
    ];
    
    for (const message of chatMessages) {
      await sendChatMessage(page1, message);
    }
    
    // Wait for activity to settle
    await page1.waitForTimeout(5000);
    
    // Capture the hero dashboard screenshot
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
    await page2.setViewportSize(VIEWPORT);
    
    await registerUser(page2, TEST_USERS[1]);
    
    // Spawn agent with detailed coding task
    await spawnAgent(page2, 'Write a complete React component for user authentication with form validation, error handling, and TypeScript interfaces. Include comprehensive tests.');
    
    // Wait for agent output to appear
    await page2.waitForTimeout(8000);
    
    // Look for terminal or code output and scroll to it
    const outputSelectors = [
      '.xterm-viewport',
      '.monaco-editor',
      '[data-testid*="terminal"]',
      '[data-testid*="output"]',
      'pre:has-text("import")',
      'pre:has-text("function")',
      'div:has-text("interface")'
    ];
    
    for (const selector of outputSelectors) {
      try {
        const element = page2.locator(selector).first();
        if (await element.count() > 0) {
          await element.scrollIntoViewIfNeeded();
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
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
    const page3a = await browser.newPage();
    const page3b = await browser.newPage();
    await page3a.setViewportSize(VIEWPORT);
    await page3b.setViewportSize(VIEWPORT);
    
    // Register two users on the same team
    await registerUser(page3a, TEST_USERS[0]);
    
    // For second user, join existing team instead of creating new one
    await page3b.goto(BASE_URL);
    await page3b.waitForSelector('text=Welcome back', { timeout: 10000 });
    
    // Try to login or join existing team for second user
    try {
      // Try to fill login form if it exists
      await page3b.fill('input[type="email"]', TEST_USERS[1].email);
      await page3b.fill('input[type="password"]', TEST_USERS[1].password);
      await page3b.click('button[type="submit"]');
      await page3b.waitForTimeout(3000);
    } catch (e) {
      // If login doesn't work, create new user
      await registerUser(page3b, TEST_USERS[1]);
    }
    
    // Create collaborative activity
    await sendChatMessage(page3a, 'Alice: Working on the frontend components now');
    await sendChatMessage(page3b, 'Bob: I\'ll handle the backend API endpoints');
    
    await spawnAgent(page3a, 'Create responsive UI components with Tailwind CSS');
    await spawnAgent(page3b, 'Build RESTful API endpoints with Express and validation');
    
    await sendChatMessage(page3a, 'Alice: Frontend is looking great! Mobile responsive design is working perfectly');
    await sendChatMessage(page3b, 'Bob: API is solid - all endpoints tested and documented');
    
    await page3a.waitForTimeout(5000);
    
    // Capture from first user's perspective
    await page3a.screenshot({
      path: path.join(SCREENSHOT_PATH, 'realtime-collaboration.png'),
      fullPage: true
    });
    
    console.log('✅ Real-time Collaboration screenshot captured');
    await page3a.close();
    await page3b.close();

    // ==================================================
    // 4. MOBILE INTERFACE
    // ==================================================
    console.log('\n📱 4. Capturing Mobile Interface Screenshot...');
    const page4 = await browser.newPage();
    await page4.setViewportSize({ width: 375, height: 812 }); // iPhone X size
    
    await registerUser(page4, TEST_USERS[2]);
    
    await spawnAgent(page4, 'Build mobile-first responsive design system');
    await sendChatMessage(page4, 'Testing mobile interface - looks fantastic!');
    
    await page4.waitForTimeout(3000);
    
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
    await page5.setViewportSize(VIEWPORT);
    
    await registerUser(page5, TEST_USERS[0]);
    
    // Try to find and trigger preview functionality
    const previewSelectors = [
      'text=Preview',
      'text=Deploy',
      'button:has-text("Live")',
      '[data-testid*="preview"]'
    ];
    
    let previewTriggered = false;
    for (const selector of previewSelectors) {
      try {
        const previewButton = page5.locator(selector);
        if (await previewButton.isVisible({ timeout: 3000 })) {
          await previewButton.click();
          previewTriggered = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    // Spawn agent with preview-related task
    await spawnAgent(page5, 'Create a React application with live preview deployment and hot reload functionality');
    
    await page5.waitForTimeout(8000);
    
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