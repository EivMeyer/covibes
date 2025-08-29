/**
 * Local Docker Manager
 * 
 * Terminal manager that uses local Docker containers for isolation.
 * Implements the TerminalManager interface for Docker-based terminals.
 */

import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import * as pty from 'node-pty';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { TerminalManager, TerminalSession, TerminalOptions } from './terminal-manager-interface.js';
import { sshService } from '../../services/ssh.js';
import { portAllocator } from '../../services/port-allocator.js';

// Note: This is adapted from the original docker-manager.ts
// Removed EC2/SSH dependencies since we're focusing on local Docker only

function createEC2Connection(host: string, keyPath: string) {
  return {
    host,
    port: 22,
    username: 'ubuntu',
    privateKey: keyPath
  };
}

const prisma = new PrismaClient();

// VM Configuration - in production this would come from user's VM settings
const DEFAULT_VM = {
  host: (() => {
    const ec2Host = process.env['EC2_HOST'];
    if (!ec2Host) {
      throw new Error('EC2_HOST environment variable is required. Set it to your EC2 instance hostname.');
    }
    return ec2Host;
  })(),
  username: (() => {
    const ec2Username = process.env['EC2_USERNAME'];
    if (!ec2Username) {
      throw new Error('EC2_USERNAME environment variable is required. Set it to your EC2 SSH username.');
    }
    return ec2Username;
  })(),
  keyPath: (() => {
    const sshKeyPath = process.env['EC2_SSH_KEY_PATH'];
    if (!sshKeyPath) {
      throw new Error('EC2_SSH_KEY_PATH environment variable is required. Set it to your SSH key file path.');
    }
    return sshKeyPath;
  })(),
  vmId: 'main-ec2'
};

export interface ContainerInfo {
  id: string;
  containerId: string;
  type: 'claude-agent' | 'preview';
  status: 'starting' | 'running' | 'stopped' | 'error';
  terminalPort?: number | undefined;
  previewPort?: number | undefined;
  agentId?: string | undefined;
  teamId: string;
  userId: string;
  metadata: Record<string, any>;
}

export interface TerminalInfo {
  containerId: string;
  terminalPort: number;
  wsUrl: string;
}

export interface SpawnAgentOptions {
  userId: string;
  teamId: string;
  agentId: string;
  task: string;
  workspaceRepo?: string;
}

export interface UserContainerOptions {
  userId: string;
  teamId: string;
  workspaceRepo?: string | undefined;
}

export interface TmuxSessionInfo {
  sessionId: string;
  agentId: string;
  task: string;
  status: 'active' | 'detached';
}

export interface PTYInfo {
  agentId: string;
  containerId: string;
  ptyProcess?: any;
  status: 'running' | 'stopped';
  createdAt: Date;
  lastActivity?: Date;  // Track last interaction
}

export interface SpawnPreviewOptions {
  teamId: string;
  userId: string;
  projectType: string;
  branch: string;
}

class DockerManager extends EventEmitter implements TerminalManager {
  private containers: Map<string, ContainerInfo> = new Map();
  private activePTYSessions: Map<string, PTYInfo> = new Map();
  private readonly AGENT_IMAGE = 'colabvibe-claude-agent';
  private readonly WORKSPACE_BASE = path.join(os.homedir(), '.covibes/workspaces');
  private readonly LOCAL_WORKSPACE_BASE = path.join(os.homedir(), '.covibes/workspaces');
  private isEC2Available = false;

  constructor() {
    super();
    this.ensureWorkspaceDir();
    
    // Force local Docker mode for development
    const forceLocal = process.env['NODE_ENV'] === 'development' || !process.env['EC2_HOST'];
    
    if (forceLocal) {
      console.log('🐳 Using local Docker mode for agent containers');
      this.isEC2Available = false;
      this.loadExistingContainers();
    } else {
      this.initializeEC2Connection().then(() => {
        this.loadExistingContainers();
      }).catch(error => {
        console.error('Failed to initialize EC2 connection, falling back to local Docker:', error);
        this.isEC2Available = false;
        this.loadExistingContainers();
      });
    }
  }

  /**
   * Initialize SSH connection to EC2 VM (optional - falls back to local Docker)
   */
  private async initializeEC2Connection(): Promise<void> {
    try {
      const connection = createEC2Connection(DEFAULT_VM.host, DEFAULT_VM.keyPath);
      await sshService.connect(DEFAULT_VM.vmId, connection);
      console.log('✅ EC2 SSH connection established for Docker management');
      this.isEC2Available = true;
    } catch (error: any) {
      console.warn('⚠️ EC2 SSH connection failed, will use local Docker instead:', error.message);
      this.isEC2Available = false;
      // Don't throw - allow fallback to local Docker execution
    }
  }

