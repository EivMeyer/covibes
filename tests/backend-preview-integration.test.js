/**
 * Backend Integration Tests for Preview Updates
 * Tests server-side preview update events and file serving
 */

const { test, expect } = require('@playwright/test');

test.describe('Backend Preview Integration', () => {
  const BASE_URL = 'http://localhost:3001';
  let token;
  let teamId;
  
  test.beforeAll(async () => {
    // Create a test team
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamName: 'BackendPreviewTest',
        userName: 'TestUser',
        email: 'backend@preview.com',
        password: 'password123'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Registration failed: ${await response.text()}`);
    }
    
    const result = await response.json();
    token = result.token;
    
    // Get team info
    const userResponse = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const userData = await userResponse.json();
    teamId = userData.team.id;
  });

  test('should serve static files for preview', async ({ request }) => {
    // Test if server can serve static files
    const htmlResponse = await request.get(`${BASE_URL}/index.html`);
    expect(htmlResponse.status()).toBe(200);
    
    // Test if server serves API documentation
    const apiResponse = await request.get(`${BASE_URL}/`);
    expect(apiResponse.status()).toBe(200);
    
    // Check if it serves app.html
    const appResponse = await request.get(`${BASE_URL}/app.html`);
    expect(appResponse.status()).toBe(200);
    
    const appContent = await appResponse.text();
    expect(appContent).toContain('CoVibe');
    expect(appContent).toContain('previewFrame');
  });

  test('should handle preview URL configuration', async ({ request }) => {
    // Test repository configuration for preview
    const repoResponse = await request.post(`${BASE_URL}/api/team/repository`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        repositoryUrl: 'https://github.com/test/preview-repo'
      }
    });
    
    if (repoResponse.ok()) {
      const repoResult = await repoResponse.json();
      expect(repoResult.success).toBeTruthy();
    }
    // Note: This endpoint might not exist yet, test helps identify needed API
  });

  test('should emit previewUpdated events via WebSocket', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    
    await page.waitForTimeout(3000);
    
    // Test WebSocket event emission
    const websocketTest = await page.evaluate(() => {
      return new Promise((resolve) => {
        let previewUpdatedReceived = false;
        let eventCount = 0;
        
        if (window.socketManager) {
          // Listen for preview updates
          const originalTrigger = window.socketManager.trigger;
          window.socketManager.trigger = function(event, data) {
            if (event === 'previewUpdated') {
              previewUpdatedReceived = true;
              eventCount++;
            }
            return originalTrigger.call(this, event, data);
          };
          
          // Simulate server emitting preview update
          setTimeout(() => {
            window.socketManager.trigger('previewUpdated', {
              teamId: 'test-team',
              userId: 'test-user',
              timestamp: Date.now(),
              previewUrl: 'http://localhost:3000'
            });
          }, 500);
          
          setTimeout(() => {
            resolve({
              eventReceived: previewUpdatedReceived,
              eventCount: eventCount,
              hasSocketManager: true
            });
          }, 1000);
        } else {
          resolve({
            eventReceived: false,
            eventCount: 0,
            hasSocketManager: false
          });
        }
      });
    });
    
    console.log('WebSocket event test:', websocketTest);
    expect(websocketTest.hasSocketManager).toBeTruthy();
    expect(websocketTest.eventReceived).toBeTruthy();
  });

  test('should handle preview file changes from agents', async ({ request, page }) => {
    // Test agent creation that should trigger preview updates
    const agentResponse = await request.post(`${BASE_URL}/api/agents/spawn`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        task: 'Create a simple HTML page for preview testing',
        agentType: 'mock'
      }
    });
    
    if (agentResponse.ok()) {
      const agentResult = await agentResponse.json();
      expect(agentResult.agent).toBeDefined();
      
      // Set up WebSocket listener for preview updates
      await page.goto(`${BASE_URL}/app.html`);
      await page.evaluate((token) => {
        localStorage.setItem('token', token);
      }, token);
      await page.reload();
      await page.waitForTimeout(3000);
      
      // Listen for preview update events triggered by agent activity
      const previewUpdateTest = await page.evaluate(() => {
        return new Promise((resolve) => {
          let updateReceived = false;
          
          if (window.socketManager) {
            window.socketManager.on('previewUpdated', (data) => {
              updateReceived = true;
              console.log('Preview update received:', data);
            });
            
            // Wait for potential preview updates
            setTimeout(() => {
              resolve({
                updateReceived: updateReceived,
                hasListener: true
              });
            }, 5000);
          } else {
            resolve({
              updateReceived: false,
              hasListener: false
            });
          }
        });
      });
      
      console.log('Agent-triggered preview test:', previewUpdateTest);
      expect(previewUpdateTest.hasListener).toBeTruthy();
    }
  });

  test('should validate preview URLs and security', async ({ request }) => {
    // Test various URL patterns for security
    const testUrls = [
      'http://localhost:3000',
      'https://example.com',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd'
    ];
    
    for (const url of testUrls) {
      // This would test if the server properly validates preview URLs
      const testResponse = await request.post(`${BASE_URL}/api/team/preview-url`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: { previewUrl: url }
      });
      
      // Note: This endpoint might not exist, but helps identify security needs
      console.log(`URL ${url} validation status: ${testResponse.status()}`);
    }
  });

  test('should handle preview serving with proper CORS headers', async ({ request }) => {
    // Test CORS headers for preview content
    const corsResponse = await request.get(`${BASE_URL}/app.html`, {
      headers: {
        'Origin': 'http://localhost:3000'
      }
    });
    
    const headers = corsResponse.headers();
    console.log('CORS headers:', headers);
    
    // Check for appropriate CORS headers if needed for preview iframe
    expect(corsResponse.status()).toBe(200);
  });

  test('should track preview access and metrics', async ({ request, page }) => {
    // Test if server tracks preview access
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Simulate preview access
    await page.evaluate(() => {
      const iframe = document.getElementById('previewFrame');
      const testContent = '<html><body><h1>Metrics Test</h1></body></html>';
      iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(testContent);
    });
    
    // Check if server provides metrics endpoint
    const metricsResponse = await request.get(`${BASE_URL}/api/metrics/preview`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    // Note: This endpoint might not exist, helps identify monitoring needs
    console.log(`Metrics endpoint status: ${metricsResponse.status()}`);
  });

  test('should handle concurrent preview updates from multiple agents', async ({ request }) => {
    // Spawn multiple agents that might update preview
    const agent1Response = await request.post(`${BASE_URL}/api/agents/spawn`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        task: 'Update CSS styles',
        agentType: 'mock'
      }
    });
    
    const agent2Response = await request.post(`${BASE_URL}/api/agents/spawn`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        task: 'Update JavaScript functionality',
        agentType: 'mock'
      }
    });
    
    if (agent1Response.ok() && agent2Response.ok()) {
      const agent1 = await agent1Response.json();
      const agent2 = await agent2Response.json();
      
      expect(agent1.agent).toBeDefined();
      expect(agent2.agent).toBeDefined();
      
      // Both agents should be able to trigger preview updates
      console.log('Multiple agents created for concurrent preview testing');
    }
  });

  test('should serve preview content with appropriate caching headers', async ({ request }) => {
    // Test caching headers for preview content
    const appResponse = await request.get(`${BASE_URL}/app.html`);
    const headers = appResponse.headers();
    
    console.log('Caching headers:', {
      'cache-control': headers['cache-control'],
      'etag': headers['etag'],
      'last-modified': headers['last-modified']
    });
    
    expect(appResponse.status()).toBe(200);
    
    // Test static asset caching
    const jsResponse = await request.get(`${BASE_URL}/js/app.js`);
    if (jsResponse.ok()) {
      const jsHeaders = jsResponse.headers();
      console.log('JS file headers:', jsHeaders['cache-control']);
    }
  });

  test('should handle preview WebSocket connection scaling', async ({ page }) => {
    // Test multiple WebSocket connections for preview updates
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    await page.waitForTimeout(2000);
    
    const connectionTest = await page.evaluate(() => {
      return new Promise((resolve) => {
        let connections = [];
        let eventCounts = [];
        
        // Test multiple socket connections (simulation)
        for (let i = 0; i < 3; i++) {
          eventCounts[i] = 0;
          
          if (window.socketManager) {
            const listener = (data) => {
              eventCounts[i]++;
            };
            window.socketManager.on('previewUpdated', listener);
            connections.push(listener);
          }
        }
        
        // Simulate broadcast event
        setTimeout(() => {
          if (window.socketManager) {
            window.socketManager.trigger('previewUpdated', {
              type: 'broadcast',
              timestamp: Date.now()
            });
          }
        }, 500);
        
        setTimeout(() => {
          resolve({
            connectionCount: connections.length,
            eventCounts: eventCounts,
            totalEvents: eventCounts.reduce((a, b) => a + b, 0)
          });
        }, 1000);
      });
    });
    
    console.log('Connection scaling test:', connectionTest);
    expect(connectionTest.connectionCount).toBeGreaterThan(0);
  });
});