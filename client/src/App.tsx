import { useState, useEffect, useRef } from 'react';
import { apiService, type AuthUser, type AuthTeam, type AgentDetails } from './services/api';
import io, { Socket } from 'socket.io-client';

// Import existing UI components
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { NotificationProvider } from './components/ui/Notification';
import { SoundSettingsProvider, useSoundSettings } from './context/SoundSettingsContext';

// Import types from types module
import type { ChatMessage } from '@/types';

// Import demo terminal
import { DemoTerminal } from './pages/DemoTerminal';
import { DemoList } from './pages/DemoList';
import ChatAgentDemo from './pages/ChatAgentDemo';

// Simple App with working state management
function AppContent() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [team, setTeam] = useState<AuthTeam | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Chat state - using working logic from SimpleApp
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  
  // Agent state
  const [agents, setAgents] = useState<AgentDetails[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  
  // Preview state
  const [previewStatus, setPreviewStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [previewDeploymentMeta, setPreviewDeploymentMeta] = useState<any>(null);

  // Last active target tracking for inspector auto-injection
  const [lastActiveTarget, setLastActiveTarget] = useState<{
    type: 'agent' | 'terminal' | 'chat';
    id: string;
    name: string;
    timestamp: number;
  } | null>(null);

  // Check if already logged in on mount
  useEffect(() => {
    
    // Check for GitHub OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const authSuccess = urlParams.get('auth_success');
    const token = urlParams.get('token');
    const githubSignup = urlParams.get('github_signup');
    const errorParam = urlParams.get('error');
    

    if (errorParam) {
      console.error('❌ GitHub OAuth error param found:', errorParam);
      throw new Error(`GitHub OAuth failed: ${errorParam}`);
    }

    if (authSuccess === 'true' && token) {
      // Store token and authenticate user
      localStorage.setItem('covibes_auth_token', token);
      
      apiService.getCurrentUser()
        .then(data => {
          setUser(data.user);
          setTeam(data.team);
          setIsLoading(false);
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch(error => {
          console.error('❌ getCurrentUser() failed:', error);
          localStorage.removeItem('covibes_auth_token');
          throw new Error(`GitHub OAuth token validation failed: ${error.message || error}`);
        });
      return;
    }

    if (githubSignup === 'true') {
      // User needs to complete team selection - stay on auth page
      setIsLoading(false);
      // Note: Don't clean URL yet, the auth page will handle GitHub signup flow
      return;
    }

    // Check for existing token
    const existingToken = localStorage.getItem('covibes_auth_token');
    if (existingToken) {
      apiService.getCurrentUser()
        .then(data => {
          setUser(data.user);
          setTeam(data.team);
          setIsLoading(false);
        })
        .catch(error => {
          console.error('❌ Existing token invalid:', error);
          localStorage.removeItem('covibes_auth_token');
          setIsLoading(false);
          throw new Error(`Existing token validation failed: ${error.message || error}`);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  // Load agents when authenticated
  useEffect(() => {
    if (!user || !team) return;
    
    setAgentsLoading(true);
    apiService.getAgents()
      .then(response => {
        setAgents(response.agents);
      })
      .catch(error => {
        console.error('Failed to load agents:', error);
      })
      .finally(() => {
        setAgentsLoading(false);
      });
  }, [user?.id, team?.id]);

  // Initialize preview when team is loaded
  useEffect(() => {
    if (team?.id) {
      // Always use the workspace preview URL - the backend will create a demo project if no repo exists
      setPreviewUrl(undefined);  // Will be set by status check
      setPreviewStatus('loading');
      
      // Check preview container status
      const checkPreviewStatus = async () => {
          try {
            const response = await fetch(`/api/preview/status`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('covibes_auth_token')}`
              }
            });
            
            if (!response.ok) {
              throw new Error(`Status check failed: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Check for VM workspace preview or local preview
            if (data?.workspace?.status === 'running' || data?.main?.status === 'running') {
              setPreviewStatus('ready');
              
              // Set deployment metadata if available
              if (data.deploymentMeta) {
                setPreviewDeploymentMeta(data.deploymentMeta);
              }
              
              // Update URL based on mode
              // Prefer server-provided public URL (dedicated proxy)
              if (data.workspace?.url) {
                setPreviewUrl(data.workspace.url);
              } else if (data.mode === 'docker' && data.workspace?.port) {
                // Fallback to direct host port if URL not provided
                const currentHost = window.location.hostname;
                setPreviewUrl(`http://${currentHost}:${data.workspace.port}/`);
              } else if (data.main?.status === 'running') {
                // Legacy/non-docker mode fallback
                setPreviewUrl(`/api/preview/proxy/${team.id}/main/`);
              }
            } else {
              // Try to start preview automatically
              startPreviewContainer();
            }
          } catch (error) {
            console.error('❌ Failed to check preview status:', error);
            setPreviewStatus('error');
          }
        };
        
        checkPreviewStatus();
    }
  }, [team]);

  // Connect to WebSocket when user is authenticated - WORKING LOGIC
  useEffect(() => {
    if (!user || !team) return;
    
    const token = localStorage.getItem('covibes_auth_token');
    if (!token) return;

    // Mobile detection for transport selection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // REQUIRED: Backend URL must be explicitly set - NO FALLBACKS
    let backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL;
    if (!backendUrl) {
      throw new Error('VITE_BACKEND_URL or VITE_API_URL environment variable is required. No fallbacks allowed.');
    }
    
    // Mobile fix: Use same port as frontend to avoid mobile browser blocking
    if (isMobile) {
      backendUrl = window.location.origin; // Use current origin (port 3000) - Vite will proxy to 3001
    }
    
    console.log(`🔍 Socket init - Mobile: ${isMobile}, URL: ${backendUrl}, Token: ${!!token}`);
    
    // Store debug info in sessionStorage for diagnostics
    sessionStorage.setItem('socketDebug', JSON.stringify({
      mobile: isMobile,
      url: backendUrl,
      hasToken: !!token,
      timestamp: new Date().toISOString()
    }));
    
    const socket = io(backendUrl, {
      auth: {
        token: token
      },
      transports: isMobile ? ['polling'] : ['polling', 'websocket'], // Mobile uses polling only
      timeout: 30000,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 3,
      reconnectionDelayMax: 10000,
      forceNew: false, // Reuse connections when possible
      upgrade: !isMobile, // Don't upgrade on mobile
      rememberUpgrade: !isMobile,
    });

    console.log(`🔍 Socket created:`, socket);
    sessionStorage.setItem('socketCreated', new Date().toISOString());

    socketRef.current = socket;
    setSocket(socket); // Update state to trigger re-render

    socket.on('connect', () => {
      console.log('✅ Socket connected!');
      sessionStorage.setItem('socketConnected', new Date().toISOString());
      setIsConnected(true);
      
      // Join team
      socket.emit('join-team', { teamId: team.id, token });
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connect error:', error);
      sessionStorage.setItem('socketError', JSON.stringify({ error: error.message, timestamp: new Date().toISOString() }));
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
    });

    socket.on('reconnect', (attemptNumber) => {
      setIsConnected(true);
      // Rejoin team after reconnection
      socket.emit('join-team', { teamId: team.id, token });
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
    });

    socket.on('reconnect_error', (error) => {
      console.error('🔌 WebSocket reconnection error:', error);
    });

    socket.on('reconnect_failed', () => {
      console.error('🔌 WebSocket reconnection failed - all attempts exhausted');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error);
      setIsConnected(false);
      
      // If authentication failed, redirect to login
      if (error.message && (error.message.includes('Authentication') || error.message.includes('token'))) {
        localStorage.removeItem('covibes_auth_token');
        window.location.href = '/auth';
      }
    });

    socket.on('team-joined', (data: { teamData: any; messages: any[]; connectedUsers: number }) => {
      if (data.messages) {
        // Transform messages to ensure they have the correct field names
        const transformedMessages = data.messages.map((msg: any) => ({
          id: msg.id,
          userId: msg.userId,
          userName: msg.user?.userName || msg.userName || 'Unknown',
          message: msg.content || msg.message || '',
          content: msg.content || msg.message || '',
          timestamp: msg.createdAt || msg.timestamp || new Date().toISOString(),
          teamId: msg.teamId,
          type: msg.type || 'user'
        }));
        setMessages(transformedMessages);
      }
    });

    socket.on('chat-message', (message: any) => {
      // Transform incoming message to ensure correct field names
      const transformedMessage: ChatMessage = {
        id: message.id,
        userId: message.userId,
        userName: message.user?.userName || message.userName || 'Unknown',
        message: message.content || message.message || '',
        content: message.content || message.message || '',
        timestamp: message.createdAt || message.timestamp || new Date().toISOString(),
        teamId: message.teamId,
        type: message.type || 'user'
      };
      setMessages(prev => [...prev, transformedMessage]);
    });

    socket.on('agent-spawned', (data: { agent: AgentDetails }) => {
      setAgents(prev => {
        return [data.agent, ...prev];
      });
    });

    socket.on('agent-status', (data: { agentId: string; status: 'starting' | 'running' | 'completed' | 'failed' | 'killed'; message?: string }) => {
      setAgents(prev => prev.map(agent => 
        agent.id === data.agentId 
          ? { ...agent, status: data.status }
          : agent
      ));
    });


    // Agent deletion handlers
    socket.on('agent-deleted', (data: { agentId: string; userId: string }) => {
      setAgents(prev => prev.filter(agent => agent.id !== data.agentId));
    });

    socket.on('all-agents-deleted', (data: { deletedCount: number; userId: string }) => {
      setAgents([]);
    });

    // Preview WebSocket handlers
    socket.on('preview-updated', (data: { branch: string; message: string }) => {
      setPreviewStatus('ready');
    });
    socket.on('preview-status-update', (data: { branch: string; status: string; port?: number; url?: string; deploymentMeta?: any }) => {
      if (data.status === 'running') {
        setPreviewStatus('ready');
        
        // Update deployment metadata if available
        if (data.deploymentMeta) {
          setPreviewDeploymentMeta(data.deploymentMeta);
        }
        
        if (data.url) {
          // Add authentication token to proxy URL
          const token = localStorage.getItem('covibes_auth_token');
          const urlWithToken = `${data.url}?token=${encodeURIComponent(token || '')}`;
          setPreviewUrl(urlWithToken);
        }
      } else if (data.status === 'stopped') {
        setPreviewStatus('error');
        setPreviewDeploymentMeta(null); // Clear metadata when stopped
      }
    });
    socket.on('preview-error', (data: { error: string; branch?: string }) => {
      console.error('❌ Preview error:', data);
      setPreviewStatus('error');
    });

    socket.on('error', (error) => {
      console.error('🔌 WebSocket error:', error);
    });

    return () => {
      socket.removeAllListeners(); // Remove all event listeners
      socket.disconnect();
      socketRef.current = null;
      setSocket(null); // Clear socket state
      setIsConnected(false);
    };
  }, [user?.id, team?.id]);

  // Auth functions
  const handleLogin = async (credentials: { email: string; password: string }) => {
    setError('');
    setIsLoading(true);
    
    try {
      const response = await apiService.login(credentials);
      setUser(response.user);
      setTeam(response.team);
      setIsLoading(false); // Set loading false immediately after successful login
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setIsLoading(false); // Set loading false on error
      throw err;
    }
  };

  const handleRegister = async (userData: { teamName: string; userName: string; email: string; password: string }) => {
    setError('');
    setIsLoading(true);
    
    try {
      const response = await apiService.register(userData);
      setUser(response.user);
      setTeam(response.team);
      setIsLoading(false); // Set loading false immediately after successful registration
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      setIsLoading(false); // Set loading false on error
      throw err;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('covibes_auth_token');
    setUser(null);
    setTeam(null);
    setIsConnected(false);
    setAgents([]);
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  // Chat functions - WORKING LOGIC
  const sendChatMessage = (content: string) => {
    if (!content.trim() || !socketRef.current || !isConnected || !team) return;

    socketRef.current.emit('chat-message', {
      message: content.trim(),
      teamId: team.id
    });
  };

  // Agent functions
  const spawnAgent = async (agentData: { task: string; agentType?: 'mock' | 'claude' }) => {
    try {
      const response = await apiService.spawnAgent(agentData);
      // Don't add to state here - the WebSocket event will handle it for real-time updates
      return response.agent;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to spawn agent');
    }
  };

  const killAgent = async (agentId: string) => {
    try {
      await apiService.killAgent(agentId);
      // Immediately remove the agent from the list for instant UI feedback
      // The WebSocket event will also handle this for all connected clients
      setAgents(prev => prev.filter(agent => agent.id !== agentId));
    } catch (error: any) {
      throw new Error(error.message || 'Failed to kill agent');
    }
  };

  const deleteAllAgents = async () => {
    try {
      await apiService.deleteAllAgents();
      // Clear all agents from the list for instant UI feedback
      // The WebSocket event will also handle this for all connected clients
      setAgents([]);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to delete all agents');
    }
  };

  // Preview functions
  const startPreviewContainer = async () => {
    if (!team?.id) return;
    
    setPreviewStatus('loading');
    
    try {
      const response = await fetch('/api/preview/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('covibes_auth_token')}`
        },
        body: JSON.stringify({ branch: 'workspace' }) // Request workspace preview
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create preview: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Set the preview URL from the response (direct proxy URL like MVP)
      if (result.url) {
        const token = localStorage.getItem('covibes_auth_token');
        const urlWithToken = `${result.url}?token=${encodeURIComponent(token || '')}`;
        setPreviewUrl(urlWithToken);
        setPreviewStatus('loading'); // Will become 'ready' when iframe loads
      } else {
      }
      
      // Also emit via WebSocket for real-time updates
      if (socketRef.current && isConnected) {
        socketRef.current.emit('preview-refresh', { 
          repositoryUrl: team.repositoryUrl 
        });
      }
      
    } catch (error) {
      console.error('❌ Failed to start preview container:', error);
      setPreviewStatus('error');
      throw error;
    }
  };

  const refreshPreview = async () => {
    if (!socketRef.current || !isConnected || !team) return;
    
    const branch = 'main'; // Use main branch (server will fallback to default branch if main doesn't exist)
    setPreviewStatus('loading');
    
    socketRef.current.emit('preview-refresh', {
      branch,
      repositoryUrl: team.repositoryUrl
    });
  };


  const handleGitHubSignupComplete = (authData: any) => {
    setUser(authData.user);
    setTeam(authData.team);
    setError('');
  };

  // Refresh user and team data
  const refreshUserAndTeam = async () => {
    try {
      const data = await apiService.getCurrentUser();
      setUser(data.user);
      setTeam(data.team);
    } catch (error: any) {
      console.error('Failed to refresh user/team data:', error);
      // If token is invalid, clear it
      if (error.status === 401) {
        localStorage.removeItem('covibes_auth_token');
        setUser(null);
        setTeam(null);
      }
    }
  };

  // Last active target tracking functions
  const setLastActiveAgent = (agentId: string, agentName: string) => {
    setLastActiveTarget({
      type: 'agent',
      id: agentId,
      name: agentName,
      timestamp: Date.now()
    });
  };

  const setLastActiveTerminal = (terminalId: string, terminalName: string) => {
    setLastActiveTarget({
      type: 'terminal',
      id: terminalId,
      name: terminalName,
      timestamp: Date.now()
    });
  };

  const setLastActiveChat = () => {
    setLastActiveTarget({
      type: 'chat',
      id: 'team-chat',
      name: 'Team Chat',
      timestamp: Date.now()
    });
  };

  const sendToLastActive = (message: string): boolean => {
    if (!lastActiveTarget) return false;

    try {
      switch (lastActiveTarget.type) {
        case 'agent':
          if (socketRef.current) {
            // STEP 1: Send the message text first
            socketRef.current.emit('terminal_input', {
              type: 'input',
              agentId: lastActiveTarget.id,
              data: message  // Send message text WITHOUT enter
            });

            // STEP 2: Wait for message to be pasted, then send ENTER
            setTimeout(() => {
              // Get the actual terminal and simulate ENTER key press
              import('./services/TerminalManager').then(({ default: TerminalManager }) => {
                const terminal = TerminalManager.getTerminal(lastActiveTarget.id);
                if (terminal && terminal.element) {
                  // Focus the terminal
                  terminal.focus();

                  // Find the textarea
                  const terminalElement = terminal.element;
                  const textarea = terminalElement.querySelector('textarea');

                  if (textarea) {
                    // Focus the textarea
                    textarea.focus();

                    // Simulate ENTER key press
                    const enterKeydown = new KeyboardEvent('keydown', {
                      key: 'Enter',
                      code: 'Enter',
                      keyCode: 13,
                      which: 13,
                      bubbles: true,
                      cancelable: true
                    });

                    const enterKeypress = new KeyboardEvent('keypress', {
                      key: 'Enter',
                      code: 'Enter',
                      keyCode: 13,
                      which: 13,
                      bubbles: true,
                      cancelable: true
                    });

                    const enterKeyup = new KeyboardEvent('keyup', {
                      key: 'Enter',
                      code: 'Enter',
                      keyCode: 13,
                      which: 13,
                      bubbles: true,
                      cancelable: true
                    });

                    // Dispatch all three enter events
                    textarea.dispatchEvent(enterKeydown);
                    textarea.dispatchEvent(enterKeypress);
                    textarea.dispatchEvent(enterKeyup);

                  } else {
                    // Fallback: send ENTER via socket
                    socketRef.current.emit('terminal_input', {
                      type: 'input',
                      agentId: lastActiveTarget.id,
                      data: '\r'
                    });
                  }
                } else {
                  // Fallback: send ENTER via socket
                  socketRef.current.emit('terminal_input', {
                    type: 'input',
                    agentId: lastActiveTarget.id,
                    data: '\r'
                  });
                }
              });
            }, 500); // Wait 500ms for message to be pasted first

            return true;
          }
          return false;
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
  };

  // Create context-like object for Dashboard
  const appState = {
    // Auth state
    user,
    team,
    isAuthenticated: !!user,
    isLoading,
    error,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    clearAuthError: () => setError(''),
    onGitHubSignupComplete: handleGitHubSignupComplete,
    refreshUserAndTeam,

    // Agents state  
    agents,
    agentsLoading,
    agentsError: null,
    spawnAgent,
    killAgent,
    deleteAllAgents,
    clearAgentsError: () => {},

    // Socket methods
    sendChatMessage,
    sendAgentInput: (agentId: string, input: string) => {
      if (socketRef.current) {
        socketRef.current.emit('agent-input', { agentId, input });
      }
    },
    isSocketConnected: () => isConnected,
    socket: socket, // Use state variable for proper re-renders
    
    // Real-time state
    chatMessages: messages,
    agentOutputs: [],
    onlineUsers: [],
    
    // Preview state
    previewUrl,
    previewStatus,
    setPreviewStatus,
    previewDeploymentMeta,
    startPreviewContainer,
    refreshPreview,
    
    // State setters (for compatibility)
    setChatMessages: setMessages,
    setAgentOutputs: () => {},
    setOnlineUsers: () => {},

    // Last active target tracking
    lastActiveTarget,
    setLastActiveAgent,
    setLastActiveTerminal,
    setLastActiveChat,
    sendToLastActive,
  };

  // Check for demo routes FIRST - before any auth/loading logic
  if (window.location.pathname === '/demo') {
    // Get agent ID from URL params if available
    const urlParams = new URLSearchParams(window.location.search);
    const agentId = urlParams.get('agentId') || undefined;

    return <DemoTerminal agentId={agentId} socket={socket} />;
  }

  if (window.location.pathname === '/demo-list') {
    return <DemoList />;
  }

  if (window.location.pathname === '/demo/chat-agent') {
    return <ChatAgentDemo />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-midnight-900 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-electric/10 rounded-full blur-xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-team-purple/10 rounded-full blur-xl float" />
        </div>

        <div className="text-center space-y-6 relative z-10">
          <div className="flex items-center justify-center space-x-1 mb-4">
            <h1 className="text-3xl font-bold text-white tracking-wide">
              Colab<span className="text-electric">Vibe</span>
            </h1>
          </div>

          <LoadingSpinner size="lg" />

          <div className="space-y-2">
            <p className="text-white font-semibold text-lg">Loading CoVibe...</p>
            <p className="text-electric text-sm font-medium">Setting up your workspace</p>
          </div>
        </div>
      </div>
    );
  }

  // Route based on authentication status
  return user ? (
    <Dashboard
      {...appState}
      previewUrl={previewUrl}
      setPreviewStatus={setPreviewStatus}
      deleteAllAgents={deleteAllAgents}
      refreshUserAndTeam={refreshUserAndTeam}
    />
  ) : (
    <AuthPage {...appState} />
  );
}

// Intermediate component to connect sound settings to notifications
function AppWithNotifications() {
  const { soundsEnabled } = useSoundSettings();

  return (
    <NotificationProvider soundsEnabled={soundsEnabled}>
      <AppContent />
    </NotificationProvider>
  );
}

// Root App component with providers
export default function App() {
  return (
    <ErrorBoundary>
      <SoundSettingsProvider>
        <AppWithNotifications />
      </SoundSettingsProvider>
    </ErrorBoundary>
  );
}
