import React, { useState, useEffect } from 'react';
import { SimpleTerminal } from '@/components/features/agents/SimpleTerminal';
import { MinimalObserverTerminal } from '@/components/features/agents/MinimalObserverTerminal';
import { useAuth } from '@/hooks/useAuth';
import TerminalManager from '@/services/TerminalManager';
import type { AgentDetails } from '@/types';

interface TerminalTileProps {
  agent?: AgentDetails | undefined;
  agentId?: string | undefined; // Explicit undefined for exactOptionalPropertyTypes
  agents?: AgentDetails[] | undefined; // All available agents for dropdown
  user?: { id: string; name: string; email: string } | undefined;
  socket?: any;
  onAgentSelect?: ((agentId: string) => void) | undefined; // When user selects from dropdown
  onDisconnect?: (() => void) | undefined; // When user disconnects agent
  onAgentDrop?: ((agentId: string) => void) | undefined; // When agent is dropped on tile
  className?: string | undefined;
  setLastActiveAgent?: ((agentId: string, agentName: string) => void) | undefined;
  setLastActiveTerminal?: ((terminalId: string, terminalName: string) => void) | undefined;
}

const TerminalTileComponent: React.FC<TerminalTileProps> = ({
  agent,
  agentId,
  agents = [],
  user,
  socket,
  onAgentSelect,
  onDisconnect,
  onAgentDrop,
  className = '',
  setLastActiveAgent,
  setLastActiveTerminal
}) => {
  const { user: authUser } = useAuth();
  const currentUser = user || authUser;
  const currentAgentId = agentId || agent?.id;
  const [showDropdown, setShowDropdown] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fontSize, setFontSize] = useState(13);
  
  const isOwner = agent?.userId === currentUser?.id;
  const canInteract = isOwner && (agent?.status === 'running' || agent?.status === 'starting');

  // Sync font size with TerminalManager when agent connects
  useEffect(() => {
    if (currentAgentId && agent) {
      const terminalSize = TerminalManager.getFontSize(currentAgentId);
      if (terminalSize !== fontSize) {
        setFontSize(terminalSize);
      }
    }
  }, [currentAgentId, agent, fontSize]);

  // Font size controls
  const zoomIn = () => {
    const newSize = Math.min(fontSize + 2, 24);
    setFontSize(newSize);
    // If agent is connected, sync with TerminalManager
    if (currentAgentId && agent) {
      TerminalManager.updateFontSize(currentAgentId, newSize);
    }
  };

  const zoomOut = () => {
    const newSize = Math.max(fontSize - 2, 8);
    setFontSize(newSize);
    // If agent is connected, sync with TerminalManager
    if (currentAgentId && agent) {
      TerminalManager.updateFontSize(currentAgentId, newSize);
    }
  };

  const resetZoom = () => {
    setFontSize(13);
    // If agent is connected, sync with TerminalManager
    if (currentAgentId && agent) {
      TerminalManager.updateFontSize(currentAgentId, 13);
    }
  };
  
  // Filter agents that are running and not already connected
  const availableAgents = agents.filter(a => 
    a.status === 'running' && 
    a.userId === currentUser?.id // Only show user's own agents
  );

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the entire terminal tile
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const rawData = e.dataTransfer.getData('text/plain');
    
    if (rawData && rawData.startsWith('{')) {
      try {
        const data = JSON.parse(rawData);
        
        if (data.type === 'agent' && data.agentId && onAgentDrop) {
          onAgentDrop(data.agentId);
        }
      } catch (error) {
        console.error('Failed to parse drop data:', error);
      }
    }
  };

  // Empty terminal state (no agent connected)
  if (!currentAgentId) {
    return (
      <div 
        className={`h-full flex flex-col bg-[#1e1e1e] ${className} ${
          isDragOver ? 'ring-2 ring-electric ring-opacity-50' : ''
        }`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Header with dropdown */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#2d2d30] border-b border-[#3e3e42]">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-gray-500" />
            <span className="text-xs text-[#858585]">No agent connected</span>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Zoom controls */}
            <div className="flex items-center space-x-1 border-l border-[#3e3e42] pl-2 mr-2">
              <button
                onClick={zoomOut}
                className="p-1 text-[#858585] hover:text-[#d4d4d4] transition-colors"
                title="Zoom out"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                </svg>
              </button>
              <span className="text-xs text-[#858585] min-w-[1.5rem] text-center">{fontSize}px</span>
              <button
                onClick={zoomIn}
                className="p-1 text-[#858585] hover:text-[#d4d4d4] transition-colors"
                title="Zoom in"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
              </button>
              <button
                onClick={resetZoom}
                className="p-1 text-[#858585] hover:text-[#d4d4d4] transition-colors"
                title="Reset zoom"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            
            {/* Agent selector dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Connect Agent ▼
              </button>
            
            {showDropdown && (
              <div className="absolute right-0 mt-1 w-64 bg-[#2d2d30] border border-[#3e3e42] rounded shadow-lg z-50">
                {availableAgents.length > 0 ? (
                  <div className="py-1 max-h-64 overflow-y-auto">
                    {availableAgents.map(a => (
                      <button
                        key={a.id}
                        onClick={() => {
                          onAgentSelect?.(a.id);
                          setShowDropdown(false);
                        }}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-[#3e3e42] transition-colors flex items-center justify-between"
                      >
                        <div>
                          <div className="text-[#d4d4d4]">
                            {a.agentName || `Agent ${a.id.slice(-6)}`}
                          </div>
                          <div className="text-[#858585] text-[10px]">
                            {a.task?.slice(0, 50)}...
                          </div>
                        </div>
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-2 text-xs text-[#858585]">
                    No running agents available
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
        
        {/* Empty terminal content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <div className="space-y-4">
              <div className={`text-gray-400 transition-all duration-200 ${
                isDragOver ? 'scale-110' : ''
              }`}>
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className={`text-sm font-medium transition-all duration-200 ${
                isDragOver ? 'text-electric' : 'text-gray-400'
              }`}>
                {isDragOver ? 'Drop agent here' : 'Terminal Ready'}
              </div>
              <div className="text-xs text-gray-600 max-w-48">
                {isDragOver 
                  ? 'Release to connect the agent to this terminal'
                  : 'Drag an agent here or use the dropdown above to connect'
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className={`h-full bg-[#1e1e1e] flex items-center justify-center ${className}`}>
        <div className="text-center text-gray-500">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-electric mx-auto mb-2"></div>
          <div className="text-xs">Loading agent...</div>
          <div className="text-xs text-gray-600 mt-1">ID: {currentAgentId.slice(-8)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full bg-[#1e1e1e] flex flex-col ${className}`}>
      {/* Terminal Status Bar with disconnect button */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#2d2d30] border-b border-[#3e3e42]">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            agent.status === 'running' ? 'bg-green-400' :
            agent.status === 'starting' ? 'bg-yellow-400 animate-pulse' : 
            agent.status === 'failed' ? 'bg-red-400' :
            'bg-gray-500'
          }`} />
          <span className="text-xs text-[#d4d4d4]">
            {agent.agentName || `Agent ${currentAgentId.slice(-6)}`}
          </span>
          <span className="text-xs text-[#858585]">•</span>
          <span className="text-xs text-[#d4d4d4]">
            {agent.userName} • {agent.status}
          </span>
          {isOwner && (
            <span className="text-xs bg-blue-600/30 text-blue-400 px-1 rounded">
              yours
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Zoom controls for connected agent */}
          <div className="flex items-center space-x-1 border-l border-[#3e3e42] pl-2 mr-2">
            <button
              onClick={zoomOut}
              className="p-1 text-[#858585] hover:text-[#d4d4d4] transition-colors"
              title="Zoom out"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
            </button>
            <span className="text-xs text-[#858585] min-w-[1.5rem] text-center">{fontSize}px</span>
            <button
              onClick={zoomIn}
              className="p-1 text-[#858585] hover:text-[#d4d4d4] transition-colors"
              title="Zoom in"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </button>
              <button
                onClick={resetZoom}
                className="p-1 text-[#858585] hover:text-[#d4d4d4] transition-colors"
                title="Reset zoom"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
          </div>
          
          {/* Disconnect button */}
          {isOwner && onDisconnect && (
            <button
              onClick={onDisconnect}
              className="px-2 py-1 text-xs text-gray-400 hover:text-red-400 transition-colors"
              title="Disconnect agent"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Terminal Content */}
      <div className="flex-1 min-h-0 overflow-hidden" style={{ contain: 'layout style' }}>
        {canInteract && socket ? (
          <SimpleTerminal
            key={currentAgentId} // Stable key to prevent unmounting
            agentId={currentAgentId}
            socket={socket}
            onClose={() => {}} // No close action in tile
            containerInfo={agent?.container ? {
              containerId: agent.container.containerId || '',
              status: agent?.status || 'running',
              terminalPort: agent.container.terminalPort,
              previewPort: agent.container.previewPort
            } : {
              containerId: '',
              status: agent?.status || 'running'
            }}
            onInput={() => {
              // Track this agent as the last active target for inspector auto-injection
              if (setLastActiveAgent && agent) {
                setLastActiveAgent(agent.id, agent.agentName || agent.userName || 'Agent');
              }
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
            {agent.status === 'starting' ? (
              <div className="text-center">
                <div className="animate-pulse mb-1 text-xs">Starting agent...</div>
                <div className="text-xs">Terminal will be available shortly</div>
              </div>
            ) : !isOwner && socket && agent.status === 'running' ? (
              <MinimalObserverTerminal
                agentId={currentAgentId}
                socket={socket}
              />
            ) : !isOwner ? (
              <div className="text-center">
                <div className="text-xs">This agent belongs to {agent.userName}</div>
                <div className="text-xs">Status: {agent.status}</div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-xs">Agent not running</div>
                <div className="text-xs">Status: {agent.status}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const TerminalTile = React.memo(TerminalTileComponent, (prevProps, nextProps) => {
  const prevAgentId = prevProps.agentId || prevProps.agent?.id;
  const nextAgentId = nextProps.agentId || nextProps.agent?.id;
  
  // Re-render if agent ID changes
  if (prevAgentId !== nextAgentId) return false;
  
  // Re-render if agent status changes
  if (prevProps.agent?.status !== nextProps.agent?.status) return false;
  
  // Re-render if socket connection changes
  if (prevProps.socket !== nextProps.socket) return false;
  
  // Re-render if user changes
  if (prevProps.user?.id !== nextProps.user?.id) return false;
  
  // Re-render if agents list changes
  if (prevProps.agents?.length !== nextProps.agents?.length) return false;
  
  // Re-render if className changes
  if (prevProps.className !== nextProps.className) return false;
  
  // Skip re-render for all other changes
  return true;
});