import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { Sidebar, SidebarSection } from '@/components/layout/Sidebar';
import { DynamicDashboard } from '@/components/layout/DynamicDashboard';
import type { GridTile } from '@/types';
import { ActiveHumans } from '@/components/features/humans/ActiveHumans';
import { SpawnAgentModal } from '@/components/features/agents/SpawnAgentModal';
import { VMConfigModal } from '@/components/features/config/VMConfigModal';
import { RepoConfigModal } from '@/components/features/config/RepoConfigModal';

// Tile Components
import { TerminalTile } from '@/components/tiles/TerminalTile';
import { ChatTile } from '@/components/tiles/ChatTile';
import { PreviewTile } from '@/components/tiles/PreviewTile';
import { IDETile } from '@/components/tiles/IDETile';
import { AgentChatTile } from '@/components/tiles/AgentChatTile';
import { AgentListMinimal } from '@/components/features/agents/AgentListMinimal';
import { ContainerManagement } from '@/components/features/containers/ContainerManagement';

// Mobile Components
import { MobileTabBar } from '@/components/mobile/MobileTabBar';
import { MobileAgentView } from '@/components/mobile/MobileAgentView';
import { MobileTeamView } from '@/components/mobile/MobileTeamView';
import { MobilePreviewView } from '@/components/mobile/MobilePreviewView';

import { useNotification } from '@/components/ui/Notification';
import { useTeamWorkspaceSync } from '@/hooks/useTeamWorkspaceSync';

// Props interface that matches what we pass from App.tsx
interface DashboardProps {
  user: any;
  team: any;
  agents: any[];
  agentsLoading: boolean;
  spawnAgent: (data: any) => Promise<any>;
  killAgent: (id: string) => Promise<void>;
  deleteAllAgents?: (() => Promise<void>) | undefined;
  sendChatMessage: (content: string) => void;
  chatMessages: any[];
  onlineUsers: any[];
  isSocketConnected: () => boolean;
  logout: () => void;
  refreshUserAndTeam?: (() => Promise<void>) | undefined;
  socket?: any;
  // Preview props
  previewUrl?: string | undefined;
  previewStatus: 'loading' | 'ready' | 'error';
  setPreviewStatus?: ((status: 'loading' | 'ready' | 'error') => void) | undefined;
  previewDeploymentMeta?: any;
  refreshPreview: () => void;
  restartPreview?: (() => Promise<void>) | undefined;
}

// Polyfill for requestIdleCallback
const requestIdleCallbackPolyfill = (callback: () => void) => {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(callback);
  } else {
    // Fallback to setTimeout for browsers without requestIdleCallback
    setTimeout(callback, 0);
  }
};

