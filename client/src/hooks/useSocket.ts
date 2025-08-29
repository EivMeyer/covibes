import React, { useEffect, useRef, useCallback, useState } from 'react';
import { socketService, SocketError, type SocketEventListeners, type ConnectionState } from '@/services/socket';

export interface SocketState {
  isConnected: boolean;
  connectionState: ConnectionState;
  reconnectAttempts: number;
  error: string | null;
}

export interface SocketHook extends SocketState {
  setListeners: (listeners: Partial<SocketEventListeners>) => void;
  sendChatMessage: (content: string) => void;
  startTyping: () => void;
  stopTyping: () => void;
  sendAgentInput: (agentId: string, input: string) => void;
  refreshPreview: () => void;
  sendUserActivity: (activity: string) => void;
  reconnect: () => Promise<void>;
  disconnect: () => void;
  ping: () => Promise<number>;
}

export function useSocket(token: string | null): SocketHook {
  const socketRef = useRef(socketService);
  const listenersRef = useRef<Partial<SocketEventListeners>>({});
  const [socketState, setSocketState] = useState<SocketState>({
    isConnected: false,
    connectionState: 'disconnected',
    reconnectAttempts: 0,
    error: null,
  });

  // Update socket state - STABLE callback (no dependencies)
  const updateSocketState = useCallback(() => {
    setSocketState({
      isConnected: socketRef.current.isConnected(),
      connectionState: socketRef.current.getConnectionState(),
      reconnectAttempts: socketRef.current.getReconnectAttempts(),
      error: null, // Will be set by error handlers
    });
  }, []); // Empty dependencies - this function never changes

  useEffect(() => {
    if (!token) {
      socketRef.current.disconnect();
      setSocketState({
        isConnected: false,
        connectionState: 'disconnected',
        reconnectAttempts: 0,
        error: null,
      });
      return;
    }

    // Set up internal listeners to track connection state
    const internalListeners: Partial<SocketEventListeners> = {
      onConnect: () => {
        updateSocketState();
      },
      onDisconnect: (reason: string) => {
        updateSocketState();
      },
      onConnectError: (error: Error) => {
        console.error('Socket connection error in hook:', error);
        setSocketState(prev => ({ ...prev, error: error.message }));
        updateSocketState();
      },
      onReconnect: (attemptNumber: number) => {
        updateSocketState();
      },
      onError: (data: { message: string }) => {
        console.error('Socket error in hook:', data.message);
        setSocketState(prev => ({ ...prev, error: data.message }));
      },
    };

    // Merge internal listeners with user listeners
    const combinedListeners = { ...listenersRef.current, ...internalListeners };
    socketRef.current.setListeners(combinedListeners);

    // Connect to WebSocket
    socketRef.current.connect(token)
      .then(() => {
        updateSocketState();
      })
      .catch((error: SocketError) => {
        console.error('Socket connection failed:', error.message);
        setSocketState(prev => ({ ...prev, error: error.message }));
      });

    return () => {
      // Don't disconnect on unmount, let the service manage the connection
      // socketRef.current.disconnect();
    };
  }, [token]); // Remove updateSocketState from dependencies

  const setListeners = useCallback((listeners: Partial<SocketEventListeners>) => {
    listenersRef.current = { ...listenersRef.current, ...listeners };
    
    // Always include internal listeners for state management
    const internalListeners: Partial<SocketEventListeners> = {
      onConnect: () => {
        updateSocketState();
        listeners.onConnect?.();
      },
      onDisconnect: (reason: string) => {
        updateSocketState();
        listeners.onDisconnect?.(reason);
      },
      onConnectError: (error: Error) => {
        setSocketState(prev => ({ ...prev, error: error.message }));
        updateSocketState();
        listeners.onConnectError?.(error);
      },
      onError: (data: { message: string }) => {
        setSocketState(prev => ({ ...prev, error: data.message }));
        listeners.onError?.(data);
      },
    };
    
    const combinedListeners = { ...listeners, ...internalListeners };
    socketRef.current.setListeners(combinedListeners);
  }, []); // Remove updateSocketState dependency to prevent loops

  const sendChatMessage = useCallback((content: string) => {
    try {
      socketRef.current.sendChatMessage(content);
    } catch (error) {
      console.error('Failed to send chat message:', error);
      setSocketState(prev => ({ ...prev, error: 'Failed to send message' }));
    }
  }, []);

  const startTyping = useCallback(() => {
    try {
      socketRef.current.startTyping();
    } catch (error) {
      console.error('Failed to send typing indicator:', error);
    }
  }, []);

  const stopTyping = useCallback(() => {
    try {
      socketRef.current.stopTyping();
    } catch (error) {
      console.error('Failed to stop typing indicator:', error);
    }
  }, []);

  const sendAgentInput = useCallback((agentId: string, input: string) => {
    try {
      socketRef.current.sendAgentInput(agentId, input);
    } catch (error) {
      console.error('Failed to send agent input:', error);
      setSocketState(prev => ({ ...prev, error: 'Failed to send input to agent' }));
    }
  }, []);

  const refreshPreview = useCallback(() => {
    try {
      socketRef.current.refreshPreview();
    } catch (error) {
      console.error('Failed to refresh preview:', error);
    }
  }, []);

  const sendUserActivity = useCallback((activity: string) => {
    try {
      socketRef.current.sendUserActivity(activity);
    } catch (error) {
      console.error('Failed to send user activity:', error);
    }
  }, []);

  const reconnect = useCallback(async () => {
    try {
      setSocketState(prev => ({ ...prev, error: null }));
      await socketRef.current.reconnect();
      updateSocketState();
    } catch (error) {
      console.error('Reconnection failed:', error);
      const errorMessage = error instanceof SocketError ? error.message : 'Reconnection failed';
      setSocketState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []); // Remove updateSocketState dependency

  const disconnect = useCallback(() => {
    socketRef.current.disconnect();
    setSocketState({
      isConnected: false,
      connectionState: 'disconnected',
      reconnectAttempts: 0,
      error: null,
    });
  }, []);

  const ping = useCallback(async () => {
    try {
      return await socketRef.current.ping();
    } catch (error) {
      console.error('Ping failed:', error);
      const errorMessage = error instanceof SocketError ? error.message : 'Ping failed';
      setSocketState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  // Return stable object - methods are stable via useCallback
  return {
    isConnected: socketState.isConnected,
    connectionState: socketState.connectionState,
    reconnectAttempts: socketState.reconnectAttempts,
    error: socketState.error,
    setListeners,
    sendChatMessage,
    startTyping,
    stopTyping,
    sendAgentInput,
    refreshPreview,
    sendUserActivity,
    reconnect,
    disconnect,
    ping,
  };
}