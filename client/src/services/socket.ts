import { io, Socket } from 'socket.io-client';

// WebSocket event types based on actual server implementation
export interface SocketUser {
  id: string;
  name: string;
  email: string;
}

export interface SocketTeam {
  id: string;
  name: string;
  inviteCode: string;
}

export interface SocketChatMessage {
  id: string;
  content: string;
  userId: string;
  userName: string;
  timestamp: string;
  teamId: string;
}

export interface SocketAgentOutput {
  agentId: string;
  output: string;
  userId: string;
  userName: string;
  timestamp: Date;
}

export interface SocketAgentEvent {
  id?: string;
  agentId?: string;
  userId: string;
  userName: string;
  status?: string;
  error?: string;
  task?: string;
  startedAt?: string;
}

export interface SocketUserActivity {
  userId: string;
  userName: string;
  activity?: string;
  timestamp?: string;
}

// Complete event listener types
export interface SocketEventListeners {
  // Connection events
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onConnectError?: (error: Error) => void;
  onReconnect?: (attemptNumber: number) => void;
  
  // Authentication events
  onAuthSuccess?: (data: { user: SocketUser; team: SocketTeam }) => void;
  onAuthError?: (data: { message: string; error?: string }) => void;
  
  // User presence events
  onUserOnline?: (user: SocketUser) => void;
  onUserOffline?: (data: { id: string; name: string }) => void;
  onOnlineUsers?: (users: SocketUser[]) => void;
  onUserActivity?: (activity: SocketUserActivity) => void;
  
  // Chat events
  onChatMessage?: (message: SocketChatMessage) => void;
  onUserTyping?: (data: { userId: string; userName: string }) => void;
  onUserStopTyping?: (data: { userId: string }) => void;
  
  // Agent events
  onAgentStarted?: (agent: SocketAgentEvent) => void;
  onAgentOutput?: (output: SocketAgentOutput) => void;
  onAgentCompleted?: (data: SocketAgentEvent) => void;
  onAgentInputSent?: (data: { agentId: string; input: string; userId: string; userName: string }) => void;
  
  // Container events
  onContainerStatus?: (data: { containerId: string; agentId?: string; status: string; timestamp: string; message?: string; error?: string }) => void;
  onContainerResourceUpdate?: (data: { containerId: string; agentId?: string; resources: any; timestamp: string }) => void;
  onContainerLogs?: (data: { containerId: string; agentId?: string; log: string; timestamp: string; level: string }) => void;
  
  // Preview events
  onPreviewUpdated?: (data: { triggeredBy: string; timestamp: Date }) => void;
  
  // Generic error handler
  onError?: (data: { message: string; error?: string }) => void;
}

// Connection states
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

// Socket service with enhanced error handling and connection management
export class SocketError extends Error {
  public code?: string | undefined;
  public data?: any;
  
  constructor(message: string, code?: string, data?: any) {
    super(message);
    this.name = 'SocketError';
    this.code = code;
    this.data = data;
  }
}

class SocketService {
  private socket: Socket | null = null;
  private listeners: SocketEventListeners = {};
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3; // Re-enabled with fixed hook
  private authToken: string | null = null;
  private teamId: string | null = null;
  private userId: string | null = null;

