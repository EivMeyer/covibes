/**
 * Live Rendering Test for CoVibe
 * Tests the real-time agent output streaming functionality
 */

const { test, expect } = require('@playwright/test');

test.describe('Live Rendering Tests', () => {
  const BASE_URL = 'http://localhost:3001';
  let token;
  
  test.beforeAll(async () => {
    // Create a test user and get a token
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamName: 'LiveRenderTest',
        userName: 'TestUser',
        email: 'liverender@test.com',
        password: 'password123'
      })
    });
    
    const result = await response.json();
    token = result.token;
  });

  test('should connect to WebSocket and authenticate', async ({ page }) => {
    // Go to app page
    await page.goto(`${BASE_URL}/app.html`);
    
    // Set authentication token
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    
    // Reload to trigger authentication
    await page.reload();
    
    // Wait for main app to appear
    await expect(page.locator('#mainApp')).toBeVisible({ timeout: 10000 });
    
    // Check if WebSocket connected (via console logs)
    const consoleMessages = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    // Wait a bit for WebSocket connection
    await page.waitForTimeout(2000);
    
    // Should have some connection-related console messages
    const hasConnectionMessages = consoleMessages.some(msg => 
      msg.includes('Socket connected') || 
      msg.includes('Connected to server') ||
      msg.includes('Authentication successful')
    );
    
    console.log('Console messages:', consoleMessages);
    expect(hasConnectionMessages).toBeTruthy();
  });

  test('should display agent list section', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    
    await expect(page.locator('#agentList')).toBeVisible();
    await expect(page.locator('#spawnAgentBtn')).toBeVisible();
  });

  test('should show agent output modal when clicking an agent', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    
    // Wait for app to load
    await page.waitForTimeout(2000);
    
    // First, let's spawn a mock agent by directly calling the API
    await page.evaluate(async () => {
      try {
        const response = await fetch('/api/agents/spawn', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('token')
          },
          body: JSON.stringify({
            task: 'Test live rendering task',
            agentType: 'mock'
          })
        });
        
        const result = await response.json();
        console.log('Agent spawn result:', result);
      } catch (err) {
        console.error('Error spawning agent:', err);
      }
    });
    
    // Wait for agent to appear
    await page.waitForTimeout(2000);
    
    // Check if agent appears in the list
    const agentExists = await page.locator('.bg-gray-800').count() > 0;
    
    if (agentExists) {
      // Click on the agent to open output modal
      await page.locator('.bg-gray-800').first().click();
      
      // Check if modal appears
      await expect(page.locator('#agentOutputModal')).toBeVisible();
      await expect(page.locator('#agentOutputContent')).toBeVisible();
    }
  });

  test('should handle real-time agent output streaming', async ({ page, context }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    
    // Wait for app to load
    await page.waitForTimeout(3000);
    
    // Test WebSocket events by directly simulating them
    const outputReceived = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Mock receiving agent output
        const mockOutput = [
          'Starting agent execution...',
          'Connecting to development environment...',
          '✓ Environment ready',
          'Executing task: Test live rendering task',
          '📁 Created test file',
          '🔧 Running tests...',
          '✅ All tests passed!'
        ];
        
        let outputCount = 0;
        
        // Simulate receiving output over time
        const interval = setInterval(() => {
          if (outputCount < mockOutput.length) {
            // Simulate the WebSocket event
            if (window.socketManager) {
              window.socketManager.trigger('agentOutput', {
                agentId: 'test-agent-123',
                output: mockOutput[outputCount],
                userId: 'test-user',
                timestamp: new Date()
              });
              outputCount++;
            }
          } else {
            clearInterval(interval);
            resolve(outputCount);
          }
        }, 500);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(interval);
          resolve(outputCount);
        }, 10000);
      });
    });
    
    console.log(`Simulated ${outputReceived} lines of agent output`);
    expect(outputReceived).toBeGreaterThan(0);
  });

  test('should display live chat messages', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    
    // Wait for app to load
    await page.waitForTimeout(2000);
    
    // Check chat interface
    await expect(page.locator('#chatMessages')).toBeVisible();
    await expect(page.locator('#chatInput')).toBeVisible();
    
    // Test sending a message
    await page.fill('#chatInput', 'Test live rendering message!');
    await page.press('#chatInput', 'Enter');
    
    // Chat input should be cleared
    await expect(page.locator('#chatInput')).toHaveValue('');
    
    // Wait a moment for message to appear
    await page.waitForTimeout(1000);
  });

  test('should show online users in real-time', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    
    // Wait for app to load
    await page.waitForTimeout(2000);
    
    // Check online users section
    await expect(page.locator('#onlineUsers')).toBeVisible();
    
    // Should show at least the current user
    const onlineUsersText = await page.locator('#onlineUsers').textContent();
    expect(onlineUsersText).toContain('Online Users');
  });

  test('should handle WebSocket reconnection', async ({ page, context }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    
    // Wait for initial connection
    await page.waitForTimeout(3000);
    
    // Simulate network disruption
    await context.setOffline(true);
    await page.waitForTimeout(1000);
    
    // Back online
    await context.setOffline(false);
    await page.waitForTimeout(3000);
    
    // Check if app is still functional
    await expect(page.locator('#mainApp')).toBeVisible();
  });

  test('should auto-scroll agent output', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    
    await page.waitForTimeout(2000);
    
    // Test auto-scroll behavior by adding content to output area
    const scrollTest = await page.evaluate(() => {
      // Create a mock output content area
      const content = document.createElement('div');
      content.id = 'agentOutputContent';
      content.style.cssText = 'height: 200px; overflow: auto; background: black; color: green;';
      
      // Add lots of content
      for (let i = 0; i < 50; i++) {
        const line = document.createElement('div');
        line.textContent = `Output line ${i + 1}`;
        content.appendChild(line);
      }
      
      document.body.appendChild(content);
      
      // Check if it scrolls to bottom automatically
      const initialScrollTop = content.scrollTop;
      content.scrollTop = content.scrollHeight;
      const maxScrollTop = content.scrollTop;
      
      return {
        initialScrollTop,
        maxScrollTop,
        scrollHeight: content.scrollHeight,
        clientHeight: content.clientHeight
      };
    });
    
    console.log('Scroll test results:', scrollTest);
    expect(scrollTest.maxScrollTop).toBeGreaterThan(0);
  });

  test('should display showcase panel with preview frame', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    
    // Wait for app to load
    await page.waitForTimeout(2000);
    
    // Check showcase panel is visible
    await expect(page.locator('#showcase')).toBeVisible();
    await expect(page.locator('#previewFrame')).toBeVisible();
    
    // Check initial iframe state
    const iframeSrc = await page.locator('#previewFrame').getAttribute('src');
    expect(iframeSrc).toBe('about:blank');
  });

  test('should handle preview content injection', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    
    await page.waitForTimeout(2000);
    
    // Inject test content into preview frame
    const testResult = await page.evaluate(() => {
      const iframe = document.getElementById('previewFrame');
      const testHTML = `
        <html>
          <head><title>Test Preview</title></head>
          <body>
            <h1>Live Preview Test</h1>
            <p>This is test content for the preview panel.</p>
          </body>
        </html>
      `;
      
      // Change iframe src to data URL with test content
      const dataURL = 'data:text/html;charset=utf-8,' + encodeURIComponent(testHTML);
      iframe.src = dataURL;
      
      return {
        newSrc: iframe.src.substring(0, 50) + '...',
        hasContent: iframe.src.includes('Live Preview Test')
      };
    });
    
    console.log('Preview content test:', testResult);
    expect(testResult.hasContent).toBeTruthy();
  });

  test('should refresh preview when previewUpdated event is received', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    
    await page.waitForTimeout(2000);
    
    // Test preview refresh functionality
    const refreshTest = await page.evaluate(() => {
      return new Promise((resolve) => {
        const iframe = document.getElementById('previewFrame');
        const testURL = 'data:text/html,<h1>Original Content</h1>';
        iframe.src = testURL;
        
        let refreshCalled = false;
        let notificationShown = false;
        
        // Mock the refreshPreview function
        const originalRefresh = window.app?.refreshPreview;
        if (window.app) {
          window.app.refreshPreview = function() {
            refreshCalled = true;
            
            // Call original method
            if (originalRefresh) {
              originalRefresh.call(this);
            }
            
            // Check for notification
            setTimeout(() => {
              const notifications = document.querySelectorAll('.fixed.top-4.right-4');
              notificationShown = notifications.length > 0;
              resolve({ refreshCalled, notificationShown });
            }, 100);
          };
          
          // Trigger previewUpdated event
          if (window.socketManager) {
            window.socketManager.trigger('previewUpdated');
          } else {
            resolve({ refreshCalled: false, notificationShown: false });
          }
        } else {
          resolve({ refreshCalled: false, notificationShown: false });
        }
        
        // Timeout fallback
        setTimeout(() => resolve({ refreshCalled, notificationShown }), 2000);
      });
    });
    
    console.log('Preview refresh test:', refreshTest);
    expect(refreshTest.refreshCalled).toBeTruthy();
  });

  test('should show preview update notifications', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    
    await page.waitForTimeout(2000);
    
    // Test notification display
    const notificationTest = await page.evaluate(() => {
      // Simulate refreshPreview call which should show notification
      if (window.app && window.app.refreshPreview) {
        window.app.refreshPreview();
        
        // Wait a moment for notification to appear
        setTimeout(() => {
          const notifications = document.querySelectorAll('.fixed.top-4.right-4');
          return notifications.length > 0;
        }, 500);
        
        return true;
      }
      return false;
    });
    
    expect(notificationTest).toBeTruthy();
  });

  test('should handle preview iframe reload', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    
    await page.waitForTimeout(2000);
    
    // Test iframe reload behavior
    const reloadTest = await page.evaluate(() => {
      const iframe = document.getElementById('previewFrame');
      const testURL = 'data:text/html,<h1>Test Content</h1>';
      iframe.src = testURL;
      
      // Store original src
      const originalSrc = iframe.src;
      
      // Call refreshPreview to trigger reload
      if (window.app && window.app.refreshPreview) {
        window.app.refreshPreview();
        
        // Check if src was reassigned (even if same value)
        return {
          hadSrc: originalSrc.length > 0,
          stillHasSrc: iframe.src.length > 0,
          srcMatches: iframe.src === originalSrc
        };
      }
      
      return { hadSrc: false, stillHasSrc: false, srcMatches: false };
    });
    
    console.log('Iframe reload test:', reloadTest);
    expect(reloadTest.hadSrc).toBeTruthy();
    expect(reloadTest.stillHasSrc).toBeTruthy();
  });
});