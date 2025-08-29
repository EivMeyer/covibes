#!/usr/bin/env node
/**
 * Claude Agent Service
 * 
 * Provides HTTP API and WebSocket connectivity for Claude agents
 * running in Docker containers. Handles:
 * - Task execution requests
 * - Real-time output streaming
 * - Health monitoring
 * - File system change notifications
 */

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

// Configuration from environment
const config = {
    port: process.env.AGENT_PORT || 8080,
    agentId: process.env.CLAUDE_AGENT_ID || 'default',
    agentType: process.env.CLAUDE_AGENT_TYPE || 'code-writer',
    workspacePath: process.env.WORKSPACE_PATH || '/workspace',
    teamId: process.env.TEAM_ID || 'default',
    repositoryUrl: process.env.REPOSITORY_URL || '',
    gitBranch: process.env.GIT_BRANCH || 'main',
    socketUrl: process.env.SOCKET_URL || '',
    claudeApiKey: process.env.CLAUDE_API_KEY || ''
};

// Event emitter for agent communication
const agentEvents = new EventEmitter();

// Current task execution state
let currentTask = null;
let taskHistory = [];

// Logging utility
const log = (level, message, data = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        agentId: config.agentId,
        message,
        ...data
    };
    console.log(JSON.stringify(logEntry));
    
    // Send to backend service if configured
    if (config.socketUrl) {
        notifyBackend('log', logEntry).catch(() => {});
    }
};