  /**
   * Wait for container to be ready for PTY connections
   */
  private async waitForContainerReady(containerId: string, maxRetries: number = 30): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Check if container is running
        const statusResult = await this.executeDockerCommandLocally(`docker inspect ${containerId} --format={{.State.Running}}`);
        if (statusResult.code !== 0 || statusResult.stdout.trim() !== 'true') {
          console.log(`🕒 Container ${containerId} not running yet, attempt ${i + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        // Check if developer user exists and shell is available
        const userCheckResult = await this.executeDockerCommandLocally(`docker exec ${containerId} id developer 2>/dev/null`);
        const bashCheckResult = await this.executeDockerCommandLocally(`docker exec ${containerId} which bash 2>/dev/null`);
        
        if (userCheckResult.code === 0 && bashCheckResult.code === 0) {
          console.log(`✅ Container ${containerId} is ready (developer user and bash available)`);
          return;
        }
        
        console.log(`🕒 Container ${containerId} not fully ready yet, attempt ${i + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error: any) {
        console.warn(`⚠️ Error checking container readiness: ${error.message}, attempt ${i + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error(`Container ${containerId} failed to become ready after ${maxRetries} attempts`);
  }

  /**
   * Execute Docker command locally
   */
  private async executeDockerCommandLocally(command: string): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve, reject) => {
      // Use shell to execute the full command to handle complex arguments properly
      const dockerProcess = spawn('/bin/bash', ['-c', command], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      dockerProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      dockerProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      dockerProcess.on('close', (code) => {
        resolve({ stdout, stderr, code: code || 0 });
      });

      dockerProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Ensure workspace directory exists
   */
  private async ensureWorkspaceDir(): Promise<void> {
    try {
      await fs.mkdir(this.WORKSPACE_BASE, { recursive: true });
    } catch (error: any) {
      console.error('Failed to create workspace directory:', error);
    }
  }

  /**
   * Load existing containers from database on startup (supports local Docker)
   */
  private async loadExistingContainers(): Promise<void> {
    try {
      const existingContainers = await prisma.container_instances.findMany({
        where: {
          status: { in: ['starting', 'running'] }
        }
      });

      for (const container of existingContainers) {
        if (container.containerId) {
          try {
            let isRunning = false;
            
            if (this.isEC2Available) {
              // Check if container exists on EC2 VM
              const statusCheck = await sshService.executeCommand(DEFAULT_VM.vmId, {
                command: `docker inspect ${container.containerId} --format='{{.State.Running}}'`,
                timeout: 10000
              });
              isRunning = statusCheck.stdout.trim() === 'true';
            } else {
              // Check if container exists locally
              const statusResult = await this.executeDockerCommandLocally(`docker inspect ${container.containerId} --format={{.State.Running}}`);
              isRunning = statusResult.code === 0 && statusResult.stdout.trim() === 'true';
            }
            
            this.containers.set(container.id, {
              id: container.id,
              containerId: container.containerId,
              type: container.type as 'claude-agent' | 'preview',
              status: isRunning ? 'running' : 'stopped',
              terminalPort: container.terminalPort || undefined,
              previewPort: container.previewPort || undefined,
              agentId: container.agentId || undefined,
              teamId: container.teamId,
              userId: container.userId,
              metadata: container.metadata as Record<string, any>
            });

            // Update database if status changed
            if (!isRunning && container.status === 'running') {
              await this.updateContainerStatus(container.id, 'stopped');
            }
          } catch (error: any) {
            console.warn(`Container ${container.containerId} not found, marking as stopped:`, error.message);
            await this.updateContainerStatus(container.id, 'stopped');
          }
        }
      }

      const location = this.isEC2Available ? 'EC2 VM' : 'local Docker';
      console.log(`Loaded ${this.containers.size} existing containers from ${location}`);
    } catch (error: any) {
      console.error('Failed to load existing containers:', error);
    }
  }

  /**
   * Build the Claude agent Docker image on the EC2 VM
   */
  async buildAgentImage(): Promise<void> {
    try {
      console.log('Building Claude agent Docker image on EC2 VM...');
      
      // First, copy the Dockerfile to the VM
      const dockerfilePath = path.join(process.cwd(), 'docker', 'claude-agent', 'Dockerfile');
      const dockerfileContent = await fs.readFile(dockerfilePath, 'utf8');
      
      // Create the Dockerfile on the VM
      await sshService.executeCommand(DEFAULT_VM.vmId, {
        command: `cat > /tmp/Dockerfile << 'EOF'\n${dockerfileContent}\nEOF`,
        timeout: 10000
      });
      
      // Build the Docker image on the VM
      const buildResult = await sshService.executeCommand(DEFAULT_VM.vmId, {
        command: `cd /tmp && docker build -t ${this.AGENT_IMAGE} -f Dockerfile .`,
        timeout: 300000 // 5 minutes for build
      });
      
      if (buildResult.stderr && buildResult.stderr.includes('ERROR')) {
        throw new Error(`Docker build failed: ${buildResult.stderr}`);
      }
      
      console.log('Claude agent Docker image built successfully on EC2');
    } catch (error: any) {
      console.error('Failed to build Claude agent image on EC2:', error);
      throw error;
    }
  }


  /**
   * Ensure team workspace exists on EC2 VM and clone repository
   */
  private async ensureTeamWorkspace(teamId: string, repoUrl?: string): Promise<string> {
    const workspaceDir = `/home/ubuntu/.covibes/workspaces/${teamId}`;
    
    try {
      // Create workspace directory on EC2 VM
      await sshService.executeCommand(DEFAULT_VM.vmId, {
        command: `mkdir -p ${workspaceDir}`,
        timeout: 5000
      });
      
      // Check if git repository exists
      const gitCheck = await sshService.executeCommand(DEFAULT_VM.vmId, {
        command: `test -d ${workspaceDir}/.git && echo "exists" || echo "missing"`,
        timeout: 5000
      });
      
      if (gitCheck.stdout.includes('missing') && repoUrl) {
        console.log(`Cloning repository ${repoUrl} to EC2 workspace ${teamId}`);
        await sshService.executeCommand(DEFAULT_VM.vmId, {
          command: `cd ${workspaceDir} && git clone ${repoUrl} . || echo "# Team ${teamId} Workspace\n\nRepository: ${repoUrl}" > README.md`,
          timeout: 30000
        });
      }
      
      return workspaceDir;
    } catch (error: any) {
      console.error(`Failed to setup team workspace ${teamId} on EC2:`, error);
      throw error;
    }
  }

  /**
   * Get or create a user's persistent container (supports local Docker)
   */
  async getUserContainer(userId: string, teamId: string, workspaceRepo?: string): Promise<ContainerInfo> {
    if (this.isEC2Available) {
      return await this.getUserContainerEC2(userId, teamId, workspaceRepo);
    } else {
      return await this.getUserContainerLocal(userId, teamId, workspaceRepo);
    }
  }

  /**
   * Get or create a user's persistent container on EC2
   */
  private async getUserContainerEC2(userId: string, teamId: string, workspaceRepo?: string): Promise<ContainerInfo> {
    // Check if user already has a container for this team
    const existingContainer = await prisma.container_instances.findFirst({
      where: {
        userId,
        teamId,
        type: 'claude-agent',
        status: { in: ['starting', 'running'] }
      }
    });

    if (existingContainer) {
      // Verify container is still running on EC2 VM
      const containerInfo = this.containers.get(existingContainer.id);
      if (containerInfo && existingContainer.containerId) {
        try {
          const statusCheck = await sshService.executeCommand(DEFAULT_VM.vmId, {
            command: `docker inspect ${existingContainer.containerId} --format='{{.State.Running}}'`,
            timeout: 10000
          });
          
          if (statusCheck.stdout.trim() === 'true') {
            console.log(`Using existing EC2 container for user ${userId}: ${existingContainer.containerId}`);
            return containerInfo;
          }
        } catch (error: any) {
          console.warn(`Container ${existingContainer.containerId} not found on EC2 VM, will recreate`);
        }
      }
    }

    // Create new user container on EC2
    return this.createUserContainer({ userId, teamId, workspaceRepo });
  }

  /**
   * Get or create a user's persistent container locally
   */
  async getUserContainerLocal(userId: string, teamId: string, workspaceRepo?: string): Promise<ContainerInfo> {
    // Check if user already has a container for this team
    const existingContainer = await prisma.container_instances.findFirst({
      where: {
        userId,
        teamId,
        type: 'claude-agent',
        status: { in: ['starting', 'running'] }
      }
    });

    if (existingContainer) {
      // Verify container is still running locally
      const containerInfo = this.containers.get(existingContainer.id);
      if (containerInfo && existingContainer.containerId) {
        try {
          const statusResult = await this.executeDockerCommandLocally(`docker inspect ${existingContainer.containerId} --format={{.State.Running}}`);
          
          if (statusResult.stdout.trim() === 'true') {
            console.log(`Using existing local container for user ${userId}: ${existingContainer.containerId}`);
            return containerInfo;
          }
        } catch (error: any) {
          console.warn(`Container ${existingContainer.containerId} not found locally, will recreate`);
        }
      }
    }

    // Create new user container locally
    return this.createUserContainerLocal({ userId, teamId, workspaceRepo });
  }

  /**
   * Create a new user container with Claude CLI (supports local Docker)
   */
  async createUserContainer(options: UserContainerOptions): Promise<ContainerInfo> {
    if (this.isEC2Available) {
      return await this.createUserContainerEC2(options);
    } else {
      return await this.createUserContainerLocal(options);
    }
  }

  /**
   * Create a new user container with Claude CLI on EC2
   */
  private async createUserContainerEC2(options: UserContainerOptions): Promise<ContainerInfo> {
    console.log(`Creating new user container for user ${options.userId} in team ${options.teamId}`);
    try {
      // Ensure workspace exists
      const workspaceDir = await this.ensureTeamWorkspace(options.teamId, options.workspaceRepo);
      
      // Allocate terminal port for SSH access
      const terminalPortTemp = await portAllocator.allocatePort();
      if (!terminalPortTemp) {
        throw new Error('Failed to allocate terminal port');
      }
      const terminalPort = terminalPortTemp;
      
      // Create container record in database
      const containerRecord = await prisma.container_instances.create({
        data: {
          id: crypto.randomUUID(),
          teamId: options.teamId,
          userId: options.userId,
          type: 'claude-agent',
          status: 'starting',
          createdAt: new Date(),
          updatedAt: new Date(),
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
      const runResult = await sshService.executeCommand(DEFAULT_VM.vmId, {
        command: dockerRunCmd,
        timeout: 60000
      });

      if (runResult.stderr && runResult.stderr.includes('Error')) {
        throw new Error(`Docker run failed: ${runResult.stderr}`);
      }

      const containerId = runResult.stdout.trim();
      
      // CRITICAL FIX: Set developer user password for SSH access on EC2
      console.log(`Setting developer password for EC2 container ${containerId}`);
      const passwordCmd = `echo 'developer:colabvibe123' | docker exec -i ${containerId} chpasswd`;
      const passwordResult = await sshService.executeCommand(DEFAULT_VM.vmId, {
        command: passwordCmd,
        timeout: 10000
      });
      
      if (passwordResult.stderr && passwordResult.stderr.includes('Error')) {
        console.warn(`Failed to set developer password on EC2: ${passwordResult.stderr}`);
      } else {
        console.log('✅ Developer password set successfully on EC2');
      }
      
      // Update database with container ID
      await prisma.container_instances.update({
        where: { id: containerRecord.id },
        data: { 
          containerId: containerId,
          status: 'running'
        }
      });

      const containerInfo: ContainerInfo = {
        id: containerRecord.id,
        containerId: containerId,
        type: 'claude-agent',
        status: 'running',
        terminalPort,
        teamId: options.teamId,
        userId: options.userId,
        metadata: containerRecord.metadata as Record<string, any>
      };

      this.containers.set(containerRecord.id, containerInfo);
      
      // Emit event
      this.emit('container-started', containerInfo);
      
      console.log(`User container spawned on EC2: ${containerId} for user ${options.userId}`);
      return containerInfo;
      
    } catch (error: any) {
      console.error('Failed to create EC2 user container:', error);
      throw error;
    }
  }

  /**
   * Create a new user container with Claude CLI locally (UPDATED FOR PTY)
   */
  async createUserContainerLocal(options: UserContainerOptions): Promise<ContainerInfo> {
    console.log(`Creating new local user container for user ${options.userId} in team ${options.teamId} (PTY mode)`);
    try {
      // Ensure local workspace exists
      const workspaceDir = path.join(this.LOCAL_WORKSPACE_BASE, options.teamId);
      await fs.mkdir(workspaceDir, { recursive: true });
      
      // Clone repository if provided
      if (options.workspaceRepo) {
        try {
          const gitCloneResult = await this.executeDockerCommandLocally(`git clone ${options.workspaceRepo} ${workspaceDir}/repo || echo "Clone failed"`);
          console.log(`Git clone result for workspace: ${gitCloneResult.stdout}`);
        } catch (cloneError) {
          console.warn(`Failed to clone repository ${options.workspaceRepo}:`, cloneError);
        }
      }
      
      // Create container record in database (no terminal port needed for PTY)
      const containerRecord = await prisma.container_instances.create({
        data: {
          id: crypto.randomUUID(),
          teamId: options.teamId,
          userId: options.userId,
          type: 'claude-agent',
          status: 'starting',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {
            workspaceRepo: options.workspaceRepo,
            createdAt: new Date().toISOString(),
            ptySessions: [], // Changed from tmuxSessions to ptySessions
            isLocal: true,
            ptyMode: true // Flag indicating PTY mode
          }
        }
      });

      // Create Docker container locally for PTY access (no SSH server needed)
      const containerName = `claude-user-${options.userId}-${containerRecord.id}`;
      const dockerRunCmd = `docker run -d --name ${containerName} -v ${workspaceDir}:/workspace:rw --memory 4g --cpus 2 --restart unless-stopped -e TEAM_ID=${options.teamId} -e USER_ID=${options.userId} --workdir /workspace ${this.AGENT_IMAGE} tail -f /dev/null`;
      
      // Execute docker run command locally
      const runResult = await this.executeDockerCommandLocally(dockerRunCmd);

      if (runResult.code !== 0) {
        throw new Error(`Docker run failed: ${runResult.stderr}`);
      }

      const containerId = runResult.stdout.trim();
      
      // CRITICAL FIX: Wait for container to be ready before marking as running
      console.log(`🕒 Waiting for container ${containerId} to be ready...`);
      await this.waitForContainerReady(containerId);
      
      // Update database with container ID
      await prisma.container_instances.update({
        where: { id: containerRecord.id },
        data: { 
          containerId: containerId,
          status: 'running'
        }
      });

      const containerInfo: ContainerInfo = {
        id: containerRecord.id,
        containerId: containerId,
        type: 'claude-agent',
        status: 'running',
        teamId: options.teamId,
        userId: options.userId,
        metadata: containerRecord.metadata as Record<string, any>
      };

      this.containers.set(containerRecord.id, containerInfo);
      
      // Emit event
      this.emit('container-started', containerInfo);
      
      console.log(`Local user container spawned for PTY: ${containerId} for user ${options.userId}`);
      return containerInfo;
      
    } catch (error: any) {
      console.error('Failed to create local user container:', error);
      throw error;
    }
  }

  /**
   * Spawn an agent as a tmux session in user's container (supports local Docker)
   */
  async spawnAgentInContainer(options: SpawnAgentOptions): Promise<{ container: ContainerInfo; sessionId: string }> {
    try {
      if (this.isEC2Available) {
        return await this.spawnAgentInContainerEC2(options);
      } else {
        return await this.spawnAgentInContainerLocal(options);
      }
    } catch (error: any) {
      console.error('Failed to spawn agent in container:', error);
      throw error;
    }
  }

  /**
   * Spawn an agent as a PTY process in user's container on EC2 (NEW PTY IMPLEMENTATION)
   */
  private async spawnAgentInContainerEC2(options: SpawnAgentOptions): Promise<{ container: ContainerInfo; sessionId: string }> {
    // Get or create user's container
    const container = await this.getUserContainer(options.userId, options.teamId, options.workspaceRepo);
    
    if (!container.containerId) {
      throw new Error('Container ID not available');
    }

    // Create unique session name for the agent
    const sessionId = `agent-${options.agentId}-pty`;
    
    console.log(`Creating PTY session ${sessionId} in container ${container.containerId} on EC2`);
    
    // Create PTY process that connects to EC2 container via SSH
    // This combines SSH tunneling with PTY for EC2 containers
    const ptyProcess = pty.spawn('ssh', [
      '-i', DEFAULT_VM.keyPath,
      '-o', 'StrictHostKeyChecking=no',
      '-t',
      `${DEFAULT_VM.username}@${DEFAULT_VM.host}`,
      `docker exec -i -t -u developer -w /workspace ${container.containerId} bash -c 'echo "Agent ${options.agentId} started for task: ${options.task}" && echo "Interactive terminal ready..." && exec bash'`
    ], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env
    });
    
    // Store PTY session info
    const ptyInfo: PTYInfo = {
      agentId: options.agentId,
      containerId: container.containerId,
      ptyProcess,
      status: 'running',
      createdAt: new Date(),
      lastActivity: new Date()
    };
    
    this.activePTYSessions.set(options.agentId, ptyInfo);
    
    // Update container metadata with new PTY session
    const currentMetadata = container.metadata || {};
    const ptySessions = currentMetadata['ptySessions'] || [];
    ptySessions.push({
      sessionId,
      agentId: options.agentId,
      task: options.task,
      status: 'active',
      createdAt: new Date().toISOString()
    });
    
    // Update database
    await prisma.container_instances.update({
      where: { id: container.id },
      data: {
        agentId: options.agentId, // Set the agentId for terminal connection lookup
        metadata: {
          ...currentMetadata,
          ptySessions
        }
      }
    });
    
    container.metadata = { ...currentMetadata, ptySessions };
    
    // CRITICAL FIX: Attach PTY data handlers immediately when process is created
    this.attachPTYDataHandlers(options.agentId, ptyProcess);
    
    // Emit PTY ready event
    this.emit('pty-ready', { agentId: options.agentId, ptyProcess });
    
    console.log(`Agent ${options.agentId} spawned as PTY process ${sessionId} on EC2`);
    return { container, sessionId };
  }

  /**
   * Spawn an agent as a PTY process in user's container locally (NEW PTY IMPLEMENTATION)
   */
  private async spawnAgentInContainerLocal(options: SpawnAgentOptions): Promise<{ container: ContainerInfo; sessionId: string }> {
    // Get or create local user container
    const container = await this.getUserContainerLocal(options.userId, options.teamId, options.workspaceRepo);
    
    if (!container.containerId) {
      throw new Error('Container ID not available');
    }

    // Create unique session name for the agent
    const sessionId = `agent-${options.agentId}-pty`;
    
    console.log(`Creating PTY session ${sessionId} in local container ${container.containerId}`);
    
    // Verify bash is available in container before creating PTY
    try {
      const bashCheckResult = await this.executeDockerCommandLocally(
        `docker exec ${container.containerId} which bash`
      );
      
      if (bashCheckResult.code !== 0) {
        console.warn(`⚠️ bash not found in container, falling back to sh`);
      }
    } catch (error: any) {
      console.warn(`⚠️ Could not verify shell in container, proceeding with bash`, error);
    }
    
    // CRITICAL FIX: Verify container is ready before spawning PTY
    try {
      await this.waitForContainerReady(container.containerId, 10);
    } catch (error: any) {
      throw new Error(`Cannot spawn PTY - container not ready: ${error.message}`);
    }
    
    console.log(`🚀 Spawning PTY process for agent ${options.agentId} in container ${container.containerId}`);
    
    // Create PTY process that runs inside the Docker container
    // This replaces the SSH + tmux approach with direct PTY creation
    const ptyProcess = pty.spawn('docker', [
      'exec', '-i', '-t',
      '-u', 'developer',
      '-w', '/workspace',
      container.containerId,
      'bash', '-c',
      `echo "Agent ${options.agentId} started for task: ${options.task}" && echo "Interactive terminal ready..." && exec bash`
    ], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env
    });
    
    // CRITICAL FIX: Verify PTY process started successfully
    await new Promise((resolve, reject) => {
      let resolved = false;
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`PTY process failed to start within 5 seconds`));
        }
      }, 5000);
      
      ptyProcess.onData((_data) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          console.log(`✅ PTY process started successfully for agent ${options.agentId}`);
          resolve(undefined);
        }
      });
      
      ptyProcess.onExit(({ exitCode, signal }: { exitCode: number, signal?: number }) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(new Error(`PTY process exited immediately: code=${exitCode}, signal=${signal}`));
        }
      });
      
      // Send initial command to verify the terminal is working
      setTimeout(() => {
        if (!resolved) {
          ptyProcess.write('echo "PTY_READY"\n');
        }
      }, 1000);
    });
    
    // Store PTY session info
    const ptyInfo: PTYInfo = {
      agentId: options.agentId,
      containerId: container.containerId,
      ptyProcess,
      status: 'running',
      createdAt: new Date(),
      lastActivity: new Date()
    };
    
    this.activePTYSessions.set(options.agentId, ptyInfo);
    
    // Update container metadata with new PTY session
    const currentMetadata = container.metadata || {};
    const ptySessions = currentMetadata['ptySessions'] || [];
    ptySessions.push({
      sessionId,
      agentId: options.agentId,
      task: options.task,
      status: 'active',
      createdAt: new Date().toISOString()
    });
    
    // Update database
    await prisma.container_instances.update({
      where: { id: container.id },
      data: {
        agentId: options.agentId, // Set the agentId for terminal connection lookup
        metadata: {
          ...currentMetadata,
          ptySessions
        }
      }
    });
    
    container.metadata = { ...currentMetadata, ptySessions };
    
    // CRITICAL FIX: Attach PTY data handlers immediately when process is created
    this.attachPTYDataHandlers(options.agentId, ptyProcess);
    
    // Emit PTY ready event
    this.emit('pty-ready', { agentId: options.agentId, ptyProcess });
    
    console.log(`Agent ${options.agentId} spawned as PTY process ${sessionId} in local container`);
    return { container, sessionId };
  }

  /**
   * Detect project type from workspace directory on EC2 VM
   */
  private async detectProjectTypeOnEC2(workspaceDir: string): Promise<{ type: string; startCommand: string; envPort?: string }> {
    try {
      // Check for package.json (Node.js projects)
      const packageJsonCheck = await sshService.executeCommand(DEFAULT_VM.vmId, {
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
        } catch (parseError) {
          console.warn('Failed to parse package.json, falling back to detection');
        }
      }
      
      // Check for Python files
      const pythonCheck = await sshService.executeCommand(DEFAULT_VM.vmId, {
        command: `test -f ${workspaceDir}/requirements.txt || test -f ${workspaceDir}/app.py || test -f ${workspaceDir}/main.py`,
        timeout: 5000
      });
      
      if (pythonCheck.exitCode === 0) {
        return {
          type: 'python',
          startCommand: 'python -m http.server 3000',
          envPort: 'PORT'
        };
      }
      
      // Check for static HTML
      const htmlCheck = await sshService.executeCommand(DEFAULT_VM.vmId, {
        command: `test -f ${workspaceDir}/index.html || test -f ${workspaceDir}/public/index.html`,
        timeout: 5000
      });
      
      if (htmlCheck.exitCode === 0) {
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
      
    } catch (error: any) {
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
  async spawnPreviewContainer(options: SpawnPreviewOptions): Promise<ContainerInfo> {
    console.log(`Creating preview container for team ${options.teamId} on EC2 VM`);
    try {
      // Check if preview container already exists for this team
      const existing = await prisma.container_instances.findFirst({
        where: {
          teamId: options.teamId,
          type: 'preview',
          status: { in: ['starting', 'running'] }
        }
      });

      if (existing && existing.containerId) {
        // Verify container is still running on EC2
        try {
          const statusCheck = await sshService.executeCommand(DEFAULT_VM.vmId, {
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
              previewPort: existing.previewPort ?? 0,
              teamId: options.teamId,
              userId: options.userId,
              metadata: existing.metadata as Record<string, any>
            };
          }
        } catch (error: any) {
          console.warn(`Preview container ${existing.containerId} not found on EC2, will recreate`);
        }
      }

      // Ensure workspace exists and get path
      const workspaceDir = await this.ensureTeamWorkspace(options.teamId);
      
      // Detect project type from workspace
      const projectConfig = await this.detectProjectTypeOnEC2(workspaceDir);
      console.log(`Detected project type: ${projectConfig.type} for team ${options.teamId}`);
      
      // Allocate preview port
      const previewPortTemp = await portAllocator.allocatePort();
      if (!previewPortTemp) {
        throw new Error('Failed to allocate preview port');
      }
      const previewPort = previewPortTemp;
      
      // Create container record
      const containerRecord = await prisma.container_instances.create({
        data: {
          id: crypto.randomUUID(),
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
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Create preview container on EC2 VM
      const containerName = `preview-${options.teamId}-${containerRecord.id}`;
      
      // Build Docker run command based on project type
      let dockerRunCmd: string;
      
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
      } else if (projectConfig.type === 'python') {
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
      } else {
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
      const runResult = await sshService.executeCommand(DEFAULT_VM.vmId, {
        command: dockerRunCmd,
        timeout: 120000 // 2 minutes for container startup
      });

      if (runResult.stderr && runResult.stderr.includes('Error')) {
        throw new Error(`Preview container creation failed: ${runResult.stderr}`);
      }

      const containerId = runResult.stdout.trim();
      
      // Update database with container ID
      await prisma.container_instances.update({
        where: { id: containerRecord.id },
        data: { 
          containerId: containerId,
          status: 'running'
        }
      });

      const containerInfo: ContainerInfo = {
        id: containerRecord.id,
        containerId: containerId,
        type: 'preview',
        status: 'running',
        previewPort: previewPort ?? 0,
        teamId: options.teamId,
        userId: options.userId,
        metadata: {
          ...containerRecord.metadata as Record<string, any>,
          startCommand: projectConfig.startCommand
        }
      };

      this.containers.set(containerRecord.id, containerInfo);
      
      // Emit event
      this.emit('container-started', containerInfo);
      
      console.log(`Preview container created on EC2: ${containerId} (${projectConfig.type}) for team ${options.teamId} on port ${previewPort}`);
      return containerInfo;
      
    } catch (error: any) {
      console.error('Failed to spawn preview container on EC2:', error);
      throw error;
    }
  }


  /**
   * Get terminal connection info for a container
   */
  async getContainerTerminal(containerId: string): Promise<TerminalInfo | null> {
    const container = Array.from(this.containers.values()).find(c => c.containerId === containerId);
    
    if (!container || !container.terminalPort) {
      return null;
    }

    return {
      containerId,
      terminalPort: container.terminalPort,
      wsUrl: `ws://${process.env['BASE_HOST'] || 'localhost'}:${container.terminalPort}/terminal`
    };
  }

  /**
   * Stop a container on EC2 VM
   */
  async stopContainer(containerId: string): Promise<void> {
    try {
      const containerInfo = Array.from(this.containers.values()).find(c => c.containerId === containerId);
      
      if (!containerInfo) {
        throw new Error(`Container ${containerId} not found`);
      }

      // Stop container on EC2 VM
      await sshService.executeCommand(DEFAULT_VM.vmId, {
        command: `docker stop ${containerId}`,
        timeout: 30000
      });
      
      // Update status
      await this.updateContainerStatus(containerInfo.id, 'stopped');
      
      // Release ports
      if (containerInfo.terminalPort) {
        await portAllocator.releasePort(containerInfo.terminalPort);
      }
      if (containerInfo.previewPort) {
        await portAllocator.releasePort(containerInfo.previewPort);
      }
      
      this.emit('container-stopped', containerInfo);
      console.log(`Container ${containerId} stopped on EC2 VM`);
      
    } catch (error: any) {
      console.error(`Failed to stop container ${containerId} on EC2:`, error);
      throw error;
    }
  }

  /**
   * Remove a container completely from EC2 VM
   */
  async removeContainer(containerId: string): Promise<void> {
    try {
      await this.stopContainer(containerId);
      
      // Remove container on EC2 VM
      await sshService.executeCommand(DEFAULT_VM.vmId, {
        command: `docker rm ${containerId}`,
        timeout: 30000
      });
      
      const containerInfo = Array.from(this.containers.values()).find(c => c.containerId === containerId);
      if (containerInfo) {
        // Remove from database
        await prisma.container_instances.delete({
          where: { id: containerInfo.id }
        });
        
        this.containers.delete(containerInfo.id);
        this.emit('container-removed', containerInfo);
      }
      
      console.log(`Container ${containerId} removed from EC2 VM`);
      
    } catch (error: any) {
      console.error(`Failed to remove container ${containerId} from EC2:`, error);
      throw error;
    }
  }

  /**
   * Get container status via SSH on EC2 VM
   */
  async getContainerStatus(containerId: string): Promise<ContainerInfo | null> {
    const containerInfo = Array.from(this.containers.values()).find(c => c.containerId === containerId);
    
    if (!containerInfo) {
      return null;
    }

    try {
      // Check container status on EC2 VM
      const statusCheck = await sshService.executeCommand(DEFAULT_VM.vmId, {
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
      
    } catch (error: any) {
      console.error(`Failed to get status for container ${containerId} on EC2:`, error);
      return containerInfo;
    }
  }

  /**
   * List all containers for a team
   */
  async getTeamContainers(teamId: string): Promise<ContainerInfo[]> {
    return Array.from(this.containers.values()).filter(c => c.teamId === teamId);
  }

  /**
   * Clean up stopped containers
   */
  async cleanupStoppedContainers(): Promise<void> {
    try {
      const stoppedContainers = await prisma.container_instances.findMany({
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
            await sshService.executeCommand(DEFAULT_VM.vmId, {
              command: `docker rm ${container.containerId}`,
              timeout: 30000
            });
            console.log(`Cleaned up stopped container on EC2: ${container.containerId}`);
          } catch (error: any) {
            console.warn(`Failed to remove container ${container.containerId} from EC2:`, error);
          }
        }
        
        // Remove from database
        await prisma.container_instances.delete({
          where: { id: container.id }
        });
        
        this.containers.delete(container.id);
      }

      console.log(`Cleaned up ${stoppedContainers.length} stopped containers`);
      
    } catch (error: any) {
      console.error('Failed to cleanup stopped containers:', error);
    }
  }

  /**
   * Clean up inactive PTY sessions (NEW PTY METHOD)
   */
  cleanupInactivePTYSessions(): void {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [agentId, ptyInfo] of this.activePTYSessions.entries()) {
      const age = now.getTime() - ptyInfo.createdAt.getTime();
      
      // Check if PTY process is still alive
      const isAlive = ptyInfo.ptyProcess && !ptyInfo.ptyProcess.killed;
      
      // Only clean up if the process is actually dead
      // Active PTY sessions should run indefinitely for agent terminals
      if (!isAlive) {
        console.log(`Cleaning up dead PTY session for agent ${agentId} (age: ${Math.round(age / 1000)}s)`);
        
        if (ptyInfo.ptyProcess && !ptyInfo.ptyProcess.killed) {
          ptyInfo.ptyProcess.kill();
        }
        
        this.activePTYSessions.delete(agentId);
        this.emit('pty-cleaned', { agentId, reason: 'dead' });
        cleanedCount++;
      } else {
        // Log that session is still active for debugging
        if (age > 60 * 60 * 1000) { // Log if older than 1 hour
          console.log(`PTY session for agent ${agentId} still active after ${Math.round(age / 1000 / 60)} minutes`);
        }
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} inactive PTY sessions`);
    }
  }

  /**
   * Update container status in database
   */
  private async updateContainerStatus(id: string, status: string): Promise<void> {
    await prisma.container_instances.update({
      where: { id },
      data: { status, updatedAt: new Date() }
    });
  }

  /**
   * Execute command in container via SSH on EC2 VM
   */
  async execCommand(containerId: string, command: string): Promise<{ stdout: string; stderr: string }> {
    try {
      const dockerExecCmd = `docker exec ${containerId} sh -c "${command.replace(/"/g, '\\"')}"`;
      
      const result = await sshService.executeCommand(DEFAULT_VM.vmId, {
        command: dockerExecCmd,
        timeout: 30000
      });
      
      return {
        stdout: result.stdout || '',
        stderr: result.stderr || ''
      };
      
    } catch (error: any) {
      console.error(`Failed to execute command in container ${containerId} via SSH:`, error);
      throw error;
    }
  }

