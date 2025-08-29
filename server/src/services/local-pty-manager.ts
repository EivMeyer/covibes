/**
 * Local PTY Manager
 * 
 * Simple terminal manager that spawns PTY processes directly on the local machine.
 * No Docker, no isolation, just direct bash/shell processes.
 * This is the fastest and simplest terminal mode.
 */

import { EventEmitter } from 'events';
import * as pty from 'node-pty';
import path from 'path';
import os from 'os';
import { TerminalManager, TerminalSession, TerminalOptions } from './terminal-manager-interface.js';

export class LocalPtyManager extends EventEmitter implements TerminalManager {
  private sessions: Map<string, TerminalSession> = new Map();
  private readonly WORKSPACE_BASE = path.join(os.homedir(), '.covibes/workspaces');

  constructor() {
    super();
    this.ensureWorkspaceDir();
    console.log('🖥️  LocalPtyManager initialized (simple local terminals)');
  }

  async spawnTerminal(options: TerminalOptions): Promise<TerminalSession> {
    console.log(`🚀 Spawning local PTY terminal for agent: ${options.agentId}`);
    
    try {
      // Ensure workspace exists for the team
      const workspaceDir = await this.ensureTeamWorkspace(options.teamId, options.workspaceRepo);
      
      // Determine shell to use
      const shell = this.getDefaultShell();
      const shellArgs = this.getShellArgs();
      
      console.log(`🐚 Using shell: ${shell} ${shellArgs.join(' ')}`);
      
      // Spawn PTY process
      const ptyProcess = pty.spawn(shell, shellArgs, {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: workspaceDir,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          USER: process.env['USER'] || 'developer',
          HOME: process.env['HOME'] || os.homedir(),
          AGENT_ID: options.agentId,
          AGENT_TASK: options.task,
          TEAM_ID: options.teamId,
          WORKSPACE: workspaceDir
        }
      });

      // Create session record
      const session: TerminalSession = {
        agentId: options.agentId,
        location: 'local',
        isolation: 'none',
        process: ptyProcess,
        status: 'running',
        createdAt: new Date(),
        metadata: {
          shell,
          workspaceDir,
          pid: ptyProcess.pid
        }
      };

      this.sessions.set(options.agentId, session);

      // Set up event handlers
      this.setupPtyEventHandlers(options.agentId, ptyProcess);

      // Send welcome message
      setTimeout(() => {
        ptyProcess.write(`echo "🚀 ColabVibe Agent Terminal"\r`);
        ptyProcess.write(`echo "📋 Agent ID: ${options.agentId}"\r`);
        ptyProcess.write(`echo "📁 Workspace: ${workspaceDir}"\r`);
        ptyProcess.write(`echo "🎯 Task: ${options.task}"\r`);
        ptyProcess.write(`echo ""\r`);
      }, 100);

      this.emit('terminal-ready', session);
      console.log(`✅ Local PTY terminal ready for agent: ${options.agentId} (PID: ${ptyProcess.pid})`);
      
      return session;

    } catch (error) {
      const errorMsg = `Failed to spawn local PTY terminal: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      
      // Create failed session record
      const failedSession: TerminalSession = {
        agentId: options.agentId,
        location: 'local',
        isolation: 'none',
        status: 'error',
        createdAt: new Date(),
        metadata: { error: errorMsg }
      };
      
      this.sessions.set(options.agentId, failedSession);
      this.emit('terminal-error', options.agentId, errorMsg);
      
      throw new Error(errorMsg);
    }
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

  killTerminal(agentId: string): boolean {
    const session = this.sessions.get(agentId);
    if (!session) {
      return false;
    }

    try {
      if (session.process && session.status === 'running') {
        session.process.kill();
        console.log(`💀 Killed local PTY terminal for agent: ${agentId}`);
      }
      
      session.status = 'stopped';
      this.sessions.delete(agentId);
      
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

  cleanup(): void {
    const now = new Date();
    const staleThreshold = 30 * 60 * 1000; // 30 minutes
    let cleanedCount = 0;

    for (const [agentId, session] of this.sessions.entries()) {
      const age = now.getTime() - session.createdAt.getTime();
      const isStale = age > staleThreshold;
      const isDeadProcess = session.process && session.process.killed;

      if (isStale || isDeadProcess || session.status === 'error') {
        console.log(`🧹 Cleaning up stale local PTY session: ${agentId} (age: ${Math.round(age / 1000)}s)`);
        this.killTerminal(agentId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`✅ Cleaned up ${cleanedCount} local PTY sessions`);
    }
  }

  private setupPtyEventHandlers(agentId: string, ptyProcess: any) {
    // Handle terminal output
    ptyProcess.onData((data: string) => {
      this.emit('terminal-data', agentId, data);
    });

    // Handle terminal exit
    ptyProcess.onExit(({ exitCode, signal }: { exitCode: number, signal?: number }) => {
      console.log(`🔌 Local PTY process exited for agent ${agentId}: code=${exitCode}, signal=${signal}`);
      
      const session = this.sessions.get(agentId);
      if (session) {
        session.status = 'stopped';
      }
      
      this.emit('terminal-exit', agentId, exitCode, signal?.toString());
    });
  }

  private getDefaultShell(): string {
    // Use bash if available, otherwise use system default shell
    const bashPaths = ['/bin/bash', '/usr/bin/bash'];
    
    for (const bashPath of bashPaths) {
      try {
        require('fs').accessSync(bashPath);
        return bashPath;
      } catch {
        continue;
      }
    }
    
    // Fallback to system default
    return process.env['SHELL'] || (os.platform() === 'win32' ? 'cmd.exe' : '/bin/sh');
  }

  private getShellArgs(): string[] {
    const shell = this.getDefaultShell();
    
    if (shell.includes('bash')) {
      return ['-l']; // Login shell for proper environment
    } else if (shell.includes('zsh')) {
      return ['-l'];
    } else if (shell === 'cmd.exe') {
      return []; // Windows cmd doesn't need special args
    } else {
      return []; // Default no args for other shells
    }
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
      // Create team workspace directory
      await fs.mkdir(workspaceDir, { recursive: true });
      
      // Clone repository if provided and not already cloned
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
                resolve(undefined);
              } else {
                console.warn(`⚠️ Git clone failed with code ${code}, workspace will be empty`);
                resolve(undefined); // Don't fail the terminal spawn
              }
            });
            
            gitClone.on('error', (error) => {
              console.warn(`⚠️ Git clone error: ${error.message}, workspace will be empty`);
              resolve(undefined); // Don't fail the terminal spawn
            });
          });
        }
      }
      
      return workspaceDir;
    } catch (error) {
      console.error(`Failed to setup team workspace ${teamId}:`, error);
      // Return a default workspace even if setup fails
      return workspaceDir;
    }
  }
}