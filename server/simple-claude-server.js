#!/usr/bin/env node
/**
 * Simple Claude Terminal Server
 * Provides SSH to Claude connection for the HTML terminal interface
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Configuration
const PORT = process.env.PORT || 7777; // Weird port to avoid conflicts
const CONFIG_PATH = './config/vm-instances.json';

// Store active SSH sessions
const sshSessions = new Map();

console.log('🚀 Starting Simple Claude Terminal Server');
console.log('=========================================');

// Load SSH key
function loadSSHKey(keyPath) {
    try {
        const fullPath = path.resolve(keyPath);
        if (!fs.existsSync(fullPath)) {
            throw new Error(`SSH key not found: ${fullPath}`);
        }
        return fs.readFileSync(fullPath, 'utf8');
    } catch (error) {
        throw new Error(`Failed to load SSH key: ${error.message}`);
    }
}

// Create SSH session
function createSSHSession(sessionId, config, socket) {
    return new Promise((resolve, reject) => {
        const client = new Client();
        
        // Auto-find SSH key if not provided
        if (!config.privateKey || config.privateKey.length < 100) {
            console.log('🔍 Auto-searching for SSH keys...');
            
            // Extensive list of possible SSH key locations
            const keyPaths = [
                // EC2 specific
                './.ssh/ec2.pem',
                './config/.ssh/ec2.pem', 
                './server/.ssh/ec2.pem',
                '../.ssh/ec2.pem',
                '../../.ssh/ec2.pem',
                
                // Default SSH locations  
                path.expanduser ? path.expanduser('~/.ssh/id_rsa') : process.env.HOME + '/.ssh/id_rsa',
                path.expanduser ? path.expanduser('~/.ssh/id_ed25519') : process.env.HOME + '/.ssh/id_ed25519',
                path.expanduser ? path.expanduser('~/.ssh/id_ecdsa') : process.env.HOME + '/.ssh/id_ecdsa',
                
                // Common EC2 key names
                path.expanduser ? path.expanduser('~/.ssh/ec2-key.pem') : process.env.HOME + '/.ssh/ec2-key.pem',
                path.expanduser ? path.expanduser('~/.ssh/aws-key.pem') : process.env.HOME + '/.ssh/aws-key.pem',
                path.expanduser ? path.expanduser('~/.ssh/colabvibe.pem') : process.env.HOME + '/.ssh/colabvibe.pem',
                
                // Current directory variations
                './ec2.pem',
                './ec2-key.pem', 
                './aws-key.pem',
                './key.pem',
                './private-key.pem'
            ];
            
            let keyFound = false;
            for (const keyPath of keyPaths) {
                try {
                    const resolvedPath = path.resolve(keyPath.replace('~', process.env.HOME || ''));
                    if (fs.existsSync(resolvedPath)) {
                        const keyContent = fs.readFileSync(resolvedPath, 'utf8');
                        if (keyContent.includes('-----BEGIN') && keyContent.length > 100) {
                            config.privateKey = keyContent;
                            console.log(`✅ Found SSH key: ${resolvedPath}`);
                            keyFound = true;
                            break;
                        }
                    }
                } catch (e) {
                    // Continue searching
                }
            }
            
            if (!keyFound) {
                return reject(new Error(`SSH key not found. Searched: ${keyPaths.join(', ')}`));
            }
        }
        
        console.log(`🔐 Connecting to ${config.username}@${config.host}:${config.port}`);
        
        const timeout = setTimeout(() => {
            client.end();
            reject(new Error('SSH connection timeout (10s)'));
        }, 10000);
        
        client.on('ready', () => {
            clearTimeout(timeout);
            console.log(`✅ SSH connected: ${sessionId}`);
            
            // Create shell session
            client.shell((err, stream) => {
                if (err) {
                    client.end();
                    return reject(new Error(`Failed to create shell: ${err.message}`));
                }
                
                // Store session
                sshSessions.set(sessionId, {
                    client,
                    stream,
                    socket: socket.id
                });
                
                // Handle stream data
                stream.on('data', (data) => {
                    socket.emit('terminal_output', {
                        sessionId,
                        output: data.toString()
                    });
                });
                
                stream.on('close', () => {
                    console.log(`🔌 SSH session closed: ${sessionId}`);
                    sshSessions.delete(sessionId);
                    client.end();
                    socket.emit('terminal_disconnected', { sessionId });
                });
                
                stream.on('error', (error) => {
                    console.error(`SSH stream error (${sessionId}):`, error);
                    socket.emit('terminal_error', { 
                        sessionId, 
                        error: error.message 
                    });
                });
                
                // Auto-start Claude Code in current directory
                setTimeout(() => {
                    console.log(`🤖 Auto-starting Claude Code for session: ${sessionId}`);
                    socket.emit('terminal_output', {
                        sessionId,
                        output: '\r\n🤖 Starting Claude Code...\r\n'
                    });
                    
                    // Just start Claude in whatever directory we're in
                    stream.write('claude\r');
                    
                    // Notify that Claude is starting
                    setTimeout(() => {
                        socket.emit('claude-started', { sessionId });
                    }, 3000);
                }, 1500);
                
                resolve({ sessionId, stream });
            });
        });
        
        client.on('error', (error) => {
            clearTimeout(timeout);
            console.error(`SSH connection error (${sessionId}):`, error);
            reject(new Error(`SSH connection failed: ${error.message}`));
        });
        
        // Connect
        client.connect({
            host: config.host,
            username: config.username || 'ubuntu',
            privateKey: config.privateKey,
            port: config.port || 22,
            readyTimeout: 8000
        });
    });
}

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'claude-terminal.html'));
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        sessions: sshSessions.size,
        timestamp: new Date().toISOString()
    });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`📱 Client connected: ${socket.id}`);
    
    socket.on('terminal_connect', async (config) => {
        const sessionId = `ssh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        try {
            console.log(`🔄 Creating SSH session: ${sessionId}`);
            await createSSHSession(sessionId, config, socket);
            
            socket.emit('terminal_connected', {
                sessionId,
                message: 'SSH connection established'
            });
            
        } catch (error) {
            console.error(`❌ SSH connection failed: ${error.message}`);
            socket.emit('terminal_error', {
                error: error.message
            });
        }
    });
    
    socket.on('terminal_input', (data) => {
        const { sessionId, input } = data;
        const session = sshSessions.get(sessionId);
        
        if (!session) {
            socket.emit('terminal_error', {
                sessionId,
                error: 'Session not found'
            });
            return;
        }
        
        // Send input to SSH stream
        session.stream.write(input);
        
        // Check if starting Claude
        if (input.trim().toLowerCase() === 'claude') {
            setTimeout(() => {
                socket.emit('claude-started', { sessionId });
            }, 2000);
        }
    });
    
    socket.on('terminal_resize', (data) => {
        const { sessionId, cols, rows } = data;
        const session = sshSessions.get(sessionId);
        
        if (session?.stream?.setWindow) {
            session.stream.setWindow(rows, cols);
        }
    });
    
    socket.on('disconnect', () => {
        console.log(`📱 Client disconnected: ${socket.id}`);
        
        // Clean up any sessions for this socket
        for (const [sessionId, session] of sshSessions.entries()) {
            if (session.socket === socket.id) {
                console.log(`🧹 Cleaning up session: ${sessionId}`);
                session.client.end();
                sshSessions.delete(sessionId);
            }
        }
    });
});

// Graceful shutdown
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

function cleanup() {
    console.log('\n🛑 Shutting down server...');
    
    // Close all SSH connections
    for (const [sessionId, session] of sshSessions.entries()) {
        console.log(`🧹 Closing SSH session: ${sessionId}`);
        session.client.end();
    }
    
    sshSessions.clear();
    
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
}

// Start server
server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 Claude Terminal: http://localhost:${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log('');
    console.log('📋 Instructions:');
    console.log(`1. Open http://localhost:${PORT} in your browser`);
    console.log('2. Click Config and paste your EC2 SSH private key');
    console.log('3. Configure your EC2 connection details');
    console.log('4. Click Connect to establish SSH');
    console.log('5. Click Start Claude to begin interactive session');
    console.log('');
    console.log('🔑 SSH Key Required:');
    console.log('   Paste your EC2 private key content in the config panel');
    console.log('');
});

export { app, server, io };
