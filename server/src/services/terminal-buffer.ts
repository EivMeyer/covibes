// Terminal output buffering service for live streaming and history
// Stores recent terminal output per agent to provide history to late-joining users

interface TerminalOutputEntry {
  timestamp: number;
  output: string;
  agentId: string;
}

interface TerminalSubscriber {
  socketId: string;
  userId: string;
  joinedAt: number;
}

interface TerminalSession {
  agentId: string;
  buffer: TerminalOutputEntry[];
  subscribers: Map<string, TerminalSubscriber>;
  lastActivity: number;
  createdAt: number;
  dimensions: { width: number; height: number };
}

class TerminalBufferService {
  private static instance: TerminalBufferService;
  private sessions: Map<string, TerminalSession> = new Map();
  private readonly MAX_BUFFER_SIZE = 1000; // Maximum entries per terminal
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes inactive cleanup
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes cleanup check
  private cleanupTimer: NodeJS.Timeout | undefined;

  private constructor() {
    this.startCleanupTimer();
  }

  static getInstance(): TerminalBufferService {
    if (!TerminalBufferService.instance) {
      TerminalBufferService.instance = new TerminalBufferService();
    }
    return TerminalBufferService.instance;
  }

  /**
   * Initialize or get terminal session for an agent
   */
  initializeSession(agentId: string, width: number = 80, height: number = 24): TerminalSession {
    let session = this.sessions.get(agentId);
    
    if (!session) {
      console.log(`[TerminalBuffer] Creating new session for agent: ${agentId}`);
      
      session = {
        agentId,
        buffer: [],
        subscribers: new Map(),
        lastActivity: Date.now(),
        createdAt: Date.now(),
        dimensions: { width, height },
      };
      this.sessions.set(agentId, session);
    }
    
    session.lastActivity = Date.now();
    return session;
  }