  /**
   * Get PTY process for an agent (NEW PTY METHOD)
   */
  getPTYProcess(agentId: string): any | null {
    const ptyInfo = this.activePTYSessions.get(agentId);
    return ptyInfo?.ptyProcess || null;
  }

  /**
   * Get PTY session info for an agent (NEW PTY METHOD)
   */
  getPTYSessionInfo(agentId: string): PTYInfo | null {
    return this.activePTYSessions.get(agentId) || null;
  }

  /**
   * Write data to PTY process (NEW PTY METHOD)
   */
  writeToPTY(agentId: string, data: string): boolean {
    const ptyInfo = this.activePTYSessions.get(agentId);
    if (ptyInfo?.ptyProcess && ptyInfo.status === 'running') {
      ptyInfo.ptyProcess.write(data);
      // Update last activity timestamp when user interacts
      ptyInfo.lastActivity = new Date();
      return true;
    }
    return false;
  }

  /**
   * Resize PTY process (NEW PTY METHOD)
   */
  resizePTY(agentId: string, cols: number, rows: number): boolean {
    const ptyInfo = this.activePTYSessions.get(agentId);
    if (ptyInfo?.ptyProcess && ptyInfo.status === 'running') {
      ptyInfo.ptyProcess.resize(cols, rows);
      return true;
    }
    return false;
  }

