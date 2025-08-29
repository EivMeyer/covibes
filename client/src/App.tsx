import { useState, useEffect, useRef } from 'react';
import { apiService, type AuthUser, type AuthTeam, type AgentDetails } from './services/api';
import io, { Socket } from 'socket.io-client';

// Import existing UI components
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { NotificationProvider } from './components/ui/Notification';

// Import types from types module
import type { ChatMessage } from '@/types';

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
  
  // Agent state
  const [agents, setAgents] = useState<AgentDetails[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  
  // Preview state
  const [previewStatus, setPreviewStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [previewDeploymentMeta, setPreviewDeploymentMeta] = useState<any>(null);

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
      localStorage.setItem('colabvibe_auth_token', token);
      
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
          localStorage.removeItem('colabvibe_auth_token');
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
    const existingToken = localStorage.getItem('colabvibe_auth_token');
    if (existingToken) {
      apiService.getCurrentUser()
        .then(data => {
          setUser(data.user);
          setTeam(data.team);
          setIsLoading(false);
        })
        .catch(error => {
          console.error('❌ Existing token invalid:', error);
          localStorage.removeItem('colabvibe_auth_token');
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
                'Authorization': `Bearer ${localStorage.getItem('colabvibe_auth_token')}`
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
              if (data.mode === 'docker' && data.workspace?.status === 'running') {
                // Use direct proxy port URL for Vite compatibility
                const port = data.workspace.port;
                // Get the current host dynamically
                const currentHost = window.location.hostname;
                setPreviewUrl(`http://${currentHost}:${port}/`);
              } else if (data.main?.status === 'running') {
                // Preview proxy is publicly accessible for running previews
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
    
    const token = localStorage.getItem('colabvibe_auth_token');
    if (!token) return;

    const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const socket = io(backendUrl, {
      auth: {
        token: token
      },
      transports: ['polling', 'websocket'], // Start with polling, upgrade to websocket
      timeout: 30000,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 3,
      reconnectionDelayMax: 10000,
      forceNew: false, // Reuse connections when possible
      upgrade: true,
      rememberUpgrade: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      
      // Join team
      socket.emit('join-team', { teamId: team.id, token });
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
        localStorage.removeItem('colabvibe_auth_token');
        window.location.href = '/auth';
      }
    });

    socket.on('team-joined', (data: { teamData: any; messages: ChatMessage[]; connectedUsers: number }) => {
      if (data.messages) {
        setMessages(data.messages);
      }
    });

    socket.on('chat-message', (message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
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
          const token = localStorage.getItem('colabvibe_auth_token');
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
    localStorage.removeItem('colabvibe_auth_token');
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
          'Authorization': `Bearer ${localStorage.getItem('colabvibe_auth_token')}`
        },
        body: JSON.stringify({ branch: 'workspace' }) // Request workspace preview
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create preview: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Set the preview URL from the response (direct proxy URL like MVP)
      if (result.url) {
        const token = localStorage.getItem('colabvibe_auth_token');
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

  const restartPreview = async () => {
    if (!team?.id) return;
    
    setPreviewStatus('loading');
    
    try {
      const response = await fetch('/api/preview/restart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('colabvibe_auth_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to restart preview: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Update preview URL if it changed
      if (result.url) {
        const token = localStorage.getItem('colabvibe_auth_token');
        const urlWithToken = `${result.url}?token=${encodeURIComponent(token || '')}`;
        setPreviewUrl(urlWithToken);
      }
      
      // Wait a bit before marking as ready to ensure container is fully started
      setTimeout(() => {
        setPreviewStatus('ready');
        // Update preview URL if it changed
        if (result.url && previewUrl !== result.url) {
          const token = localStorage.getItem('colabvibe_auth_token');
          const urlWithToken = `${result.url}?token=${encodeURIComponent(token || '')}`;
          setPreviewUrl(urlWithToken);
        }
      }, 2000);
    } catch (error) {
      console.error('❌ Failed to restart preview:', error);
      setPreviewStatus('error');
    }
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
        localStorage.removeItem('colabvibe_auth_token');
        setUser(null);
        setTeam(null);
      }
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
    socket: socketRef.current,
    
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
    restartPreview,
    
    // State setters (for compatibility)
    setChatMessages: setMessages,
    setAgentOutputs: () => {},
    setOnlineUsers: () => {},
  };

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

  // DEBUG: Removed excessive logging to reduce console noise

  // Route based on authentication status
  return user ? (
    <Dashboard 
      {...appState}
      previewUrl={previewUrl}
      setPreviewStatus={setPreviewStatus}
      deleteAllAgents={deleteAllAgents}
      restartPreview={restartPreview}
      refreshUserAndTeam={refreshUserAndTeam}
    />
  ) : (
    <AuthPage {...appState} />
  );
}

// Root App component with providers
export default function App() {
  return (
    <ErrorBoundary>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </ErrorBoundary>
  );
}