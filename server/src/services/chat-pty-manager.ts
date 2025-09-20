/**
 * Chat PTY Manager
 *
 * Terminal manager optimized for chat mode agents using Claude JSON output.
 * Uses direct command execution without PTY/tmux for clean responses.
 * Maintains conversation continuity via Claude session IDs.
 */

import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';
import path from 'path';
import os from 'os';
import { PrismaClient } from '@prisma/client';
import { TerminalManager, TerminalSession, TerminalOptions } from './terminal-manager-interface.js';
import { claudeConfigManager } from './claude-config-manager.js';
import { StreamingChatManager } from './streaming-chat-manager.js';

const prisma = new PrismaClient();

interface ChatSession extends TerminalSession {
  claudeSessionId?: string;  // Claude conversation session ID
  conversationStarted: boolean;
  isWaitingForResponse: boolean;
  lastCommandTimestamp?: Date;
  activeProcess?: ChildProcess;  // Current Claude process if running
}

export class ChatPtyManager extends EventEmitter implements TerminalManager {
  private sessions: Map<string, ChatSession> = new Map();
  private readonly WORKSPACE_BASE = path.join(os.homedir(), '.covibes/workspaces');
  private streamingManager = new StreamingChatManager();

  constructor() {
    super();
    this.ensureWorkspaceDir();
    console.log('💬 ChatPtyManager initialized (JSON-based chat sessions with Claude)');
  }

