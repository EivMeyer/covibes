import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import type { GridTile } from './WorkspaceGrid';

interface AllotmentWorkspaceProps {
  tiles: GridTile[];
  onAddTile: (type: GridTile['type'], agentId?: string, terminalId?: string) => void;
  onRemoveTile: (id: string) => void;
  renderTile: (tile: GridTile) => React.ReactNode;
  className?: string;
}

interface TileWithHeader {
  tile: GridTile;
  isMaximized?: boolean;
}

// Cool header component with color-coded design
const TileHeader: React.FC<{
  tile: GridTile;
  onClose: () => void;
  onMaximize: () => void;
  onDetach?: () => void;
  isMaximized?: boolean;
}> = ({ tile, onClose, onMaximize, onDetach, isMaximized }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  // Color scheme for each tile type
  const getColorScheme = () => {
    switch (tile.type) {
      case 'terminal': 
        return {
          bg: 'from-cyan-500/10 via-blue-500/5 to-cyan-600/10',
          border: 'border-cyan-500/20',
          indicator: 'bg-cyan-500',
          text: 'text-cyan-100',
          accent: 'text-cyan-400'
        };
      case 'chat': 
        return {
          bg: 'from-purple-500/10 via-pink-500/5 to-purple-600/10',
          border: 'border-purple-500/20',
          indicator: 'bg-purple-500',
          text: 'text-purple-100',
          accent: 'text-purple-400'
        };
      case 'preview': 
        return {
          bg: 'from-green-500/10 via-emerald-500/5 to-green-600/10',
          border: 'border-green-500/20',
          indicator: 'bg-green-500',
          text: 'text-green-100',
          accent: 'text-green-400'
        };
      case 'ide': 
        return {
          bg: 'from-orange-500/10 via-amber-500/5 to-orange-600/10',
          border: 'border-orange-500/20',
          indicator: 'bg-orange-500',
          text: 'text-orange-100',
          accent: 'text-orange-400'
        };
      default: 
        return {
          bg: 'from-gray-500/10 via-slate-500/5 to-gray-600/10',
          border: 'border-gray-500/20',
          indicator: 'bg-gray-500',
          text: 'text-gray-100',
          accent: 'text-gray-400'
        };
    }
  };

  const colorScheme = getColorScheme();
  
  return (
    <div 
      className={`
        relative h-8 bg-gradient-to-r ${colorScheme.bg} 
        backdrop-blur-sm border-b ${colorScheme.border}
        transition-all duration-300 group
        ${isHovered ? 'shadow-lg' : 'shadow-sm'}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Subtle background effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/3 to-transparent 
                      opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Content */}
      <div className="relative flex items-center justify-between h-full px-3">
        {/* Left side - Color indicator and Title */}
        <div className="flex items-center space-x-3">
          {/* Color-coded indicator dot */}
          <div className={`w-2 h-2 rounded-full ${colorScheme.indicator} 
                          shadow-sm group-hover:shadow-md transition-shadow`} />
          
          {/* Title with smaller, cleaner font */}
          <span className={`text-xs font-medium ${colorScheme.text} tracking-wide uppercase`}>
            {tile.title}
          </span>
          
          {/* Status indicators */}
          {tile.type === 'terminal' && tile.agentId && (
            <span className={`px-2 py-0.5 text-xs ${colorScheme.accent} 
                           bg-current/10 rounded border border-current/20`}>
              ACTIVE
            </span>
          )}
          {tile.type === 'terminal' && !tile.agentId && (
            <span className="px-2 py-0.5 text-xs text-gray-400 
                           bg-gray-500/10 rounded border border-gray-500/20">
              EMPTY
            </span>
          )}
        </div>
        
        {/* Right side - Controls */}
        <div className="flex items-center space-x-1 opacity-50 group-hover:opacity-100 transition-opacity">
          {/* Detach button for terminals with agents */}
          {tile.type === 'terminal' && tile.agentId && onDetach && (
            <button
              onClick={onDetach}
              className="p-1 hover:bg-yellow-500/20 rounded transition-colors group/detach"
              title="Detach Agent"
            >
              <svg className={`w-3 h-3 ${colorScheme.text} group-hover/detach:text-yellow-400 transition-colors`} 
                   fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </button>
          )}
          
          {/* Maximize/Restore */}
          <button
            onClick={onMaximize}
            className={`p-1 hover:bg-white/10 rounded transition-colors`}
            title={isMaximized ? "Restore" : "Maximize"}
          >
            <svg className={`w-3 h-3 ${colorScheme.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMaximized ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 4l-5-5" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              )}
            </svg>
          </button>
          
          {/* Close */}
          <button
            onClick={onClose}
            className="p-1 hover:bg-red-500/20 rounded transition-colors group/close"
            title="Close"
          >
            <svg className={`w-3 h-3 ${colorScheme.text} group-hover/close:text-red-400 transition-colors`} 
                 fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Bottom accent line */}
      <div className={`absolute bottom-0 left-0 right-0 h-px ${colorScheme.indicator} 
                       opacity-30 group-hover:opacity-60 transition-opacity`} />
    </div>
  );
};

export const AllotmentWorkspace: React.FC<AllotmentWorkspaceProps> = ({
  tiles,
  onAddTile,
  onRemoveTile,
  renderTile,
  className = ''
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [maximizedTile, setMaximizedTile] = useState<string | null>(null);
  const [sizes, setSizes] = useState<number[]>([]);
  const [draggedTile, setDraggedTile] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [tileOrder, setTileOrder] = useState<string[]>([]);
  const allotmentRef = useRef<any>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  
  // Initialize tile order and sizes
  useEffect(() => {
    if (tiles.length > 0) {
      // Initialize tile order if needed
      if (tileOrder.length === 0 || tileOrder.length !== tiles.length) {
        const newOrder = tiles.map(tile => tile.id);
        setTileOrder(newOrder);
        localStorage.setItem('tile-order', JSON.stringify(newOrder));
      }
      
      // Initialize sizes
      if (sizes.length !== tiles.length) {
        const equalSize = 100 / tiles.length;
        setSizes(tiles.map(() => equalSize));
      }
    }
  }, [tiles.length, tileOrder.length]);

  // Load saved tile order
  useEffect(() => {
    const savedOrder = localStorage.getItem('tile-order');
    if (savedOrder && tiles.length > 0) {
      try {
        const parsed = JSON.parse(savedOrder);
        // Only use saved order if all current tiles are present
        if (parsed.every((id: string) => tiles.some(tile => tile.id === id))) {
          setTileOrder(parsed);
        }
      } catch (e) {
        // Invalid saved order
      }
    }
  }, []);
  
  const handleAddTile = (type: GridTile['type']) => {
    onAddTile(type);
    setShowAddMenu(false);
  };
  
  const handleMaximize = (tileId: string) => {
    if (maximizedTile === tileId) {
      setMaximizedTile(null);
      // Restore original sizes
      if (allotmentRef.current && sizes.length > 0) {
        allotmentRef.current.resize(sizes);
      }
    } else {
      setMaximizedTile(tileId);
      // Maximize the selected tile
      if (allotmentRef.current) {
        const index = tiles.findIndex(t => t.id === tileId);
        if (index !== -1) {
          const newSizes = tiles.map((_, i) => i === index ? 90 : 10 / (tiles.length - 1));
          allotmentRef.current.resize(newSizes);
        }
      }
    }
  };
  
  const handleSizeChange = (newSizes: number[]) => {
    if (!maximizedTile) {
      setSizes(newSizes);
      localStorage.setItem('allotment-sizes', JSON.stringify(newSizes));
    }
  };
  
  // Load saved sizes
  useEffect(() => {
    const savedSizes = localStorage.getItem('allotment-sizes');
    if (savedSizes) {
      try {
        const parsed = JSON.parse(savedSizes);
        if (parsed.length === tiles.length) {
          setSizes(parsed);
        }
      } catch (e) {
        // Invalid saved sizes
      }
    }
  }, []);

  // Handle drag over workspace
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // Handle drop from agent list
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    
    const rawData = e.dataTransfer.getData('text/plain');
    
    if (rawData && rawData.startsWith('{')) {
      try {
        const data = JSON.parse(rawData);
        console.log('AllotmentWorkspace: Drop data received:', data);
        
        if (data.type === 'agent' && data.agentId) {
          // Check if dropped directly on a terminal tile
          const target = e.target as HTMLElement;
          const terminalPane = target.closest('.terminal-pane');
          
          if (terminalPane) {
            // Dropped on a specific terminal
            const terminalId = terminalPane.getAttribute('data-tile-id');
            if (terminalId) {
              console.log('AllotmentWorkspace: Connecting agent to specific terminal:', terminalId);
              onAddTile('connect-agent', data.agentId, terminalId);
              return;
            }
          }
          
          // Otherwise, look for empty terminal tiles (no agentId assigned)
          const emptyTerminal = tiles.find(tile => tile.type === 'terminal' && !tile.agentId);
          
          if (emptyTerminal) {
            console.log('AllotmentWorkspace: Connecting agent to existing empty terminal:', emptyTerminal.id);
            onAddTile('connect-agent', data.agentId, emptyTerminal.id);
          } else {
            console.log('AllotmentWorkspace: Adding new terminal tile for agent:', data.agentId);
            onAddTile('terminal', data.agentId);
          }
        }
      } catch (error) {
        console.debug('AllotmentWorkspace: Drop data is not valid agent JSON:', rawData);
      }
    }
  }, [onAddTile, tiles]);

  // Handle agent detach from terminal
  const handleDetach = useCallback((tileId: string) => {
    onAddTile('detach-agent', undefined, tileId);
  }, [onAddTile]);

  // Click outside handler for add menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (workspaceRef.current && !workspaceRef.current.contains(event.target as Node)) {
        setShowAddMenu(false);
      }
    };
    
    if (showAddMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAddMenu]);
  
  if (tiles.length === 0) {
    return (
      <div 
        ref={workspaceRef}
        className={`flex items-center justify-center h-full bg-midnight-900 ${className}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="text-center space-y-6">
          <div className="text-gray-500 text-lg font-medium">
            Workspace is empty
          </div>
          <div className="text-gray-600 text-sm max-w-md">
            Drag agents from the sidebar or click "Add Panel" to get started
          </div>
          <div className="flex items-center justify-center space-x-2 text-gray-600 mb-4">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
            </svg>
            <span className="text-sm">Drag agents here</span>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="px-4 py-2 bg-electric hover:bg-electric/80 text-midnight-900 font-medium rounded-lg transition-colors"
            >
              Add Panel
            </button>
            
            {showAddMenu && (
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-48 bg-midnight-800/95 backdrop-blur-sm 
                              border border-midnight-600 rounded-lg shadow-2xl">
                <div className="p-1">
                  <button
                    onClick={() => handleAddTile('terminal')}
                    className="w-full px-3 py-2 text-left text-sm text-white hover:bg-cyan-500/20 
                               transition-colors rounded flex items-center space-x-2"
                  >
                    <span>🖥️</span>
                    <span>Agent Terminal</span>
                  </button>
                  <button
                    onClick={() => handleAddTile('chat')}
                    className="w-full px-3 py-2 text-left text-sm text-white hover:bg-purple-500/20 
                               transition-colors rounded flex items-center space-x-2"
                  >
                    <span>💬</span>
                    <span>Team Chat</span>
                  </button>
                  <button
                    onClick={() => handleAddTile('preview')}
                    className="w-full px-3 py-2 text-left text-sm text-white hover:bg-green-500/20 
                               transition-colors rounded flex items-center space-x-2"
                  >
                    <span>👁️</span>
                    <span>Preview</span>
                  </button>
                  <button
                    onClick={() => handleAddTile('ide')}
                    className="w-full px-3 py-2 text-left text-sm text-white hover:bg-orange-500/20 
                               transition-colors rounded flex items-center space-x-2"
                  >
                    <span>💻</span>
                    <span>Code Editor</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      ref={workspaceRef}
      className={`relative h-full bg-midnight-900 ${className}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Compact Add Panel Button - Bottom Right Corner */}
      <div className="absolute bottom-4 right-4 z-40">
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="w-10 h-10 bg-electric/90 hover:bg-electric text-midnight-900 font-bold 
                       rounded-full shadow-lg hover:shadow-electric/50 transition-all duration-200
                       backdrop-blur-sm border border-electric/30 flex items-center justify-center"
            title="Add Panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          
          {showAddMenu && (
            <div className="absolute bottom-full right-0 mb-2 w-48 bg-midnight-800/95 backdrop-blur-sm 
                            border border-midnight-600 rounded-lg shadow-2xl">
              <div className="p-1">
                <button
                  onClick={() => handleAddTile('terminal')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-cyan-500/20 
                             transition-colors rounded flex items-center space-x-2"
                >
                  <span>🖥️</span>
                  <span>Agent Terminal</span>
                </button>
                <button
                  onClick={() => handleAddTile('chat')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-purple-500/20 
                             transition-colors rounded flex items-center space-x-2"
                >
                  <span>💬</span>
                  <span>Team Chat</span>
                </button>
                <button
                  onClick={() => handleAddTile('preview')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-green-500/20 
                             transition-colors rounded flex items-center space-x-2"
                >
                  <span>👁️</span>
                  <span>Preview</span>
                </button>
                <button
                  onClick={() => handleAddTile('ide')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-orange-500/20 
                             transition-colors rounded flex items-center space-x-2"
                >
                  <span>💻</span>
                  <span>Code Editor</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Allotment Split Panes */}
      <Allotment 
        ref={allotmentRef}
        onChange={handleSizeChange}
        defaultSizes={sizes.length > 0 ? sizes : undefined}
      >
        {tiles.map((tile) => (
          <Allotment.Pane key={tile.id} minSize={100}>
            <div 
              className={`h-full flex flex-col bg-midnight-800 ${tile.type === 'terminal' ? 'terminal-pane' : ''}`}
              data-tile-id={tile.type === 'terminal' ? tile.id : undefined}
            >
              <TileHeader
                tile={tile}
                onClose={() => onRemoveTile(tile.id)}
                onMaximize={() => handleMaximize(tile.id)}
                onDetach={() => handleDetach(tile.id)}
                isMaximized={maximizedTile === tile.id}
              />
              <div className="flex-1 overflow-hidden">
                {renderTile(tile)}
              </div>
            </div>
          </Allotment.Pane>
        ))}
      </Allotment>
      
      {/* Custom Styles for Allotment */}
      <style jsx global>{`
        .allotment-module_splitView__L-yRc {
          background: #0a0a0f !important;
        }
        
        .allotment-module_sashContainer__fzRfN {
          background: transparent !important;
        }
        
        .allotment-module_sash__19Pgl {
          background: #2a2a3a !important;
          transition: background-color 0.2s;
        }
        
        .allotment-module_sash__19Pgl:hover {
          background: #00ff88 !important;
          opacity: 0.5;
        }
        
        .allotment-module_sash__19Pgl.allotment-module_active__PzRir {
          background: #00ff88 !important;
          opacity: 0.7;
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
};