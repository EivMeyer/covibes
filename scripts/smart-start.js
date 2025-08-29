#!/usr/bin/env node

const { spawn } = require('child_process');
const { getServerStatus, createLockFile, PORT } = require('./check-server');

async function smartStart() {
    console.log('🔍 Checking server status...');
    
    const status = await getServerStatus();
    
    if (status.serverRunning) {
        console.log(`✅ Server already running on port ${PORT}`);
        console.log(`🌐 Access at: http://localhost:${PORT}`);
        console.log(`📊 Started by: ${status.lockData.startedBy}`);
        console.log(`⏰ Started at: ${status.lockData.startedAt}`);
        
        // Just connect to existing server
        process.exit(0);
    }
    
    console.log('🚀 Starting new server...');
    
    // Create lockfile
    await createLockFile();
    
    // Start server
    const serverProcess = spawn('npm', ['run', 'dev'], {
        cwd: '../server',
        stdio: 'inherit'
    });
    
    // Cleanup on exit
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down server...');
        serverProcess.kill('SIGTERM');
        require('./check-server').removeLockFile();
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        serverProcess.kill('SIGTERM');
        require('./check-server').removeLockFile();
        process.exit(0);
    });
    
    serverProcess.on('exit', (code) => {
        require('./check-server').removeLockFile();
        process.exit(code);
    });
}

smartStart().catch(console.error);