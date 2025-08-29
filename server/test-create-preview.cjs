#!/usr/bin/env node

const http = require('http');

async function createPreviewContainer() {
  console.log('🚀 Creating Preview Container via API');
  console.log('=' .repeat(50));

  const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWVpaHMwNGEwMDByYXVqc2pqd3VmYmV2IiwidGVhbUlkIjoiY21laWhhMDQ3MDAwcGF1anN5bnYzajB5NSIsImlhdCI6MTc1NTYwNzExNSwiZXhwIjoxNzU1NjkzNTE1fQ.-ShcJQ3rMBc2gciNiaBptT-g49AhcgX4wNDPRnob5fE';
  const teamId = 'cmeiha047000paujsynv3j0y5';
  
  try {
    console.log('1. 🌐 Creating preview container...');
    
    const response = await new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        projectType: 'react',
        branch: 'main'
      });

      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: `/api/preview/${teamId}/container`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'Preview-Container-Test/1.0'
        },
        timeout: 60000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.write(postData);
      req.end();
    });
    
    console.log(`📊 Response Status: ${response.status}`);
    
    if (response.status === 200) {
      console.log('✅ Preview container created successfully!');
      const result = JSON.parse(response.body);
      console.log(`📦 Container ID: ${result.container?.containerId || 'N/A'}`);
      console.log(`🌐 Preview URL: ${result.previewUrl || 'N/A'}`);
      console.log('🎉 Now you can test the SSH tunnel!');
    } else {
      console.log(`❌ Container creation failed: ${response.status}`);
      if (response.body) {
        try {
          const parsed = JSON.parse(response.body);
          console.log(`📝 Error: ${parsed.message || parsed.error}`);
        } catch (e) {
          console.log(`📝 Response: ${response.body}`);
        }
      }
    }
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
  }
}

createPreviewContainer();