// Notify backend service
const notifyBackend = async (event, data) => {
    if (!config.socketUrl) return;
    
    try {
        const response = await fetch(`${config.socketUrl}/api/agents/${config.agentId}/events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event,
                data,
                timestamp: new Date().toISOString()
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        // Silently fail backend notifications to avoid affecting agent operation
    }
};

// Execute Claude agent task
const executeTask = async (task, mode = 'general') => {
    return new Promise((resolve, reject) => {
        log('info', 'Starting task execution', { task, mode });
        
        const agentWrapper = '/usr/local/bin/claude-agent';
        const args = ['execute', task, mode];
        
        // Set environment for subprocess
        const env = {
            ...process.env,
            CLAUDE_API_KEY: config.claudeApiKey,
            ANTHROPIC_API_KEY: config.claudeApiKey
        };
        
        const childProcess = spawn(agentWrapper, args, {
            cwd: config.workspacePath,
            env,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let stdout = '';
        let stderr = '';
        
        // Track current task
        currentTask = {
            id: Date.now().toString(),
            task,
            mode,
            startTime: new Date(),
            status: 'running',
            process: childProcess
        };
        
        // Handle stdout
        childProcess.stdout.on('data', (data) => {
            const output = data.toString();
            stdout += output;
            
            // Emit real-time output
            agentEvents.emit('output', {
                type: 'stdout',
                data: output,
                timestamp: new Date()
            });
            
            log('debug', 'Task output', { output: output.trim() });
        });
        
        // Handle stderr
        childProcess.stderr.on('data', (data) => {
            const output = data.toString();
            stderr += output;
            
            agentEvents.emit('output', {
                type: 'stderr',
                data: output,
                timestamp: new Date()
            });
            
            log('warn', 'Task error output', { output: output.trim() });
        });
        
        // Handle process completion
        childProcess.on('close', (code) => {
            const endTime = new Date();
            const duration = endTime - currentTask.startTime;
            
            const result = {
                success: code === 0,
                exitCode: code,
                stdout,
                stderr,
                duration,
                startTime: currentTask.startTime,
                endTime
            };
            
            // Update task status
            currentTask.status = code === 0 ? 'completed' : 'failed';
            currentTask.result = result;
            
            // Add to history
            taskHistory.unshift({
                ...currentTask,
                result
            });
            
            // Keep only last 10 tasks in memory
            if (taskHistory.length > 10) {
                taskHistory = taskHistory.slice(0, 10);
            }
            
            log('info', 'Task execution completed', {
                success: result.success,
                exitCode: code,
                duration
            });
            
            currentTask = null;
            
            if (code === 0) {
                resolve(result);
            } else {
                reject(new Error(`Task failed with exit code ${code}: ${stderr}`));
            }
        });
        
        // Handle process errors
        childProcess.on('error', (error) => {
            log('error', 'Task execution error', { error: error.message });
            currentTask.status = 'error';
            currentTask = null;
            reject(error);
        });
    });
};

// Health check function
const healthCheck = async () => {
    const checks = {
        timestamp: new Date().toISOString(),
        agentId: config.agentId,
        status: 'healthy',
        checks: {}
    };
    
    try {
        // Check workspace accessibility
        await fs.access(config.workspacePath, fs.constants.R_OK | fs.constants.W_OK);
        checks.checks.workspace = 'ok';
    } catch (error) {
        checks.checks.workspace = 'error';
        checks.status = 'unhealthy';
    }
    
    // Check Claude CLI
    try {
        const { spawn } = require('child_process');
        const claudeCheck = spawn('claude', ['--version'], { stdio: 'pipe' });
        await new Promise((resolve, reject) => {
            claudeCheck.on('close', (code) => {
                if (code === 0) {
                    checks.checks.claude = 'ok';
                    resolve();
                } else {
                    checks.checks.claude = 'error';
                    checks.status = 'unhealthy';
                    reject();
                }
            });
        });
    } catch (error) {
        checks.checks.claude = 'error';
        checks.status = 'unhealthy';
    }
    
    // Check API key
    checks.checks.apiKey = config.claudeApiKey ? 'ok' : 'missing';
    if (!config.claudeApiKey) {
        checks.status = 'unhealthy';
    }
    
    return checks;
};

// HTTP request handler
const handleRequest = async (req, res) => {
    const { method, url } = req;
    const [, ...pathParts] = url.split('/');
    const path = pathParts.join('/');
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    try {
        switch (true) {
            case method === 'GET' && path === 'health':
                const health = await healthCheck();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(health));
                break;
                
            case method === 'GET' && path === 'status':
                const status = {
                    agentId: config.agentId,
                    agentType: config.agentType,
                    currentTask: currentTask ? {
                        id: currentTask.id,
                        task: currentTask.task,
                        status: currentTask.status,
                        startTime: currentTask.startTime
                    } : null,
                    taskHistory: taskHistory.slice(0, 5).map(t => ({
                        id: t.id,
                        task: t.task,
                        status: t.status,
                        startTime: t.startTime,
                        duration: t.result?.duration
                    }))
                };
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(status));
                break;
                
            case method === 'POST' && path === 'execute':
                if (currentTask) {
                    res.writeHead(409, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Task already running' }));
                    return;
                }
                
                const body = await new Promise((resolve) => {
                    let data = '';
                    req.on('data', chunk => data += chunk);
                    req.on('end', () => resolve(data));
                });
                
                const { task, mode = 'general' } = JSON.parse(body);
                
                if (!task) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Task is required' }));
                    return;
                }
                
                try {
                    const result = await executeTask(task, mode);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: error.message }));
                }
                break;
                
            case method === 'POST' && path === 'stop':
                if (currentTask && currentTask.process) {
                    currentTask.process.kill('SIGTERM');
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'No running task' }));
                }
                break;
                
            default:
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not found' }));
        }
    } catch (error) {
        log('error', 'Request handling error', { error: error.message, url });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
    }
};

// Start HTTP server
const server = http.createServer(handleRequest);

server.listen(config.port, () => {
    log('info', 'Agent service started', {
        port: config.port,
        agentId: config.agentId,
        agentType: config.agentType,
        workspacePath: config.workspacePath
    });
    
    // Notify backend that agent is ready
    notifyBackend('agent-ready', {
        agentId: config.agentId,
        port: config.port
    }).catch(() => {});
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
    log('info', 'Received SIGTERM, shutting down gracefully');
    
    if (currentTask && currentTask.process) {
        currentTask.process.kill('SIGTERM');
    }
    
    server.close(() => {
        log('info', 'Agent service stopped');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    log('info', 'Received SIGINT, shutting down gracefully');
    process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    log('error', 'Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    log('error', 'Unhandled rejection', { reason, promise });
    process.exit(1);
});