/**
 * Preview Service
 *
 * Manages preview instances for team projects
 * - Clones repositories
 * - Detects project types
 * - Runs projects on allocated ports
 * - Manages process lifecycle
 */
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { portAllocator } from './port-allocator.js';
class PreviewService extends EventEmitter {
    constructor() {
        super();
        this.previews = new Map();
        this.baseDir = path.join(process.cwd(), '.previews');
        this.initializeService();
    }
    async initializeService() {
        // Create base directory for previews
        try {
            await fs.mkdir(this.baseDir, { recursive: true });
        }
        catch (error) {
            console.error('Failed to create preview directory:', error);
        }
        console.log('🚀 Preview service initialized with intelligent port allocation');
        // Set up periodic health monitoring
        // DISABLED: Health monitoring is killing the server process itself
        // this.startHealthMonitoring();
    }
    getPreviewKey(teamId, branch) {
        return `${teamId}-${branch}`;
    }
    async getPreviewStatus(teamId, branch) {
        const key = this.getPreviewKey(teamId, branch);
        const preview = this.previews.get(key);
        if (!preview) {
            return { status: 'stopped', message: 'Preview not running' };
        }
        // Get meaningful message based on status
        let message = '';
        if (preview.status === 'running') {
            message = `Preview running on port ${preview.port}`;
        }
        else if (preview.status === 'starting') {
            message = `Preview is starting on port ${preview.port}`;
        }
        else if (preview.status === 'error') {
            // Get the last error message from logs
            const errorLogs = preview.logs.filter(log => log.includes('Error') || log.includes('Failed'));
            if (errorLogs.length > 0) {
                message = errorLogs[errorLogs.length - 1].replace(/^(Error:|Failed to start preview:)\s*/, '');
            }
            else {
                message = 'Preview failed to start';
            }
        }
        else {
            message = `Preview ${preview.status}`;
        }
        return {
            status: preview.status,
            port: preview.port,
            message,
            deploymentMeta: preview.deploymentMeta
        };
    }
    async getPreviewInfo(teamId, branch) {
        const key = this.getPreviewKey(teamId, branch);
        const preview = this.previews.get(key);
        if (!preview) {
            return null;
        }
        return {
            status: preview.status,
            port: preview.port,
            pid: preview.process?.pid,
            deploymentMeta: preview.deploymentMeta
        };
    }
    async createPreview(config) {
        const { teamId, branch, repositoryUrl } = config;
        const key = this.getPreviewKey(teamId, branch);
        // Stop existing preview if running
        await this.stopPreview(teamId, branch);
        // Allocate port using intelligent allocator
        const port = await portAllocator.allocatePort();
        if (!port) {
            throw new Error('No available ports for preview - all ports in range 4000-8999 are occupied');
        }
        console.log(`🔌 Allocated port ${port} for ${teamId}/${branch}`);
        // Create preview entry
        this.previews.set(key, {
            port,
            status: 'starting',
            logs: []
        });
        // Clone and run project asynchronously
        this.startPreviewAsync(teamId, branch, repositoryUrl, port).catch(error => {
            // If the async process fails, update the preview status
            const failedPreview = this.previews.get(key);
            if (failedPreview) {
                failedPreview.status = 'error';
                failedPreview.logs.push(`Failed to start preview: ${error.message}`);
            }
        });
        return { port, status: 'starting' };
    }
    async startPreviewAsync(teamId, branch, repositoryUrl, port) {
        const key = this.getPreviewKey(teamId, branch);
        const preview = this.previews.get(key);
        const buildStartTime = Date.now();
        try {
            // Clone repository
            const projectDir = path.join(this.baseDir, teamId, branch);
            await this.cloneRepository(repositoryUrl, projectDir, branch);
            // Collect git metadata after cloning
            const deploymentMeta = await this.collectGitMetadata(projectDir, repositoryUrl, branch);
            preview.deploymentMeta = deploymentMeta;
            // Detect project type
            const projectType = await this.detectProjectType(projectDir);
            // Install dependencies if needed
            if (projectType.installCommand) {
                deploymentMeta.buildStatus = 'building';
                await this.runCommand(projectType.installCommand, projectDir);
            }
            // Start the project
            const process = await this.startProject(projectDir, projectType, port);
            // Calculate build duration
            const buildDuration = Date.now() - buildStartTime;
            deploymentMeta.buildDuration = buildDuration;
            deploymentMeta.buildStatus = 'success';
            // Update preview info
            preview.process = process;
            preview.status = 'running';
            // Emit WebSocket event for status update
            this.emit('status-change', {
                teamId,
                branch,
                status: 'running',
                port,
                url: `/api/preview/${teamId}/${branch}/`,
                deploymentMeta
            });
            // Handle process events
            process.stdout?.on('data', (data) => {
                const log = data.toString();
                preview.logs.push(log);
                this.emit('log', { teamId, branch, log });
            });
            process.stderr?.on('data', (data) => {
                const log = data.toString();
                preview.logs.push(log);
                this.emit('log', { teamId, branch, log });
            });
            process.on('exit', (code) => {
                preview.status = 'stopped';
                portAllocator.releasePort(port);
                this.emit('stopped', { teamId, branch, code });
            });
        }
        catch (error) {
            // Mark build as failed
            if (preview.deploymentMeta) {
                preview.deploymentMeta.buildStatus = 'failed';
                preview.deploymentMeta.buildDuration = Date.now() - buildStartTime;
            }
            preview.status = 'error';
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            preview.logs.push(`Error: ${errorMessage}`);
            portAllocator.releasePort(port);
            // Emit WebSocket event for error
            this.emit('status-change', {
                teamId,
                branch,
                status: 'error',
                port,
                error: errorMessage
            });
            throw error;
        }
    }
    async collectGitMetadata(projectDir, repositoryUrl, branch) {
        try {
            // Get commit hash
            const commitHash = await this.runCommand('git rev-parse HEAD', projectDir);
            // Get commit message
            const commitMessage = await this.runCommand('git log -1 --pretty=%B', projectDir);
            // Get commit author
            const commitAuthor = await this.runCommand('git log -1 --pretty=%an', projectDir);
            // Get commit date
            const commitDate = await this.runCommand('git log -1 --pretty=%ai', projectDir);
            return {
                commitHash: commitHash.trim().substring(0, 8), // Short hash
                commitMessage: commitMessage.trim().split('\n')[0], // First line only
                commitAuthor: commitAuthor.trim(),
                commitDate: commitDate.trim(),
                branch,
                repositoryUrl,
                deployedAt: new Date().toISOString(),
                buildStatus: 'building'
            };
        }
        catch (error) {
            // Fallback metadata if git commands fail
            return {
                commitHash: 'unknown',
                commitMessage: 'Unable to fetch commit info',
                commitAuthor: 'unknown',
                commitDate: new Date().toISOString(),
                branch,
                repositoryUrl,
                deployedAt: new Date().toISOString(),
                buildStatus: 'building'
            };
        }
    }
    async cloneRepository(repositoryUrl, targetDir, branch) {
        // Clean up existing directory
        try {
            await fs.rm(targetDir, { recursive: true, force: true });
        }
        catch { }
        // Create parent directory
        await fs.mkdir(targetDir, { recursive: true });
        // First, check if the branch exists
        try {
            // Use git ls-remote to check if branch exists without cloning
            const checkCommand = `git ls-remote --heads ${repositoryUrl} refs/heads/${branch}`;
            const result = await this.runCommand(checkCommand, process.cwd());
            if (!result || result.trim() === '') {
                throw new Error(`Branch '${branch}' does not exist in repository. Please create the '${branch}' branch in your repository first, or use 'main' branch instead.`);
            }
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('does not exist')) {
                throw error; // Re-throw our custom error
            }
            // For other errors (network, auth, etc), try to clone anyway
            console.warn(`Could not verify branch existence: ${error}`);
        }
        // Clone repository
        try {
            await this.runCommand(`git clone --branch ${branch} --single-branch ${repositoryUrl} .`, targetDir);
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Remote branch')) {
                throw new Error(`Branch '${branch}' not found in repository. Please ensure the '${branch}' branch exists in your repository.`);
            }
            throw error;
        }
    }
    async detectProjectType(projectDir) {
        // Check for package.json (Node.js projects)
        try {
            const packageJsonPath = path.join(projectDir, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
            // Detect framework from dependencies
            const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
            // React/Vite project
            if (deps.react || deps.vite) {
                return {
                    type: 'react',
                    installCommand: 'npm install',
                    startCommand: packageJson.scripts?.dev || packageJson.scripts?.start || 'npm run dev',
                    port: 5173, // Vite default
                    envPort: 'VITE_PORT'
                };
            }
            // Next.js project
            if (deps.next) {
                return {
                    type: 'nextjs',
                    installCommand: 'npm install',
                    startCommand: packageJson.scripts?.dev || 'npm run dev',
                    port: 3000,
                    envPort: 'PORT'
                };
            }
            // Vue project
            if (deps.vue) {
                return {
                    type: 'vue',
                    installCommand: 'npm install',
                    startCommand: packageJson.scripts?.dev || packageJson.scripts?.serve || 'npm run serve',
                    port: 8080,
                    envPort: 'PORT'
                };
            }
            // Generic Node.js
            return {
                type: 'node',
                installCommand: 'npm install',
                startCommand: packageJson.scripts?.start || 'node index.js',
                port: 3000,
                envPort: 'PORT'
            };
        }
        catch { }
        // Python project
        try {
            await fs.access(path.join(projectDir, 'requirements.txt'));
            return {
                type: 'python',
                installCommand: 'pip install -r requirements.txt',
                startCommand: 'python app.py',
                port: 5000,
                envPort: 'PORT'
            };
        }
        catch { }
        // Static HTML
        return {
            type: 'static',
            startCommand: 'npx http-server -p',
            port: 8080
        };
    }
    async runCommand(command, cwd) {
        return new Promise((resolve, reject) => {
            const proc = spawn(command, {
                cwd,
                shell: true,
                stdio: 'pipe'
            });
            let output = '';
            proc.stdout?.on('data', (data) => output += data.toString());
            proc.stderr?.on('data', (data) => output += data.toString());
            proc.on('exit', (code) => {
                if (code === 0) {
                    resolve(output);
                }
                else {
                    reject(new Error(`Command failed: ${command}\n${output}`));
                }
            });
        });
    }
    async startProject(projectDir, projectType, port) {
        // Build start command with port
        let startCommand = projectType.startCommand;
        // Add port to command if needed
        if (projectType.type === 'static') {
            startCommand = `${startCommand} ${port}`;
        }
        // Set environment variables
        const env = { ...process.env };
        if (projectType.envPort) {
            env[projectType.envPort] = port.toString();
        }
        env.PORT = port.toString(); // Always set PORT as fallback
        // Start the process
        const proc = spawn(startCommand, {
            cwd: projectDir,
            shell: true,
            stdio: 'pipe',
            env
        });
        if (!proc.pid) {
            throw new Error('Failed to start preview process');
        }
        // Wait for the server to actually start serving content
        await this.waitForServerReady(port, 30000); // Wait up to 30 seconds
        return proc;
    }
    async waitForServerReady(port, timeoutMs) {
        const startTime = Date.now();
        const http = await import('http');
        while (Date.now() - startTime < timeoutMs) {
            try {
                await new Promise((resolve, reject) => {
                    const req = http.request({
                        hostname: 'localhost',
                        port,
                        method: 'HEAD',
                        timeout: 1000
                    }, (res) => {
                        resolve();
                    });
                    req.on('error', () => reject());
                    req.on('timeout', () => reject());
                    req.end();
                });
                // Server is responding
                return;
            }
            catch {
                // Server not ready yet, wait and retry
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        throw new Error(`Server failed to start on port ${port} within ${timeoutMs}ms`);
    }
    async stopPreview(teamId, branch) {
        const key = this.getPreviewKey(teamId, branch);
        const preview = this.previews.get(key);
        if (!preview) {
            return;
        }
        // Kill the process
        if (preview.process) {
            try {
                // Kill process group to ensure all child processes are terminated
                process.kill(-preview.process.pid, 'SIGTERM');
            }
            catch {
                // Try regular kill if group kill fails
                try {
                    preview.process.kill('SIGTERM');
                }
                catch { }
            }
        }
        // Release port
        portAllocator.releasePort(preview.port);
        // Remove from map
        this.previews.delete(key);
    }
    async getPreviewLogs(teamId, branch) {
        const key = this.getPreviewKey(teamId, branch);
        const preview = this.previews.get(key);
        if (!preview) {
            return ['Preview not running'];
        }
        return preview.logs.slice(-100); // Return last 100 log lines
    }
    /**
     * Get port allocation statistics
     */
    getPortStats() {
        return portAllocator.getStats();
    }
    /**
     * Periodic health monitoring of preview instances
     */
    startHealthMonitoring() {
        setInterval(async () => {
            try {
                const { unhealthy } = await portAllocator.performHealthCheck();
                // Handle unhealthy previews
                for (const port of unhealthy) {
                    const preview = Array.from(this.previews.entries())
                        .find(([_, p]) => p.port === port);
                    if (preview) {
                        const [key, previewData] = preview;
                        console.warn(`⚠️ Preview on port ${port} is unresponsive, marking as stopped`);
                        previewData.status = 'stopped';
                        previewData.logs.push('Preview became unresponsive and was stopped');
                        portAllocator.releasePort(port);
                        const [teamId, branch] = key.split('-');
                        this.emit('stopped', { teamId, branch, reason: 'unresponsive' });
                    }
                }
            }
            catch (error) {
                console.error('Health monitoring error:', error);
            }
        }, 60000); // Check every minute
    }
}
// Export singleton instance
export const previewService = new PreviewService();
