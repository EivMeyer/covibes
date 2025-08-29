#!/usr/bin/env node

const net = require('net');
const fs = require('fs');
const path = require('path');

const LOCKFILE = path.join(__dirname, '..', '.server.lock');
const PORT = 3001;

function checkPort(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
            server.once('close', () => resolve(false)); // Port is free
            server.close();
        });
        server.on('error', () => resolve(true)); // Port is in use
    });
}

async function getServerStatus() {
    const portInUse = await checkPort(PORT);
    const lockFileExists = fs.existsSync(LOCKFILE);
    
    let lockData = null;
    if (lockFileExists) {
        try {
            lockData = JSON.parse(fs.readFileSync(LOCKFILE, 'utf8'));
        } catch (e) {
            // Invalid lockfile, remove it
            fs.unlinkSync(LOCKFILE);
        }
    }
    
    return {
        portInUse,
        lockFileExists,
        lockData,
        serverRunning: portInUse && lockFileExists && lockData
    };
}

async function createLockFile(pid = process.pid) {
    const lockData = {
        pid,
        port: PORT,
        startedAt: new Date().toISOString(),
        startedBy: process.env.USER || 'unknown'
    };
    
    fs.writeFileSync(LOCKFILE, JSON.stringify(lockData, null, 2));
    return lockData;
}

function removeLockFile() {
    if (fs.existsSync(LOCKFILE)) {
        fs.unlinkSync(LOCKFILE);
    }
}

module.exports = {
    checkPort,
    getServerStatus,
    createLockFile,
    removeLockFile,
    PORT,
    LOCKFILE
};

// CLI usage
if (require.main === module) {
    getServerStatus().then(status => {
        console.log(JSON.stringify(status, null, 2));
        process.exit(status.serverRunning ? 0 : 1);
    });
}