export const Dashboard: React.FC<DashboardProps> = (props) => {
  // Get token for API calls - use the correct key!
  const token = typeof window !== 'undefined' ? localStorage.getItem('colabvibe_auth_token') : null;
  const { 
    loadWorkspace, 
    saveWorkspace, 
    registerEventHandlers, 
    activeDrags,
    connected,
    emitDragStart,
    emitDragMove,
    emitDragStop,
    emitTileAdd,
    emitTileRemove
  } = useTeamWorkspaceSync(token);
  
  
  // Debug: Expose saveWorkspace on window for testing
  useEffect(() => {
    if (typeof window !== 'undefined' && saveWorkspace) {
      (window as any).debugSaveWorkspace = saveWorkspace;
    }
  }, [saveWorkspace]);
  const [showSpawnAgent, setShowSpawnAgent] = useState(false);
  const [showVMConfig, setShowVMConfig] = useState(false);
  const [showRepoConfig, setShowRepoConfig] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [fullscreenIDE, setFullscreenIDE] = useState(false);
  const [mobileTab, setMobileTab] = useState<'agents' | 'team' | 'preview'>('agents');
  const [sidebarWidth, setSidebarWidth] = useState(256); // Default 256px (w-64)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [gridTiles, setGridTiles] = useState<GridTile[]>(() => {
    return [];
  });
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  
  // State for keyboard shortcuts
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  
  // Container management state
  const [showContainerManagement, setShowContainerManagement] = useState(false);
  const [containers, setContainers] = useState<any[]>([]);

  // Extract props
  const { 
    user, 
    team, 
    agents, 
    agentsLoading, 
    spawnAgent, 
    killAgent, 
    deleteAllAgents,
    sendChatMessage, 
    chatMessages,
    onlineUsers,
    isSocketConnected,
    logout,
    refreshUserAndTeam,
    // Preview props
    previewUrl,
    previewStatus,
    setPreviewStatus,
    previewDeploymentMeta,
    refreshPreview 
  } = props;
  
  const { addNotification } = useNotification();

  // Load workspace from server when user becomes available
  useEffect(() => {
    
    // Skip if already loaded or no user/token
    if (workspaceLoaded || !user?.id || !token) {
      return;
    }
    
    const loadWorkspaceData = async () => {
      try {
        const workspace = await loadWorkspace();
        
        if (workspace) {
            
            // Process tiles
            if (workspace.tiles && Array.isArray(workspace.tiles)) {
              
              // Filter out agent tiles as they are dynamic
              const filtered = workspace.tiles.filter((tile: any) => 
                tile.type !== 'agents' && tile.type !== 'agent'
              );
              
              
              setGridTiles(filtered);
            } else {
            }
            
            // Process sidebar width
            if (workspace.sidebarWidth) {
              setSidebarWidth(workspace.sidebarWidth);
            }
            
            // Process layouts for DynamicDashboard
            if (workspace.layouts) {
              
              localStorage.setItem('dashboard-layouts', JSON.stringify(workspace.layouts));
              
              // CRITICAL: Dispatch event to update DynamicDashboard with loaded layouts
              window.dispatchEvent(new CustomEvent('workspace-layouts-updated', { detail: workspace.layouts }));
            } else {
            }
          } else {
          }
        } catch (error) {
          addNotification({
            message: 'Failed to load workspace configuration',
            type: 'error'
          });
        } finally {
          setWorkspaceLoaded(true);
        }
    };
    
    // Call the load function
    loadWorkspaceData();
  }, [user?.id, token, loadWorkspace, addNotification]); // Trigger on user.id change

  // Expose layout save function to window for DynamicDashboard
  useEffect(() => {
    (window as any).saveWorkspaceLayouts = (layouts: any) => {
      saveWorkspace({ layouts });
    };
    return () => {
      delete (window as any).saveWorkspaceLayouts;
    };
  }, [saveWorkspace]);

  // Register team workspace synchronization event handlers
  useEffect(() => {
    registerEventHandlers({
      onWorkspaceUpdated: (data) => {
        // Update local state with changes from team members
        if (data.tiles) {
          // Filter out agent tiles as they are dynamic
          const filtered = data.tiles.filter((tile: any) => 
            tile.type !== 'agents' && tile.type !== 'agent'
          );
          setGridTiles(filtered);
        }
        
        if (data.sidebarWidth) {
          setSidebarWidth(data.sidebarWidth);
        }
        
        // Also update localStorage for DynamicDashboard layouts
        if (data.layouts) {
          localStorage.setItem('dashboard-layouts', JSON.stringify(data.layouts));
          // Force re-render of DynamicDashboard with new layouts
          window.dispatchEvent(new CustomEvent('workspace-layouts-updated', { detail: data.layouts }));
        }

        // Show notification about the update
        addNotification({
          message: `Workspace updated by team member`,
          type: 'info',
        });
      },
      
      onDragStarted: (data) => {
        // Visual feedback is handled through activeDrags state
      },
      
      onDragStopped: (data) => {
        // The final position will come through workspace-update event
      },
      
      onTileAdded: (data) => {
        addNotification({
          message: `Team member added ${data.title} panel`,
          type: 'info',
        });
      },
      
      onTileRemoved: (data) => {
        addNotification({
          message: `Team member removed a panel`,
          type: 'info',
        });
      }
    });
  }, [registerEventHandlers, addNotification]);

  // VM status is handled by the server - agents auto-assign VMs as needed
  const hasVMConfig = true; // Server auto-assigns default VM to users
  const canSpawnAgent = hasVMConfig && isSocketConnected(); // Need both VM and socket
  const canAddPanels = true; // Panels work without WebSocket (except terminal with agents)


  const handleSpawnAgent = () => {
    if (!canSpawnAgent) {
      if (!hasVMConfig) {
        addNotification({
          message: 'Please configure your VM before spawning agents',
          type: 'warning',
        });
        setShowVMConfig(true);
      } else if (!isSocketConnected()) {
        addNotification({
          message: 'Not connected to server',
          type: 'error',
        });
      }
      return;
    }
    setShowSpawnAgent(true);
  };

  const handleAgentSpawned = async (agentId: string) => {
    // Automatically create a terminal tile for the new agent
    handleAddTile('terminal', agentId);
  };

  // Container management functions
  const handleContainerAction = async (action: string, containerId: string) => {
    try {
      // Use the socket service to send container actions
      if (props.socket) {
        props.socket.emit('container_action', { containerId, action });
      }
      addNotification({
        message: `Container ${action} initiated`,
        type: 'success',
      });
    } catch (error) {
      console.error(`Failed to ${action} container:`, error);
      addNotification({
        message: `Failed to ${action} container`,
        type: 'error',
      });
      throw error;
    }
  };

  // Extract container information from agents
  const getContainerSummary = () => {
    const agentContainers = agents
      .filter(agent => agent.container)
      .map(agent => ({
        ...agent.container,
        agentId: agent.id,
        agentName: agent.agentName,
        type: 'agent' as const,
      }));

    // For now, we'll just return agent containers
    // In the future, this could include preview containers and other container types
    return agentContainers;
  };

  const containerSummary = getContainerSummary();

  // Grid tile management
  const handleAddTile = useCallback((type: GridTile['type'] | 'connect-agent' | 'detach-agent', agentId?: string, terminalId?: string) => {

    // Handle connecting agent to existing terminal
    if (type === 'connect-agent' && agentId && terminalId) {
      setGridTiles(prev => {
        const updated = prev.map(tile => {
          if (tile.id === terminalId && tile.type === 'terminal') {
            const agent = agents.find(a => a.id === agentId);
            return {
              ...tile,
              agentId,
              title: agent?.agentName || `Agent ${agentId.slice(-6)}`
            };
          }
          return tile;
        });
        // Save immediately for better persistence
        saveWorkspace({ tiles: updated });
        return updated;
      });
      return;
    }

    // Handle detaching agent from terminal
    if (type === 'detach-agent' && terminalId) {
      setGridTiles(prev => {
        const updated = prev.map(tile => {
          if (tile.id === terminalId && tile.type === 'terminal') {
            return {
              ...tile,
              agentId: undefined,
              title: 'Agent Terminal'
            };
          }
          return tile;
        });
        // Save immediately for better persistence
        saveWorkspace({ tiles: updated });
        return updated;
      });
      return;
    }

    // If adding a terminal without an agent, open the spawn agent modal instead
    if (type === 'terminal' && !agentId) {
      handleSpawnAgent();
      return;
    }

    const newTile: GridTile = {
      id: `${type}-${Date.now()}`,
      type: type as GridTile['type'], // Ensure type casting
      title: type === 'terminal' && agentId ?
        agents.find(a => a.id === agentId)?.agentName || `Agent ${agentId.slice(-6)}` :
        type === 'terminal' ? 'Agent Terminal' :
        type === 'chat' ? 'Team Chat' :
        type === 'preview' ? 'Preview' :
        type === 'ide' ? 'Code Editor' :
        'Unknown',
      agentId
    };

    setGridTiles(prev => {
      const updated = [...prev, newTile];
      // Save immediately instead of waiting for idle callback
      if (saveWorkspace) {
        saveWorkspace({ tiles: updated });
      }
      return updated;
    });
  }, [agents, saveWorkspace, handleSpawnAgent]);

  const handleRemoveTile = useCallback((id: string) => {
    setGridTiles(prev => {
      const tileToRemove = prev.find(tile => tile.id === id);
      const updated = prev.filter(tile => tile.id !== id);
      // Save immediately instead of waiting for idle callback
      saveWorkspace({ tiles: updated });
      return updated;
    });
  }, [saveWorkspace]);

  const handleOpenTerminal = useCallback((agent: any) => {
    // Check if terminal for this agent is already open
    const existingTerminal = gridTiles.find(tile => 
      tile.type === 'terminal' && tile.agentId === agent.id
    );
    
    if (!existingTerminal) {
      handleAddTile('terminal', agent.id);
    } else {
    }
  }, [gridTiles, handleAddTile]);
  
  // Keyboard shortcut handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      
      // Ctrl+L for new agent (spawn agent modal)
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        handleSpawnAgent();
        return;
      }
      
      // Ctrl+W for testing workspace load/save
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        
        // Test loading workspace
        loadWorkspace().then((result) => {
          
          // Test saving workspace
          const testData = {
            tiles: [{ id: 'test-terminal-123', type: 'terminal', title: 'Test Terminal' }],
            layouts: { lg: [{ i: 'test-terminal-123', x: 0, y: 0, w: 6, h: 12 }] },
            sidebarWidth: 300
          };
          
          saveWorkspace(testData);
          
          addNotification({
            message: 'Workspace test completed - check console for results',
            type: 'info'
          });
        }).catch((error) => {
          console.error('🧪 Workspace load failed:', error);
          addNotification({
            message: 'Workspace test failed - check console for errors',
            type: 'error'
          });
        });
        
        return;
      }
      
      // Ctrl+O for open terminal for most recent agent
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        
        // Get the most recent agent (first in the array - newest agents appear first)
        if (agents.length > 0) {
          const mostRecentAgent = agents[0];
          handleOpenTerminal(mostRecentAgent);
          
          addNotification({
            message: `Terminal opened for ${mostRecentAgent.agentName || 'recent agent'}`,
            type: 'success',
          });
        } else {
          addNotification({
            message: 'No agents available to open',
            type: 'warning',
          });
        }
        return;
      }
      
      // Number keys 1-9 to select agent by index
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        if (index < agents.length) {
          e.preventDefault();
          const agent = agents[index];
          setSelectedAgentId(agent.id);
          addNotification({
            message: `Selected: ${agent.agentName || agent.userName + "'s Agent"}`,
            type: 'info',
          });
        }
        return;
      }
      
      // 't' key to connect selected agent to next available terminal
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 't' && selectedAgentId) {
        e.preventDefault();
        const agent = agents.find(a => a.id === selectedAgentId);
        if (agent) {
          
          // Find an empty terminal or create a new one
          const emptyTerminal = gridTiles.find(tile => 
            tile.type === 'terminal' && !tile.agentId
          );
          
          if (emptyTerminal) {
            // Connect to existing empty terminal
            handleAddTile('connect-agent', agent.id, emptyTerminal.id);
            addNotification({
              message: `Connected ${agent.agentName || 'agent'} to terminal`,
              type: 'success',
            });
          } else {
            // Create new terminal with this agent
            handleAddTile('terminal', agent.id);
            addNotification({
              message: `Created terminal for ${agent.agentName || 'agent'}`,
              type: 'success',
            });
          }
          
          // Clear selection after connecting
          setSelectedAgentId(null);
        }
        return;
      }
      
      // Ctrl+T to add empty terminal tile
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        handleAddTile('terminal');
        addNotification({
          message: 'Terminal tile added to workspace',
          type: 'success',
        });
        return;
      }
      
      // Ctrl+Shift+L to auto-select newest agent
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        if (agents.length > 0) {
          const newestAgent = agents[0]; // agents[0] is newest
          setSelectedAgentId(newestAgent.id);
          addNotification({
            message: `Selected newest agent: ${newestAgent.agentName || newestAgent.userName + "'s Agent"}`,
            type: 'success',
          });
        } else {
          addNotification({
            message: 'No agents available to select',
            type: 'warning',
          });
        }
        return;
      }
      
      // Escape to clear selection
      if (e.key === 'Escape' && selectedAgentId) {
        e.preventDefault();
        setSelectedAgentId(null);
        addNotification({
          message: 'Selection cleared',
          type: 'info',
        });
      }
    };
    
    // Add event listener
    document.addEventListener('keydown', handleKeyDown);
    
    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [agents, selectedAgentId, gridTiles, handleOpenTerminal, handleSpawnAgent, handleAddTile, addNotification]);
  


  // Optimized render functions with minimal dependencies
  const renderTerminalTile = useCallback((tile: GridTile) => {
    const agent = agents.find(a => a.id === tile.agentId);

    // FIXED: Sanitize agent data to prevent circular references
    const sanitizedAgent = agent ? {
      id: agent.id,
      agentName: agent.agentName || agent.userName,
      status: agent.status,
      task: agent.task,
      output: agent.output,
      userId: agent.userId,  // CRITICAL: Include userId for ownership check
      userName: agent.userName  // Include userName for display
    } : null;

    // FIXED: Sanitize agents array to prevent circular references
    const sanitizedAgents = agents.map(a => ({
      id: a.id,
      agentName: a.agentName || a.userName,
      status: a.status,
      task: a.task,
      userId: a.userId,  // Include userId for ownership checks
      userName: a.userName  // Include userName for display
    }));

    return (
      <div
        key={`${tile.id}-${tile.agentId || 'empty'}`}
        className="h-full"
      >
        <TerminalTile
          agent={sanitizedAgent}
          agentId={tile.agentId}
          agents={sanitizedAgents} // Pass sanitized agents for dropdown
          user={user}
          socket={props.socket}
          onAgentSelect={(agentId) => {
            handleAddTile('connect-agent', agentId, tile.id);
          }}
          onAgentDrop={(agentId) => {
            handleAddTile('connect-agent', agentId, tile.id);
          }}
          onDisconnect={() => {
            // Update the tile to remove the agent
            setGridTiles(prev => {
              const updated = prev.map(t =>
                t.id === tile.id
                  ? { ...t, agentId: undefined, title: 'Terminal' }
                  : t
              );
              // Save immediately for better persistence
              saveWorkspace({ tiles: updated });
              return updated;
            });
          }}
        />
      </div>
    );
  }, [agents, user, props.socket, handleAddTile, saveWorkspace]);

  const renderChatTile = useCallback(() => (
    <ChatTile
      user={user}
      chatMessages={chatMessages}
      sendChatMessage={sendChatMessage}
      isSocketConnected={isSocketConnected}
    />
  ), [user, chatMessages, sendChatMessage, isSocketConnected]);

  const [isRestarting, setIsRestarting] = useState(false);

  const handleRestartPreview = async () => {
    setIsRestarting(true);
    try {
      await props.restartPreview?.();
    } finally {
      setIsRestarting(false);
    }
  };

  const renderPreviewTile = useCallback(() => (
    <PreviewTile
      url={previewUrl}
      onRefresh={refreshPreview}
      onRestart={props.restartPreview ? handleRestartPreview : undefined}
      onOpenIDE={() => setFullscreenIDE(true)}
      isLoading={previewStatus === 'loading'}
      isRestarting={isRestarting}
      onLoad={() => setPreviewStatus?.('ready')}
    />
  ), [previewUrl, refreshPreview, props.restartPreview, previewStatus, setPreviewStatus, isRestarting]);

  const renderIDETile = useCallback(() => (
    <IDETile
      teamId={team?.id}
      repositoryUrl={team?.repositoryUrl}
      onToggleFullscreen={() => setFullscreenIDE(true)}
    />
  ), [team?.id, team?.repositoryUrl]);

  const renderAgentChatTile = useCallback((tile: GridTile) => {
    const agent = agents.find(a => a.id === tile.agentId);

    // Sanitize agent data to prevent circular references
    const sanitizedAgent = agent ? {
      id: agent.id,
      userId: agent.userId,
      userName: agent.userName,
      type: agent.type,
      agentType: agent.agentType,
      task: agent.task,
      status: agent.status,
      output: agent.output || '',
      startedAt: agent.startedAt,
      completedAt: agent.completedAt,
      lastActivity: agent.lastActivity,
      outputLines: agent.outputLines || 0,
      isOwner: agent.userId === user?.id,
      repositoryUrl: agent.repositoryUrl,
      agentName: agent.agentName || undefined,
      container: agent.container ? {
        containerId: agent.container.containerId,
        status: agent.container.status,
        terminalPort: agent.container.terminalPort,
        previewPort: agent.container.previewPort,
        proxyUrl: agent.container.proxyUrl,
        createdAt: agent.container.createdAt
      } : undefined
    } : undefined;

    return (
      <div className="h-full flex flex-col">
        <AgentChatTile
          agent={sanitizedAgent}
          agentId={tile.agentId}
          agents={agents}
          user={user}
          socket={props.socket}
          onAgentSelect={(agentId: string) => {
            const updatedTiles = gridTiles.map(t =>
              t.id === tile.id ? { ...t, agentId } : t
            );
            setGridTiles(updatedTiles);
            saveWorkspace();
          }}
          onDisconnect={() => {
            const updatedTiles = gridTiles.map(t =>
              t.id === tile.id ? { ...t, agentId: undefined } : t
            );
            setGridTiles(updatedTiles);
            saveWorkspace();
          }}
        />
      </div>
    );
  }, [agents, user, props.socket, gridTiles, saveWorkspace]);

  // Render tile content based on type - optimized
  const renderTile = useCallback((tile: GridTile) => {
    switch (tile.type) {
      case 'terminal':
        return renderTerminalTile(tile);
      case 'chat':
        return renderChatTile();
      case 'preview':
        return renderPreviewTile();
      case 'ide':
        return renderIDETile();
      case 'agentchat':
        return renderAgentChatTile(tile);
      default:
        return null;
    }
  }, [renderTerminalTile, renderChatTile, renderPreviewTile, renderIDETile, renderAgentChatTile]);

  const handleVMConfigSuccess = async () => {
    // VM status handled via props
    addNotification({
      message: 'VM configuration updated successfully!',
      type: 'success',
    });
  };

  const handleRepoConfigSuccess = async () => {
    // Refresh team data to show updated repository configuration
    if (refreshUserAndTeam) {
      await refreshUserAndTeam();
    }
    
    // Trigger preview refresh with the new repository
    refreshPreview();
    
    addNotification({
      message: 'Repository configuration updated successfully!',
      type: 'success',
    });
  };

  // Sidebar resize handlers
  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
  }, []);

  useEffect(() => {
    if (!isResizingSidebar) {
      document.body.classList.remove('resizing-sidebar');
      return;
    }
    
    document.body.classList.add('resizing-sidebar');

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(400, e.clientX));
      setSidebarWidth(newWidth);
      saveWorkspace({ sidebarWidth: newWidth });
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      document.body.classList.remove('resizing-sidebar');
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove('resizing-sidebar');
    };
  }, [isResizingSidebar]);

  if (!user || !team) {
    return (
      <div className="min-h-screen bg-midnight-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-electric mx-auto"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // FIXED: Memoize gridTiles to prevent infinite re-renders in DynamicDashboard
  const memoizedGridTiles = useMemo(() => gridTiles, [gridTiles]);

  return (
    <div 
      data-testid="dashboard"
      className={`h-screen bg-midnight-900 text-white flex flex-col ${
        isResizingSidebar ? 'select-none' : ''
      }`}
    >
      {/* Header */}
      <Header
        user={user}
        team={team}
        logout={logout}
        isSocketConnected={isSocketConnected}
        onConfigureVM={() => setShowVMConfig(true)}
        onConfigureRepo={() => setShowRepoConfig(true)}
      />

      {/* Main Content */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Mobile Sidebar Overlay */}
        {showMobileSidebar && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
              onClick={() => setShowMobileSidebar(false)}
            />
            <div className="absolute left-0 top-0 bottom-0 w-80 max-w-[80vw]">
              <Sidebar
                onSpawnAgent={handleSpawnAgent}
                canSpawnAgent={canSpawnAgent}
                vmConnected={hasVMConfig}
                socketConnected={isSocketConnected()}
                className="h-full"
              >
                {/* Active Humans */}
                <SidebarSection title="Team" defaultExpanded>
                  <ActiveHumans
                    onlineUsers={onlineUsers}
                    currentUserId={user?.id}
                    className="max-h-64 overflow-y-auto"
                  />
                </SidebarSection>
              </Sidebar>
            </div>
          </div>
        )}
        
        {/* Desktop Layout - Resizable Sidebar + Workspace */}
        <div className="hidden md:flex w-full h-full relative overflow-hidden">
          {/* Resizable Sidebar Container */}
          <div 
            className="bg-midnight-800 border-r border-midnight-600 h-full flex-shrink-0 relative overflow-y-auto"
            style={{ width: `${sidebarWidth}px` }}
          >
            <Sidebar
              className="h-full"
              onSpawnAgent={handleSpawnAgent}
              canSpawnAgent={canSpawnAgent}
              vmConnected={hasVMConfig}
              socketConnected={isSocketConnected()}
            >
              {/* Active Agents - EXPANDABLE */}
              <SidebarSection title="Active Agents" defaultExpanded className="flex-shrink-0">
                <AgentListMinimal 
                  agents={agents}
                  agentsLoading={agentsLoading}
                  killAgent={killAgent}
                  user={user}
                  onViewOutput={handleOpenTerminal}
                  onDeleteAllAgents={deleteAllAgents}
                  className="max-h-[300px] overflow-y-auto"
                />
              </SidebarSection>
              
              {/* Container Overview - COLLAPSIBLE */}
              {containerSummary.length > 0 && (
                <SidebarSection title="Containers" collapsible className="flex-shrink-0">
                  <div className="space-y-2">
                    {/* Container Summary Stats */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <div className="text-green-400 font-bold">
                          {containerSummary.filter(c => c.status === 'running').length}
                        </div>
                        <div className="text-slate-500">Running</div>
                      </div>
                      <div className="text-center">
                        <div className="text-yellow-400 font-bold">
                          {containerSummary.filter(c => ['starting', 'creating'].includes(c.status)).length}
                        </div>
                        <div className="text-slate-500">Starting</div>
                      </div>
                      <div className="text-center">
                        <div className="text-red-400 font-bold">
                          {containerSummary.filter(c => ['stopped', 'error'].includes(c.status)).length}
                        </div>
                        <div className="text-slate-500">Issues</div>
                      </div>
                    </div>

                    {/* Container List - Compact */}
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {containerSummary.slice(0, 5).map((container, index) => (
                        <div key={container.containerId || index} className="flex items-center justify-between text-xs p-1 rounded bg-slate-800/30">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              container.status === 'running' ? 'bg-green-400' :
                              container.status === 'starting' ? 'bg-yellow-400' :
                              container.status === 'stopped' ? 'bg-red-400' :
                              'bg-slate-500'
                            }`} />
                            <span className="text-slate-300 truncate">
                              {container.agentName || `C-${container.containerId?.slice(-6)}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-slate-500">
                            {container.terminalPort && (
                              <span className="font-mono">:{container.terminalPort}</span>
                            )}
                            {container.resources && (
                              <span>{container.resources.memory}</span>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {containerSummary.length > 5 && (
                        <div className="text-xs text-slate-500 text-center py-1">
                          +{containerSummary.length - 5} more containers
                        </div>
                      )}
                    </div>

                    {/* Manage Containers Button */}
                    {containerSummary.length > 0 && (
                      <button
                        onClick={() => setShowContainerManagement(true)}
                        className="w-full text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                      >
                        Manage All Containers
                      </button>
                    )}
                  </div>
                </SidebarSection>
              )}
              
              {/* Active Humans - EXPANDABLE */}
              <SidebarSection title="Team" collapsible className="flex-1 min-h-0 overflow-hidden">
                <ActiveHumans
                  onlineUsers={onlineUsers}
                  currentUserId={user?.id}
                  className="h-full overflow-y-auto"
                />
              </SidebarSection>
            </Sidebar>
            
            {/* Sidebar Resize Handle */}
            <div
              className={`absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-electric/30 transition-colors ${
                isResizingSidebar ? 'bg-electric/50' : 'bg-transparent'
              }`}
              onMouseDown={handleSidebarResizeStart}
              style={{
                right: '-2px',
                width: '5px',
                zIndex: 10
              }}
            />
          </div>

          {/* Dynamic Dashboard - Drag & Drop with Resizable Tiles */}
          <div className="flex-1 h-full bg-midnight-900 overflow-y-auto overflow-x-hidden">
            <DynamicDashboard
              tiles={memoizedGridTiles}
              onAddTile={handleAddTile}
              onRemoveTile={handleRemoveTile}
              renderTile={renderTile}
              activeDrags={activeDrags}
              onDragStart={emitDragStart}
              onDragMove={emitDragMove}
              onDragStop={emitDragStop}
              onTileAdd={emitTileAdd}
              onTileRemove={emitTileRemove}
            />
          </div>
        </div>

        {/* Mobile Layout - Three Tab Interface */}
        <div className="md:hidden w-full h-full flex flex-col">
          {/* Tab Content Area */}
          <div className="flex-1 overflow-hidden" style={{ paddingBottom: '60px' }}>
            {mobileTab === 'agents' && (
              <MobileAgentView
                agents={agents}
                agentsLoading={agentsLoading}
                user={user}
                canSpawnAgent={canSpawnAgent}
                onSpawnAgent={handleSpawnAgent}
                killAgent={killAgent}
                isSocketConnected={isSocketConnected()}
                socket={props.socket}
              />
            )}
            
            {mobileTab === 'team' && (
              <MobileTeamView
                team={team}
                user={user}
                chatMessages={chatMessages}
                onlineUsers={onlineUsers}
                sendChatMessage={sendChatMessage}
                isSocketConnected={isSocketConnected()}
                socket={props.socket}
                logout={props.logout}
              />
            )}
            
            {mobileTab === 'preview' && (
              <MobilePreviewView
                previewUrl={previewUrl}
                previewStatus={previewStatus}
                refreshPreview={refreshPreview}
                team={team}
              />
            )}
          </div>
          
          {/* Bottom Tab Bar */}
          <MobileTabBar
            activeTab={mobileTab}
            onTabChange={setMobileTab}
            badges={{
              agents: agents.filter(a => a.status === 'running').length,
              team: 0, // Could add unread message count here
              preview: 0
            }}
          />
        </div>
      </div>

      {/* Modals */}
      <SpawnAgentModal
        isOpen={showSpawnAgent}
        onClose={() => setShowSpawnAgent(false)}
        onSuccess={handleAgentSpawned}
      />

      <VMConfigModal
        isOpen={showVMConfig}
        onClose={() => setShowVMConfig(false)}
        onSuccess={handleVMConfigSuccess}
      />

      <RepoConfigModal
        isOpen={showRepoConfig}
        onClose={() => setShowRepoConfig(false)}
        onSuccess={handleRepoConfigSuccess}
        team={team}
      />

      {/* Container Management Modal */}
      {showContainerManagement && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-slate-200">Container Management</h2>
              <button
                onClick={() => setShowContainerManagement(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[80vh]">
              <ContainerManagement
                teamId={team?.id || ''}
                containers={containerSummary}
                onContainerAction={handleContainerAction}
                onRefresh={() => {
                  // Refresh agents to get updated container info
                  if (refreshUserAndTeam) {
                    refreshUserAndTeam();
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen IDE Overlay */}
      {fullscreenIDE && (
        <IDETile
          teamId={team?.id}
          repositoryUrl={team?.repositoryUrl}
              isFullscreen={true}
          onToggleFullscreen={() => setFullscreenIDE(false)}
          onClose={() => setFullscreenIDE(false)}
        />
      )}

    </div>
  );
};