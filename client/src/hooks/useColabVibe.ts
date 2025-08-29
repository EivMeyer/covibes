import { useEffect, useCallback, useState } from 'react';
import { useAuth } from './useAuth';
import { useSocket } from './useSocket';
import { useAgents } from './useAgents';
import { useChat } from './useChat';
import { useVMConfig } from './useVMConfig';
import type { SocketUser, SocketEventListeners } from '@/services/socket';

export interface OnlineUser extends SocketUser {
  isOnline: boolean;
  lastActivity?: Date;
}

export interface CoVibeState {
  isInitialized: boolean;
  isConnecting: boolean;
  onlineUsers: OnlineUser[];
  currentActivity: string | null;
}

export interface CoVibeHook extends CoVibeState {
  // Re-export all sub-hooks for convenience
  auth: ReturnType<typeof useAuth>;
  socket: ReturnType<typeof useSocket>;
  agents: ReturnType<typeof useAgents>;
  chat: ReturnType<typeof useChat>;
  vmConfig: ReturnType<typeof useVMConfig>;
  
  // Combined functionality
  initialize: () => Promise<void>;
  setActivity: (activity: string) => void;
  clearActivity: () => void;
}

/**
 * Master hook that orchestrates all CoVibe functionality
 * This provides a single entry point for components to access all features
 * with proper initialization and state synchronization
 */
export function useCoVibe(): CoVibeHook {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [currentActivity, setCurrentActivity] = useState<string | null>(null);

  // Initialize all sub-hooks
  const auth = useAuth();
  const socket = useSocket(auth.isAuthenticated && auth.user ? 'token-placeholder' : null);
  const agents = useAgents();
  const chat = useChat();
  const vmConfig = useVMConfig();

  // Initialize the system when authentication is ready
  const initialize = useCallback(async () => {
    if (!auth.isAuthenticated || !auth.user || isInitialized) {
      return;
    }

    setIsConnecting(true);
    
    try {
      // Load initial data
      await Promise.all([
        agents.loadAgents(),
        vmConfig.getStatus().catch(console.warn), // VM status is optional
      ]);
      
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize CoVibe:', error);
    } finally {
      setIsConnecting(false);
    }
  }, [auth.isAuthenticated, auth.user, isInitialized, agents, vmConfig]);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket.isConnected || !auth.user) {
      return;
    }

    const socketListeners: SocketEventListeners = {
      // User presence
      onUserOnline: (user: SocketUser) => {
        setOnlineUsers(prev => {
          const existing = prev.find(u => u.id === user.id);
          if (existing) {
            return prev.map(u => u.id === user.id ? { ...u, isOnline: true, lastActivity: new Date() } : u);
          }
          return [...prev, { ...user, isOnline: true, lastActivity: new Date() }];
        });
      },

      onUserOffline: (data: { id: string; name: string }) => {
        setOnlineUsers(prev => prev.map(user => 
          user.id === data.id ? { ...user, isOnline: false } : user
        ));
      },

      onOnlineUsers: (users: SocketUser[]) => {
        setOnlineUsers(users.map(user => ({ 
          ...user, 
          isOnline: true, 
          lastActivity: new Date() 
        })));
      },

      onUserActivity: (activity) => {
        setOnlineUsers(prev => prev.map(user => 
          user.id === activity.userId 
            ? { ...user, lastActivity: new Date() }
            : user
        ));
      },

      // Chat events
      onChatMessage: (message) => {
        chat.addMessage(message);
      },

      onUserTyping: (data) => {
        chat.addUserTyping(data.userId, data.userName);
      },

      onUserStopTyping: (data) => {
        chat.removeUserTyping(data.userId);
      },

      // Agent events
      onAgentStarted: () => {
        // Refresh agents list when new agent starts
        agents.refresh();
      },

      onAgentOutput: (output) => {
        agents.updateAgentOutput(output.agentId, output.output);
      },

      onAgentCompleted: (data) => {
        if (data.status) {
          agents.updateAgentStatus(data.agentId!, data.status as any);
        }
      },

      // Error handling
      onError: (data) => {
        console.error('Socket error:', data.message);
      },
    };

    socket.setListeners(socketListeners);
  }, [socket, auth.user, chat, agents]);

  // Auto-initialize when authentication is ready
  useEffect(() => {
    if (auth.isAuthenticated && auth.user && !isInitialized && !isConnecting) {
      initialize();
    }
  }, [auth.isAuthenticated, auth.user, isInitialized, isConnecting, initialize]);

  // Reset state on logout
  useEffect(() => {
    if (!auth.isAuthenticated) {
      setIsInitialized(false);
      setOnlineUsers([]);
      setCurrentActivity(null);
      chat.clearMessages();
    }
  }, [auth.isAuthenticated, chat]);

  // Activity management
  const setActivity = useCallback((activity: string) => {
    setCurrentActivity(activity);
    if (socket.isConnected) {
      socket.sendUserActivity(activity);
    }
  }, [socket]);

  const clearActivity = useCallback(() => {
    setCurrentActivity(null);
  }, []);

  return {
    // State
    isInitialized,
    isConnecting,
    onlineUsers,
    currentActivity,
    
    // Sub-hooks
    auth,
    socket,
    agents,
    chat,
    vmConfig,
    
    // Actions
    initialize,
    setActivity,
    clearActivity,
  };
}