import { useState, useCallback, useRef, useEffect } from 'react';
import type { SocketChatMessage } from '@/services/socket';

export interface ChatState {
  messages: SocketChatMessage[];
  typingUsers: Array<{ userId: string; userName: string }>;
  isLoading: boolean;
  error: string | null;
}

export interface ChatHook extends ChatState {
  addMessage: (message: SocketChatMessage) => void;
  addUserTyping: (userId: string, userName: string) => void;
  removeUserTyping: (userId: string) => void;
  clearMessages: () => void;
  clearError: () => void;
  getMessageHistory: (limit?: number) => SocketChatMessage[];
  searchMessages: (query: string) => SocketChatMessage[];
}

export function useChat(): ChatHook {
  const [messages, setMessages] = useState<SocketChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Array<{ userId: string; userName: string }>>([]);
  const [isLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Keep track of typing timeouts to auto-remove typing indicators
  const typingTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const addMessage = useCallback((message: SocketChatMessage) => {
    setMessages(prev => {
      // Prevent duplicate messages
      if (prev.some(m => m.id === message.id)) {
        return prev;
      }
      
      // Keep only last 1000 messages for performance
      const newMessages = [...prev, message];
      return newMessages.length > 1000 ? newMessages.slice(-1000) : newMessages;
    });
  }, []);

  const addUserTyping = useCallback((userId: string, userName: string) => {
    setTypingUsers(prev => {
      // Don't add if already typing
      if (prev.some(user => user.userId === userId)) {
        return prev;
      }
      
      return [...prev, { userId, userName }];
    });

    // Clear any existing timeout for this user
    const existingTimeout = typingTimeouts.current.get(userId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set timeout to auto-remove typing indicator after 3 seconds
    const timeout = setTimeout(() => {
      removeUserTyping(userId);
    }, 3000);
    
    typingTimeouts.current.set(userId, timeout);
  }, []);

  const removeUserTyping = useCallback((userId: string) => {
    setTypingUsers(prev => prev.filter(user => user.userId !== userId));
    
    // Clear the timeout
    const timeout = typingTimeouts.current.get(userId);
    if (timeout) {
      clearTimeout(timeout);
      typingTimeouts.current.delete(userId);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const getMessageHistory = useCallback((limit = 50) => {
    return messages.slice(-limit);
  }, [messages]);

  const searchMessages = useCallback((query: string) => {
    if (!query.trim()) return [];
    
    const lowerQuery = query.toLowerCase();
    return messages.filter(message => 
      message.content.toLowerCase().includes(lowerQuery) ||
      message.userName.toLowerCase().includes(lowerQuery)
    );
  }, [messages]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      typingTimeouts.current.forEach(timeout => clearTimeout(timeout));
      typingTimeouts.current.clear();
    };
  }, []);

  return {
    messages,
    typingUsers,
    isLoading,
    error,
    addMessage,
    addUserTyping,
    removeUserTyping,
    clearMessages,
    clearError,
    getMessageHistory,
    searchMessages,
  };
}