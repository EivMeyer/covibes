"use strict";
/**
 * Docker Container Management Service
 *
 * Manages Claude agent containers and preview containers with:
 * - Container lifecycle management (spawn, stop, cleanup)
 * - Terminal connections for xterm.js
 * - Port allocation for services
 * - Shared workspace volume management
 * - Container status tracking
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dockerManager = void 0;
const client_1 = require("@prisma/client");
const events_1 = require("events");
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const port_allocator_js_1 = require("../../services/port-allocator.js");
const ssh_js_1 = require("../../services/ssh.js");
const prisma = new client_1.PrismaClient();
// VM Configuration - in production this would come from user's VM settings
const DEFAULT_VM = {
    host: process.env['EC2_HOST'] || 'ec2-13-60-242-174.eu-north-1.compute.amazonaws.com',
    username: process.env['EC2_USERNAME'] || 'ubuntu',
    keyPath: process.env['EC2_SSH_KEY_PATH'] || './.ssh/ec2.pem',
    vmId: 'main-ec2'
};
class DockerManager extends events_1.EventEmitter {
    constructor() {
        super();
        this.containers = new Map();
        this.AGENT_IMAGE = 'colabvibe-claude-agent';
        this.PREVIEW_IMAGE = 'colabvibe-preview';
        this.WORKSPACE_BASE = '/tmp/colabvibe-workspaces';
        this.ensureWorkspaceDir();
        this.initializeEC2Connection().then(() => {
            this.loadExistingContainers();
        }).catch(error => {
            console.error('Failed to initialize EC2 connection:', error);
        });
    }
    /**
     * Initialize SSH connection to EC2 VM
     */
    async initializeEC2Connection() {
        try {
            const connection = (0, ssh_js_1.createEC2Connection)(DEFAULT_VM.host, DEFAULT_VM.keyPath);
            await ssh_js_1.sshService.connect(DEFAULT_VM.vmId, connection);
            console.log('✅ EC2 SSH connection established for Docker management');
        }
        catch (error) {
            console.error('❌ Failed to establish EC2 SSH connection for Docker:', error);
            throw error;
        }
    }
    /**
     * Ensure workspace directory exists
     */
    async ensureWorkspaceDir() {
        try {
            await promises_1.default.mkdir(this.WORKSPACE_BASE, { recursive: true });
        }
        catch (error) {
            console.error('Failed to create workspace directory:', error);
        }
    }
    /**
     * Load existing containers from database on startup
     */
    async loadExistingContainers() {
        try {
            const existingContainers = await prisma.containerInstance.findMany({
                where: {
                    status: { in: ['starting', 'running'] }
                }
            });
            for (const container of existingContainers) {
                if (container.containerId) {
                    try {
                        // Check if container exists on EC2 VM
                        const statusCheck = await ssh_js_1.sshService.executeCommand(DEFAULT_VM.vmId, {
                            command: `docker inspect ${container.containerId} --format='{{.State.Running}}'`,
                            timeout: 10000
                        });
                        const isRunning = statusCheck.stdout.trim() === 'true';
                        this.containers.set(container.id, {
                            id: container.id,
                            containerId: container.containerId,
                            type: container.type,
                            status: isRunning ? 'running' : 'stopped',
                            terminalPort: container.terminalPort || undefined,
                            previewPort: container.previewPort || undefined,
                            agentId: container.agentId || undefined,
                            teamId: container.teamId,
                            userId: container.userId,
                            metadata: container.metadata
                        });
                        // Update database if status changed
                        if (!isRunning && container.status === 'running') {
                            await this.updateContainerStatus(container.id, 'stopped');
                        }
                    }
                    catch (sshError) {
                        console.warn(`Container ${container.containerId} not found on EC2 VM, marking as stopped`);
                        await this.updateContainerStatus(container.id, 'stopped');
                    }
                }
            }
            console.log(`Loaded ${this.containers.size} existing containers from EC2 VM`);
        }
        catch (error) {
            console.error('Failed to load existing containers:', error);
        }
    }
    /**
     * Build the Claude agent Docker image on the EC2 VM
     */
    async buildAgentImage() {
        try {
            console.log('Building Claude agent Docker image on EC2 VM...');
            // First, copy the Dockerfile to the VM
            const dockerfilePath = path_1.default.join(process.cwd(), 'docker', 'claude-agent', 'Dockerfile');
            const dockerfileContent = await promises_1.default.readFile(dockerfilePath, 'utf8');
            // Create the Dockerfile on the VM
            await ssh_js_1.sshService.executeCommand(DEFAULT_VM.vmId, {
                command: `cat > /tmp/Dockerfile << 'EOF'\n${dockerfileContent}\nEOF`,
                timeout: 10000
            });
            // Build the Docker image on the VM
            const buildResult = await ssh_js_1.sshService.executeCommand(DEFAULT_VM.vmId, {
                command: `cd /tmp && docker build -t ${this.AGENT_IMAGE} -f Dockerfile .`,
                timeout: 300000 // 5 minutes for build
            });
            if (buildResult.stderr && buildResult.stderr.includes('ERROR')) {
                throw new Error(`Docker build failed: ${buildResult.stderr}`);
            }
            console.log('Claude agent Docker image built successfully on EC2');
        }
        catch (error) {
            console.error('Failed to build Claude agent image on EC2:', error);
            throw error;
        }
    }
    /**
     * Get team workspace directory
     */
    getTeamWorkspace(teamId) {
        return path_1.default.join(this.WORKSPACE_BASE, teamId);
    }
    /**
     * Ensure team workspace exists on EC2 VM and clone repository
     */
    async ensureTeamWorkspace(teamId, repoUrl) {
        const workspaceDir = `/home/ubuntu/colabvibe-workspaces/${teamId}`;
        try {
            // Create workspace directory on EC2 VM
            await ssh_js_1.sshService.executeCommand(DEFAULT_VM.vmId, {
                command: `mkdir -p ${workspaceDir}`,
                timeout: 5000
            });
            // Check if git repository exists
            const gitCheck = await ssh_js_1.sshService.executeCommand(DEFAULT_VM.vmId, {
                command: `test -d ${workspaceDir}/.git && echo "exists" || echo "missing"`,
                timeout: 5000
            });
            if (gitCheck.stdout.includes('missing') && repoUrl) {
                console.log(`Cloning repository ${repoUrl} to EC2 workspace ${teamId}`);
                await ssh_js_1.sshService.executeCommand(DEFAULT_VM.vmId, {
                    command: `cd ${workspaceDir} && git clone ${repoUrl} . || echo "# Team ${teamId} Workspace\n\nRepository: ${repoUrl}" > README.md`,
                    timeout: 30000
                });
            }
            return workspaceDir;
        }
        catch (error) {
            console.error(`Failed to setup team workspace ${teamId} on EC2:`, error);
            throw error;
        }
    }
    /**
     * Get or create a user's persistent container
     */
    async getUserContainer(userId, teamId, workspaceRepo) {
        // Check if user already has a container for this team
        const existingContainer = await prisma.containerInstance.findFirst({
            where: {
                userId,
                teamId,
                type: 'user-claude-agent',
                status: { in: ['starting', 'running'] }
            }
        });
        if (existingContainer) {
            // Verify container is still running on EC2 VM
            const containerInfo = this.containers.get(existingContainer.id);
            if (containerInfo && existingContainer.containerId) {
                try {
                    const statusCheck = await ssh_js_1.sshService.executeCommand(DEFAULT_VM.vmId, {
                        command: `docker inspect ${existingContainer.containerId} --format='{{.State.Running}}'`,
                        timeout: 10000
                    });
                    if (statusCheck.stdout.trim() === 'true') {
                        console.log(`Using existing container for user ${userId}: ${existingContainer.containerId}`);
                        return containerInfo;
                    }
                }
                catch (error) {
                    console.warn(`Container ${existingContainer.containerId} not found on EC2 VM, will recreate`);
                }
            }
        }
        // Create new user container
        return this.createUserContainer({ userId, teamId, workspaceRepo });
    }
    /**
     * Create a new user container with Claude CLI
     */
    async createUserContainer(options) {
        console.log(`Creating new user container for user ${options.userId} in team ${options.teamId}`);
        try {
            // Ensure workspace exists
            const workspaceDir = await this.ensureTeamWorkspace(options.teamId, options.workspaceRepo);
            // Allocate terminal port for SSH access
            const terminalPort = await port_allocator_js_1.portAllocator.allocatePort('terminal');
            // Create container record in database
            const containerRecord = await prisma.containerInstance.create({
                data: {
                    teamId: options.teamId,
                    userId: options.userId,
                    type: 'user-claude-agent',
                    status: 'starting',
                    terminalPort,
                    metadata: {
                        workspaceRepo: options.workspaceRepo,
                        createdAt: new Date().toISOString(),
                        tmuxSessions: []
                    }
                }
            });
            // Create Docker container on EC2 VM with SSH server for terminal access
            const containerName = `claude-user-${options.userId}-${containerRecord.id}`;
            const dockerRunCmd = [
                'docker run -d',
                `--name ${containerName}`,
                `-p ${terminalPort}:22`, // SSH port for terminal access
                `-v ${workspaceDir}:/workspace:rw`,
                `--memory 4g --cpus="2"`, // Resource limits
                '--restart unless-stopped',
                `-e TEAM_ID=${options.teamId}`,
                `-e USER_ID=${options.userId}`,
                `-e TERMINAL_PORT=${terminalPort}`,
                `--workdir /workspace`,
                this.AGENT_IMAGE
            ].join(' ');
            // Execute docker run command on EC2 VM
            const runResult = await ssh_js_1.sshService.executeCommand(DEFAULT_VM.vmId, {
                command: dockerRunCmd,
                timeout: 60000
            });
            if (runResult.stderr && runResult.stderr.includes('Error')) {
                throw new Error(`Docker run failed: ${runResult.stderr}`);
            }
            const containerId = runResult.stdout.trim();
            // Update database with container ID
            await prisma.containerInstance.update({
                where: { id: containerRecord.id },
                data: {
                    containerId: containerId,
                    status: 'running'
                }
            });
            const containerInfo = {
                id: containerRecord.id,
                containerId: containerId,
                type: 'user-claude-agent',
                status: 'running',
                terminalPort,
                teamId: options.teamId,
                userId: options.userId,
                metadata: containerRecord.metadata
            };
            this.containers.set(containerRecord.id, containerInfo);
            // Emit event
            this.emit('container-started', containerInfo);
            console.log(`User container spawned: ${containerId} for user ${options.userId}`);
            return containerInfo;
        }
        catch (error) {
            console.error('Failed to create user container:', error);
            throw error;
        }
    }
    /**
     * Spawn an agent as a tmux session in user's container
     */
    async spawnAgentInContainer(options) {
        try {
            // Get or create user's container
            const container = await this.getUserContainer(options.userId, options.teamId, options.workspaceRepo);
            if (!container.containerId) {
                throw new Error('Container ID not available');
            }
            // Create unique session name for the agent
            const sessionId = `agent-${options.agentId}`;
            console.log(`Creating tmux session ${sessionId} in container ${container.containerId}`);
            // Create tmux session inside the Docker container on EC2 VM
            const createSessionCmd = `docker exec -d ${container.containerId} tmux new-session -d -s ${sessionId} -c /workspace bash -c 'echo "Agent ${options.agentId} started for task: ${options.task}"; echo "Run: claude login (first time only)"; echo "Then: claude \\"${options.task}\\""; bash'`;
            await ssh_js_1.sshService.executeCommand(DEFAULT_VM.vmId, {
                command: createSessionCmd,
                timeout: 10000
            });
            // Update container metadata with new session
            const currentMetadata = container.metadata || {};
            const tmuxSessions = currentMetadata.tmuxSessions || [];
            tmuxSessions.push({
                sessionId,
                agentId: options.agentId,
                task: options.task,
                status: 'active',
                createdAt: new Date().toISOString()
            });
            // Update database
            await prisma.containerInstance.update({
                where: { id: container.id },
                data: {
                    metadata: {
                        ...currentMetadata,
                        tmuxSessions
                    }
                }
            });
            container.metadata = { ...currentMetadata, tmuxSessions };
            console.log(`Agent ${options.agentId} spawned as tmux session ${sessionId}`);
            return { container, sessionId };
        }
        catch (error) {
            console.error('Failed to spawn agent in container:', error);
            throw error;
        }
    }
    /**
     * Detect project type from workspace directory on EC2 VM
     */
    async detectProjectTypeOnEC2(workspaceDir) {
        try {
            // Check for package.json (Node.js projects)
            const packageJsonCheck = await ssh_js_1.sshService.executeCommand(DEFAULT_VM.vmId, {
                command: `test -f ${workspaceDir}/package.json && cat ${workspaceDir}/package.json`,
                timeout: 10000
            });
            if (packageJsonCheck.stdout) {
                try {
                    const packageJson = JSON.parse(packageJsonCheck.stdout);
                    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                    // React/Vite project
                    if (deps.react || deps.vite) {
                        return {
                            type: 'react',
                            startCommand: packageJson.scripts?.dev || packageJson.scripts?.start || 'npm run dev',
                            envPort: 'VITE_PORT'
                        };
                    }
                    // Next.js project
                    if (deps.next) {
                        return {
                            type: 'nextjs',
                            startCommand: packageJson.scripts?.dev || 'npm run dev',
                            envPort: 'PORT'
                        };
                    }
                    // Vue project
                    if (deps.vue) {
                        return {
                            type: 'vue',
                            startCommand: packageJson.scripts?.dev || packageJson.scripts?.serve || 'npm run serve',
                            envPort: 'PORT'
                        };
                    }
                    // Generic Node.js
                    return {
                        type: 'node',
                        startCommand: packageJson.scripts?.start || 'node index.js',
                        envPort: 'PORT'
                    };
                }
                catch (parseError) {
                    console.warn('Failed to parse package.json, falling back to detection');
                }
            }
            // Check for Python files
            const pythonCheck = await ssh_js_1.sshService.executeCommand(DEFAULT_VM.vmId, {
                command: `test -f ${workspaceDir}/requirements.txt || test -f ${workspaceDir}/app.py || test -f ${workspaceDir}/main.py`,
                timeout: 5000
            });
            if (pythonCheck.code === 0) {
                return {
                    type: 'python',
                    startCommand: 'python -m http.server 3000',
                    envPort: 'PORT'
                };
            }
            // Check for static HTML
            const htmlCheck = await ssh_js_1.sshService.executeCommand(DEFAULT_VM.vmId, {
                command: `test -f ${workspaceDir}/index.html || test -f ${workspaceDir}/public/index.html`,
                timeout: 5000
            });
            if (htmlCheck.code === 0) {
                return {
                    type: 'static',
                    startCommand: 'python -m http.server 3000'
                };
            }
            // Default fallback
            return {
                type: 'generic',
                startCommand: 'python -m http.server 3000'
            };
        }
        catch (error) {
            console.warn('Project type detection failed, using default:', error);
            return {
                type: 'generic',
                startCommand: 'python -m http.server 3000'
            };
        }
    }
    /**
     * Spawn a preview container on EC2 VM
     */
    async spawnPreviewContainer(options) {
        console.log(`Creating preview container for team ${options.teamId} on EC2 VM`);
        try {
            // Check if preview container already exists for this team
            const existing = await prisma.containerInstance.findFirst({
                where: {
                    teamId: options.teamId,
                    type: 'preview',
                    status: { in: ['starting', 'running'] }
                }
            });
            if (existing && existing.containerId) {
                // Verify container is still running on EC2
                try {
                    const statusCheck = await ssh_js_1.sshService.executeCommand(DEFAULT_VM.vmId, {
                        command: `docker inspect ${existing.containerId} --format='{{.State.Running}}'`,
                        timeout: 10000
                    });
                    if (statusCheck.stdout.trim() === 'true') {
                        console.log(`Using existing preview container for team ${options.teamId}: ${existing.containerId}`);
                        return this.containers.get(existing.id) || {
                            id: existing.id,
                            containerId: existing.containerId,
                            type: 'preview',
                            status: 'running',
                            previewPort: existing.previewPort || undefined,
                            teamId: options.teamId,
                            userId: options.userId,
                            metadata: existing.metadata
                        };
                    }
                }
                catch (error) {
                    console.warn(`Preview container ${existing.containerId} not found on EC2, will recreate`);
                }
            }
            // Ensure workspace exists and get path
            const workspaceDir = await this.ensureTeamWorkspace(options.teamId);
            // Detect project type from workspace
            const projectConfig = await this.detectProjectTypeOnEC2(workspaceDir);
            console.log(`Detected project type: ${projectConfig.type} for team ${options.teamId}`);
            // Allocate preview port
            const previewPort = await port_allocator_js_1.portAllocator.allocatePort('preview');
            // Create container record
            const containerRecord = await prisma.containerInstance.create({
                data: {
                    teamId: options.teamId,
                    userId: options.userId,
                    type: 'preview',
                    status: 'starting',
                    previewPort,
                    metadata: {
                        projectType: projectConfig.type,
                        branch: options.branch,
                        startCommand: projectConfig.startCommand,
                        detectedAt: new Date().toISOString()
                    }
                }
            });
            // Create preview container on EC2 VM
            const containerName = `preview-${options.teamId}-${containerRecord.id}`;
            // Build Docker run command based on project type
            let dockerRunCmd;
            if (projectConfig.type === 'react' || projectConfig.type === 'node' || projectConfig.type === 'vue' || projectConfig.type === 'nextjs') {
                // Node.js based projects
                dockerRunCmd = [
                    'docker run -d',
                    `--name ${containerName}`,
                    `-p ${previewPort}:3000`,
                    `-v ${workspaceDir}:/workspace:rw`,
                    `--memory 2g --cpus="1"`,
                    '--restart unless-stopped',
                    `-e NODE_ENV=development`,
                    `-e PORT=3000`,
                    `-e HOST=0.0.0.0`,
                    projectConfig.envPort ? `-e ${projectConfig.envPort}=3000` : '',
                    `--workdir /workspace`,
                    'node:18-alpine',
                    'sh', '-c',
                    `'apk add --no-cache git python3 make g++ && if [ -f package.json ]; then npm install --no-fund --no-audit && ${projectConfig.startCommand}; else python3 -m http.server 3000; fi'`
                ].filter(Boolean).join(' ');
            }
            else if (projectConfig.type === 'python') {
                // Python projects  
                dockerRunCmd = [
                    'docker run -d',
                    `--name ${containerName}`,
                    `-p ${previewPort}:3000`,
                    `-v ${workspaceDir}:/workspace:rw`,
                    `--memory 1g --cpus="1"`,
                    '--restart unless-stopped',
                    `-e PORT=3000`,
                    `--workdir /workspace`,
                    'python:3.9-alpine',
                    'sh', '-c',
                    `'if [ -f requirements.txt ]; then pip install -r requirements.txt; fi && ${projectConfig.startCommand}'`
                ].join(' ');
            }
            else {
                // Static/generic projects
                dockerRunCmd = [
                    'docker run -d',
                    `--name ${containerName}`,
                    `-p ${previewPort}:3000`,
                    `-v ${workspaceDir}:/workspace:rw`,
                    `--memory 512m --cpus="0.5"`,
                    '--restart unless-stopped',
                    `--workdir /workspace`,
                    'python:3.9-alpine',
                    'sh', '-c',
                    `'${projectConfig.startCommand}'`
                ].join(' ');
            }
            console.log(`Starting preview container on EC2: ${containerName}`);
            // Execute docker run command on EC2 VM
            const runResult = await ssh_js_1.sshService.executeCommand(DEFAULT_VM.vmId, {
                command: dockerRunCmd,
                timeout: 120000 // 2 minutes for container startup
            });
            if (runResult.stderr && runResult.stderr.includes('Error')) {
                throw new Error(`Preview container creation failed: ${runResult.stderr}`);
            }
            const containerId = runResult.stdout.trim();
            // Update database with container ID
            await prisma.containerInstance.update({
                where: { id: containerRecord.id },
                data: {
                    containerId: containerId,
                    status: 'running'
                }
            });
            const containerInfo = {
                id: containerRecord.id,
                containerId: containerId,
                type: 'preview',
                status: 'running',
                previewPort,
                teamId: options.teamId,
                userId: options.userId,
                metadata: {
                    ...containerRecord.metadata,
                    startCommand: projectConfig.startCommand
                }
            };
            this.containers.set(containerRecord.id, containerInfo);
            // Emit event
            this.emit('container-started', containerInfo);
            console.log(`Preview container created on EC2: ${containerId} (${projectConfig.type}) for team ${options.teamId} on port ${previewPort}`);
            return containerInfo;
        }
        catch (error) {
            console.error('Failed to spawn preview container on EC2:', error);
            throw error;
        }
    }
    /**
     * Get Docker configuration for preview containers based on project type
     */
    getPreviewContainerConfig(projectType, workspaceDir, port) {
        const baseConfig = {
            WorkingDir: '/workspace',
            HostConfig: {
                Binds: [`${workspaceDir}:/workspace:rw`],
                PortBindings: {
                    '3000/tcp': [{ HostPort: port.toString() }]
                },
                Memory: 1 * 1024 * 1024 * 1024, // 1GB memory limit
                RestartPolicy: { Name: 'unless-stopped' }
            },
            AttachStdout: true,
            AttachStderr: true
        };
        switch (projectType) {
            case 'react':
            case 'vue':
            case 'node':
                return {
                    ...baseConfig,
                    Image: 'node:18-alpine',
                    Cmd: ['sh', '-c', 'npm install && npm run dev || npm start || python3 -m http.server 3000'],
                    Env: ['PORT=3000', 'HOST=0.0.0.0']
                };
            case 'python':
                return {
                    ...baseConfig,
                    Image: 'python:3.9-alpine',
                    Cmd: ['sh', '-c', 'pip install -r requirements.txt 2>/dev/null || true && python -m http.server 3000'],
                    Env: ['PORT=3000']
                };
            case 'static':
            default:
                return {
                    ...baseConfig,
                    Image: 'nginx:alpine',
                    HostConfig: {
                        ...baseConfig.HostConfig,
                        Binds: [`${workspaceDir}:/usr/share/nginx/html:ro`]
                    }
                };
        }
    }
    /**
     * Get terminal connection info for a container
     */
    async getContainerTerminal(containerId) {
        const container = Array.from(this.containers.values()).find(c => c.containerId === containerId);
        if (!container || !container.terminalPort) {
            return null;
        }
        return {
            containerId,
            terminalPort: container.terminalPort,
            wsUrl: `ws://localhost:${container.terminalPort}/terminal`
        };
    }
    /**
     * Stop a container on EC2 VM
     */
    async stopContainer(containerId) {
        try {
            const containerInfo = Array.from(this.containers.values()).find(c => c.containerId === containerId);
            if (!containerInfo) {
                throw new Error(`Container ${containerId} not found`);
            }
            // Stop container on EC2 VM
            await ssh_js_1.sshService.executeCommand(DEFAULT_VM.vmId, {
                command: `docker stop ${containerId}`,
                timeout: 30000
            });
            // Update status
            await this.updateContainerStatus(containerInfo.id, 'stopped');
            // Release ports
            if (containerInfo.terminalPort) {
                await port_allocator_js_1.portAllocator.releasePort(containerInfo.terminalPort);
            }
            if (containerInfo.previewPort) {
                await port_allocator_js_1.portAllocator.releasePort(containerInfo.previewPort);
            }
            this.emit('container-stopped', containerInfo);
            console.log(`Container ${containerId} stopped on EC2 VM`);
        }
        catch (error) {
            console.error(`Failed to stop container ${containerId} on EC2:`, error);
            throw error;
        }
    }
    /**
     * Remove a container completely from EC2 VM
     */
    async removeContainer(containerId) {
        try {
            await this.stopContainer(containerId);
            // Remove container on EC2 VM
            await ssh_js_1.sshService.executeCommand(DEFAULT_VM.vmId, {
                command: `docker rm ${containerId}`,
                timeout: 30000
            });
            const containerInfo = Array.from(this.containers.values()).find(c => c.containerId === containerId);
            if (containerInfo) {
                // Remove from database
                await prisma.containerInstance.delete({
                    where: { id: containerInfo.id }
                });
                this.containers.delete(containerInfo.id);
                this.emit('container-removed', containerInfo);
            }
            console.log(`Container ${containerId} removed from EC2 VM`);
        }
        catch (error) {
            console.error(`Failed to remove container ${containerId} from EC2:`, error);
            throw error;
        }
    }
    /**
     * Get container status via SSH on EC2 VM
     */
    async getContainerStatus(containerId) {
        const containerInfo = Array.from(this.containers.values()).find(c => c.containerId === containerId);
        if (!containerInfo) {
            return null;
        }
        try {
            // Check container status on EC2 VM
            const statusCheck = await ssh_js_1.sshService.executeCommand(DEFAULT_VM.vmId, {
                command: `docker inspect ${containerId} --format='{{.State.Running}}'`,
                timeout: 10000
            });
            const isRunning = statusCheck.stdout.trim() === 'true';
            const status = isRunning ? 'running' : 'stopped';
            // Update status if changed
            if (status !== containerInfo.status) {
                await this.updateContainerStatus(containerInfo.id, status);
                containerInfo.status = status;
            }
            return containerInfo;
        }
        catch (error) {
            console.error(`Failed to get status for container ${containerId} on EC2:`, error);
            return containerInfo;
        }
    }
    /**
     * List all containers for a team
     */
    async getTeamContainers(teamId) {
        return Array.from(this.containers.values()).filter(c => c.teamId === teamId);
    }
    /**
     * Clean up stopped containers
     */
    async cleanupStoppedContainers() {
        try {
            const stoppedContainers = await prisma.containerInstance.findMany({
                where: {
                    status: 'stopped',
                    updatedAt: {
                        lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Older than 24 hours
                    }
                }
            });
            for (const container of stoppedContainers) {
                if (container.containerId) {
                    try {
                        // Remove container from EC2 VM
                        await ssh_js_1.sshService.executeCommand(DEFAULT_VM.vmId, {
                            command: `docker rm ${container.containerId}`,
                            timeout: 30000
                        });
                        console.log(`Cleaned up stopped container on EC2: ${container.containerId}`);
                    }
                    catch (error) {
                        console.warn(`Failed to remove container ${container.containerId} from EC2:`, error);
                    }
                }
                // Remove from database
                await prisma.containerInstance.delete({
                    where: { id: container.id }
                });
                this.containers.delete(container.id);
            }
            console.log(`Cleaned up ${stoppedContainers.length} stopped containers`);
        }
        catch (error) {
            console.error('Failed to cleanup stopped containers:', error);
        }
    }
    /**
     * Update container status in database
     */
    async updateContainerStatus(id, status) {
        await prisma.containerInstance.update({
            where: { id },
            data: { status, updatedAt: new Date() }
        });
    }
    /**
     * Execute command in container via SSH on EC2 VM
     */
    async execCommand(containerId, command) {
        try {
            const dockerExecCmd = `docker exec ${containerId} sh -c "${command.replace(/"/g, '\\"')}"`;
            const result = await ssh_js_1.sshService.executeCommand(DEFAULT_VM.vmId, {
                command: dockerExecCmd,
                timeout: 30000
            });
            return {
                stdout: result.stdout || '',
                stderr: result.stderr || ''
            };
        }
        catch (error) {
            console.error(`Failed to execute command in container ${containerId} via SSH:`, error);
            throw error;
        }
    }
}
// Singleton instance
exports.dockerManager = new DockerManager();
// Initialize on startup - wait a bit for SSH connections to be established
setTimeout(async () => {
    try {
        // Check if agent image exists on EC2 VM
        const imageCheck = await ssh_js_1.sshService.executeCommand(DEFAULT_VM.vmId, {
            command: 'docker images --format "{{.Repository}}:{{.Tag}}" | grep colabvibe-claude-agent',
            timeout: 10000
        });
        if (!imageCheck.stdout.includes('colabvibe-claude-agent')) {
            console.log('Claude agent image not found on EC2 VM, building...');
            await exports.dockerManager.buildAgentImage();
        }
        else {
            console.log('Claude agent Docker image found on EC2 VM');
        }
        // Start cleanup interval
        setInterval(() => {
            exports.dockerManager.cleanupStoppedContainers();
        }, 60 * 60 * 1000); // Every hour
    }
    catch (error) {
        console.error('Failed to initialize Docker manager:', error);
        console.log('Will continue without building Docker image - you may need to build it manually on EC2');
    }
}, 2000); // Wait 2 seconds for SSH connections to establish
