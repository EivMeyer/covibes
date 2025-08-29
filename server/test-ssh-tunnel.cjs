#!/usr/bin/env node

const http = require('http');

async function testSSHTunnel() {
  console.log('🧪 Testing SSH Tunnel Preview System');
  console.log('=' .repeat(50));

  const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWVpaHMwNGEwMDByYXVqc2pqd3VmYmV2IiwidGVhbUlkIjoiY21laWhhMDQ3MDAwcGF1anN5bnYzajB5NSIsImlhdCI6MTc1NTYwNzExNSwiZXhwIjoxNzU1NjkzNTE1fQ.-ShcJQ3rMBc2gciNiaBptT-g49AhcgX4wNDPRnob5fE';
  const teamId = 'cmeiha047000paujsynv3j0y5';
  
  try {
    console.log('1. 🌐 Testing SSH tunneled preview proxy...');
    
    const response = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: `/api/preview/${teamId}/live/`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'User-Agent': 'SSH-Tunnel-Test/1.0'
        },
        timeout: 30000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body,
            size: body.length
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.end();
    });
    
    console.log(`📊 Response Status: ${response.status}`);
    console.log(`📦 Response Size: ${response.size} bytes`);
    
    if (response.status === 200) {
      console.log('✅ SSH tunnel preview is working!');
      
      if (response.body.includes('<html') || response.body.includes('<!DOCTYPE')) {
        console.log('📄 Received HTML content (preview working)');
        console.log(`📝 Preview: "${response.body.slice(0, 150)}..."`);
      } else {
        console.log('📄 Response preview:');
        console.log(`"${response.body.slice(0, 200)}..."`);
      }
      
    } else {
      console.log(`❌ Preview failed: ${response.status}`);
      if (response.body) {
        try {
          const parsed = JSON.parse(response.body);
          console.log(`📝 Error: ${parsed.message || parsed.error}`);
        } catch (e) {
          console.log(`📝 Response: ${response.body.slice(0, 200)}`);
        }
      }
    }
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
  }
}

testSSHTunnel();