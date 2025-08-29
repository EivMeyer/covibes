/**
 * SSH Service for Agent Execution
 *
 * Handles SSH connections to VMs for agent command execution
 * Requirements:
 * - Connect to EC2 instances via SSH
 * - Execute Claude agent commands
 * - Stream command output in real-time
 * - Handle connection errors and timeouts
 * - Encrypt/decrypt SSH keys stored in database
 */
import { Client } from 'ssh2';
import { readFileSync } from 'fs';
import { EventEmitter } from 'events';
/**
 * SSH service for executing commands on remote VMs
 */
export class SSHService extends EventEmitter {
    constructor() {
        super(...arguments);
        this.connections = new Map();
        this.defaultTimeout = 30000; // 30 seconds
    }
    /**
     * Create SSH connection to a VM
     */
    async connect(vmId, connection) {
        return new Promise((resolve, reject) => {
            const client = new Client();
            // Set connection timeout
            const connectTimeout = setTimeout(() => {
                client.end();
                reject(new Error(`SSH connection timeout for VM ${vmId}`));
            }, 10000);
            client.on('ready', () => {
                clearTimeout(connectTimeout);
                this.connections.set(vmId, client);
                this.emit('connected', vmId);
                resolve(true);
            });
            client.on('error', (err) => {
                clearTimeout(connectTimeout);
                this.emit('connection-error', vmId, err);
                reject(new Error(`SSH connection failed for VM ${vmId}: ${err.message}`));
            });
            client.on('close', () => {
                this.connections.delete(vmId);
                this.emit('disconnected', vmId);
            });
            try {
                client.connect({
                    host: connection.host,
                    username: connection.username,
                    privateKey: connection.privateKey,
                    passphrase: '', // Empty passphrase for unencrypted keys
                    port: connection.port || 22,
                    readyTimeout: 8000
                });
            }
            catch (error) {
                clearTimeout(connectTimeout);
                reject(error);
            }
        });
    }
    /**
     * Execute command on VM via SSH
     */
    async executeCommand(vmId, execution) {
        const client = this.connections.get(vmId);
        if (!client) {
            throw new Error(`No SSH connection found for VM ${vmId}`);
        }
        return new Promise((resolve, reject) => {
            const { command, workingDirectory, timeout = this.defaultTimeout } = execution;
            // Prepare command with working directory
            const fullCommand = workingDirectory
                ? `cd "${workingDirectory}" && ${command}`
                : command;
            // Set command timeout
            const commandTimeout = setTimeout(() => {
                reject(new Error(`Command execution timeout for VM ${vmId}`));
            }, timeout);
            client.exec(fullCommand, (err, stream) => {
                if (err) {
                    clearTimeout(commandTimeout);
                    reject(new Error(`Failed to execute command on VM ${vmId}: ${err.message}`));
                    return;
                }
                let stdout = '';
                let stderr = '';
                let exitCode = null;
                stream.on('close', (code) => {
                    clearTimeout(commandTimeout);
                    exitCode = code;
                    resolve({
                        success: code === 0,
                        stdout,
                        stderr,
                        exitCode,
                        error: code !== 0 ? `Command exited with code ${code}` : undefined
                    });
                });
                stream.on('data', (data) => {
                    const output = data.toString();
                    stdout += output;
                    this.emit('command-output', vmId, output, 'stdout');
                });
                stream.stderr.on('data', (data) => {
                    const output = data.toString();
                    stderr += output;
                    this.emit('command-output', vmId, output, 'stderr');
                });
                stream.on('error', (streamErr) => {
                    clearTimeout(commandTimeout);
                    reject(new Error(`Stream error for VM ${vmId}: ${streamErr.message}`));
                });
            });
        });
    }
    /**
     * Execute Claude agent command with special handling
     */
    async executeAgentCommand(vmId, agentType, task, repositoryUrl) {
        const client = this.connections.get(vmId);
        if (!client) {
            throw new Error(`No SSH connection found for VM ${vmId}`);
        }
        // Prepare Claude command based on agent type and task
        let claudeCommand;
        if (!task.trim()) {
            // No initial task - start interactive Claude session
            claudeCommand = repositoryUrl
                ? `claude --mode interactive --repository "${repositoryUrl}"`
                : `claude --mode interactive`;
        }
        else if (agentType === 'code-writer') {
            claudeCommand = repositoryUrl
                ? `claude --mode code --repository "${repositoryUrl}" --task "${task}"`
                : `claude --mode code --task "${task}"`;
        }
        else {
            claudeCommand = `claude --mode general --task "${task}"`;
        }
        // Set working directory to a projects folder
        const workingDirectory = repositoryUrl
            ? `/home/ubuntu/projects/${this.extractRepoName(repositoryUrl)}`
            : '/home/ubuntu/workspace';
        // Clone repository if URL provided
        if (repositoryUrl) {
            const repoName = this.extractRepoName(repositoryUrl);
            const cloneCommand = `mkdir -p /home/ubuntu/projects && cd /home/ubuntu/projects && git clone "${repositoryUrl}" "${repoName}" 2>/dev/null || echo "Repository already exists or clone failed"`;
            try {
                await this.executeCommand(vmId, { command: cloneCommand, timeout: 60000 });
            }
            catch (error) {
                console.warn(`Failed to clone repository ${repositoryUrl}:`, error);
            }
        }
        // Execute the Claude command
        return this.executeCommand(vmId, {
            command: claudeCommand,
            workingDirectory,
            timeout: 300000 // 5 minutes for agent execution
        });
    }
    /**
     * Stream command execution with real-time output
     */
    async streamCommand(vmId, execution, onOutput) {
        const client = this.connections.get(vmId);
        if (!client) {
            throw new Error(`No SSH connection found for VM ${vmId}`);
        }
        return new Promise((resolve, reject) => {
            const { command, workingDirectory, timeout = this.defaultTimeout } = execution;
            const fullCommand = workingDirectory
                ? `cd "${workingDirectory}" && ${command}`
                : command;
            const commandTimeout = setTimeout(() => {
                reject(new Error(`Streaming command timeout for VM ${vmId}`));
            }, timeout);
            client.exec(fullCommand, (err, stream) => {
                if (err) {
                    clearTimeout(commandTimeout);
                    reject(new Error(`Failed to execute streaming command on VM ${vmId}: ${err.message}`));
                    return;
                }
                let stdout = '';
                let stderr = '';
                let exitCode = null;
                stream.on('close', (code) => {
                    clearTimeout(commandTimeout);
                    exitCode = code;
                    resolve({
                        success: code === 0,
                        stdout,
                        stderr,
                        exitCode,
                        error: code !== 0 ? `Command exited with code ${code}` : undefined
                    });
                });
                stream.on('data', (data) => {
                    const output = data.toString();
                    stdout += output;
                    onOutput(output, 'stdout');
                    this.emit('stream-output', vmId, output, 'stdout');
                });
                stream.stderr.on('data', (data) => {
                    const output = data.toString();
                    stderr += output;
                    onOutput(output, 'stderr');
                    this.emit('stream-output', vmId, output, 'stderr');
                });
                stream.on('error', (streamErr) => {
                    clearTimeout(commandTimeout);
                    reject(new Error(`Streaming error for VM ${vmId}: ${streamErr.message}`));
                });
            });
        });
    }
    /**
     * Check if VM connection is active
     */
    isConnected(vmId) {
        return this.connections.has(vmId);
    }
    /**
     * Disconnect from VM
     */
    disconnect(vmId) {
        const client = this.connections.get(vmId);
        if (client) {
            client.end();
            this.connections.delete(vmId);
        }
    }
    /**
     * Disconnect from all VMs
     */
    disconnectAll() {
        for (const [vmId, client] of Array.from(this.connections.entries())) {
            client.end();
        }
        this.connections.clear();
    }
    /**
     * Get list of connected VMs
     */
    getConnectedVMs() {
        return Array.from(this.connections.keys());
    }
    /**
     * Extract repository name from URL
     */
    extractRepoName(repositoryUrl) {
        const match = repositoryUrl.match(/\/([^\/]+)\.git$/) || repositoryUrl.match(/\/([^\/]+)\/?$/);
        return match ? match[1] : 'project';
    }
}
// Singleton instance
export const sshService = new SSHService();
/**
 * Load SSH private key from file system - USE EXACT CONFIGURED PATH
 */
export function loadSSHKey(keyPath) {
    try {
        const key = readFileSync(keyPath, 'utf8');
        console.log(`🔑 Using SSH key: ${keyPath} (${key.length} bytes)`);
        return key;
    }
    catch (error) {
        throw new Error(`Failed to load SSH key from ${keyPath}: ${error.message}`);
    }
}
/**
 * Create SSH connection configuration for EC2 instance
 */
export function createEC2Connection(host, privateKeyPath) {
    return {
        host,
        username: 'ubuntu', // Default EC2 username
        privateKey: loadSSHKey(privateKeyPath),
        port: 22
    };
}
export default SSHService;
