import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { GridTile } from './WorkspaceGrid';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface GridWorkspaceProps {
  tiles: GridTile[];
  onAddTile: (type: GridTile['type'] | 'connect-agent' | 'detach-agent', agentId?: string, terminalId?: string) => void;
  onRemoveTile: (id: string) => void;
  renderTile: (tile: GridTile) => React.ReactNode;
  className?: string;
}

// Color scheme helper
const getColorScheme = (type: GridTile['type']) => {
  switch (type) {
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

// Tile header component
const TileHeader: React.FC<{
  tile: GridTile;
  onClose: () => void;
  onDetach?: () => void;
}> = ({ tile, onClose, onDetach }) => {
  const colorScheme = getColorScheme(tile.type);

  return (
    <div 
      className={`
        grid-tile-handle relative h-8 bg-gradient-to-r ${colorScheme.bg} 
        backdrop-blur-sm border-b ${colorScheme.border}
        transition-all duration-300 group cursor-move
      `}
    >
      {/* Content */}
      <div className="relative flex items-center justify-between h-full px-3">
        {/* Left side - Drag handle, indicator and Title */}
        <div className="flex items-center space-x-3">
          {/* Drag Handle */}
          <div 
            className="cursor-move p-1 hover:bg-white/10 rounded transition-colors"
            title="Drag to move"
          >
            <svg className={`w-3 h-3 ${colorScheme.text}`} fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
          </div>
          
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

export const GridWorkspace: React.FC<GridWorkspaceProps> = ({
  tiles,
  onAddTile,
  onRemoveTile,
  renderTile,
  className = ''
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [layouts, setLayouts] = useState<any>({});
  const workspaceRef = useRef<HTMLDivElement>(null);

  // Convert tiles to grid layout format
  const gridItems = useMemo(() => {
    return tiles.map((tile, index) => {
      const savedLayout = layouts['lg']?.find((l: any) => l.i === tile.id);
      
      if (savedLayout) {
        return savedLayout;
      }
      
      // Auto-arrange new tiles in a smart grid - reasonable sizes
      const cols = 12;
      const tileWidth = 12; // Full width
      const tileHeight = tile.type === 'terminal' ? 12 : 10; // Reasonable height for 60px rowHeight
      
      // Calculate position based on existing tiles
      const existingTiles = tiles.slice(0, index);
      let x = 0;
      let y = 0;
      
      // Try to place next to existing tiles
      if (existingTiles.length > 0) {
        const lastTile = layouts['lg']?.find((l: any) => l.i === existingTiles[existingTiles.length - 1]?.id);
        if (lastTile) {
          x = (lastTile.x + lastTile.w) % cols;
          y = lastTile.y + (Math.floor((lastTile.x + lastTile.w) / cols) * lastTile.h);
        }
      }
      
      // Make sure tile fits
      if (x + tileWidth > cols) {
        x = 0;
        y += tileHeight;
      }
      
      const layout = {
        i: tile.id,
        x,
        y,
        w: tileWidth,
        h: tileHeight,
        minW: 6,
        minH: 8,
        maxH: 20
      };
      
      // DEBUG: Log calculated dimensions
      console.log('🔍 New Tile Layout:', {
        tileId: tile.id,
        type: tile.type,
        gridWidth: tileWidth,
        gridHeight: tileHeight,
        pixelWidth: `~${(tileWidth / 12) * 100}%`,
        pixelHeight: `~${tileHeight * 60}px`,
        layout
      });
      
      return layout;
    });
  }, [tiles, layouts]);

  // Handle layout change
  const handleLayoutChange = useCallback((layout: any, layouts: any) => {
    setLayouts(layouts);
    localStorage.setItem('grid-layouts', JSON.stringify(layouts));
  }, []);

  // Load saved layouts
  useEffect(() => {
    const saved = localStorage.getItem('grid-layouts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validate that saved layouts have reasonable sizes
        Object.keys(parsed).forEach(breakpoint => {
          if (Array.isArray(parsed[breakpoint])) {
            parsed[breakpoint] = parsed[breakpoint].map((item: any) => ({
              ...item,
              w: Math.max(item.w || 12, 6), // Minimum reasonable width
              h: Math.max(item.h || 12, 8), // Minimum reasonable height
            }));
          }
        });
        setLayouts(parsed);
      } catch (e) {
        // Invalid saved layouts, clear them
        localStorage.removeItem('grid-layouts');
      }
    }
  }, []);

  const handleAddTile = (type: GridTile['type'] | 'connect-agent' | 'detach-agent') => {
    console.log('GridWorkspace: handleAddTile called with type:', type);
    onAddTile(type);
    setShowAddMenu(false);
  };

  const toggleAddMenu = useCallback(() => {
    console.log('🔍 GridWorkspace: toggleAddMenu called - current showAddMenu:', showAddMenu);
    setShowAddMenu(prev => {
      console.log('🔍 GridWorkspace: toggling from', prev, 'to', !prev);
      return !prev;
    });
  }, [showAddMenu]);

  const handleDetach = useCallback((tileId: string) => {
    onAddTile('detach-agent', undefined, tileId);
  }, [onAddTile]);

  // Handle drag over workspace for agent drops
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    
    const rawData = e.dataTransfer.getData('text/plain');
    
    if (rawData && rawData.startsWith('{')) {
      try {
        const data = JSON.parse(rawData);
        
        if (data.type === 'agent' && data.agentId) {
          const emptyTerminal = tiles.find(tile => tile.type === 'terminal' && !tile.agentId);
          
          if (emptyTerminal) {
            onAddTile('connect-agent', data.agentId, emptyTerminal.id);
          } else {
            onAddTile('terminal', data.agentId);
          }
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }
  }, [onAddTile, tiles]);

  // Click outside handler for add menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Don't close if clicking on the floating controls or the add menu itself
      const clickedOnFloatingControls = target && (
        (target as Element).closest?.('.fixed.bottom-4.right-4') ||
        (target as Element).closest?.('[data-add-menu]')
      );
      
      if (!clickedOnFloatingControls && workspaceRef.current && !workspaceRef.current.contains(target)) {
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

  console.log('🔍 GridWorkspace render - showAddMenu state:', showAddMenu);

  if (tiles.length === 0) {
    console.log('🔍 Rendering empty workspace with center Add Panel button, showAddMenu:', showAddMenu);
    return (
      <div 
        ref={workspaceRef}
        className={`flex items-center justify-center h-full bg-midnight-900 ${className}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="text-center space-y-6 relative">
          <div className="text-gray-500 text-lg font-medium">
            Workspace is empty
          </div>
          <div className="text-gray-600 text-sm max-w-md">
            Drag agents from the sidebar or click "Add Panel" to get started
          </div>
          <div className="text-center">
            <p className="text-lg text-gray-400 mb-2">Use the floating button (bottom-right) to add panels</p>
            <svg className="w-8 h-8 mx-auto text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
        </div>
        
        {/* Floating Add Panel Button - ALWAYS VISIBLE */}
        <div className="fixed bottom-4 right-4 z-[9999] pointer-events-auto">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🔍 Floating Add Panel button clicked (empty workspace)!');
              setShowAddMenu(true);
            }}
            className="w-12 h-12 bg-electric/90 hover:bg-electric text-midnight-900 font-bold 
                       rounded-full shadow-lg hover:shadow-electric/50 transition-all duration-200
                       backdrop-blur-sm border border-electric/30 flex items-center justify-center
                       hover:scale-110 active:scale-95"
            title="Add Panel"
            style={{ 
              background: 'rgb(59, 130, 246)', 
              zIndex: 10000
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          
          {showAddMenu && (
            <div data-add-menu className="absolute bottom-full right-0 mb-2 w-48 bg-midnight-800 border border-midnight-600 rounded-lg shadow-2xl"
                 style={{ 
                   zIndex: 9999, 
                   display: 'block',
                   position: 'absolute',
                   backgroundColor: '#1a1f3a',
                   border: '1px solid #3a3f5a',
                   borderRadius: '8px',
                   padding: '8px',
                   minWidth: '192px'
                 }}>
              <div className="p-1">
                <button
                  onClick={() => {
                    console.log('🔍 Terminal option clicked (floating)!');
                    handleAddTile('terminal');
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-cyan-500/20 transition-colors rounded flex items-center space-x-3"
                  style={{ width: '100%', padding: '8px 12px', textAlign: 'left', color: 'white', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <div className="w-2 h-2 rounded-full bg-cyan-500" />
                  <span>Terminal</span>
                </button>
                <button
                  onClick={() => {
                    console.log('🔍 Chat option clicked (floating)!');
                    handleAddTile('chat');
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-purple-500/20 transition-colors rounded flex items-center space-x-3"
                  style={{ width: '100%', padding: '8px 12px', textAlign: 'left', color: 'white', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>Team Chat</span>
                </button>
                <button
                  onClick={() => {
                    console.log('🔍 Preview option clicked (floating)!');
                    handleAddTile('preview');
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-green-500/20 transition-colors rounded flex items-center space-x-3"
                  style={{ width: '100%', padding: '8px 12px', textAlign: 'left', color: 'white', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={() => {
                    console.log('🔍 Code Editor option clicked (floating)!');
                    handleAddTile('ide');
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-orange-500/20 transition-colors rounded flex items-center space-x-3"
                  style={{ width: '100%', padding: '8px 12px', textAlign: 'left', color: 'white', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <div className="w-2 h-2 rounded-full bg-orange-500" />
                  <span>Code Editor</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }


  console.log('🔍 Rendering workspace with tiles, floating Add Panel button should be visible');
  
  return (
    <div 
      ref={workspaceRef}
      className={`relative h-full bg-midnight-900 ${className}`}
      style={{ minHeight: '100vh' }} // Use full viewport height
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* React Grid Layout */}
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        onLayoutChange={handleLayoutChange}
        breakpoints={{lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0}}
        cols={{lg: 12, md: 12, sm: 12, xs: 12, xxs: 12}}
        rowHeight={60}
        margin={[8, 8]}
        containerPadding={[16, 16]}
        isDraggable={true}
        isResizable={true}
        useCSSTransforms={true}
        compactType="vertical"
        preventCollision={false}
        draggableHandle=".grid-tile-handle"
      >
        {tiles.map((tile) => (
          <div key={tile.id} className="bg-midnight-800 rounded-lg border border-midnight-600 overflow-hidden">
            <TileHeader
              tile={tile}
              onClose={() => onRemoveTile(tile.id)}
              onDetach={() => handleDetach(tile.id)}
            />
            <div className="h-full overflow-hidden" style={{ height: 'calc(100% - 2rem)' }}>
              {renderTile(tile)}
            </div>
          </div>
        ))}
      </ResponsiveGridLayout>

      {/* Floating Controls - Bottom Right Corner - ALWAYS VISIBLE */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col space-y-2 pointer-events-none"
           style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 9999 }}>
        {/* Reset Layout Button - BRIGHT RED AND ALWAYS VISIBLE */}
        <button
          onClick={() => {
            // ULTRA AGGRESSIVE RESET - clear ALL layout data
            console.log('🔄 ULTRA RESET: Clearing all layout data...');
            
            // Clear all possible localStorage keys
            localStorage.removeItem('grid-layouts');
            localStorage.removeItem('workspace-tiles'); 
            localStorage.removeItem('tile-order');
            localStorage.removeItem('allotment-sizes');
            localStorage.removeItem('sidebar-width');
            
            // Clear any react-grid-layout related keys
            Object.keys(localStorage).forEach(key => {
              if (key.includes('grid') || key.includes('layout') || key.includes('tile')) {
                localStorage.removeItem(key);
              }
            });
            
            setLayouts({});
            console.log('🔄 ULTRA RESET complete - refreshing...');
            
            // Force immediate page refresh
            window.location.reload();
          }}
          className="w-12 h-12 bg-red-600 hover:bg-red-500 text-white font-bold 
                     rounded-full shadow-2xl hover:shadow-red-500/50 transition-all duration-200
                     backdrop-blur-sm border-2 border-red-400 flex items-center justify-center
                     pointer-events-auto hover:scale-110 active:scale-95"
          title="🔄 RESET VIEW - Clear all panels and layout"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        
        <div className="relative pointer-events-auto">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🔍 Floating Add Panel button clicked!');
              toggleAddMenu();
            }}
            className="w-12 h-12 bg-electric/90 hover:bg-electric text-midnight-900 font-bold 
                       rounded-full shadow-lg hover:shadow-electric/50 transition-all duration-200
                       backdrop-blur-sm border border-electric/30 flex items-center justify-center
                       hover:scale-110 active:scale-95"
            title="Add Panel"
            style={{ 
              background: 'rgb(59, 130, 246)', 
              zIndex: 10000,
              position: 'relative'
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          
          {showAddMenu && (
            <div data-add-menu className="absolute bottom-full right-0 mb-2 w-48 bg-midnight-800/95 backdrop-blur-sm 
                            border border-midnight-600 rounded-lg shadow-2xl pointer-events-auto"
                 style={{ zIndex: 9999, display: 'block', visibility: 'visible' }}>
              <div className="p-1">
                <button
                  onClick={() => handleAddTile('terminal')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-cyan-500/20 
                             transition-colors rounded flex items-center space-x-3"
                >
                  <div className="w-2 h-2 rounded-full bg-cyan-500" />
                  <span>Terminal</span>
                </button>
                <button
                  onClick={() => handleAddTile('chat')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-purple-500/20 
                             transition-colors rounded flex items-center space-x-3"
                >
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>Team Chat</span>
                </button>
                <button
                  onClick={() => handleAddTile('preview')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-green-500/20 
                             transition-colors rounded flex items-center space-x-3"
                >
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={() => handleAddTile('ide')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-orange-500/20 
                             transition-colors rounded flex items-center space-x-3"
                >
                  <div className="w-2 h-2 rounded-full bg-orange-500" />
                  <span>Code Editor</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};