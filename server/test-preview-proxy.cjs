/**
 * Test Preview Proxy System
 * Tests the enhanced preview proxy API endpoints
 */
const http = require('http');

const API_BASE = 'http://localhost:3001';

// Test user credentials
const TEST_USER = {
  email: 'test@example.com',
  password: 'password123'
};

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testPreviewProxySystem() {
  console.log('🧪 Testing Enhanced Preview Proxy System');
  console.log('=' .repeat(50));

  try {
    // 1. Login to get JWT token
    console.log('1. 🔐 Logging in to get JWT token...');
    const loginResponse = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, TEST_USER);

    if (loginResponse.status !== 200) {
      throw new Error(`Login failed: ${loginResponse.status} - ${JSON.stringify(loginResponse.data)}`);
    }

    const token = loginResponse.data.token;
    const teamId = loginResponse.data.user.teamId;
    console.log(`✅ Login successful! Team ID: ${teamId}`);

    // 2. Test preview status endpoint
    console.log('\n2. 📊 Testing preview status endpoint...');
    const statusResponse = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/preview/status',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`Status Response (${statusResponse.status}):`, JSON.stringify(statusResponse.data, null, 2));

    // 3. Test container creation endpoint
    console.log('\n3. 🐳 Testing Docker preview container creation...');
    const createContainerResponse = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/preview/${teamId}/container`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }, {
      projectType: 'react',
      branch: 'main'
    });

    console.log(`Container Creation Response (${createContainerResponse.status}):`, JSON.stringify(createContainerResponse.data, null, 2));

    if (createContainerResponse.status === 200 || createContainerResponse.status === 201) {
      const container = createContainerResponse.data.container;
      console.log(`✅ Container created with preview port: ${container?.previewPort}`);

      // Wait a bit for container to start
      console.log('\n⏳ Waiting 5 seconds for container to start...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 4. Test preview status again to see if container is running
      console.log('\n4. 📊 Checking preview status after container creation...');
      const statusAfterResponse = await makeRequest({
        hostname: 'localhost',
        port: 3001,
        path: '/api/preview/status',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`Updated Status Response (${statusAfterResponse.status}):`, JSON.stringify(statusAfterResponse.data, null, 2));

      // 5. Test preview proxy endpoint
      if (statusAfterResponse.data?.docker?.proxyUrl) {
        console.log('\n5. 🔄 Testing preview proxy endpoint...');
        const proxyResponse = await makeRequest({
          hostname: 'localhost',
          port: 3001,
          path: statusAfterResponse.data.docker.proxyUrl,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        });

        console.log(`Proxy Response (${proxyResponse.status}):`);
        if (proxyResponse.body && typeof proxyResponse.body === 'string') {
          console.log(`Body preview: ${proxyResponse.body.substring(0, 200)}...`);
        } else {
          console.log('Response data:', proxyResponse.data);
        }

        if (proxyResponse.status === 200) {
          console.log('✅ Preview proxy is working!');
        } else if (proxyResponse.status === 404) {
          console.log('⚠️  Preview container not available yet (this is normal for new containers)');
        } else if (proxyResponse.status === 502) {
          console.log('⚠️  Preview container not responding (may still be starting up)');
        }
      } else {
        console.log('⚠️  No proxy URL available in status response');
      }

      // 6. Test container cleanup
      console.log('\n6. 🧹 Testing container cleanup...');
      const cleanupResponse = await makeRequest({
        hostname: 'localhost',
        port: 3001,
        path: `/api/preview/${teamId}/container`,
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`Cleanup Response (${cleanupResponse.status}):`, JSON.stringify(cleanupResponse.data, null, 2));
    }

    console.log('\n✅ Preview proxy system test completed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testPreviewProxySystem().catch(console.error);