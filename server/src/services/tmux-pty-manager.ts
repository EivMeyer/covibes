/**
 * Tmux PTY Manager
 * 
 * Terminal manager that creates persistent tmux sessions for agents.
 * Each agent gets its own tmux session that survives disconnections
 * and server restarts, enabling true persistent terminals.
 * 
 * Sessions run Claude commands with per-user configuration.
 */

import { EventEmitter } from 'events';
import * as pty from 'node-pty';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PrismaClient } from '@prisma/client';
import { TerminalManager, TerminalSession, TerminalOptions } from './terminal-manager-interface.js';
import { claudeConfigManager } from './claude-config-manager.js';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

export class TmuxPtyManager extends EventEmitter implements TerminalManager {
  private sessions: Map<string, TerminalSession> = new Map();
  private readonly WORKSPACE_BASE = path.join(os.homedir(), '.covibes/workspaces');
  private readonly SESSION_PREFIX = 'colabvibe-agent-';

  constructor() {
    super();
    this.ensureWorkspaceDir();
    this.cleanupOrphanedSessions();
    console.log('🖥️  TmuxPtyManager initialized (persistent tmux sessions with Claude)');
  }

  async spawnTerminal(options: TerminalOptions): Promise<TerminalSession> {
    console.log(`🚀 Spawning tmux terminal for agent: ${options.agentId}`);
    
    const sessionName = this.getSessionName(options.agentId);
    
    try {
      // Check if session already exists
      const existingSession = await this.checkTmuxSession(sessionName);
      if (existingSession) {
        console.log(`♻️ Reconnecting to existing tmux session: ${sessionName}`);
        return await this.attachToExistingSession(sessionName, options);
      }

      // Ensure workspace exists
      const workspaceDir = await this.ensureTeamWorkspace(options.teamId, options.workspaceRepo);
      
      // Initialize user's Claude configuration
      await claudeConfigManager.initializeUserConfig(options.userId);
      
      // Create new tmux session with Claude
      return await this.createTmuxSession(sessionName, options, workspaceDir);
      
    } catch (error) {
      const errorMsg = `Failed to spawn tmux terminal: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      
      const failedSession: TerminalSession = {
        agentId: options.agentId,
        location: 'local',
        isolation: 'tmux',
        status: 'error',
        createdAt: new Date(),
        metadata: { error: errorMsg, sessionName }
      };
      
      this.sessions.set(options.agentId, failedSession);
      this.emit('terminal-error', options.agentId, errorMsg);
      
      throw new Error(errorMsg);
    }
  }

  private async createTmuxSession(
    sessionName: string,
    options: TerminalOptions,
    workspaceDir: string
  ): Promise<TerminalSession> {
    // Build Claude command with user's configuration
    console.log(`🎯 TmuxPtyManager received agentName: ${options.agentName}`);
    const { command: claudeCommand, args: claudeArgs, env: claudeEnv } =
      claudeConfigManager.buildClaudeCommand(options.userId, {
        task: options.task,
        teamId: options.teamId,
        skipPermissions: true,
        interactive: !options.task, // Interactive if no specific task
        appendSystemPrompt: true, // Add agent development guidelines
        ...(options.agentName ? { agentName: options.agentName } : {}), // Only include if defined
        mode: options.mode,
        sessionId: options.sessionId
      });

    // Build simple Claude command with proper shell escaping
    const escapedArgs = claudeArgs.map(arg => {
      // Escape all bash special characters
      const escaped = arg
        .replace(/\\/g, '\\\\')  // Escape backslashes first
        .replace(/"/g, '\\"')    // Escape quotes
        .replace(/!/g, '\\!')    // Escape exclamation marks (history expansion)
        .replace(/\$/g, '\\$')   // Escape dollar signs (variable expansion)
        .replace(/`/g, '\\`')    // Escape backticks (command substitution)
        .replace(/\n/g, '\\n')   // Escape newlines
        .replace(/\r/g, '\\r')   // Escape carriage returns
        .replace(/\t/g, '\\t');  // Escape tabs
      return `"${escaped}"`;
    }).join(' ');
    let claudeCmd = claudeCommand;
    if (escapedArgs) {
      claudeCmd += ` ${escapedArgs}`;
    }
    
    console.log(`🎯 Creating tmux session: ${sessionName}`);
    console.log(`📁 Workspace: ${workspaceDir}`);
    console.log(`🤖 Claude Command: ${claudeCmd.replace(/\n/g, '\\n')}`);

    // Create tmux session with persistent bash shell
    await execAsync(`tmux new-session -d -s "${sessionName}" -c "${workspaceDir}"`);
    
    // Give tmux session time to initialize
    await this.sleep(300);
    
    // Send the startup commands to the bash shell in tmux
    const startupCommands = [
      `echo "🚀 Covibes Agent Terminal (Full Permissions)"`,
      `echo "📋 Agent ID: ${options.agentId}"`,
      `echo "📁 Workspace: ${workspaceDir}"`,
      `echo "🎯 Task: ${options.task || 'Interactive Claude Session'}"`,
      `echo "⚙️ Claude Config: ${claudeConfigManager.getUserConfigDir(options.userId)}"`,
      `echo "🔓 Permissions: Full user access (sudo available)"`,
      `echo "🐳 Docker: Available at /var/run/docker.sock"`,
      `echo ""`,
      `cd "${workspaceDir}"`, // Ensure we're in the workspace directory
      `export CLAUDE_CONFIG_DIR="${claudeEnv['CLAUDE_CONFIG_DIR']}"`,
      `export DOCKER_HOST="unix:///var/run/docker.sock"`,  // Make Docker access explicit
      `export SUDO_AVAILABLE="true"`,  // Indicate sudo is available
      `export AGENT_PERMISSIONS="full"`,  // Indicate full permissions
      claudeCmd
    ];
    
    // Send each command to the tmux session
    for (const cmd of startupCommands) {
      const cleanCmd = cmd.replace(/'/g, "'\"'\"'");
      await execAsync(`tmux send-keys -t "${sessionName}" '${cleanCmd}' Enter`);
      await this.sleep(100); // Slightly longer delay for command processing
    }
    
    // Give final startup time
    await this.sleep(200);
    
    // Attach to the session via PTY with proper ANSI handling
    // Use -CC for control mode to avoid tmux's screen control
    const ptyProcess = pty.spawn('tmux', [
      'attach-session',
      '-t', sessionName,
      // Don't clear screen on attach
      '\;', 'set', '-t', sessionName, 'remain-on-exit', 'off',
      '\;', 'set', '-t', sessionName, 'window-style', 'default',
      '\;', 'set', '-t', sessionName, 'window-active-style', 'default'
    ], {
      name: 'xterm-256color',  // Use 256 color terminal
      cols: 100,  // Start with wider default to reduce resize events
      rows: 30,   // And taller default
      cwd: workspaceDir,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        USER: process.env['USER'] || 'developer',
        HOME: process.env['HOME'] || os.homedir(),
        // Disable tmux's alternate screen to preserve ANSI sequences
        TMUX_TMPDIR: '/tmp',
        TMUX_DISABLE_ALTERNATE_SCREEN: '1',
        // Full permissions environment
        DOCKER_HOST: 'unix:///var/run/docker.sock',
        SUDO_AVAILABLE: 'true',
        AGENT_PERMISSIONS: 'full',
        PATH: `${process.env['PATH']}:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`
      }
    });

    // Create session record
    const session: TerminalSession = {
      agentId: options.agentId,
      location: 'local',
      isolation: 'tmux',
      process: ptyProcess,
      status: 'running',
      createdAt: new Date(),
      metadata: {
        sessionName,
        workspaceDir,
        command: claudeCmd,
        pid: ptyProcess.pid,
        claudeConfig: claudeConfigManager.getUserConfigDir(options.userId)
      }
    };

    this.sessions.set(options.agentId, session);
    
    // Update database with session info
    await this.updateAgentSessionInfo(options.agentId, sessionName);

    // Set up event handlers
    this.setupPtyEventHandlers(options.agentId, ptyProcess, sessionName);

    this.emit('terminal-ready', session);
    console.log(`✅ Tmux session ready: ${sessionName} (PID: ${ptyProcess.pid})`);
    
    return session;
  }

  private async attachToExistingSession(
    sessionName: string,
    options: TerminalOptions
  ): Promise<TerminalSession> {
    console.log(`🔗 Attaching to existing tmux session: ${sessionName}`);
    
    // Attach to existing session via PTY
    const ptyProcess = pty.spawn('tmux', ['attach-session', '-t', sessionName], {
      name: 'xterm-256color',  // Match the TERM environment variable
      cols: 100,  // Start with wider default to reduce resize events
      rows: 30,   // And taller default
      env: {
        ...process.env,
        TERM: 'xterm-256color'
      }
    });

    const session: TerminalSession = {
      agentId: options.agentId,
      location: 'local',
      isolation: 'tmux',
      process: ptyProcess,
      status: 'running',
      createdAt: new Date(),
      metadata: {
        sessionName,
        pid: ptyProcess.pid,
        reconnected: true,
        claudeConfig: claudeConfigManager.getUserConfigDir(options.userId)
      }
    };

    this.sessions.set(options.agentId, session);

    // Set up event handlers
    this.setupPtyEventHandlers(options.agentId, ptyProcess, sessionName);

    this.emit('terminal-ready', session);
    console.log(`✅ Reconnected to tmux session: ${sessionName} (PID: ${ptyProcess.pid})`);
    
    return session;
  }


  sendInput(agentId: string, data: string): boolean {
    const session = this.sessions.get(agentId);
    if (!session || !session.process || session.status !== 'running') {
      return false;
    }

    try {
      session.process.write(data);
      return true;
    } catch (error) {
      console.error(`Error sending input to agent ${agentId}:`, error);
      return false;
    }
  }

  resizeTerminal(agentId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(agentId);
    if (!session || !session.process || session.status !== 'running') {
      return false;
    }

    try {
      session.process.resize(cols, rows);
      return true;
    } catch (error) {
      console.error(`Error resizing terminal for agent ${agentId}:`, error);
      return false;
    }
  }

  async killTerminal(agentId: string): Promise<boolean> {
    const session = this.sessions.get(agentId);
    if (!session) {
      return false;
    }

    const sessionName = this.getSessionName(agentId);
    
    try {
      // Kill the PTY process
      if (session.process && session.status === 'running') {
        session.process.kill();
      }
      
      // Kill the tmux session
      try {
        await execAsync(`tmux kill-session -t "${sessionName}"`);
        console.log(`💀 Killed tmux session: ${sessionName}`);
      } catch (tmuxError) {
        console.warn(`Warning: Could not kill tmux session ${sessionName}:`, (tmuxError as any).message);
      }
      
      // Update session status
      session.status = 'stopped';
      this.sessions.delete(agentId);
      
      // Update database
      await this.clearAgentSessionInfo(agentId);
      
      return true;
    } catch (error) {
      console.error(`Error killing terminal for agent ${agentId}:`, error);
      return false;
    }
  }

  getSession(agentId: string): TerminalSession | null {
    return this.sessions.get(agentId) || null;
  }

  getActiveSessions(): TerminalSession[] {
    return Array.from(this.sessions.values()).filter(s => s.status === 'running');
  }

  isReady(agentId: string): boolean {
    const session = this.sessions.get(agentId);
    return session?.status === 'running' && !!session.process;
  }

  async cleanup(): Promise<void> {
    const now = new Date();
    const staleThreshold = 2 * 60 * 60 * 1000; // 2 hours for tmux sessions
    let cleanedCount = 0;

    for (const [agentId, session] of this.sessions.entries()) {
      const age = now.getTime() - session.createdAt.getTime();
      const isStale = age > staleThreshold;
      const isDeadProcess = session.process && session.process.killed;

      if (isStale || isDeadProcess || session.status === 'error') {
        console.log(`🧹 Cleaning up stale tmux session: ${agentId} (age: ${Math.round(age / 1000)}s)`);
        await this.killTerminal(agentId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`✅ Cleaned up ${cleanedCount} tmux sessions`);
    }
  }

  // Tmux-specific methods

  private getSessionName(agentId: string): string {
    return `${this.SESSION_PREFIX}${agentId}`;
  }

  private async checkTmuxSession(sessionName: string): Promise<boolean> {
    try {
      await execAsync(`tmux has-session -t "${sessionName}"`);
      return true;
    } catch {
      return false;
    }
  }

  async listCovibesSessions(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('tmux list-sessions -F "#{session_name}"');
      return stdout
        .split('\n')
        .filter(name => name.startsWith(this.SESSION_PREFIX))
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  private async cleanupOrphanedSessions(): Promise<void> {
    try {
      const sessions = await this.listCovibesSessions();
      console.log(`🧹 Found ${sessions.length} existing Covibes tmux sessions`);
      
      // For now, just log them. In production, you might want to clean up old sessions
      for (const sessionName of sessions) {
        console.log(`📺 Existing session: ${sessionName}`);
      }
    } catch (error) {
      console.warn('Could not check for orphaned tmux sessions:', (error as any).message);
    }
  }

  // Database helpers

  private async updateAgentSessionInfo(agentId: string, sessionName: string): Promise<void> {
    try {
      await prisma.agents.update({
        where: { id: agentId },
        data: {
          tmuxSessionName: sessionName,
          isSessionPersistent: true,
          terminalIsolation: 'tmux'
        }
      });
      console.log(`📊 Updated agent ${agentId} session info: ${sessionName}`);
    } catch (error) {
      console.warn(`Could not update agent session info for ${agentId}:`, (error as any).message);
    }
  }

  private async clearAgentSessionInfo(agentId: string): Promise<void> {
    try {
      await prisma.agents.update({
        where: { id: agentId },
        data: {
          tmuxSessionName: null,
          isSessionPersistent: false
        }
      });
      console.log(`📊 Cleared agent ${agentId} session info`);
    } catch (error) {
      console.warn(`Could not clear agent session info for ${agentId}:`, (error as any).message);
    }
  }

  // Utility methods

  private setupPtyEventHandlers(agentId: string, ptyProcess: any, _sessionName: string) {
    // Handle terminal output
    ptyProcess.onData((data: string) => {
      this.emit('terminal-data', agentId, data);
    });

    // Handle terminal exit
    ptyProcess.onExit(({ exitCode, signal }: { exitCode: number, signal?: number }) => {
      console.log(`🔌 Tmux PTY process exited for agent ${agentId}: code=${exitCode}, signal=${signal}`);
      
      const session = this.sessions.get(agentId);
      if (session) {
        session.status = 'stopped';
      }
      
      this.emit('terminal-exit', agentId, exitCode, signal?.toString());
    });
  }

  private async ensureWorkspaceDir(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      await fs.mkdir(this.WORKSPACE_BASE, { recursive: true });
      console.log(`📁 Workspace directory ensured: ${this.WORKSPACE_BASE}`);
    } catch (error) {
      console.error('Failed to create workspace directory:', error);
    }
  }

  private async ensureTeamWorkspace(teamId: string, repoUrl?: string): Promise<string> {
    const fs = await import('fs/promises');
    const { spawn } = await import('child_process');
    
    const workspaceDir = path.join(this.WORKSPACE_BASE, teamId);
    
    try {
      await fs.mkdir(workspaceDir, { recursive: true });
      
      if (repoUrl) {
        try {
          await fs.access(path.join(workspaceDir, '.git'));
          console.log(`📂 Git repository already exists in workspace: ${workspaceDir}`);
        } catch {
          console.log(`📥 Cloning repository to workspace: ${repoUrl} → ${workspaceDir}`);
          
          await new Promise((resolve) => {
            const gitClone = spawn('git', ['clone', repoUrl, '.'], {
              cwd: workspaceDir,
              stdio: 'pipe'
            });
            
            gitClone.on('close', (code) => {
              if (code === 0) {
                console.log(`✅ Repository cloned successfully`);
              } else {
                console.warn(`⚠️ Git clone failed with code ${code}, workspace will be empty`);
              }
              resolve(undefined);
            });
            
            gitClone.on('error', (error) => {
              console.warn(`⚠️ Git clone error: ${error.message}, workspace will be empty`);
              resolve(undefined);
            });
          });
        }
      }
      
      return workspaceDir;
    } catch (error) {
      console.error(`Failed to setup team workspace ${teamId}:`, error);
      return workspaceDir;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}