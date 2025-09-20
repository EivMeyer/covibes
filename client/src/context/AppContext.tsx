import React, { createContext, useContext, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { useAgents } from '@/hooks/useAgents';
import type { User, Team, Agent, ChatMessage, AgentOutput, AgentDetails, SpawnAgentRequest } from '@/types';
import type { SocketUser, SocketChatMessage, SocketAgentOutput, SocketAgentEvent } from '@/services/socket';

interface LastActiveTarget {
  type: 'agent' | 'terminal' | 'chat';
  id: string;
  name: string;
  timestamp: number;
}

interface AppContextType {
  // Auth state
  user: User | null;
  team: Team | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;  // Renamed from authError to match actual hook
  login: (credentials: { email: string; password: string }) => Promise<void>;  // Fixed to match hook signature
  register: (userData: { teamName: string; userName: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  clearAuthError: () => void;

  // Agents state
  agents: AgentDetails[];
  agentsLoading: boolean;
  agentsError: string | null;
  spawnAgent: (agentData: SpawnAgentRequest) => Promise<AgentDetails>;
  killAgent: (agentId: string) => Promise<void>;  // Fixed method name
  clearAgentsError: () => void;

  // Socket methods
  sendChatMessage: (content: string) => void;
  sendAgentInput: (agentId: string, input: string) => void;  // Fixed method name
  isSocketConnected: () => boolean;

  // Real-time state (managed by socket listeners)
  chatMessages: ChatMessage[];
  agentOutputs: AgentOutput[];
  onlineUsers: User[];

  // Last active tracking for inspector auto-injection
  lastActiveTarget: LastActiveTarget | null;
  setLastActiveAgent: (agentId: string, agentName: string) => void;
  setLastActiveTerminal: (terminalId: string, terminalName: string) => void;
  setLastActiveChat: () => void;
  sendToLastActive: (message: string) => boolean; // Returns true if successful

  // State setters for socket events
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setAgentOutputs: React.Dispatch<React.SetStateAction<AgentOutput[]>>;
  setOnlineUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const agents = useAgents();
  
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([]);
  const [agentOutputs, setAgentOutputs] = React.useState<AgentOutput[]>([]);
  const [onlineUsers, setOnlineUsers] = React.useState<User[]>([]);
  const [lastActiveTarget, setLastActiveTarget] = React.useState<LastActiveTarget | null>(null);

  // Use refs to prevent stale closures
  const agentsRef = React.useRef(agents);
  const authRef = React.useRef(auth);
  
  // Update refs on every render
  React.useEffect(() => {
    agentsRef.current = agents;
    authRef.current = auth;
  });

  // WebSocket enabled with fixed auth redirect issue - memoized to prevent re-renders
  const token = React.useMemo(() => 
    auth.isAuthenticated ? localStorage.getItem('colabvibe_auth_token') : null,
    [auth.isAuthenticated]
  );
  const socket = useSocket(token);

  // Set up socket listeners - STABLE useEffect
  React.useEffect(() => {
    if (!socket || !authRef.current.isAuthenticated) return;

    socket.setListeners({
      onUserOnline: (user: SocketUser) => {
        // Convert SocketUser to User format
        const fullUser: User = {
          id: user.id,
          name: user.name,
          email: user.email,
          teamId: authRef.current.team?.id || '',
          createdAt: new Date().toISOString()
        };
        setOnlineUsers(prev => [...prev.filter(u => u.id !== user.id), fullUser]);
      },
      onUserOffline: (data) => {
        setOnlineUsers(prev => prev.filter(u => u.id !== data.id));
      },
      onChatMessage: (message: SocketChatMessage) => {
        setChatMessages(prev => [...prev, message]);
      },
      onAgentOutput: (output: SocketAgentOutput) => {
        setAgentOutputs(prev => [...prev, output]);
      },
      onAgentCompleted: (data: SocketAgentEvent) => {
        if (data.agentId && data.status) {
          agentsRef.current.updateAgentStatus(data.agentId, data.status as Agent['status']);
        }
      },
      onError: (error: { message: string; error?: string }) => {
        console.error('Socket error:', error);
      },
    });
  }, [socket]); // ONLY socket dependency - refs handle the rest

  const sendChatMessage = React.useCallback((content: string) => {
    if (!auth.user || !auth.team) return;
    socket.sendChatMessage(content);
  }, [auth.user, auth.team, socket.sendChatMessage]);

  const sendAgentInput = React.useCallback((agentId: string, input: string) => {
    socket.sendAgentInput(agentId, input);
  }, [socket.sendAgentInput]);

  // Last active tracking functions
  const setLastActiveAgent = React.useCallback((agentId: string, agentName: string) => {
    setLastActiveTarget({
      type: 'agent',
      id: agentId,
      name: agentName,
      timestamp: Date.now()
    });
  }, []);

  const setLastActiveTerminal = React.useCallback((terminalId: string, terminalName: string) => {
    setLastActiveTarget({
      type: 'terminal',
      id: terminalId,
      name: terminalName,
      timestamp: Date.now()
    });
  }, []);

  const setLastActiveChat = React.useCallback(() => {
    setLastActiveTarget({
      type: 'chat',
      id: 'team-chat',
      name: 'Team Chat',
      timestamp: Date.now()
    });
  }, []);

  const sendToLastActive = React.useCallback((message: string): boolean => {
    if (!lastActiveTarget) return false;

    try {
      switch (lastActiveTarget.type) {
        case 'agent':
          sendAgentInput(lastActiveTarget.id, message);
          return true;
        case 'chat':
          sendChatMessage(message);
          return true;
        case 'terminal':
          // TODO: Implement terminal message sending
          console.warn('Terminal message sending not yet implemented');
          return false;
        default:
          return false;
      }
    } catch (error) {
      console.error('Failed to send to last active target:', error);
      return false;
    }
  }, [lastActiveTarget, sendAgentInput, sendChatMessage]);

  const contextValue: AppContextType = React.useMemo(() => ({
    // Auth
    user: auth.user,
    team: auth.team,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    error: auth.error,
    login: auth.login,
    register: auth.register,
    logout: auth.logout,
    clearAuthError: auth.clearError,

    // Agents
    agents: agents.agents,
    agentsLoading: agents.isLoading,
    agentsError: agents.error,
    spawnAgent: agents.spawnAgent,
    killAgent: agents.killAgent,
    clearAgentsError: agents.clearError,

    // Socket
    sendChatMessage,
    sendAgentInput,
    isSocketConnected: () => socket.isConnected,

    // Real-time state
    chatMessages,
    agentOutputs,
    onlineUsers,
    setChatMessages,
    setAgentOutputs,
    setOnlineUsers,

    // Last active tracking
    lastActiveTarget,
    setLastActiveAgent,
    setLastActiveTerminal,
    setLastActiveChat,
    sendToLastActive,
  }), [
    auth.user, auth.team, auth.isAuthenticated, auth.isLoading, auth.error,
    auth.login, auth.register, auth.logout, auth.clearError,
    agents.agents, agents.isLoading, agents.error, agents.spawnAgent, agents.killAgent, agents.clearError,
    sendChatMessage, sendAgentInput, socket.isConnected,
    chatMessages, agentOutputs, onlineUsers,
    setChatMessages, setAgentOutputs, setOnlineUsers,
    lastActiveTarget, setLastActiveAgent, setLastActiveTerminal, setLastActiveChat, sendToLastActive
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}