  async spawnTerminal(options: TerminalOptions): Promise<TerminalSession> {
    console.log(`🚀 Spawning chat session for agent: ${options.agentId}`);

    try {
      // Check if session already exists
      const existingSession = this.sessions.get(options.agentId);
      if (existingSession && existingSession.status === 'running') {
        console.log(`♻️ Reusing existing chat session for agent: ${options.agentId}`);
        return existingSession;
      }

      // Ensure workspace exists
      const workspaceDir = await this.ensureTeamWorkspace(options.teamId, options.workspaceRepo);

      // Initialize user's Claude configuration
      await claudeConfigManager.initializeUserConfig(options.userId);

      // Create lightweight chat session (no PTY/tmux)
      const session: ChatSession = {
        agentId: options.agentId,
        location: 'local',
        isolation: 'none',  // No isolation needed for chat
        status: 'running',
        createdAt: new Date(),
        metadata: {
          userId: options.userId,
          teamId: options.teamId,
          agentName: options.agentName,
          workspaceDir,
          sessionId: options.sessionId  // Existing Claude session ID if provided
        },
        conversationStarted: false,
        isWaitingForResponse: false
      };

      // If sessionId provided, store it but DON'T mark as started
      // The conversation only starts after the first successful Claude response
      if (options.sessionId) {
        session.claudeSessionId = options.sessionId;
        session.conversationStarted = false;  // Don't resume non-existent conversation!
      }

      this.sessions.set(options.agentId, session);

      // Update database with session info
      await this.updateAgentSession(options.agentId, 'chat-mode');

      console.log(`✅ Chat session created for agent: ${options.agentId}`);
      this.emit('terminal-ready', session);

      return session;

    } catch (error) {
      const errorMsg = `Failed to spawn chat session: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);

      const failedSession: ChatSession = {
        agentId: options.agentId,
        location: 'local',
        isolation: 'none',
        status: 'error',
        createdAt: new Date(),
        metadata: { error: errorMsg },
        conversationStarted: false,
        isWaitingForResponse: false
      };

      this.sessions.set(options.agentId, failedSession);
      this.emit('terminal-error', options.agentId, errorMsg);

      throw new Error(errorMsg);
    }
  }


  private buildSystemPrompt(session: ChatSession): string | undefined {
    const metadata = session.metadata || {};

    // Only add system prompt for first message
    if (session.conversationStarted) {
      return undefined;
    }

    // Get base system prompt
    let systemPrompt = (claudeConfigManager as any)['AGENT_SYSTEM_PROMPT'] || 'ColabVibe Agent Online';

    // Add agent name if provided
    if (metadata['agentName']) {
      systemPrompt = `WORKER CALLSIGN: ${metadata['agentName']}\n\n${systemPrompt}`;
    }

    // Add workspace context if teamId provided
    if (metadata['teamId']) {
      const templateContext = `
WORKSPACE TEMPLATE STRUCTURE:
- Frontend: React + Vite on port 5173 (dev server with HMR)
- Backend: Express on port 3002
- Database: PostgreSQL (team-isolated: preview_${(metadata['teamId'] as string).replace(/-/g, '_')})
- Main files: /src/App.jsx, /server.js, /package.json, /vite.config.js
- Build system: Vite bundler
- Workspace path: ${metadata['workspaceDir']}/
- Package manager: npm

DEVELOPMENT COMMANDS:
- Frontend dev: npm run dev (runs on port 5173)
- Backend: npm run server (runs on port 3002)
- Full stack: npm run dev:fullstack (runs both)
`;
      systemPrompt = templateContext + '\n' + systemPrompt;
    }

    return systemPrompt;
  }

  sendInput(agentId: string, data: string): boolean {
    const session = this.sessions.get(agentId);
    if (!session || session.status !== 'running') {
      return false;
    }

    // Don't send if already waiting for response
    if (session.isWaitingForResponse) {
      console.warn(`⚠️ Chat session ${agentId} is already waiting for response`);
      return false;
    }

    if (!data.trim()) {
      return false;
    }

    console.log(`💬 Sending chat message for ${agentId}: ${data.substring(0, 100)}...`);

    // Execute asynchronously without blocking
    this.executeChatCommand(session, data)
      .then(() => {
        console.log(`✅ executeChatCommand completed successfully for ${agentId}`);
      })
      .catch(error => {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ Chat execution error for ${agentId}:`, errorMsg);
        console.error(`Full error:`, error);
        this.emit('chat-error', agentId, errorMsg);
      });

    return true;
  }

  private async executeChatCommand(session: ChatSession, data: string): Promise<void> {
    try {
      session.isWaitingForResponse = true;
      session.lastCommandTimestamp = new Date();

      // Set up streaming event handlers
      const handleStreamStart = (streamAgentId: string) => {
        if (streamAgentId === session.agentId) {
          console.log(`🚀 Stream started for ${streamAgentId}`);
          this.emit('chat-stream-start', streamAgentId);
        }
      };

      const handleStreamChunk = (streamAgentId: string, chunk: any) => {
        if (streamAgentId === session.agentId) {
          console.log(`📤 Emitting stream chunk for ${streamAgentId}:`, chunk.content?.substring(0, 50));
          // Emit streaming chunk to frontend
          this.emit('chat-stream-chunk', streamAgentId, chunk);
        }
      };

      this.streamingManager.once('stream-start', handleStreamStart);
      this.streamingManager.on('stream-chunk', handleStreamChunk);

      // Handle tool use events
      const handleToolUse = (streamAgentId: string, data: any) => {
        if (streamAgentId === session.agentId) {
          console.log(`🔧 Forwarding tool use event for ${streamAgentId}:`, data.tool);
          this.emit('chat-tool-use', streamAgentId, data);
        }
      };
      this.streamingManager.on('tool-use', handleToolUse);

      const handleStreamComplete = async (agentId: string, data: any) => {
        if (agentId === session.agentId) {
          // Store session ID for continuity - ensure we use the UUID session ID
          if (data.sessionId && data.sessionId.includes('-')) {
            session.claudeSessionId = data.sessionId;
            session.conversationStarted = true;
            console.log(`🆔 UUID Session ID stored: ${data.sessionId}`);
          }

          // Emit complete response
          this.emit('chat-response', agentId, data.fullContent);

          // Store in terminal history
          await this.storeTerminalHistory(agentId, data.fullContent, 'output');

          // Emit metadata if available
          if (data.metadata) {
            this.emit('chat-metadata', agentId, {
              cost: data.metadata.inputTokens,
              duration: 0,
              turns: 1,
              sessionId: data.sessionId
            });
          }

          console.log(`✅ Stream completed for ${agentId}`);

          // Emit stream complete event to frontend
          this.emit('chat-stream-complete', agentId);
        }
        session.isWaitingForResponse = false;

        // Clean up event handlers
        this.streamingManager.off('stream-chunk', handleStreamChunk);
        this.streamingManager.off('stream-complete', handleStreamComplete);
        this.streamingManager.off('stream-error', handleStreamError);
        this.streamingManager.off('tool-use', handleToolUse);
      };

      this.streamingManager.once('stream-complete', handleStreamComplete);

      const handleStreamError = (agentId: string, error: string) => {
        if (agentId === session.agentId) {
          console.error(`❌ Stream error for ${agentId}:`, error);
          this.emit('chat-error', agentId, error);
        }
        session.isWaitingForResponse = false;

        // Clean up event handlers
        this.streamingManager.off('stream-chunk', handleStreamChunk);
        this.streamingManager.off('stream-complete', handleStreamComplete);
        this.streamingManager.off('stream-error', handleStreamError);
        this.streamingManager.off('tool-use', handleToolUse);
      };

      this.streamingManager.once('stream-error', handleStreamError);

      // Build system prompt for first message
      const systemPrompt = this.buildSystemPrompt(session);

      // Start the stream with system prompt if needed
      await this.streamingManager.startStream(
        session.agentId,
        data,
        session.claudeSessionId,
        session.metadata?.['workspaceDir'] || this.WORKSPACE_BASE,
        systemPrompt && !session.conversationStarted ? systemPrompt : undefined
      );

    } catch (error) {
      session.isWaitingForResponse = false;
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Chat error for ${session.agentId}:`, errorMsg);
      this.emit('chat-error', session.agentId, errorMsg);
    }
  }

  resizeTerminal(_agentId: string, _cols: number, _rows: number): boolean {
    // No-op for chat mode - no terminal to resize
    return true;
  }

  killTerminal(agentId: string): boolean {
    const session = this.sessions.get(agentId);
    if (!session) return false;

    try {
      // Kill active Claude process if running
      if (session.activeProcess && !session.activeProcess.killed) {
        session.activeProcess.kill('SIGTERM');
      }

      session.status = 'stopped';
      this.sessions.delete(agentId);

      console.log(`💀 Cleaned up chat session for agent ${agentId}`);
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
    return session?.status === 'running';
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


  private async updateAgentSession(agentId: string, sessionType: string): Promise<void> {
    try {
      await prisma.agents.update({
        where: { id: agentId },
        data: {
          tmuxSessionName: sessionType,  // Store 'chat-mode' instead of tmux session name
          isSessionPersistent: false,     // No persistent tmux session
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

}