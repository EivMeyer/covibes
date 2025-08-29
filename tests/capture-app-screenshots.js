/**
 * Capture screenshots of the actual CoVibe app
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

async function captureScreenshots() {
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
  
  console.log('📸 Capturing CoVibe App Screenshots...\n');

  try {
    // 1. Load the app HTML
    console.log('1. Loading CoVibe app...');
    await page.goto('http://localhost:3001/app.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // 2. Login Screen
    console.log('2. Capturing Login Screen...');
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'colabvibe-01-login.png'),
      fullPage: true 
    });

    // 3. Register Screen
    console.log('3. Capturing Register Screen...');
    await page.evaluate(() => showScreen('register'));
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'colabvibe-02-register.png'),
      fullPage: true 
    });

    // 4. Join Team Screen
    console.log('4. Capturing Join Team Screen...');
    await page.evaluate(() => showScreen('joinTeam'));
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'colabvibe-03-join-team.png'),
      fullPage: true 
    });

    // 5. Main App with Mock Data
    console.log('5. Setting up main app with mock data...');
    await page.evaluate(() => {
      // Mock authentication
      localStorage.setItem('token', 'mock-jwt-token');
      localStorage.setItem('team', JSON.stringify({
        id: 'team-123',
        name: 'Alpha Team',
        code: 'ALPHA1'
      }));
      localStorage.setItem('user', JSON.stringify({
        id: 'user-123',
        name: 'John Developer',
        email: 'john@example.com'
      }));
      
      // Show app screen
      showScreen('app');
      
      // Update UI with team info
      document.getElementById('teamName').textContent = 'Alpha Team';
      document.getElementById('teamCode').textContent = 'Code: ALPHA1';
      document.getElementById('userCount').textContent = '3 users online';
      
      // Add chat messages
      const chatMessages = document.getElementById('chatMessages');
      const messages = [
        { user: 'Sarah', text: 'Good morning team! Ready to ship v2.0 today?', time: '09:30' },
        { user: 'Mike', text: 'Absolutely! I\'m finishing the auth module now', time: '09:32' },
        { user: 'John', text: 'Great! I\'ll handle the database migrations', time: '09:33' },
        { user: 'System', text: '🤖 Agent-1 spawned: Building REST API endpoints', time: '09:35', system: true },
        { user: 'Sarah', text: 'Agent is already making progress on the API!', time: '09:36' },
        { user: 'Mike', text: 'Love how fast these agents work 🚀', time: '09:37' },
        { user: 'System', text: '✅ Agent-1 completed: 5 endpoints created', time: '09:40', system: true },
      ];
      
      chatMessages.innerHTML = messages.map(msg => `
        <div class="p-2 ${msg.system ? 'text-blue-400' : ''}">
          <span class="font-bold">${msg.user}</span>
          <span class="text-gray-500 text-xs ml-2">${msg.time}</span>
          <div class="mt-1">${msg.text}</div>
        </div>
      `).join('');
      
      // Add agents
      const agentList = document.getElementById('agentList');
      const agents = [
        { name: 'Agent-1', status: '🟢 Running', task: 'Building authentication system' },
        { name: 'Agent-2', status: '🟢 Running', task: 'Creating React components' },
        { name: 'Agent-3', status: '⚪ Idle', task: 'Waiting for next task' }
      ];
      
      agentList.innerHTML = agents.map(agent => `
        <div class="bg-gray-700 p-3 rounded cursor-pointer hover:bg-gray-600">
          <div class="flex justify-between">
            <span class="font-bold">${agent.name}</span>
            <span class="text-sm">${agent.status}</span>
          </div>
          <div class="text-xs text-gray-400 mt-1">${agent.task}</div>
        </div>
      `).join('');
      
      // Add agent output
      const agentOutput = document.getElementById('agentOutput');
      const output = [
        '$ npm install express bcrypt jsonwebtoken',
        '✓ Dependencies installed',
        '',
        '$ Creating authentication middleware...',
        '✓ auth.js created',
        '✓ JWT token generation implemented',
        '✓ Password hashing configured',
        '',
        '$ Running tests...',
        '✓ All 15 tests passing',
        '',
        '> Authentication system ready for deployment'
      ];
      
      agentOutput.innerHTML = output.map(line => 
        `<div class="text-green-400">${line || '&nbsp;'}</div>`
      ).join('');
      
      // Add preview content
      const previewFrame = document.getElementById('previewFrame');
      previewFrame.srcdoc = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              margin: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .login-form {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              width: 300px;
            }
            h2 { margin: 0 0 30px 0; color: #333; }
            input {
              width: 100%;
              padding: 10px;
              margin: 10px 0;
              border: 1px solid #ddd;
              border-radius: 5px;
              box-sizing: border-box;
            }
            button {
              width: 100%;
              padding: 12px;
              background: #667eea;
              color: white;
              border: none;
              border-radius: 5px;
              font-size: 16px;
              cursor: pointer;
              margin-top: 20px;
            }
            button:hover { background: #5a67d8; }
          </style>
        </head>
        <body>
          <div class="login-form">
            <h2>Live Preview</h2>
            <input type="email" placeholder="Email">
            <input type="password" placeholder="Password">
            <button>Sign In</button>
          </div>
        </body>
        </html>
      `;
    });
    
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'colabvibe-04-main-app.png'),
      fullPage: true 
    });

    // 6. VM Configuration Modal
    console.log('6. Capturing VM Configuration Modal...');
    await page.click('#configureVMBtn');
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'colabvibe-05-vm-config.png'),
      fullPage: true 
    });
    
    // Close modal by clicking outside or using escape
    await page.keyboard.press('Escape');

    // 7. Mobile Views
    console.log('7. Capturing Mobile Views...');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('http://localhost:3001/app.html');
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'colabvibe-06-mobile-login.png'),
      fullPage: true 
    });

    // Mobile main app
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
      showScreen('app');
    });
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'colabvibe-07-mobile-app.png'),
      fullPage: true 
    });

    // 8. Tablet View
    console.log('8. Capturing Tablet View...');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'colabvibe-08-tablet.png'),
      fullPage: true 
    });

    console.log('\n✅ Screenshots captured successfully!');
    console.log(`📁 Location: ${screenshotsDir}`);
    
    // List files
    const files = fs.readdirSync(screenshotsDir)
      .filter(f => f.startsWith('colabvibe-') && f.endsWith('.png'));
    
    console.log('\n📸 Generated screenshots:');
    files.sort().forEach(file => {
      const stats = fs.statSync(path.join(screenshotsDir, file));
      const size = (stats.size / 1024).toFixed(1);
      console.log(`   - ${file} (${size} KB)`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

captureScreenshots().catch(console.error);