  /**
   * Kill PTY process (NEW PTY METHOD)
   */
  killPTY(agentId: string): boolean {
    const ptyInfo = this.activePTYSessions.get(agentId);
    if (ptyInfo?.ptyProcess) {
      ptyInfo.ptyProcess.kill();
      ptyInfo.status = 'stopped';
      this.activePTYSessions.delete(agentId);
      this.emit('pty-killed', { agentId });
      return true;
    }
    return false;
  }

  /**
   * Get all active PTY sessions (NEW PTY METHOD)
   */
  getActivePTYSessions(): PTYInfo[] {
    return Array.from(this.activePTYSessions.values());
  }

  /**
   * Attach PTY data handlers immediately when PTY process is created (CRITICAL FIX)
   */
  private attachPTYDataHandlers(agentId: string, ptyProcess: any): void {
    console.log(`🔗 Attaching PTY data handlers for agent ${agentId}`);
    
    // Store buffered output for clients that connect later
    let outputBuffer = '';
    const MAX_BUFFER_SIZE = 1024 * 50; // 50KB buffer
    
    // Handle PTY data output - capture immediately
    const handlePTYData = (buffer: Buffer) => {
      const rawBytes = buffer.toString('binary');
      console.log(`📡 PTY data captured for agent ${agentId}: ${rawBytes.length} bytes`);
      
      // Add to output buffer for late-joining clients
      outputBuffer += rawBytes;
      if (outputBuffer.length > MAX_BUFFER_SIZE) {
        // Trim buffer to prevent memory issues
        outputBuffer = outputBuffer.slice(-MAX_BUFFER_SIZE);
      }
      
      // Immediately emit to server for broadcasting
      this.emit('pty-data', {
        agentId,
        data: rawBytes,
        timestamp: Date.now()
      });
    };
    
    // Handle PTY process exit
    const handlePTYExit = (code: number, signal: string) => {
      console.log(`🔌 PTY process exited for agent ${agentId}: code=${code}, signal=${signal}`);
      
      // Log exit reason for debugging
      if (code !== 0) {
        console.error(`❌ PTY process failed for agent ${agentId}: exit code ${code}`);
      }
      
      this.emit('pty-exit', {
        agentId,
        code,
        signal
      });
      
      // Clean up PTY session
      this.activePTYSessions.delete(agentId);
    };
    
    // Handle PTY process errors
    const handlePTYError = (error: Error) => {
      console.error(`❌ PTY process error for agent ${agentId}:`, error);
      
      // Emit error event
      this.emit('pty-error', {
        agentId,
        error: error.message
      });
      
      // Clean up on error
      this.activePTYSessions.delete(agentId);
    };
    
    // Attach event listeners
    ptyProcess.on('data', handlePTYData);
    ptyProcess.on('exit', handlePTYExit);
    ptyProcess.on('error', handlePTYError);
    
    // Store buffer getter for late-joining clients
    (ptyProcess as any).getOutputBuffer = () => outputBuffer;
    
    console.log(`✅ PTY data handlers attached for agent ${agentId}`);
  }

