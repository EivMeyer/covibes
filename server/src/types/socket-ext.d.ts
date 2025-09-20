/**
 * Socket.IO type extensions for Covibes
 * 
 * Extends Socket.IO types to include custom authentication and session properties
 * This resolves TypeScript errors related to custom properties on Socket instances
 */

import { Socket } from 'socket.io';

declare module 'socket.io' {
  interface Socket {
    userId?: string;
    teamId?: string;
    userName?: string;
  }
}

// Global SSH session type for terminal connections
export interface GlobalSSHSession {
  client?: any;
  stream?: any;
  process?: any;
  agentId: string;
}

// Container info type for WebSocket proxy handling
export interface ContainerInfo {
  id: string;
  teamId: string;
  userId: string;
  agentId?: string;
  type: string;
  containerId?: string;
  status: string;
  terminalPort?: number;
  previewPort?: number;
  metadata: Record<string, any>;
}

export {};