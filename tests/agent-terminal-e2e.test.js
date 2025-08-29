import { test, expect } from '@playwright/test';

test.describe('Agent Terminal E2E Test', () => {
  let authToken;
  let teamId;
  let agentId;

  test.beforeAll(async ({ request }) => {
    // Register a test user
    const registerResponse = await request.post('http://localhost:3001/api/auth/register', {
      data: {
        userName: 'TerminalTest',
        email: `terminal-test-${Date.now()}@test.com`,
        password: 'TestPassword123!',
        teamName: 'Terminal Test Team'
      }
    });
    
    expect(registerResponse.ok()).toBeTruthy();
    const registerData = await registerResponse.json();
    authToken = registerData.token;
    teamId = registerData.team.id;
    
    console.log('✅ Test user registered:', {
      email: registerData.user.email,
      teamId: teamId
    });
  });

  test('should spawn agent and connect terminal to real EC2', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3002');
    
    // Store auth token in localStorage
    await page.evaluate((token) => {
      localStorage.setItem('authToken', token);
    }, authToken);
    
    // Reload to apply auth
    await page.reload();
    
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
    console.log('✅ Dashboard loaded');
    
    // Click on Agents tab
    await page.click('text=Agents');
    await page.waitForTimeout(1000);
    
    // Click spawn agent button
    const spawnButton = page.locator('button:has-text("Spawn Agent")').first();
    await spawnButton.waitFor({ state: 'visible' });
    await spawnButton.click();
    console.log('✅ Clicked spawn agent button');
    
    // Fill in agent details in modal
    await page.waitForSelector('[data-testid="spawn-agent-modal"]', { timeout: 5000 });
    
    // Select agent type
    await page.selectOption('select[name="agentType"]', 'general');
    
    // Enter task
    await page.fill('textarea[name="task"]', 'Test terminal connection to EC2');
    
    // Submit form
    await page.click('button:has-text("Spawn")');
    console.log('✅ Agent spawn form submitted');
    
    // Wait for agent to appear in the list
    await page.waitForSelector('.agent-card', { timeout: 10000 });
    
    // Get the agent ID from the page
    const agentCard = page.locator('.agent-card').first();
    const agentText = await agentCard.textContent();
    console.log('✅ Agent spawned:', agentText);
    
    // Click on the agent to open terminal
    await agentCard.click();
    console.log('✅ Clicked on agent card');
    
    // Wait for terminal modal to open
    await page.waitForSelector('[data-testid="agent-output-modal"]', { timeout: 5000 });
    console.log('✅ Agent modal opened');
    
    // Wait for terminal to connect
    await page.waitForSelector('.xterm-screen', { timeout: 15000 });
    console.log('✅ Terminal element found');
    
    // Check for terminal connection message or Claude prompt
    const terminalConnected = await page.waitForFunction(
      () => {
        const terminal = document.querySelector('.xterm-screen');
        if (!terminal) return false;
        const text = terminal.textContent || '';
        return text.includes('Terminal connected') || 
               text.includes('SSH terminal session established') ||
               text.includes('Claude') ||
               text.includes('ubuntu@');
      },
      { timeout: 20000 }
    );
    
    expect(terminalConnected).toBeTruthy();
    console.log('✅ Terminal connected to EC2!');
    
    // Check that we can see some terminal output
    const terminalContent = await page.evaluate(() => {
      const terminal = document.querySelector('.xterm-screen');
      return terminal ? terminal.textContent : '';
    });
    
    console.log('Terminal content preview:', terminalContent.substring(0, 200));
    
    // Verify it's a real SSH connection (should show ubuntu@ or Claude)
    expect(terminalContent).toMatch(/ubuntu@|Claude|Starting Claude/i);
    
    // Type a test command
    await page.keyboard.type('echo "Terminal test successful"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    
    // Check for echo response
    const echoResponse = await page.evaluate(() => {
      const terminal = document.querySelector('.xterm-screen');
      return terminal ? terminal.textContent : '';
    });
    
    expect(echoResponse).toContain('Terminal test successful');
    console.log('✅ Terminal input/output working!');
    
    // Close modal
    await page.click('[aria-label="Close modal"]');
    console.log('✅ Test completed successfully');
  });

  test('should verify WebSocket terminal events', async ({ page, request }) => {
    // This test verifies the WebSocket connection directly
    
    // First spawn an agent via API
    const spawnResponse = await request.post('http://localhost:3001/api/agents/spawn', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      data: {
        type: 'general',
        task: 'WebSocket terminal test'
      }
    });
    
    expect(spawnResponse.ok()).toBeTruthy();
    const agentData = await spawnResponse.json();
    agentId = agentData.id;
    console.log('✅ Agent spawned via API:', agentId);
    
    // Navigate to page and setup WebSocket listener
    await page.goto('http://localhost:3002');
    
    await page.evaluate((token) => {
      localStorage.setItem('authToken', token);
    }, authToken);
    
    await page.reload();
    
    // Listen for WebSocket events
    const terminalEvents = await page.evaluate((agentId) => {
      return new Promise((resolve) => {
        const events = [];
        
        // Connect to WebSocket
        const socket = window.socketService?.getSocket();
        if (!socket) {
          resolve({ error: 'No socket connection' });
          return;
        }
        
        // Listen for terminal events
        socket.on('terminal_connected', (data) => {
          events.push({ type: 'connected', data });
        });
        
        socket.on('terminal_output', (data) => {
          events.push({ type: 'output', data });
        });
        
        socket.on('terminal_error', (data) => {
          events.push({ type: 'error', data });
        });
        
        // Emit terminal connect
        socket.emit('terminal_connect', { agentId });
        
        // Wait for events
        setTimeout(() => {
          resolve(events);
        }, 5000);
      });
    }, agentId);
    
    console.log('WebSocket events received:', terminalEvents);
    
    // Verify we got terminal connection events
    const connectedEvent = terminalEvents.find(e => e.type === 'connected');
    expect(connectedEvent).toBeTruthy();
    console.log('✅ Terminal connected event received');
    
    const outputEvents = terminalEvents.filter(e => e.type === 'output');
    expect(outputEvents.length).toBeGreaterThan(0);
    console.log(`✅ Received ${outputEvents.length} output events`);
  });

  test.afterAll(async ({ request }) => {
    // Clean up: stop agent if it's still running
    if (agentId && authToken) {
      await request.post(`http://localhost:3001/api/agents/${agentId}/stop`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
    }
  });
});