/**
 * Screenshot capture script for CoVibe
 * Captures all major screens and UI states
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

async function captureScreenshots() {
  // Create screenshots directory
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  
  const page = await context.newPage();
  
  console.log('📸 Starting screenshot capture...\n');

  try {
    // 1. Login Screen
    console.log('Capturing: Login Screen');
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '01-login-screen.png'),
      fullPage: true 
    });

    // 2. Register Screen
    console.log('Capturing: Register Screen');
    await page.click('text=Create Team');
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '02-register-screen.png'),
      fullPage: true 
    });

    // Fill registration form
    await page.fill('#registerTeamName', 'Demo Team');
    await page.fill('#registerUserName', 'John Doe');
    await page.fill('#registerEmail', 'demo@example.com');
    await page.fill('#registerPassword', 'DemoPass123!');
    await page.screenshot({ 
      path: path.join(screenshotsDir, '03-register-filled.png'),
      fullPage: true 
    });

    // 3. Join Team Screen
    console.log('Capturing: Join Team Screen');
    await page.click('text=Join Existing Team');
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '04-join-team-screen.png'),
      fullPage: true 
    });

    // 4. Main Application (Mock logged in state)
    console.log('Capturing: Main Application');
    await page.evaluate(() => {
      // Mock authentication
      localStorage.setItem('token', 'mock-jwt-token');
      localStorage.setItem('team', JSON.stringify({
        id: 'team-123',
        name: 'Demo Team',
        code: 'DEMO123'
      }));
      localStorage.setItem('user', JSON.stringify({
        id: 'user-123',
        name: 'John Doe',
        email: 'demo@example.com'
      }));
    });
    
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(2000);
    
    // Add some mock data to make it look populated
    await page.evaluate(() => {
      // Add team info
      const teamName = document.querySelector('#teamName');
      if (teamName) teamName.textContent = 'Demo Team';
      
      const teamCode = document.querySelector('#teamCode');
      if (teamCode) teamCode.textContent = 'Code: DEMO123';
      
      const userCount = document.querySelector('#userCount');
      if (userCount) userCount.textContent = '3 users online';

      // Add some chat messages
      const chatMessages = document.querySelector('#chatMessages');
      if (chatMessages) {
        const messages = [
          { user: 'Alice', message: 'Hey team, starting work on the API endpoints', time: '10:30' },
          { user: 'Bob', message: 'Great! I\'ll handle the frontend components', time: '10:32' },
          { user: 'John', message: 'Perfect, I\'ll set up the database schema', time: '10:33' },
          { user: 'System', message: '🤖 Agent-1 spawned successfully', time: '10:35', system: true },
          { user: 'Alice', message: 'The authentication endpoint is ready for testing', time: '10:40' },
        ];
        
        chatMessages.innerHTML = messages.map(msg => `
          <div class="message mb-2 ${msg.system ? 'text-blue-400' : ''}">
            <span class="font-bold">${msg.user}</span>
            <span class="text-gray-500 text-sm ml-2">${msg.time}</span>
            <div class="mt-1">${msg.message}</div>
          </div>
        `).join('');
      }

      // Add some agents to the list
      const agentList = document.querySelector('#agentList');
      if (agentList) {
        const agents = [
          { name: 'Agent-1', status: 'Running', task: 'Building authentication system' },
          { name: 'Agent-2', status: 'Running', task: 'Creating React components' },
          { name: 'Agent-3', status: 'Idle', task: 'Waiting for task' }
        ];
        
        agentList.innerHTML = agents.map(agent => `
          <div class="agent-item bg-gray-800 p-3 rounded mb-2">
            <div class="flex justify-between items-center">
              <span class="font-bold">${agent.name}</span>
              <span class="text-sm ${agent.status === 'Running' ? 'text-green-400' : 'text-gray-400'}">
                ${agent.status}
              </span>
            </div>
            <div class="text-sm text-gray-400 mt-1">${agent.task}</div>
          </div>
        `).join('');
      }

      // Add some agent output
      const agentOutput = document.querySelector('#agentOutput');
      if (agentOutput) {
        const output = [
          '> Agent-1 starting task...',
          '> Installing dependencies: express, bcrypt, jsonwebtoken',
          '> Creating authentication middleware',
          '> Setting up JWT token generation',
          '✓ Authentication system implemented successfully',
          '',
          '> Agent-2 starting task...',
          '> Creating LoginForm component',
          '> Adding form validation',
          '> Implementing API integration',
          '✓ Login component ready'
        ];
        
        agentOutput.innerHTML = `
          <div class="font-mono text-sm text-green-400">
            ${output.map(line => `<div>${line || '&nbsp;'}</div>`).join('')}
          </div>
        `;
      }

      // Add preview content
      const previewFrame = document.querySelector('#previewFrame');
      if (previewFrame) {
        previewFrame.srcdoc = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .preview-content {
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                text-align: center;
              }
              h1 { color: #333; margin-bottom: 20px; }
              p { color: #666; }
            </style>
          </head>
          <body>
            <div class="preview-content">
              <h1>🚀 Live Preview</h1>
              <p>Your application will appear here</p>
              <p>Currently showing: Login Page</p>
            </div>
          </body>
          </html>
        `;
      }
    });

    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '05-main-application.png'),
      fullPage: true 
    });

    // 5. VM Configuration Modal
    console.log('Capturing: VM Configuration Modal');
    await page.click('#configureVMBtn');
    await page.waitForTimeout(500);
    
    // Fill VM form
    await page.fill('#vmHost', '192.168.1.100');
    await page.fill('#vmUser', 'ubuntu');
    await page.fill('#vmKeyPath', '~/.ssh/colabvibe-vm.pem');
    
    await page.screenshot({ 
      path: path.join(screenshotsDir, '06-vm-config-modal.png'),
      fullPage: true 
    });

    // 6. Mobile View
    console.log('Capturing: Mobile View');
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X size
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '07-mobile-login.png'),
      fullPage: true 
    });

    // Mobile main app
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
    });
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '08-mobile-app.png'),
      fullPage: true 
    });

    // 7. Tablet View
    console.log('Capturing: Tablet View');
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad size
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '09-tablet-view.png'),
      fullPage: true 
    });

    // 8. Dark Theme (if implemented)
    console.log('Capturing: Dark Theme');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://localhost:3001');
    await page.evaluate(() => {
      document.body.classList.add('dark');
    });
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '10-dark-theme.png'),
      fullPage: true 
    });

    console.log('\n✅ Screenshots captured successfully!');
    console.log(`📁 Saved to: ${screenshotsDir}`);
    
    // List all screenshots
    console.log('\n📸 Generated screenshots:');
    const files = fs.readdirSync(screenshotsDir);
    files.sort().forEach(file => {
      if (file.endsWith('.png')) {
        const stats = fs.statSync(path.join(screenshotsDir, file));
        const size = (stats.size / 1024).toFixed(1);
        console.log(`   - ${file} (${size} KB)`);
      }
    });

  } catch (error) {
    console.error('❌ Error capturing screenshots:', error.message);
  } finally {
    await browser.close();
  }
}

// Run the screenshot capture
captureScreenshots().catch(console.error);