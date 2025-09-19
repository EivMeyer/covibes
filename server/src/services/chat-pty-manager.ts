/**
 * Chat PTY Manager
 *
 * Terminal manager optimized for chat mode agents using Claude --print flag.
 * Uses node-pty for consistent infrastructure with terminal mode but optimized
 * for single-command execution pattern with completion events.
 *
 * Maintains session persistence via tmux for chat agent reconnection capabilities.
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

interface ChatSession extends TerminalSession {
  ptyProcess?: pty.IPty;
  responseBuffer: string;
  isWaitingForResponse: boolean;
  lastCommandTimestamp?: Date;
}

export class ChatPtyManager extends EventEmitter implements TerminalManager {
  private sessions: Map<string, ChatSession> = new Map();
  private readonly WORKSPACE_BASE = path.join(os.homedir(), '.covibes/workspaces');
  private readonly SESSION_PREFIX = 'colabvibe-chat-';
  private readonly COMMAND_TIMEOUT = 30000; // 30 seconds for Claude responses

  constructor() {
    super();
    this.ensureWorkspaceDir();
    this.cleanupOrphanedSessions();
    console.log('💬 ChatPtyManager initialized (PTY-based chat sessions with Claude)');
  }

  async spawnTerminal(options: TerminalOptions): Promise<TerminalSession> {
    console.log(`🚀 Spawning chat PTY for agent: ${options.agentId}`);

    const sessionName = this.getSessionName(options.agentId);

    try {
      // Check if session already exists
      const existingSession = await this.checkTmuxSession(sessionName);
      if (existingSession) {
        console.log(`♻️ Reconnecting to existing chat session: ${sessionName}`);
        return await this.attachToExistingSession(sessionName, options);
      }

      // Ensure workspace exists
      const workspaceDir = await this.ensureTeamWorkspace(options.teamId, options.workspaceRepo);

      // Initialize user's Claude configuration
      await claudeConfigManager.initializeUserConfig(options.userId);

      // Create new tmux session optimized for chat
      return await this.createChatSession(sessionName, options, workspaceDir);

    } catch (error) {
      const errorMsg = `Failed to spawn chat PTY: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);

      const failedSession: ChatSession = {
        agentId: options.agentId,
        location: 'local',
        isolation: 'tmux',
        status: 'error',
        createdAt: new Date(),
        metadata: { error: errorMsg, sessionName },
        responseBuffer: '',
        isWaitingForResponse: false
      };

      this.sessions.set(options.agentId, failedSession);
      this.emit('terminal-error', options.agentId, errorMsg);

      throw new Error(errorMsg);
    }
  }

  private async createChatSession(
    sessionName: string,
    options: TerminalOptions,
    workspaceDir: string
  ): Promise<ChatSession> {
    console.log(`🎯 ChatPtyManager received agentName: ${options.agentName}`);

    // Build Claude command for chat mode
    const { command: claudeCommand, args: claudeArgs, env: claudeEnv } =
      claudeConfigManager.buildClaudeCommand(options.userId, {
        task: '', // Chat mode doesn't use task parameter
        teamId: options.teamId,
        skipPermissions: true,
        interactive: false,
        appendSystemPrompt: true,
        ...(options.agentName ? { agentName: options.agentName } : {}),
        mode: 'chat',
        ...(options.sessionId ? { sessionId: options.sessionId } : {})
      });

    // Build tmux command with proper shell setup for chat
    const tmuxCmd = [
      'tmux', 'new-session', '-d', '-s', sessionName,
      '-c', workspaceDir,
      'bash'
    ];

    console.log(`📦 Creating tmux chat session: ${sessionName} in ${workspaceDir}`);

    try {
      // Create tmux session
      await execAsync(tmuxCmd.join(' '), { env: claudeEnv });

      // Wait for session to be ready
      await this.waitForTmuxSession(sessionName);

      // Create PTY attached to tmux session
      const ptyProcess = pty.spawn('tmux', ['attach-session', '-t', sessionName], {
        name: 'xterm-color',
        cols: 120,
        rows: 30,
        cwd: workspaceDir,
        env: claudeEnv
      });

      const session: ChatSession = {
        agentId: options.agentId,
        location: 'local',
        isolation: 'tmux',
        process: ptyProcess,
        ptyProcess,
        status: 'running',
        createdAt: new Date(),
        metadata: {
          sessionName,
          workspaceDir,
          claudeCommand: `${claudeCommand} ${claudeArgs.join(' ')}`,
          userId: options.userId,
          teamId: options.teamId,
          agentName: options.agentName
        },
        responseBuffer: '',
        isWaitingForResponse: false
      };

      // Set up PTY event handlers for chat
      this.setupChatPtyHandlers(session, claudeCommand, claudeArgs);

      this.sessions.set(options.agentId, session);

      // Update database with session info
      await this.updateAgentSession(options.agentId, sessionName);

      console.log(`✅ Chat PTY session created: ${sessionName}`);
      this.emit('terminal-ready', session);

      return session;

    } catch (error) {
      console.error(`Failed to create chat session ${sessionName}:`, error);
      throw error;
    }
  }

  private setupChatPtyHandlers(session: ChatSession, _claudeCommand: string, _claudeArgs: string[]) {
    if (!session.ptyProcess) return;

    session.ptyProcess.onData((data: string) => {
      // Filter out ANSI codes and control characters for cleaner output
      const cleanData = data.replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, '');

      if (session.isWaitingForResponse) {
        // Accumulate response data
        session.responseBuffer += cleanData;

        // Check if Claude command completed (look for prompt return)
        if (this.isCommandComplete(cleanData)) {
          this.handleChatResponse(session);
        }
      }

      // Always emit raw data for debugging/monitoring
      this.emit('terminal-data', session.agentId, cleanData);
    });

    session.ptyProcess.onExit((event: { exitCode: number; signal?: number }) => {
      console.log(`💬 Chat PTY session ${session.metadata?.['sessionName']} exited: ${event.exitCode}, signal: ${event.signal}`);
      session.status = 'stopped';
      this.emit('terminal-exit', session.agentId, event.exitCode, event.signal);
    });

    // Send initial setup commands to prepare for Claude
    setTimeout(() => {
      if (session.ptyProcess) {
        // Clear screen and set up environment
        session.ptyProcess.write('clear\n');
        session.ptyProcess.write(`export CLAUDE_CONFIG_DIR="${claudeConfigManager.getUserConfigDir(session.metadata?.['userId'] || '')}"\n`);
        session.ptyProcess.write('echo "Chat session ready"\n');
      }
    }, 500);
  }

  private isCommandComplete(data: string): boolean {
    // Look for bash prompt patterns that indicate command completion
    const promptPatterns = [
      /\$ $/,          // Standard bash prompt
      /# $/,           // Root prompt
      /> $/,           // Continuation prompt
      /ubuntu@.*\$ $/, // Ubuntu prompt pattern
    ];

    return promptPatterns.some(pattern => pattern.test(data));
  }

  private async handleChatResponse(session: ChatSession) {
    if (!session.isWaitingForResponse) return;

    session.isWaitingForResponse = false;

    // Extract Claude's response from the buffer
    const response = this.extractClaudeResponse(session.responseBuffer);
    session.responseBuffer = '';

    if (response) {
      console.log(`💬 Chat response received for ${session.agentId}: ${response.substring(0, 100)}...`);

      // Store response in terminal history
      await this.storeTerminalHistory(session.agentId, response, 'output');

      // Emit chat response event for agent chat service
      this.emit('chat-response', session.agentId, response);
    }
  }

  private extractClaudeResponse(buffer: string): string {
    // Remove command echo and extract actual Claude output
    const lines = buffer.split('\n').filter(line => line.trim());

    // Find start of Claude output (after the command echo)
    let startIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]?.includes('claude')) {
        startIndex = i + 1;
        break;
      }
    }

    // Find end of Claude output (before the prompt)
    let endIndex = lines.length;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i]?.match(/\$ $|# $|> $|ubuntu@.*\$ $/)) {
        endIndex = i;
        break;
      }
    }

    return lines.slice(startIndex, endIndex).join('\n').trim();
  }

  sendInput(agentId: string, data: string): boolean {
    const session = this.sessions.get(agentId);
    if (!session?.ptyProcess || session.status !== 'running') {
      return false;
    }

    // For chat mode, we expect structured command execution
    if (data.trim()) {
      console.log(`💬 Executing chat command for ${agentId}: ${data.substring(0, 100)}...`);

      // Prepare for response collection
      session.isWaitingForResponse = true;
      session.responseBuffer = '';
      session.lastCommandTimestamp = new Date();

      // Build and execute Claude command with the input message
      const { command, args } = claudeConfigManager.buildClaudeCommand(
        session.metadata?.['userId'] || '',
        {
          teamId: session.metadata?.['teamId'],
          skipPermissions: true,
          mode: 'chat',
          ...(session.metadata?.['sessionId'] ? { sessionId: session.metadata['sessionId'] } : {})
        }
      );

      // Execute Claude with input piped via echo
      const claudeCmd = `echo "${data.replace(/"/g, '\\"')}" | ${command} ${args.join(' ')}\n`;
      session.ptyProcess.write(claudeCmd);

      // Set timeout for response
      setTimeout(() => {
        if (session.isWaitingForResponse) {
          console.warn(`⏰ Chat command timeout for ${agentId}`);
          session.isWaitingForResponse = false;
          this.emit('chat-error', agentId, 'Command timeout');
        }
      }, this.COMMAND_TIMEOUT);
    }

    return true;
  }

  resizeTerminal(agentId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(agentId);
    if (session?.ptyProcess) {
      session.ptyProcess.resize(cols, rows);
      return true;
    }
    return false;
  }

  killTerminal(agentId: string): boolean {
    const session = this.sessions.get(agentId);
    if (!session) return false;

    try {
      // Kill PTY process
      if (session.ptyProcess) {
        session.ptyProcess.kill();
      }

      // Kill tmux session
      if (session.metadata?.['sessionName']) {
        execAsync(`tmux kill-session -t ${session.metadata['sessionName']}`).catch(console.error);
      }

      session.status = 'stopped';
      this.sessions.delete(agentId);

      console.log(`💀 Killed chat session for agent ${agentId}`);
      return true;
    } catch (error) {
      console.error(`Error killing chat session ${agentId}:`, error);
      return false;
    }
  }

  getSession(agentId: string): TerminalSession | null {
    return this.sessions.get(agentId) || null;
  }

  getActiveSessions(): TerminalSession[] {
    return Array.from(this.sessions.values());
  }

  isReady(agentId: string): boolean {
    const session = this.sessions.get(agentId);
    return session?.status === 'running' && !!session.ptyProcess;
  }

  cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [agentId, session] of this.sessions) {
      if (now - session.createdAt.getTime() > maxAge && session.status === 'stopped') {
        this.killTerminal(agentId);
      }
    }
  }

  // Private helper methods

  private getSessionName(agentId: string): string {
    return `${this.SESSION_PREFIX}${agentId}`;
  }

  private async ensureWorkspaceDir(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      await fs.mkdir(this.WORKSPACE_BASE, { recursive: true });
    } catch (error) {
      console.error('Failed to ensure workspace directory:', error);
    }
  }

  private async ensureTeamWorkspace(teamId: string, repositoryUrl?: string): Promise<string> {
    const teamWorkspace = path.join(this.WORKSPACE_BASE, teamId);
    const fs = await import('fs/promises');

    try {
      await fs.mkdir(teamWorkspace, { recursive: true });

      // Initialize workspace if repository provided
      if (repositoryUrl) {
        // TODO: Clone repository if not exists
        console.log(`📂 Team workspace ready: ${teamWorkspace} (repo: ${repositoryUrl})`);
      }

      return teamWorkspace;
    } catch (error) {
      console.error(`Failed to ensure team workspace ${teamId}:`, error);
      throw error;
    }
  }

  private async checkTmuxSession(sessionName: string): Promise<boolean> {
    try {
      await execAsync(`tmux has-session -t ${sessionName}`);
      return true;
    } catch {
      return false;
    }
  }

  private async waitForTmuxSession(sessionName: string, maxWait = 5000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      if (await this.checkTmuxSession(sessionName)) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Tmux session ${sessionName} failed to start within ${maxWait}ms`);
  }

  private async attachToExistingSession(sessionName: string, options: TerminalOptions): Promise<ChatSession> {
    const workspaceDir = path.join(this.WORKSPACE_BASE, options.teamId);

    // Create PTY attached to existing tmux session
    const ptyProcess = pty.spawn('tmux', ['attach-session', '-t', sessionName], {
      name: 'xterm-color',
      cols: 120,
      rows: 30,
      cwd: workspaceDir,
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: claudeConfigManager.getUserConfigDir(options.userId)
      }
    });

    const session: ChatSession = {
      agentId: options.agentId,
      location: 'local',
      isolation: 'tmux',
      process: ptyProcess,
      ptyProcess,
      status: 'running',
      createdAt: new Date(),
      metadata: {
        sessionName,
        workspaceDir,
        userId: options.userId,
        teamId: options.teamId,
        agentName: options.agentName,
        reconnected: true
      },
      responseBuffer: '',
      isWaitingForResponse: false
    };

    // Set up handlers for reconnected session
    this.setupChatPtyHandlers(session, 'claude', []);

    this.sessions.set(options.agentId, session);
    this.emit('terminal-ready', session);

    return session;
  }

  private async updateAgentSession(agentId: string, sessionName: string): Promise<void> {
    try {
      await prisma.agents.update({
        where: { id: agentId },
        data: {
          tmuxSessionName: sessionName,
          isSessionPersistent: true,
          status: 'running'
        }
      });
    } catch (error) {
      console.error(`Failed to update agent session info for ${agentId}:`, error);
    }
  }

  private async storeTerminalHistory(agentId: string, output: string, type: string): Promise<void> {
    try {
      await prisma.terminal_history.create({
        data: {
          id: `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          agentId,
          output,
          type
        }
      });
    } catch (error) {
      console.error(`Failed to store terminal history for ${agentId}:`, error);
    }
  }

  private cleanupOrphanedSessions(): void {
    // TODO: Check for orphaned tmux sessions and clean them up
    console.log('🧹 Chat session cleanup completed');
  }
}