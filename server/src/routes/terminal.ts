import express from 'express';
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';

const router = express.Router();
const execAsync = promisify(exec);

// Persistent Claude Code connection
class ClaudeCodeAgent {
    private process: ChildProcess | null = null;
    private isRunning: boolean = false;
    private messageQueue: Array<{ resolve: Function, reject: Function, timeout: NodeJS.Timeout }> = [];
    private currentResponse: string = '';
    
    constructor() {
        this.startClaudeProcess();
    }
    
    private startClaudeProcess() {
        try {
            console.log('🚀 Starting persistent Claude Code connection...');
            
            // Try to spawn Claude Code process - fall back to mock if not available
            this.process = spawn('claude', [], {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true
            });
            
            if (!this.process.stdout || !this.process.stderr || !this.process.stdin) {
                throw new Error('Failed to create Claude process pipes');
            }
            
            this.process.stdout.on('data', (data: Buffer) => {
                const output = data.toString();
                this.handleClaudeOutput(output);
            });
            
            this.process.stderr.on('data', (data: Buffer) => {
                console.error('Claude stderr:', data.toString());
            });
            
            this.process.on('error', (error) => {
                console.error('Claude process error:', error);
                this.isRunning = false;
                // Restart after delay
                setTimeout(() => this.startClaudeProcess(), 5000);
            });
            
            this.process.on('exit', (code) => {
                console.log(`Claude process exited with code ${code}`);
                this.isRunning = false;
                // Restart after delay
                setTimeout(() => this.startClaudeProcess(), 5000);
            });
            
            this.isRunning = true;
            console.log('✅ Claude Code agent started successfully');
            
        } catch (error) {
            console.warn('⚠️  Could not start Claude Code, using mock mode:', (error as Error).message);
            this.isRunning = false; // Will use fallback mode
        }
    }
    
    private handleClaudeOutput(output: string) {
        this.currentResponse += output;
        
        // If we have a waiting message, resolve it
        if (this.messageQueue.length > 0) {
            const { resolve, timeout } = this.messageQueue.shift()!;
            clearTimeout(timeout);
            resolve(this.currentResponse.trim());
            this.currentResponse = '';
        }
    }
    
    async sendMessage(message: string): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.isRunning || !this.process || !this.process.stdin) {
                // Fallback to system command execution
                this.executeSystemCommand(message).then(resolve).catch(reject);
                return;
            }
            
            try {
                this.currentResponse = '';
                this.process.stdin.write(message + '\n');
                
                // Set timeout for response
                const timeout = setTimeout(() => {
                    const index = this.messageQueue.findIndex(item => item.resolve === resolve);
                    if (index !== -1) {
                        this.messageQueue.splice(index, 1);
                    }
                    reject(new Error('Claude response timeout'));
                }, 30000);
                
                this.messageQueue.push({ resolve, reject, timeout });
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    private async executeSystemCommand(command: string): Promise<string> {
        // Built-in commands
        if (command.trim() === 'help') {
            return `Claude Code Terminal - Available commands:
- Any text: Send message to Claude Code agent
- System commands: pwd, ls, date, whoami, echo
- Type naturally to interact with Claude

Agent Status: ${this.isRunning ? 'Connected' : 'Fallback Mode'}`;
        }
        
        if (command.startsWith('echo ')) {
            return command.substring(5);
        }
        
        // Execute system commands as fallback
        try {
            const { stdout, stderr } = await execAsync(command, { 
                timeout: 10000,
                cwd: process.env['HOME'] || process.cwd()
            });
            return stdout + (stderr ? '\n' + stderr : '');
        } catch (error) {
            return `Error: ${(error as Error).message}`;
        }
    }
    
    getStatus() {
        return {
            isRunning: this.isRunning,
            queueLength: this.messageQueue.length,
            hasProcess: !!this.process
        };
    }
}

// Create the persistent Claude Code agent instance
const claudeAgent = new ClaudeCodeAgent();

/**
 * GET /api/terminal/status
 * Get the status of the persistent Claude Code agent
 */
router.get('/status', (_req, res) => {
    try {
        const status = claudeAgent.getStatus();
        
        res.json({
            success: true,
            agent: {
                running: status.isRunning,
                queueLength: status.queueLength,
                hasProcess: status.hasProcess
            },
            message: status.isRunning ? 'Claude Code agent is running' : 'Agent in fallback mode'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get status: ' + (error as Error).message
        });
    }
});

/**
 * POST /api/terminal/message
 * Send a message to the persistent Claude Code agent
 */
router.post('/message', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Message is required and must be a string'
            });
        }
        
        console.log(`Sending message to Claude Code: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
        
        try {
            const response = await claudeAgent.sendMessage(message);
            
            res.json({
                success: true,
                message: message,
                response: response,
                agent: claudeAgent.getStatus()
            });
            
        } catch (error) {
            console.error('Claude message error:', error);
            res.json({
                success: false,
                error: (error as Error).message,
                message: message
            });
        }
        
    } catch (error) {
        console.error('Terminal message error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send message: ' + (error as Error).message
        });
    }
});

/**
 * POST /api/terminal/restart
 * Restart the Claude Code agent (for debugging)
 */
router.post('/restart', (_req, res) => {
    try {
        console.log('🔄 Restarting Claude Code agent...');
        
        // Create a new agent instance (the old one will be garbage collected)
        const newAgent = new ClaudeCodeAgent();
        
        // Replace the global agent reference
        Object.setPrototypeOf(claudeAgent, Object.getPrototypeOf(newAgent));
        Object.assign(claudeAgent, newAgent);
        
        res.json({
            success: true,
            message: 'Claude Code agent restarted successfully'
        });
        
    } catch (error) {
        console.error('Terminal restart error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to restart agent: ' + (error as Error).message
        });
    }
});


export default router;