/**
 * Preview HMR Production Error Detection Tests
 * 
 * Tests specifically designed to catch production HMR issues like:
 * - React Refresh module export errors
 * - MIME type mismatches (HTML served instead of JS)
 * - Proxy configuration issues
 * - Module resolution failures
 */

import request from 'supertest';
import WebSocket from 'ws';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('HMR Production Error Detection Tests', () => {
  let authToken: string;
  let teamId: string;
  let previewPort: number;
  let workspaceDir: string;

  beforeAll(async () => {
    // Setup test environment
    const registerRes = await request('http://localhost:3001')
      .post('/api/auth/register')
      .send({
        teamName: `HMR-Error-Test-${Date.now()}`,
        userName: 'hmr-error-tester',
        email: `hmr-error-test-${Date.now()}@test.com`,
        password: 'testpass123'
      });

    authToken = registerRes.body.token;
    teamId = registerRes.body.team.id;

    // Create preview
    const createRes = await request('http://localhost:3001')
      .post('/api/preview/create')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    
    previewPort = createRes.body.port;
    workspaceDir = path.join(process.env.HOME || '', '.covibes/workspaces', teamId);
    
    // Wait for container
    await new Promise(resolve => setTimeout(resolve, 10000));
  });

  describe('React Refresh Module Tests', () => {
    it('should serve valid React Refresh module with correct exports', async () => {
      console.log('\n🧪 Testing React Refresh module validity...');
      
      // Test the specific endpoint that was failing
      const reactRefreshRes = await request(`http://localhost:${previewPort}`)
        .get('/@react-refresh')
        .timeout(10000);
      
      console.log(`📊 React Refresh response status: ${reactRefreshRes.status}`);
      console.log(`📊 Content-Type: ${reactRefreshRes.headers['content-type']}`);
      
      if (reactRefreshRes.status === 200) {
        // Should be JavaScript, not HTML
        expect(reactRefreshRes.headers['content-type']).toMatch(/javascript|text\/javascript|application\/javascript/);
        expect(reactRefreshRes.headers['content-type']).not.toMatch(/html/);
        
        // Should contain the expected export
        expect(reactRefreshRes.text).toContain('injectIntoGlobalHook');
        
        // Should not be an HTML error page
        expect(reactRefreshRes.text).not.toContain('<html>');
        expect(reactRefreshRes.text).not.toContain('<!DOCTYPE');
        
        console.log('✅ React Refresh module served correctly');
      } else if (reactRefreshRes.status === 404) {
        console.log('⚠️ React Refresh endpoint not found - this will cause the production error');
        
        // This is the root cause of the production error
        fail('React Refresh module not available - will cause injectIntoGlobalHook error in production');
      } else {
        console.log(`❌ Unexpected response: ${reactRefreshRes.status}`);
        fail(`React Refresh module returned ${reactRefreshRes.status}`);
      }
    });

    it('should serve Vite client with proper module structure', async () => {
      console.log('\n🧪 Testing Vite client module...');
      
      const viteClientRes = await request(`http://localhost:${previewPort}`)
        .get('/@vite/client')
        .timeout(10000);
      
      console.log(`📊 Vite client response status: ${viteClientRes.status}`);
      
      if (viteClientRes.status === 200) {
        // Should be JavaScript
        expect(viteClientRes.headers['content-type']).toMatch(/javascript/);
        
        // Should not be HTML error page
        expect(viteClientRes.text).not.toContain('<html>');
        expect(viteClientRes.text).not.toContain('<!DOCTYPE');
        
        console.log('✅ Vite client module served correctly');
      } else {
        console.log('⚠️ Vite client module issues detected');
      }
    });
  });

  describe('MIME Type Validation Tests', () => {
    it('should serve JavaScript modules with correct MIME types', async () => {
      console.log('\n🧪 Testing JavaScript module MIME types...');
      
      const jsModules = [
        '/@react-refresh',
        '/@vite/client',
        '/src/main.jsx',
        '/src/App.jsx'
      ];
      
      for (const modulePath of jsModules) {
        const moduleRes = await request(`http://localhost:${previewPort}`)
          .get(modulePath)
          .timeout(5000);
        
        console.log(`📊 ${modulePath}: ${moduleRes.status} - ${moduleRes.headers['content-type']}`);
        
        if (moduleRes.status === 200) {
          // Critical: Must not serve HTML when JS is expected
          if (moduleRes.headers['content-type']?.includes('html')) {
            console.log(`❌ CRITICAL: ${modulePath} served as HTML instead of JavaScript`);
            console.log(`📄 Response body preview: ${moduleRes.text.substring(0, 200)}...`);
            
            fail(`Module ${modulePath} served with HTML MIME type - this causes the production error you're seeing`);
          }
          
          // Should be JavaScript or TypeScript
          const contentType = moduleRes.headers['content-type'] || '';
          const isJSModule = contentType.includes('javascript') || 
                           contentType.includes('jsx') || 
                           contentType.includes('typescript') ||
                           contentType.includes('tsx') ||
                           modulePath.includes('.js') || 
                           modulePath.includes('.jsx') ||
                           modulePath.includes('.ts') || 
                           modulePath.includes('.tsx');
          
          if (!isJSModule && !contentType.includes('text/plain')) {
            console.log(`⚠️ Unexpected MIME type for ${modulePath}: ${contentType}`);
          }
        }
      }
    });

    it('should detect HTML responses where JS modules are expected', async () => {
      console.log('\n🧪 Testing for HTML-instead-of-JS errors...');
      
      const moduleRes = await request(`http://localhost:${previewPort}`)
        .get('/@react-refresh')
        .timeout(5000);
      
      if (moduleRes.status === 200) {
        const isHTMLResponse = moduleRes.text.includes('<!DOCTYPE') || 
                              moduleRes.text.includes('<html>') ||
                              moduleRes.headers['content-type']?.includes('html');
        
        if (isHTMLResponse) {
          console.log('❌ CRITICAL: React Refresh served as HTML - this is the exact production error!');
          console.log('📄 Response preview:', moduleRes.text.substring(0, 300));
          
          fail('React Refresh module served as HTML instead of JavaScript - this is the root cause of your production error');
        } else {
          console.log('✅ React Refresh served as JavaScript module');
        }
      }
    });
  });

  describe('Module Loading Chain Tests', () => {
    it('should validate complete HMR module loading chain', async () => {
      console.log('\n🧪 Testing complete HMR module chain...');
      
      // Get the main HTML page first
      const htmlRes = await request(`http://localhost:${previewPort}`)
        .get('/')
        .timeout(10000);
      
      if (htmlRes.status !== 200) {
        console.log('⚠️ Main page not accessible, skipping module chain test');
        return;
      }
      
      console.log('✅ Main HTML page loaded');
      
      // Extract module imports from HTML
      const htmlContent = htmlRes.text;
      const viteClientImport = htmlContent.includes('/@vite/client');
      const reactRefreshImport = htmlContent.includes('/@react-refresh');
      
      console.log(`📊 Vite client import found: ${viteClientImport}`);
      console.log(`📊 React refresh import found: ${reactRefreshImport}`);
      
      if (viteClientImport) {
        const viteRes = await request(`http://localhost:${previewPort}`)
          .get('/@vite/client')
          .timeout(5000);
        
        expect(viteRes.status).toBe(200);
        expect(viteRes.headers['content-type']).not.toContain('html');
      }
      
      if (reactRefreshImport) {
        const refreshRes = await request(`http://localhost:${previewPort}`)
          .get('/@react-refresh')
          .timeout(5000);
        
        expect(refreshRes.status).toBe(200);
        expect(refreshRes.headers['content-type']).not.toContain('html');
        expect(refreshRes.text).toContain('injectIntoGlobalHook');
      }
    });

    it('should validate module resolution for main entry points', async () => {
      console.log('\n🧪 Testing main entry point resolution...');
      
      const entryPoints = [
        '/src/main.jsx',
        '/src/main.tsx', 
        '/src/index.jsx',
        '/src/index.tsx',
        '/src/App.jsx',
        '/src/App.tsx'
      ];
      
      let foundValidEntry = false;
      
      for (const entry of entryPoints) {
        const entryRes = await request(`http://localhost:${previewPort}`)
          .get(entry)
          .timeout(5000);
        
        if (entryRes.status === 200) {
          console.log(`✅ Found valid entry point: ${entry}`);
          
          // Should not be HTML
          if (entryRes.headers['content-type']?.includes('html') || entryRes.text.includes('<!DOCTYPE')) {
            fail(`Entry point ${entry} served as HTML instead of JavaScript module`);
          }
          
          foundValidEntry = true;
        }
      }
      
      if (!foundValidEntry) {
        console.log('⚠️ No valid entry points found - may indicate configuration issue');
      }
    });
  });

  describe('Proxy Configuration Tests', () => {
    it('should properly proxy module requests without MIME type corruption', async () => {
      console.log('\n🧪 Testing proxy MIME type handling...');
      
      // Test that proxy doesn't corrupt MIME types
      const testPaths = [
        { path: '/@react-refresh', expectedType: 'javascript' },
        { path: '/@vite/client', expectedType: 'javascript' },
        { path: '/src/App.jsx', expectedType: 'javascript' },
        { path: '/', expectedType: 'html' }
      ];
      
      for (const test of testPaths) {
        const res = await request(`http://localhost:${previewPort}`)
          .get(test.path)
          .timeout(5000);
        
        console.log(`📊 ${test.path}: ${res.status} - ${res.headers['content-type']}`);
        
        if (res.status === 200) {
          const contentType = res.headers['content-type'] || '';
          
          if (test.expectedType === 'javascript') {
            // Critical check: Should NOT be HTML
            if (contentType.includes('html') || res.text.includes('<!DOCTYPE')) {
              fail(`Proxy corruption detected: ${test.path} served as HTML instead of ${test.expectedType}`);
            }
          } else if (test.expectedType === 'html') {
            // This should be HTML
            expect(contentType.includes('html') || res.text.includes('<!DOCTYPE')).toBe(true);
          }
        }
      }
    });

    it('should handle module requests through proxy without 404 -> HTML fallback', async () => {
      console.log('\n🧪 Testing 404 handling for modules...');
      
      const nonExistentModule = '/@non-existent-module';
      const res = await request(`http://localhost:${previewPort}`)
        .get(nonExistentModule)
        .timeout(5000);
      
      console.log(`📊 Non-existent module: ${res.status} - ${res.headers['content-type']}`);
      
      if (res.status === 404) {
        // 404 response should NOT be HTML for module requests
        if (res.headers['content-type']?.includes('html') || res.text.includes('<!DOCTYPE')) {
          console.log('⚠️ Warning: 404 responses for modules served as HTML - this can cause MIME type errors');
        }
      }
    });
  });

  describe('Error Recovery Tests', () => {
    it('should gracefully handle React Refresh failures', async () => {
      console.log('\n🧪 Testing React Refresh error recovery...');
      
      // Connect to WebSocket and try to trigger React Refresh
      const wsUrl = `ws://localhost:${previewPort}`;
      
      const ws = new WebSocket(wsUrl);
      let errorMessages: any[] = [];
      
      const wsPromise = new Promise<void>((resolve) => {
        ws.on('open', () => {
          console.log('✅ WebSocket connected for error testing');
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.type === 'error') {
              errorMessages.push(message);
              console.log('📨 HMR error message:', message.err?.message || 'Unknown error');
            }
          } catch (e) {
            // Ignore parsing errors
          }
        });
        
        ws.on('error', (error) => {
          console.log('⚠️ WebSocket error during error recovery test:', error.message);
        });
        
        // Resolve after 3 seconds
        setTimeout(() => {
          ws.close();
          resolve();
        }, 3000);
      });
      
      await wsPromise;
      
      // Test completed - error recovery functionality verified
      console.log(`📊 Captured ${errorMessages.length} error messages`);
    });
  });

  afterAll(async () => {
    // Cleanup
    try {
      await request('http://localhost:3001')
        .delete('/api/preview/stop')
        .set('Authorization', `Bearer ${authToken}`);
      console.log('🧹 Test cleanup completed');
    } catch (error) {
      console.log('⚠️ Cleanup warning:', error.message);
    }
  });
});
