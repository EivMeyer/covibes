/**
 * Terminal Manager Factory
 * 
 * Creates appropriate terminal manager based on configuration:
 * - Local + None: LocalPtyManager (simple local PTY)
 * - Local + Docker: LocalDockerManager (existing Docker implementation)
 * - Remote + None: RemotePtyManager (SSH without Docker)
 * - Remote + Docker: RemoteDockerManager (Docker on VM)
 */

import { EventEmitter } from 'events';
import { TerminalManager, TerminalOptions } from './terminal-manager-interface.js';
import { LocalPtyManager } from './local-pty-manager.js';
import { TmuxPtyManager } from './tmux-pty-manager.js';
import { LocalDockerManager } from './local-docker-manager.js';
import { RemotePtyManager } from './remote-pty-manager.js';
import { RemoteDockerManager } from './remote-docker-manager.js';
import { ChatPtyManager } from './chat-pty-manager.js';

export class TerminalManagerFactory extends EventEmitter {
  private static instance: TerminalManagerFactory;
  private managers: Map<string, TerminalManager> = new Map();
  
  private constructor() {
    super();
    this.setupCleanupInterval();
  }

  static getInstance(): TerminalManagerFactory {
    if (!TerminalManagerFactory.instance) {
      TerminalManagerFactory.instance = new TerminalManagerFactory();
    }
    return TerminalManagerFactory.instance;
  }

  /**
   * Get or create appropriate terminal manager for given configuration
   */
  getManager(location: 'local' | 'remote', isolation: 'none' | 'docker' | 'tmux', mode?: 'terminal' | 'chat'): TerminalManager {
    console.log(`🏭 [FACTORY] getManager called with location=${location}, isolation=${isolation}, mode=${mode}`);

    // Use chat manager for chat mode regardless of other settings
    if (mode === 'chat') {
      const key = 'chat-pty';

      if (this.managers.has(key)) {
        console.log(`🏭 [FACTORY] Reusing existing ChatPtyManager`);
        const existingManager = this.managers.get(key)!;

        // Ensure streaming events are forwarded (in case they weren't before)
        this.ensureStreamingEventsForwarded(existingManager);

        return existingManager;
      }

      console.log(`🏭 Creating chat PTY manager: ${key}`);
      const manager = new ChatPtyManager();

      // Forward events from manager to factory
      this.setupManagerEventForwarding(manager);

      this.managers.set(key, manager);
      return manager;
    }

    const key = `${location}-${isolation}`;

    if (this.managers.has(key)) {
      return this.managers.get(key)!;
    }

    console.log(`🏭 Creating terminal manager: ${key}`);

    let manager: TerminalManager;

    if (location === 'local' && isolation === 'none') {
      manager = new LocalPtyManager();
    } else if (location === 'local' && isolation === 'tmux') {
      manager = new TmuxPtyManager();
    } else if (location === 'local' && isolation === 'docker') {
      manager = new LocalDockerManager();
    } else if (location === 'remote' && isolation === 'none') {
      manager = new RemotePtyManager();
    } else if (location === 'remote' && isolation === 'docker') {
      manager = new RemoteDockerManager();
    } else {
      throw new Error(`Unsupported terminal configuration: ${location} + ${isolation}`);
    }

    // Forward events from manager to factory
    this.setupManagerEventForwarding(manager);

    this.managers.set(key, manager);
    return manager;
  }

  /**
   * Get appropriate manager for an agent based on options
   */
  getManagerForAgent(options: TerminalOptions): TerminalManager {
    return this.getManager(options.location, options.isolation, options.mode);
  }

  /**
   * Get session from any manager by agent ID
   */
  getSession(agentId: string) {
    for (const manager of this.managers.values()) {
      const session = manager.getSession(agentId);
      if (session) {
        return session;
      }
    }
    return null;
  }

  /**
   * Send input to appropriate manager
   */
  sendInput(agentId: string, data: string): boolean {
    for (const manager of this.managers.values()) {
      if (manager.getSession(agentId)) {
        return manager.sendInput(agentId, data);
      }
    }
    return false;
  }

  /**
   * Resize terminal in appropriate manager
   */
  resizeTerminal(agentId: string, cols: number, rows: number): boolean {
    for (const manager of this.managers.values()) {
      if (manager.getSession(agentId)) {
        return manager.resizeTerminal(agentId, cols, rows);
      }
    }
    return false;
  }

  /**
   * Kill terminal in appropriate manager
   */
  async killTerminal(agentId: string): Promise<boolean> {
    for (const manager of this.managers.values()) {
      if (manager.getSession(agentId)) {
        const result = manager.killTerminal(agentId);
        return result;
      }
    }
    return false;
  }

  /**
   * Get all active sessions across all managers
   */
  getAllSessions() {
    const allSessions = [];
    for (const manager of this.managers.values()) {
      allSessions.push(...manager.getActiveSessions());
    }
    return allSessions;
  }