  connect(token: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      // If already connected with the same token, return existing socket
      if (this.socket?.connected && this.authToken === token) {
        resolve(this.socket);
        return;
      }

      // Disconnect existing socket if any
      if (this.socket) {
        this.socket.disconnect();
      }

      this.authToken = token;
      this.connectionState = 'connecting';
      
      // Create new socket connection with both polling and WebSocket for real-time terminal
      // Always use relative path to ensure HTTPS is used when the page is loaded over HTTPS
      // This allows nginx to properly proxy the WebSocket connection
      const wsUrl = undefined; // Always use relative path for proper HTTPS handling

      console.log('🔌 Socket connecting via relative path (nginx proxy)');
      console.log('🔍 Environment:', { origin: window.location.origin, protocol: window.location.protocol });

      // When wsUrl is undefined, io() uses relative path automatically
      this.socket = io(wsUrl || '/', {
        transports: ['polling', 'websocket'], // Match server configuration - enable both transports
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        forceNew: true,
        upgrade: true, // Allow WebSocket upgrade for better terminal performance
        // Add authentication token to handshake
        auth: {
          token: token
        },
        // Add extra headers for polling transport
        transportOptions: {
          polling: {
            extraHeaders: {
              'Cache-Control': 'no-cache'
            }
          }
        }
      });

      this.setupEventHandlers();
      
      // Handle connection success
      const onConnect = () => {
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        this.authenticate(token)
          .then(() => {
            resolve(this.socket!);
          })
          .catch((error) => {
            reject(new SocketError('Authentication failed', 'AUTH_ERROR', error));
          });
      };
      
      // Handle connection failure
      const onConnectError = (error: any) => {
        console.error('🚨 WebSocket connection failed:', error);
        this.connectionState = 'error';
        reject(new SocketError('Connection failed', 'CONNECTION_ERROR', error));
      };
      
      this.socket.once('connect', onConnect);
      this.socket.once('connect_error', onConnectError);
    });
  }
  
  private authenticate(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new SocketError('Socket not connected'));
        return;
      }
      
      // Decode JWT token to get team ID (like in joinTeam method)
      try {
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('Invalid JWT token format');
        const payload = JSON.parse(atob(parts[1]));
        const teamId = payload.teamId;
        const userId = payload.userId;
        
        if (!teamId || !userId) {
          reject(new SocketError('Invalid JWT token: missing teamId or userId'));
          return;
        }

        // Set user info
        this.userId = userId;
        this.teamId = teamId;
        
        const onTeamJoined = (data: any) => {
          this.socket!.off('team-joined', onTeamJoined);
          this.socket!.off('error', onJoinError);
          this.listeners.onAuthSuccess?.({ user: { id: userId, name: 'User', email: '' }, team: { id: teamId, name: '', inviteCode: '' } });
          resolve();
        };
        
        const onJoinError = (data: { message: string; error?: string }) => {
          console.error('🚨 Team join failed:', data.message);
          this.socket!.off('team-joined', onTeamJoined);
          this.socket!.off('error', onJoinError);
          this.listeners.onAuthError?.(data);
          reject(new SocketError(data.message, 'AUTH_ERROR', data));
        };
        
        this.socket.once('team-joined', onTeamJoined);
        this.socket.once('error', onJoinError);
        
        // Use join-team event like the server expects
        this.socket.emit('join-team', { teamId, token });
        
      } catch (error) {
        reject(new SocketError('Failed to decode JWT token', 'INVALID_TOKEN', error));
      }
    });
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      this.connectionState = 'connected';
      this.reconnectAttempts = 0;
      
      // Team joining is handled during authentication
      
      this.listeners.onConnect?.();
    });

    this.socket.on('disconnect', (reason: string) => {
      this.connectionState = 'disconnected';
      this.listeners.onDisconnect?.(reason);
    });

    this.socket.on('connect_error', (error: any) => {
      console.error('🚨 WebSocket connection error:', error);
      this.connectionState = 'error';
      this.listeners.onConnectError?.(error);
    });

    this.socket.on('reconnect', (attemptNumber: number) => {
      this.connectionState = 'connected';
      this.listeners.onReconnect?.(attemptNumber);
    });

    this.socket.on('reconnect_attempt', (attemptNumber: number) => {
      this.connectionState = 'reconnecting';
      this.reconnectAttempts = attemptNumber;
    });

    // User presence events
    this.socket.on('user_online', (user: SocketUser) => {
      this.listeners.onUserOnline?.(user);
    });

    this.socket.on('user_offline', (data: { id: string; name: string }) => {
      this.listeners.onUserOffline?.(data);
    });

    this.socket.on('online_users', (users: SocketUser[]) => {
      this.listeners.onOnlineUsers?.(users);
    });

    this.socket.on('user_activity', (activity: SocketUserActivity) => {
      this.listeners.onUserActivity?.(activity);
    });

    // Chat events
    this.socket.on('chat_message', (message: SocketChatMessage) => {
      this.listeners.onChatMessage?.(message);
    });

    this.socket.on('user_typing', (data: { userId: string; userName: string }) => {
      this.listeners.onUserTyping?.(data);
    });

    this.socket.on('user_stop_typing', (data: { userId: string }) => {
      this.listeners.onUserStopTyping?.(data);
    });

    // Agent events
    this.socket.on('agent_started', (agent: SocketAgentEvent) => {
      this.listeners.onAgentStarted?.(agent);
    });

    this.socket.on('agent_output', (output: SocketAgentOutput) => {
      this.listeners.onAgentOutput?.(output);
    });

    this.socket.on('agent_completed', (data: SocketAgentEvent) => {
      this.listeners.onAgentCompleted?.(data);
    });

    this.socket.on('agent_input_sent', (data: { agentId: string; input: string; userId: string; userName: string }) => {
      this.listeners.onAgentInputSent?.(data);
    });

    // Preview events
    this.socket.on('preview_updated', (data: { triggeredBy: string; timestamp: Date }) => {
      this.listeners.onPreviewUpdated?.(data);
    });

    // Team events
    this.socket.on('team-joined', (data: any) => {
    });

    this.socket.on('user-connected', (data: { userId: string; userName: string; connectedUsers: number }) => {
    });

    this.socket.on('user-disconnected', (data: { userId: string; userName: string; connectedUsers: number }) => {
    });

    // Terminal events - CRITICAL MISSING HANDLERS!
    this.socket.on('terminal_connected', (data: { agentId: string; message?: string }) => {
    });

    this.socket.on('terminal_output', (data: { agentId: string; output: string }) => {
    });

    this.socket.on('terminal_error', (data: { agentId: string; error: string }) => {
      console.error('🖥️ Terminal error for agent:', data.agentId, data.error);
    });

    this.socket.on('claude_started', (data: { agentId: string }) => {
    });

    this.socket.on('terminal_disconnected', (data: { agentId: string }) => {
    });

    // Container events
    this.socket.on('container_status', (data: { containerId: string; agentId?: string; status: string; timestamp: string; message?: string; error?: string }) => {
      this.listeners.onContainerStatus?.(data);
    });

    this.socket.on('container_resource_update', (data: { containerId: string; agentId?: string; resources: any; timestamp: string }) => {
      this.listeners.onContainerResourceUpdate?.(data);
    });

    this.socket.on('container_logs', (data: { containerId: string; agentId?: string; log: string; timestamp: string; level: string }) => {
      this.listeners.onContainerLogs?.(data);
    });

    // Error events
    this.socket.on('error', (data: { message: string; error?: string }) => {
      console.error('🚨 Socket error:', data.message);
      this.listeners.onError?.(data);
    });
  }

  setListeners(listeners: Partial<SocketEventListeners>): void {
    this.listeners = { ...this.listeners, ...listeners };
  }

  clearListeners(): void {
    this.listeners = {};
  }

  // Chat methods
  sendChatMessage(content: string): void {
    this.ensureConnected();
    this.socket!.emit('chat_message', { content });
  }

  startTyping(): void {
    this.ensureConnected();
    this.socket!.emit('typing_start');
  }

  stopTyping(): void {
    this.ensureConnected();
    this.socket!.emit('typing_stop');
  }

  // Agent methods
  sendAgentInput(agentId: string, input: string): void {
    this.ensureConnected();
    this.socket!.emit('agent_input', { agentId, input });
  }

  // Container methods
  sendContainerAction(containerId: string, action: 'start' | 'stop' | 'restart'): void {
    this.ensureConnected();
    this.socket!.emit('container_action', { containerId, action });
  }

  // Preview methods
  refreshPreview(): void {
    this.ensureConnected();
    this.socket!.emit('refresh_preview');
  }

  // User activity
  sendUserActivity(activity: string): void {
    this.ensureConnected();
    this.socket!.emit('user_activity', { activity });
  }

  // Helper method to ensure connection
  private ensureConnected(): void {
    if (!this.socket || !this.socket.connected) {
      throw new SocketError('Socket not connected', 'NOT_CONNECTED');
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connectionState = 'disconnected';
    this.authToken = null;
    this.teamId = null;
    this.userId = null;
    this.reconnectAttempts = 0;
    this.clearListeners();
  }

  // Connection state methods
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  // Getters for current state
  getSocket(): Socket | null {
    return this.socket;
  }

  getTeamId(): string | null {
    return this.teamId;
  }

  getUserId(): string | null {
    return this.userId;
  }

  // Team joining is now handled during authentication

  // Removed duplicate getSocket method

  // Force reconnection
  async reconnect(): Promise<Socket> {
    if (!this.authToken) {
      throw new SocketError('No auth token available for reconnection', 'NO_TOKEN');
    }
    
    this.disconnect();
    return this.connect(this.authToken);
  }

  // Health check
  ping(): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        reject(new SocketError('Socket not connected', 'NOT_CONNECTED'));
        return;
      }
      
      const startTime = Date.now();
      this.socket!.emit('ping', startTime, () => {
        resolve(Date.now() - startTime);
      });
    });
  }
}

// Export singleton instance
export const socketService = new SocketService();