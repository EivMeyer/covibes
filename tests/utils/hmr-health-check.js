#!/usr/bin/env node

/**
 * HMR Health Check Utility
 * 
 * Quick utility to detect the specific HMR production errors:
 * - React Refresh module export issues
 * - MIME type mismatches (HTML served instead of JS)
 * - Module resolution failures
 * 
 * Usage: node tests/utils/hmr-health-check.js [port]
 */

const http = require('http');
const { URL } = require('url');

const DEFAULT_PORT = 7174;

async function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.abort();
      reject(new Error('Request timeout'));
    });
  });
}

async function checkHMRHealth(port = DEFAULT_PORT) {
  console.log(`🔍 Running HMR Health Check on port ${port}...\n`);
  
  const baseUrl = `http://localhost:${port}`;
  let criticalErrors = 0;
  let warnings = 0;

  // Test 1: React Refresh Module
  console.log('1️⃣ Checking React Refresh module...');
  try {
    const res = await makeRequest(`${baseUrl}/@react-refresh`);
    
    if (res.status === 200) {
      const contentType = res.headers['content-type'] || '';
      const isHTML = contentType.includes('html') || res.body.includes('<!DOCTYPE');
      const hasExport = res.body.includes('injectIntoGlobalHook');
      
      if (isHTML) {
        console.log('❌ CRITICAL: React Refresh served as HTML instead of JavaScript');
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Body preview: ${res.body.substring(0, 100)}...`);
        criticalErrors++;
      } else if (!hasExport) {
        console.log('❌ CRITICAL: React Refresh missing injectIntoGlobalHook export');
        console.log(`   Content-Type: ${contentType}`);
        criticalErrors++;
      } else {
        console.log('✅ React Refresh module OK');
      }
    } else if (res.status === 404) {
      console.log('❌ CRITICAL: React Refresh module not found (404)');
      console.log('   This will cause: "does not provide an export named \'injectIntoGlobalHook\'"');
      criticalErrors++;
    } else {
      console.log(`⚠️  WARNING: React Refresh unexpected status: ${res.status}`);
      warnings++;
    }
  } catch (error) {
    console.log(`❌ CRITICAL: React Refresh request failed: ${error.message}`);
    criticalErrors++;
  }

  // Test 2: Vite Client
  console.log('\n2️⃣ Checking Vite client module...');
  try {
    const res = await makeRequest(`${baseUrl}/@vite/client`);
    
    if (res.status === 200) {
      const contentType = res.headers['content-type'] || '';
      const isHTML = contentType.includes('html') || res.body.includes('<!DOCTYPE');
      
      if (isHTML) {
        console.log('❌ CRITICAL: Vite client served as HTML instead of JavaScript');
        console.log(`   Content-Type: ${contentType}`);
        criticalErrors++;
      } else {
        console.log('✅ Vite client module OK');
      }
    } else {
      console.log(`⚠️  WARNING: Vite client status: ${res.status}`);
      warnings++;
    }
  } catch (error) {
    console.log(`⚠️  WARNING: Vite client request failed: ${error.message}`);
    warnings++;
  }

  // Test 3: Main HTML page structure
  console.log('\n3️⃣ Checking main page HTML structure...');
  try {
    const res = await makeRequest(baseUrl);
    
    if (res.status === 200) {
      const hasViteClient = res.body.includes('/@vite/client');
      const hasReactRefresh = res.body.includes('/@react-refresh');
      const isHTML = res.body.includes('<!DOCTYPE') || res.body.includes('<html');
      
      if (!isHTML) {
        console.log('❌ CRITICAL: Main page not serving HTML');
        criticalErrors++;
      } else if (!hasViteClient && !hasReactRefresh) {
        console.log('⚠️  WARNING: No HMR modules found in HTML');
        warnings++;
      } else {
        console.log('✅ Main page structure OK');
        if (hasViteClient) console.log('   - Vite client import found');
        if (hasReactRefresh) console.log('   - React refresh import found');
      }
    } else {
      console.log(`❌ CRITICAL: Main page status: ${res.status}`);
      criticalErrors++;
    }
  } catch (error) {
    console.log(`❌ CRITICAL: Main page request failed: ${error.message}`);
    criticalErrors++;
  }

  // Test 4: Common entry points
  console.log('\n4️⃣ Checking common entry points...');
  const entryPoints = ['/src/main.jsx', '/src/App.jsx', '/src/main.tsx', '/src/App.tsx'];
  
  for (const entry of entryPoints) {
    try {
      const res = await makeRequest(`${baseUrl}${entry}`);
      
      if (res.status === 200) {
        const contentType = res.headers['content-type'] || '';
        const isHTML = contentType.includes('html') || res.body.includes('<!DOCTYPE');
        
        if (isHTML) {
          console.log(`❌ CRITICAL: ${entry} served as HTML instead of JavaScript`);
          console.log(`   Content-Type: ${contentType}`);
          criticalErrors++;
        } else {
          console.log(`✅ ${entry} OK`);
        }
        break; // Found valid entry point
      }
    } catch (error) {
      // Entry point not found, continue
    }
  }

  // Summary
  console.log('\n📊 HMR Health Check Summary');
  console.log('=' .repeat(40));
  
  if (criticalErrors === 0 && warnings === 0) {
    console.log('🎉 ALL TESTS PASSED - HMR should work correctly');
  } else {
    console.log(`❌ ${criticalErrors} critical errors detected`);
    console.log(`⚠️  ${warnings} warnings detected`);
    
    if (criticalErrors > 0) {
      console.log('\n🚨 CRITICAL ERRORS DETECTED:');
      console.log('These errors will cause the exact production issues you\'re seeing:');
      console.log('- "does not provide an export named \'injectIntoGlobalHook\'"');
      console.log('- "Expected a JavaScript module script but the server responded with MIME type text/html"');
      
      console.log('\n🔧 LIKELY CAUSES:');
      console.log('- Vite dev server not properly configured for production proxy');
      console.log('- 404 errors falling back to HTML instead of proper 404 responses');
      console.log('- Proxy MIME type mapping issues');
      console.log('- Missing or misconfigured React Refresh plugin');
    }
  }
  
  return {
    criticalErrors,
    warnings,
    passed: criticalErrors === 0
  };
}

// Run if called directly
if (require.main === module) {
  const port = process.argv[2] ? parseInt(process.argv[2]) : DEFAULT_PORT;
  
  checkHMRHealth(port)
    .then(result => {
      process.exit(result.criticalErrors > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Health check failed:', error.message);
      process.exit(1);
    });
}

module.exports = { checkHMRHealth };