  /**
   * Sanitize Unicode string to remove invalid characters that break JSON serialization
   */
  private sanitizeUnicode(str: string): string {
    try {
      // Replace unpaired surrogate characters and other problematic Unicode
      return str
        // Remove unpaired high surrogates (0xD800-0xDBFF not followed by low surrogate)
        .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '�')
        // Remove unpaired low surrogates (0xDC00-0xDFFF not preceded by high surrogate)
        .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '�')
        // Remove null bytes and other control characters that might cause issues
        .replace(/\u0000/g, '')
        // Remove other problematic Unicode control characters
        .replace(/[\u007F-\u009F]/g, '');
    } catch (error) {
      console.warn(`[TerminalBuffer] Unicode sanitization failed, using fallback: ${error}`);
      // Fallback: encode as UTF-8 and decode back to remove invalid sequences
      try {
        return Buffer.from(str, 'utf8').toString('utf8');
      } catch {
        // Ultimate fallback: replace all non-ASCII with replacement character
        return str.replace(/[^\x00-\x7F]/g, '�');
      }
    }
  }

  /**
   * Add terminal output to the buffer
   */
  addOutput(agentId: string, output: string): void {
    const session = this.initializeSession(agentId);
    
    // Sanitize output to prevent JSON serialization errors
    const sanitizedOutput = this.sanitizeUnicode(output);
    
    const entry: TerminalOutputEntry = {
      timestamp: Date.now(),
      output: sanitizedOutput,
      agentId,
    };
    
    session.buffer.push(entry);
    session.lastActivity = Date.now();
    
    // Trim buffer if it exceeds max size
    if (session.buffer.length > this.MAX_BUFFER_SIZE) {
      const removeCount = session.buffer.length - this.MAX_BUFFER_SIZE;
      session.buffer.splice(0, removeCount);
      console.log(`[TerminalBuffer] Trimmed ${removeCount} old entries for agent: ${agentId}`);
    }
    
    // Log warning if we had to sanitize the output
    if (sanitizedOutput !== output) {
      console.warn(`[TerminalBuffer] Sanitized Unicode characters in output for agent ${agentId}: ${output.length} -> ${sanitizedOutput.length} chars`);
    }
    
    console.debug(`[TerminalBuffer] Added output to agent ${agentId}: ${sanitizedOutput.length} chars (buffer size: ${session.buffer.length})`);
  }

  /**
   * Get terminal history for an agent
   */
  getHistory(agentId: string, since?: number): TerminalOutputEntry[] {
    const session = this.sessions.get(agentId);
    
    if (!session) {
      return [];
    }
    
    if (since) {
      return session.buffer.filter(entry => entry.timestamp > since);
    }
    
    return [...session.buffer]; // Return copy to prevent mutation
  }

  /**
   * Get recent terminal output (last N entries or last X milliseconds)
   */
  getRecentHistory(agentId: string, options: { lastEntries?: number; lastMs?: number } = {}): TerminalOutputEntry[] {
    const session = this.sessions.get(agentId);
    
    if (!session) {
      return [];
    }
    
    let entries = session.buffer;
    
    // Filter by time if specified
    if (options.lastMs) {
      const cutoff = Date.now() - options.lastMs;
      entries = entries.filter(entry => entry.timestamp > cutoff);
    }
    
    // Limit by count if specified
    if (options.lastEntries && entries.length > options.lastEntries) {
      entries = entries.slice(-options.lastEntries);
    }
    
    return entries;
  }

  /**
   * Add subscriber to a terminal session
   */
  addSubscriber(agentId: string, socketId: string, userId: string): void {
    const session = this.initializeSession(agentId);
    
    const subscriber: TerminalSubscriber = {
      socketId,
      userId,
      joinedAt: Date.now(),
    };
    
    session.subscribers.set(socketId, subscriber);
    session.lastActivity = Date.now();
    
    console.log(`[TerminalBuffer] Added subscriber ${socketId} (user: ${userId}) to agent: ${agentId} (total: ${session.subscribers.size})`);
  }

  /**
   * Remove subscriber from a terminal session
   */
  removeSubscriber(agentId: string, socketId: string): boolean {
    const session = this.sessions.get(agentId);
    
    if (!session) {
      return false;
    }
    
    const removed = session.subscribers.delete(socketId);
    session.lastActivity = Date.now();
    
    if (removed) {
      console.log(`[TerminalBuffer] Removed subscriber ${socketId} from agent: ${agentId} (remaining: ${session.subscribers.size})`);
    }
    
    return removed;
  }

  /**
   * Remove subscriber from all sessions (when socket disconnects)
   */
  removeSubscriberFromAll(socketId: string): void {
    for (const [agentId, session] of this.sessions) {
      if (session.subscribers.has(socketId)) {
        this.removeSubscriber(agentId, socketId);
      }
    }
  }

  /**
   * Get all subscribers for an agent
   */
  getSubscribers(agentId: string): TerminalSubscriber[] {
    const session = this.sessions.get(agentId);
    return session ? Array.from(session.subscribers.values()) : [];
  }

  /**
   * Get subscriber count for an agent
   */
  getSubscriberCount(agentId: string): number {
    const session = this.sessions.get(agentId);
    return session ? session.subscribers.size : 0;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }


  /**
   * Handle terminal resize for an agent
   */
  resizeTerminal(agentId: string, width: number, height: number): void {
    const session = this.sessions.get(agentId);
    
    if (session) {
      session.dimensions = { width, height };
      console.log(`[TerminalBuffer] Resized terminal for agent ${agentId}: ${width}x${height}`);
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats(agentId: string): { bufferSize: number; subscriberCount: number; lastActivity: number; uptime: number } | null {
    const session = this.sessions.get(agentId);
    
    if (!session) {
      return null;
    }
    
    return {
      bufferSize: session.buffer.length,
      subscriberCount: session.subscribers.size,
      lastActivity: session.lastActivity,
      uptime: Date.now() - session.createdAt,
    };
  }

  /**
   * Clear terminal buffer for an agent
   */
  clearBuffer(agentId: string): void {
    const session = this.sessions.get(agentId);
    
    if (session) {
      session.buffer = [];
      session.lastActivity = Date.now();
      console.log(`[TerminalBuffer] Cleared buffer for agent: ${agentId}`);
    }
  }

  /**
   * Remove terminal session completely
   */
  removeSession(agentId: string): boolean {
    const removed = this.sessions.delete(agentId);
    
    if (removed) {
      console.log(`[TerminalBuffer] Removed session for agent: ${agentId}`);
    }
    
    return removed;
  }

  /**
   * Start cleanup timer to remove inactive sessions
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupInactiveSessions();
    }, this.CLEANUP_INTERVAL);
    
    console.log(`[TerminalBuffer] Started cleanup timer (${this.CLEANUP_INTERVAL}ms interval)`);
  }

  /**
   * Clean up inactive sessions to prevent memory leaks
   */
  private cleanupInactiveSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];
    
    for (const [agentId, session] of this.sessions) {
      const inactiveTime = now - session.lastActivity;
      
      // Remove sessions that are inactive and have no subscribers
      if (inactiveTime > this.SESSION_TIMEOUT && session.subscribers.size === 0) {
        expiredSessions.push(agentId);
      }
    }
    
    if (expiredSessions.length > 0) {
      console.log(`[TerminalBuffer] Cleaning up ${expiredSessions.length} inactive sessions: ${expiredSessions.join(', ')}`);
      
      for (const agentId of expiredSessions) {
        this.removeSession(agentId);
      }
    }
  }

  /**
   * Shutdown the service and cleanup resources
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    
    this.sessions.clear();
    console.log(`[TerminalBuffer] Service shutdown completed`);
  }

  /**
   * Get overall service statistics
   */
  getServiceStats(): { totalSessions: number; totalSubscribers: number; totalBufferEntries: number } {
    let totalSubscribers = 0;
    let totalBufferEntries = 0;
    
    for (const session of this.sessions.values()) {
      totalSubscribers += session.subscribers.size;
      totalBufferEntries += session.buffer.length;
    }
    
    return {
      totalSessions: this.sessions.size,
      totalSubscribers,
      totalBufferEntries,
    };
  }
}

export default TerminalBufferService.getInstance();
export { TerminalBufferService };
export type { TerminalOutputEntry, TerminalSubscriber, TerminalSession };