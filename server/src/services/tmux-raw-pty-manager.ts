/**
 * TMUX Raw PTY Manager
 * 
 * Uses tmux for persistence but captures raw output without tmux's terminal emulation
 * This preserves ANSI escape sequences properly for observer terminals
 */

import { EventEmitter } from 'events';
import * as pty from 'node-pty';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { TerminalManager, TerminalSession, TerminalOptions } from './terminal-manager-interface.js';

const execAsync = promisify(exec);

export class TmuxRawPtyManager extends EventEmitter implements TerminalManager {
  private sessions: Map<string, TerminalSession> = new Map();
  private readonly SESSION_PREFIX = 'colabvibe-agent-';

  constructor() {
    super();
    console.log('🖥️  TmuxRawPtyManager initialized (tmux with raw ANSI passthrough)');
  }

  async spawnTerminal(options: TerminalOptions): Promise<TerminalSession> {
    const sessionName = `${this.SESSION_PREFIX}${options.agentId}`;
    
    try {
      // Check if session exists
      const { stdout } = await execAsync(`tmux has-session -t ${sessionName} 2>/dev/null || echo "not found"`);
      const exists = !stdout.includes('not found');

      if (!exists) {
        // Create new tmux session in detached mode
        const workspaceDir = path.join(os.homedir(), '.colabvibes', options.teamId);
        
        // Create session with proper terminal settings
        await execAsync(`tmux new-session -d -s ${sessionName} -c ${workspaceDir} -x 80 -y 24`);
        
        // Set tmux options for proper ANSI handling
        await execAsync(`tmux set-option -t ${sessionName} -g default-terminal "xterm-256color"`);
        await execAsync(`tmux set-option -t ${sessionName} -g terminal-overrides "xterm*:Tc"`);
        
        // Run Claude command if task is provided
        if (options.task) {
          const claudeCmd = `claude "${options.task.replace(/"/g, '\\"')}"`;
          await execAsync(`tmux send-keys -t ${sessionName} "${claudeCmd}" Enter`);
        }
      }

      // Create a PTY process that pipes tmux output
      // Use 'tmux pipe-pane' to get raw output without tmux's terminal emulation
      const pipeCmd = `tmux pipe-pane -t ${sessionName} -o 'cat >> /tmp/tmux-${options.agentId}.log'`;
      await execAsync(pipeCmd);

      // Now attach using a simple cat process that reads the pipe
      const ptyProcess = pty.spawn('bash', ['-c', `
        # Start capturing from tmux
        tmux capture-pane -t ${sessionName} -p -J -S - -E -
        # Then tail the output pipe
        tail -f /tmp/tmux-${options.agentId}.log 2>/dev/null || true
      `], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        env: process.env
      });

      // For input, we send directly to tmux
      const originalWrite = ptyProcess.write.bind(ptyProcess);
      ptyProcess.write = (data: string) => {
        // Send input to tmux session
        exec(`tmux send-keys -t ${sessionName} "${data.replace(/"/g, '\\"')}"`, (err) => {
          if (err) console.error('Error sending to tmux:', err);
        });
        return originalWrite(''); // Don't echo locally
      };

      const session: TerminalSession = {
        agentId: options.agentId,
        location: 'local',
        isolation: 'tmux',
        process: ptyProcess,
        status: 'running',
        createdAt: new Date(),
        metadata: { sessionName }
      };

      this.sessions.set(options.agentId, session);
      this.setupPtyEventHandlers(options.agentId, ptyProcess);

      this.emit('terminal-ready', session);
      return session;

    } catch (error) {
      throw new Error(`Failed to create tmux session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private setupPtyEventHandlers(agentId: string, ptyProcess: any) {
    ptyProcess.onData((data: string) => {
      // Raw data from tmux, including all ANSI sequences
      this.emit('terminal-data', agentId, data);
    });

    ptyProcess.onExit(({ exitCode, signal }: {exitCode: number, signal: number}) => {
      console.log(`PTY exited for agent ${agentId}`);
      this.emit('terminal-exit', agentId, exitCode, signal?.toString());
    });
  }

  sendInput(agentId: string, data: string): boolean {
    const session = this.sessions.get(agentId);
    if (session?.process) {
      session.process.write(data);
      return true;
    }
    return false;
  }

  resizeTerminal(agentId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(agentId);
    if (session?.metadata?.['sessionName']) {
      exec(`tmux resize-window -t ${session.metadata['sessionName']} -x ${cols} -y ${rows}`);
      return true;
    }
    return false;
  }

  killTerminal(agentId: string): boolean {
    const session = this.sessions.get(agentId);
    if (session?.metadata?.['sessionName']) {
      exec(`tmux kill-session -t ${session.metadata['sessionName']}`);
      exec(`rm -f /tmp/tmux-${agentId}.log`);
      if (session.process) {
        session.process.kill();
      }
      this.sessions.delete(agentId);
      return true;
    }
    return false;
  }

  getSession(agentId: string): TerminalSession | null {
    return this.sessions.get(agentId) || null;
  }

  getActiveSessions(): TerminalSession[] {
    return Array.from(this.sessions.values());
  }

  isReady(agentId: string): boolean {
    return this.sessions.get(agentId)?.status === 'running';
  }

  cleanup(): void {
    for (const [agentId, _session] of this.sessions) {
      this.killTerminal(agentId);
    }
  }
}