/**
 * Terminal Manager Interface
 * 
 * Defines common interface for all terminal management implementations:
 * - LocalPtyManager: Direct local PTY processes
 * - LocalDockerManager: Local Docker containers
 * - RemotePtyManager: SSH to VM without Docker
 * - RemoteDockerManager: Docker containers on VM
 */

export interface VMConfig {
  id: string;
  host: string;
  port?: number;
  username: string;
  privateKey?: string;
  keyPath?: string;
}

export interface TerminalOptions {
  agentId: string;
  agentName?: string;
  userId: string;
  teamId: string;
  task: string;
  location: 'local' | 'remote';
  isolation: 'none' | 'docker' | 'tmux';
  vmConfig?: VMConfig;
  workspaceRepo?: string;
}

export interface TerminalSession {
  agentId: string;
  location: 'local' | 'remote';
  isolation: 'none' | 'docker' | 'tmux';
  process?: any;  // PTY process for simple terminals
  containerId?: string;  // Container ID for Docker terminals
  vmConfig?: VMConfig;  // VM config for remote terminals
  status: 'starting' | 'running' | 'stopped' | 'error';
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface TerminalManager {
  /**
   * Spawn a terminal for an agent
   */
  spawnTerminal(options: TerminalOptions): Promise<TerminalSession>;

  /**
   * Send input to a terminal
   */
  sendInput(agentId: string, data: string): boolean;

  /**
   * Resize terminal
   */
  resizeTerminal(agentId: string, cols: number, rows: number): boolean;

  /**
   * Kill terminal and cleanup resources
   */
  killTerminal(agentId: string): boolean | Promise<boolean>;

  /**
   * Get terminal session info
   */
  getSession(agentId: string): TerminalSession | null;

  /**
   * Get all active sessions
   */
  getActiveSessions(): TerminalSession[];

  /**
   * Check if terminal is ready
   */
  isReady(agentId: string): boolean;

  /**
   * Cleanup inactive sessions
   */
  cleanup(): void;
}

export interface TerminalManagerEvents {
  'terminal-ready': (session: TerminalSession) => void;
  'terminal-data': (agentId: string, data: string) => void;
  'terminal-exit': (agentId: string, code: number, signal?: string) => void;
  'terminal-error': (agentId: string, error: string) => void;
}