  /**
   * Get buffered output for an agent (for late-joining clients)
   */
  getPTYOutputBuffer(agentId: string): string {
    const ptyInfo = this.activePTYSessions.get(agentId);
    if (ptyInfo?.ptyProcess && (ptyInfo.ptyProcess as any).getOutputBuffer) {
      return (ptyInfo.ptyProcess as any).getOutputBuffer();
    }
    return '';
  }

  // TerminalManager interface implementation
  async spawnTerminal(options: TerminalOptions): Promise<TerminalSession> {
    try {
      const result = await this.spawnAgentInContainer({
        userId: options.userId,
        teamId: options.teamId,
        agentId: options.agentId,
        task: options.task,
        workspaceRepo: options.workspaceRepo || 'default'
      });

      return {
        agentId: options.agentId,
        location: 'local',
        isolation: 'docker',
        status: 'running',
        containerId: result.container.containerId,
        createdAt: new Date(),
        metadata: {
          containerId: result.container.containerId,
          sessionId: result.sessionId
        }
      };
    } catch (error: any) {
      return {
        agentId: options.agentId,
        location: 'local',
        isolation: 'docker',
        status: 'error',
        createdAt: new Date(),
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  sendInput(agentId: string, data: string): boolean {
    return this.writeToPTY(agentId, data);
  }

  resizeTerminal(agentId: string, cols: number, rows: number): boolean {
    return this.resizePTY(agentId, cols, rows);
  }

  killTerminal(agentId: string): boolean {
    // Find and stop container
    const ptyInfo = this.activePTYSessions.get(agentId);
    if (ptyInfo?.containerId) {
      this.stopContainer(ptyInfo.containerId);
      return true;
    }
    return false;
  }

  getSession(agentId: string): TerminalSession | null {
    const ptyInfo = this.activePTYSessions.get(agentId);
    if (!ptyInfo) return null;

    return {
      agentId,
      location: 'local',
      isolation: 'docker',
      status: 'running',
      containerId: ptyInfo.containerId,
      createdAt: new Date(), // Could store actual creation time
      metadata: {
        containerId: ptyInfo.containerId,
        terminalPort: undefined // PTYInfo doesn't contain terminalPort
      }
    };
  }

  getActiveSessions(): TerminalSession[] {
    const sessions: TerminalSession[] = [];
    for (const [agentId, ptyInfo] of this.activePTYSessions.entries()) {
      sessions.push({
        agentId,
        location: 'local',
        isolation: 'docker',
        status: 'running',
        containerId: ptyInfo.containerId,
        createdAt: new Date(),
        metadata: {
          containerId: ptyInfo.containerId,
          terminalPort: undefined // PTYInfo doesn't contain terminalPort
        }
      });
    }
    return sessions;
  }

  isReady(agentId: string): boolean {
    const ptyInfo = this.activePTYSessions.get(agentId);
    return ptyInfo !== undefined;
  }

  cleanup(): void {
    this.cleanupInactivePTYSessions();
    this.cleanupStoppedContainers();
  }
}

// Singleton instance
export const dockerManager = new DockerManager();
export const LocalDockerManager = DockerManager;

// Initialize on startup - local Docker initialization
setTimeout(async () => {
  try {
    console.log('Initializing Local Docker Manager...');
    
    // Start cleanup intervals for local Docker
    setInterval(() => {
      dockerManager.cleanupStoppedContainers();
    }, 60 * 60 * 1000); // Every hour
    
    // Start PTY cleanup interval
    setInterval(() => {
      dockerManager.cleanupInactivePTYSessions();
    }, 5 * 60 * 1000); // Every 5 minutes
    
    console.log('✅ Local Docker Manager initialized');
    
  } catch (error: any) {
    console.error('Failed to initialize Local Docker manager:', error);
  }
}, 1000); // Wait 1 second for initialization