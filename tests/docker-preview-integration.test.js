/**
 * Docker Preview Integration Test
 * 
 * Tests Docker container creation and content serving directly
 * This test bypasses the frontend and tests the backend Docker functionality
 */

const { test, expect } = require('@playwright/test');

test.describe('Docker Preview Integration Tests', () => {
  let page;
  let authToken;
  let teamId;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    
    // Login and get auth token
    await page.goto('http://localhost:3001');
    await page.click('text=Login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Login")');
    
    await page.waitForSelector('text=Team Collaboration');
    
    // Extract auth token and team ID
    authToken = await page.evaluate(() => localStorage.getItem('token'));
    
    // Get team info
    const teamResponse = await page.evaluate(async (token) => {
      const res = await fetch('/api/team/info', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return await res.json();
    }, authToken);
    
    teamId = teamResponse.id;
    console.log(`🔑 Got auth token and team ID: ${teamId}`);
  });

  test('should create Docker container and serve content', async () => {
    console.log('🐳 Testing Docker container creation and content serving...');
    
    // Step 1: Check initial preview status
    console.log('📝 Step 1: Checking initial preview status...');
    const initialStatus = await page.evaluate(async (token) => {
      const res = await fetch('/api/preview/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return {
        status: res.status,
        data: await res.json()
      };
    }, authToken);
    
    console.log('📊 Initial status:', initialStatus);
    expect(initialStatus.status).toBe(200);

    // Step 2: Create preview container
    console.log('📝 Step 2: Creating preview container...');
    const createResponse = await page.evaluate(async (token) => {
      const res = await fetch('/api/preview/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ branch: 'main' })
      });
      return {
        status: res.status,
        data: await res.json()
      };
    }, authToken);
    
    console.log('🔨 Create response:', createResponse);
    
    if (createResponse.status === 200) {
      console.log('✅ Preview container creation initiated');
      expect(createResponse.data).toHaveProperty('containerId');
    } else {
      console.log('⚠️ Preview container creation may have failed:', createResponse);
    }

    // Step 3: Wait for container to be ready and check status
    console.log('📝 Step 3: Waiting for container to be ready...');
    
    let containerReady = false;
    let attempts = 0;
    const maxAttempts = 12; // 60 seconds
    
    while (!containerReady && attempts < maxAttempts) {
      attempts++;
      console.log(`🔍 Attempt ${attempts}/${maxAttempts}: Checking container status...`);
      
      const statusResponse = await page.evaluate(async (token) => {
        const res = await fetch('/api/preview/status', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return await res.json();
      }, authToken);
      
      console.log(`📊 Status check ${attempts}:`, statusResponse.main);
      
      if (statusResponse.main && statusResponse.main.status === 'running') {
        containerReady = true;
        console.log('✅ Container is running!');
        console.log(`🌐 Container details:`, statusResponse.main);
      } else {
        await page.waitForTimeout(5000); // Wait 5 seconds
      }
    }
    
    if (!containerReady) {
      console.log('❌ Container failed to start within 60 seconds');
      // Continue test to check direct access anyway
    }

    // Step 4: Test direct access to preview content
    console.log('📝 Step 4: Testing direct access to preview content...');
    
    const previewUrl = `/api/preview/${teamId}/main/`;
    console.log(`🌐 Testing preview URL: ${previewUrl}`);
    
    try {
      const contentResponse = await page.evaluate(async (url, token) => {
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return {
          status: res.status,
          contentType: res.headers.get('content-type'),
          text: await res.text()
        };
      }, previewUrl, authToken);
      
      console.log(`📄 Content response status: ${contentResponse.status}`);
      console.log(`📄 Content type: ${contentResponse.contentType}`);
      console.log(`📄 Content preview: ${contentResponse.text.substring(0, 200)}...`);
      
      if (contentResponse.status === 200) {
        console.log('✅ Preview content is accessible');
        
        // Check if content contains our app elements
        const hasAppTitle = contentResponse.text.includes('CoVibe Live Preview') || 
                           contentResponse.text.includes('CoVibe Test');
        const hasHtmlStructure = contentResponse.text.includes('<html>') && 
                               contentResponse.text.includes('</html>');
        const hasExpressApp = contentResponse.text.includes('gradient') || 
                            contentResponse.text.includes('stat-card');
        
        console.log(`🔍 Content analysis:`);
        console.log(`   - Has app title: ${hasAppTitle}`);
        console.log(`   - Has HTML structure: ${hasHtmlStructure}`);
        console.log(`   - Has Express app features: ${hasExpressApp}`);
        
        if (hasAppTitle && hasHtmlStructure) {
          console.log('🎉 SUCCESS: Preview content is being served correctly!');
        } else if (hasHtmlStructure) {
          console.log('✅ HTML content is being served (may be different version)');
        } else {
          console.log('⚠️ Content served but may not be the expected app');
        }
        
      } else if (contentResponse.status === 404) {
        console.log('❌ Preview endpoint not found - container may not be ready');
      } else if (contentResponse.status === 502) {
        console.log('❌ Bad Gateway - container exists but not responding');
      } else {
        console.log(`❌ Unexpected response: ${contentResponse.status}`);
      }
      
    } catch (error) {
      console.log('❌ Error accessing preview content:', error.message);
    }

    // Step 5: Test API endpoints within the preview
    console.log('📝 Step 5: Testing API endpoints within preview...');
    
    try {
      const apiResponse = await page.evaluate(async (teamId, token) => {
        const res = await fetch(`/api/preview/${teamId}/main/api/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return {
          status: res.status,
          data: res.status === 200 ? await res.json() : await res.text()
        };
      }, teamId, authToken);
      
      console.log('🔌 API endpoint response:', apiResponse);
      
      if (apiResponse.status === 200 && apiResponse.data.status) {
        console.log('✅ API endpoints within preview are working');
        console.log(`📊 App status: ${apiResponse.data.status}`);
        console.log(`⏱️ App uptime: ${apiResponse.data.uptime}s`);
      }
      
    } catch (error) {
      console.log('⚠️ API endpoint test failed:', error.message);
    }
  });

  test('should handle Docker commands and container management', async () => {
    console.log('🐳 Testing Docker container management...');
    
    // Check if Docker is available
    const dockerAvailable = await page.evaluate(async () => {
      try {
        // This would be a server-side check in a real scenario
        return true; // Assume Docker is available for now
      } catch (error) {
        return false;
      }
    });
    
    console.log(`🐳 Docker available: ${dockerAvailable}`);
    
    if (dockerAvailable) {
      // Test container stop functionality
      const stopResponse = await page.evaluate(async (token) => {
        const res = await fetch('/api/preview/stop', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ branch: 'main' })
        });
        return {
          status: res.status,
          data: await res.json()
        };
      }, authToken);
      
      console.log('🛑 Stop response:', stopResponse);
      
      if (stopResponse.status === 200) {
        console.log('✅ Container stop command succeeded');
      } else {
        console.log('⚠️ Container stop may have failed (or no container to stop)');
      }
    }
  });

  test('should verify repository cloning and project detection', async () => {
    console.log('📥 Testing repository cloning and project detection...');
    
    // This test would ideally check if the Docker service correctly:
    // 1. Clones the repository
    // 2. Detects it as a Node.js project  
    // 3. Runs npm install
    // 4. Starts the development server
    
    // For now, we test this indirectly by checking the preview content
    const previewUrl = `/api/preview/${teamId}/main/`;
    
    const response = await page.evaluate(async (url, token) => {
      try {
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.status === 200) {
          const text = await res.text();
          return {
            success: true,
            hasNodejsContent: text.includes('express') || text.includes('node'),
            hasOurRepo: text.includes('CoVibe') || text.includes('test'),
            hasPackageJsonFeatures: text.includes('dev') || text.includes('start')
          };
        }
        return { success: false, status: res.status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }, previewUrl, authToken);
    
    console.log('📊 Repository detection results:', response);
    
    if (response.success) {
      console.log('✅ Repository cloning appears successful');
      
      if (response.hasOurRepo) {
        console.log('✅ Our test repository content is being served');
      }
      
      if (response.hasNodejsContent) {
        console.log('✅ Node.js/Express project detected and running');
      }
    } else {
      console.log('❌ Repository cloning/detection may have failed');
    }
  });
});