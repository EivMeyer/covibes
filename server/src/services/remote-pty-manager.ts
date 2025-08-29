/**
 * Remote PTY Manager (PLACEHOLDER)
 * 
 * SSH-based terminal manager for remote VMs without Docker.
 * Currently not implemented - remote server is down.
 */

import { EventEmitter } from 'events';
import { TerminalManager, TerminalSession, TerminalOptions } from './terminal-manager-interface.js';

export class RemotePtyManager extends EventEmitter implements TerminalManager {
  constructor() {
    super();
    console.log('🌐 RemotePtyManager initialized (PLACEHOLDER - remote disabled)');
  }

  async spawnTerminal(options: TerminalOptions): Promise<TerminalSession> {
    const errorMsg = 'Remote terminals are currently disabled (server down)';
    console.error(`❌ ${errorMsg}`);
    
    
    this.emit('terminal-error', options.agentId, errorMsg);
    throw new Error(errorMsg);
  }

  sendInput(_agentId: string, _data: string): boolean {
    return false;
  }

  resizeTerminal(_agentId: string, _cols: number, _rows: number): boolean {
    return false;
  }

  killTerminal(_agentId: string): boolean {
    return false;
  }

  getSession(_agentId: string): TerminalSession | null {
    return null;
  }

  getActiveSessions(): TerminalSession[] {
    return [];
  }

  isReady(_agentId: string): boolean {
    return false;
  }

  cleanup(): void {
    // No-op
  }
}