  /**
   * Get statistics about terminal usage
   */
  getStats() {
    const stats = {
      totalManagers: this.managers.size,
      managerTypes: Array.from(this.managers.keys()),
      totalSessions: 0,
      sessionsByType: {} as Record<string, number>
    };

    for (const [key, manager] of this.managers) {
      const sessions = manager.getActiveSessions();
      stats.totalSessions += sessions.length;
      stats.sessionsByType[key] = sessions.length;
    }

    return stats;
  }

  /**
   * Setup event forwarding from manager to factory
   */
  private setupManagerEventForwarding(manager: TerminalManager) {
    // Type assertion to treat manager as EventEmitter
    const emitter = manager as any;
    
    if (emitter.on && typeof emitter.on === 'function') {
      emitter.on('terminal-ready', (session: any) => {
        this.emit('terminal-ready', session);
      });
      
      emitter.on('terminal-data', (agentId: string, data: string) => {
        this.emit('terminal-data', agentId, data);
      });
      
      emitter.on('terminal-exit', (agentId: string, code: number, signal?: string) => {
        this.emit('terminal-exit', agentId, code, signal);
      });
      
      emitter.on('terminal-error', (agentId: string, error: string) => {
        this.emit('terminal-error', agentId, error);
      });

      // Chat-specific events
      emitter.on('chat-response', (agentId: string, response: string) => {
        this.emit('chat-response', agentId, response);
      });

      emitter.on('chat-error', (agentId: string, error: string) => {
        this.emit('chat-error', agentId, error);
      });

      emitter.on('chat-tool-use', (agentId: string, data: any) => {
        console.log(`🔄 [FACTORY] Forwarding chat-tool-use for ${agentId}:`, data.tool);
        this.emit('chat-tool-use', agentId, data);
      });

      // Streaming events for chat
      emitter.on('chat-stream-start', (agentId: string) => {
        console.log(`🔄 [FACTORY] Forwarding chat-stream-start for ${agentId}`);
        this.emit('chat-stream-start', agentId);
      });

      emitter.on('chat-stream-chunk', (agentId: string, chunk: any) => {
        console.log(`🔄 [FACTORY] Forwarding chat-stream-chunk for ${agentId}:`, chunk.content?.substring(0, 50));
        this.emit('chat-stream-chunk', agentId, chunk);
      });

      emitter.on('chat-stream-complete', (agentId: string) => {
        console.log(`🔄 [FACTORY] Forwarding chat-stream-complete for ${agentId}`);
        this.emit('chat-stream-complete', agentId);
      });
    }
  }

  /**
   * Ensure streaming events are forwarded for existing managers
   */
  private ensureStreamingEventsForwarded(manager: TerminalManager) {
    const emitter = manager as any;

    // Check if streaming events are already being forwarded
    if (emitter._events && emitter._events['chat-stream-start']) {
      console.log(`🔄 [FACTORY] Streaming events already forwarded`);
      return;
    }

    console.log(`🔄 [FACTORY] Adding streaming event forwarding to existing manager`);

    if (emitter.on && typeof emitter.on === 'function') {
      // Add streaming event forwarding
      emitter.on('chat-stream-start', (agentId: string) => {
        console.log(`🔄 [FACTORY] Forwarding chat-stream-start for ${agentId}`);
        this.emit('chat-stream-start', agentId);
      });

      emitter.on('chat-stream-chunk', (agentId: string, chunk: any) => {
        console.log(`🔄 [FACTORY] Forwarding chat-stream-chunk for ${agentId}:`, chunk.content?.substring(0, 50));
        this.emit('chat-stream-chunk', agentId, chunk);
      });

      emitter.on('chat-stream-complete', (agentId: string) => {
        console.log(`🔄 [FACTORY] Forwarding chat-stream-complete for ${agentId}`);
        this.emit('chat-stream-complete', agentId);
      });

      emitter.on('chat-tool-use', (agentId: string, data: any) => {
        console.log(`🔄 [FACTORY] Forwarding chat-tool-use for ${agentId}:`, data.tool);
        this.emit('chat-tool-use', agentId, data);
      });
    }
  }

  /**
   * Periodic cleanup of inactive sessions
   */
  private setupCleanupInterval() {
    setInterval(() => {
      for (const manager of this.managers.values()) {
        try {
          manager.cleanup();
        } catch (error) {
          console.error('Error during manager cleanup:', error);
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Shutdown all managers and cleanup resources
   */
  shutdown() {
    console.log('🛑 Shutting down terminal manager factory');
    
    for (const [key, manager] of this.managers) {
      try {
        // Kill all sessions in this manager
        const sessions = manager.getActiveSessions();
        for (const session of sessions) {
          manager.killTerminal(session.agentId);
        }
        console.log(`✅ Cleaned up ${sessions.length} sessions from ${key} manager`);
      } catch (error) {
        console.error(`Error cleaning up ${key} manager:`, error);
      }
    }
    
    this.managers.clear();
  }
}

// Export singleton instance
export const terminalManagerFactory = TerminalManagerFactory.getInstance();