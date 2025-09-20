#!/usr/bin/env node

/**
 * HMR Health Check Utility - API-based testing without browser
 * 
 * Verifies Hot Module Replacement functionality by:
 * 1. Checking preview deployment status
 * 2. Modifying a test file
 * 3. Checking if container reflects changes
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// Configuration - will auto-detect from available workspaces
const BACKEND_URL = 'http://localhost:3001';
const WORKSPACE_DIR = '/home/eivind/.covibess';
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class HMRHealthChecker {
  constructor() {
    this.teamId = null;
    this.projectPath = null;
    this.containerName = null;
  }

  async findActiveTeam() {
    console.log('🔍 Finding active preview deployment...');
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/health`);
      if (!response.ok) {
        console.log('   ❌ Backend not responding');
        return false;
      }
      console.log('   ✅ Backend is healthy');
    } catch (error) {
      console.log('   ❌ Backend connection failed:', error.message);
      return false;
    }

    // Check for running preview containers
    try {
      const { stdout } = await execAsync('docker ps --filter "name=preview-" --format "{{.Names}}" | head -1');
      if (stdout.trim()) {
        this.containerName = stdout.trim();
        this.teamId = this.containerName.replace('preview-', '');
        console.log(`   📦 Found running container: ${this.containerName}`);
        return true;
      }
    } catch (error) {
      console.log('   ⚠️  Docker command failed');
    }

    // Look for workspace directories
    try {
      const dirs = await fs.readdir(WORKSPACE_DIR);
      const workspaceDir = dirs.find(dir => dir.length > 20); // Find team ID directories
      if (workspaceDir) {
        this.teamId = workspaceDir;
        this.projectPath = path.join(WORKSPACE_DIR, workspaceDir);
        console.log(`   📁 Found workspace: ${this.teamId}`);
        return true;
      }
    } catch (error) {
      console.log('   ❌ No workspace directories found');
    }

    return false;
  }

  async checkPreviewStatus() {
    if (!this.teamId) return null;

    console.log('🏥 Checking preview deployment status...');
    try {
      const response = await fetch(`${BACKEND_URL}/api/preview/status/${this.teamId}`);
      
      if (!response.ok) {
        console.log(`   ❌ Preview API returned ${response.status}`);
        return null;
      }

      const data = await response.json();
      console.log(`   📊 Preview status: ${data.status || 'unknown'}`);
      
      if (data.containerName) {
        this.containerName = data.containerName;
      }

      return data;
    } catch (error) {
      console.log('   ❌ Failed to check preview status:', error.message);
      return null;
    }
  }

  async checkContainerHealth() {
    if (!this.containerName) return false;

    console.log('🔧 Checking container health...');
    try {
      const { stdout } = await execAsync(`docker inspect ${this.containerName} --format '{{.State.Status}}'`);
      const status = stdout.trim();
      console.log(`   📦 Container status: ${status}`);
      return status === 'running';
    } catch (error) {
      console.log('   ❌ Container not found or inaccessible');
      return false;
    }
  }

  async testFileWatching() {
    if (!this.projectPath) {
      console.log('⚠️  No project path - skipping file watching test');
      return false;
    }

    console.log('📝 Testing file watching and HMR...');
    
    // Look for common files to modify
    const testFiles = [
      path.join(this.projectPath, 'src/App.jsx'),
      path.join(this.projectPath, 'src/App.tsx'),
      path.join(this.projectPath, 'src/index.html'),
      path.join(this.projectPath, 'package.json')
    ];

    let targetFile = null;
    for (const file of testFiles) {
      try {
        await fs.access(file);
        targetFile = file;
        console.log(`   📄 Found test file: ${path.basename(file)}`);
        break;
      } catch {
        // File doesn't exist, continue
      }
    }

    if (!targetFile) {
      console.log('   ⚠️  No suitable test files found');
      return false;
    }

    try {
      // Read original content
      const originalContent = await fs.readFile(targetFile, 'utf-8');
      console.log(`   📖 Read ${originalContent.length} characters from file`);

      // Create a test modification
      const timestamp = new Date().toISOString();
      const testComment = `// HMR Test: ${timestamp}`;
      const modifiedContent = testComment + '\n' + originalContent;

      // Write modified content
      await fs.writeFile(targetFile, modifiedContent);
      console.log(`   ✏️  Added test comment with timestamp`);

      // Wait for file system events to propagate
      await delay(2000);

      // Check if container logs show file change detection
      if (this.containerName) {
        try {
          const { stdout } = await execAsync(`docker logs --tail=10 ${this.containerName} 2>&1 | grep -i "hmr\\|hot\\|reload\\|update" || echo "No HMR logs found"`);
          if (stdout.includes('HMR') || stdout.includes('hot') || stdout.includes('reload')) {
            console.log(`   🔥 HMR activity detected in logs!`);
          } else {
            console.log(`   📋 Container logs: ${stdout.trim()}`);
          }
        } catch {
          console.log('   ⚠️  Could not check container logs');
        }
      }

      // Restore original content
      await delay(1000);
      await fs.writeFile(targetFile, originalContent);
      console.log(`   🔄 Restored original file content`);

      return true;
    } catch (error) {
      console.log(`   ❌ File modification test failed: ${error.message}`);
      return false;
    }
  }

  async checkViteDevServer() {
    if (!this.containerName) return false;

    console.log('⚡ Checking Vite dev server health...');
    try {
      // Check if Vite is running inside container
      const { stdout } = await execAsync(`docker exec ${this.containerName} ps aux | grep -i vite || echo "Vite not found"`);
      
      if (stdout.includes('vite') || stdout.includes('dev')) {
        console.log('   ✅ Vite dev server is running');
        
        // Check if HMR port is exposed
        const { stdout: portInfo } = await execAsync(`docker port ${this.containerName} 2>/dev/null || echo "No ports exposed"`);
        console.log(`   🔌 Exposed ports: ${portInfo.trim() || 'None'}`);
        
        return true;
      } else {
        console.log('   ❌ Vite dev server not detected');
        return false;
      }
    } catch (error) {
      console.log('   ❌ Failed to check Vite server:', error.message);
      return false;
    }
  }

  async runHealthCheck() {
    console.log('========================================');
    console.log('   HMR HEALTH CHECK (API-BASED)');
    console.log('========================================\n');

    let allHealthy = true;
    const results = {};

    // Step 1: Find active team/deployment
    results.teamFound = await this.findActiveTeam();
    if (!results.teamFound) {
      console.log('\n❌ No active teams or deployments found');
      return false;
    }

    // Step 2: Check preview status via API  
    results.previewStatus = await this.checkPreviewStatus();
    
    // Step 3: Check container health
    results.containerHealthy = await this.checkContainerHealth();
    if (!results.containerHealthy) allHealthy = false;

    // Step 4: Check Vite dev server
    results.viteRunning = await this.checkViteDevServer();
    if (!results.viteRunning) allHealthy = false;

    // Step 5: Test file watching
    results.fileWatchingWorks = await this.testFileWatching();
    if (!results.fileWatchingWorks) allHealthy = false;

    // Summary
    console.log('\n========================================');
    console.log('         HEALTH CHECK SUMMARY');
    console.log('========================================');
    console.log(`Team/Deployment Found: ${results.teamFound ? '✅' : '❌'}`);
    console.log(`Preview API Response:  ${results.previewStatus ? '✅' : '❌'}`);
    console.log(`Container Health:      ${results.containerHealthy ? '✅' : '❌'}`);
    console.log(`Vite Dev Server:       ${results.viteRunning ? '✅' : '❌'}`);
    console.log(`File Watching:         ${results.fileWatchingWorks ? '✅' : '❌'}`);

    if (allHealthy) {
      console.log('\n🎉 HMR system is healthy and ready!');
      console.log('Your preview system supports hot module replacement.');
    } else {
      console.log('\n⚠️  Some HMR components need attention:');
      if (!results.containerHealthy) console.log('  • Container is not running properly');
      if (!results.viteRunning) console.log('  • Vite dev server is not active');
      if (!results.fileWatchingWorks) console.log('  • File watching may not be configured');
    }
    console.log('========================================\n');

    return allHealthy;
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const checker = new HMRHealthChecker();
  
  checker.runHealthCheck()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('\n💥 Fatal error:', error.message);
      process.exit(1);
    });
}

export { HMRHealthChecker };