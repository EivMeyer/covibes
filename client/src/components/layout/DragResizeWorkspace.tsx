import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Allotment } from 'allotment';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import type { 
  DragEndEvent,
  DragStartEvent 
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import 'allotment/dist/style.css';
import type { GridTile } from './WorkspaceGrid';

interface DragResizeWorkspaceProps {
  tiles: GridTile[];
  onAddTile: (type: GridTile['type'], agentId?: string, terminalId?: string) => void;
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

// Sortable tile header component
const SortableTileHeader: React.FC<{
  tile: GridTile;
  onClose: () => void;
  onMaximize: () => void;
  onDetach?: () => void;
  isMaximized?: boolean;
}> = ({ tile, onClose, onMaximize, onDetach, isMaximized }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tile.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const colorScheme = getColorScheme(tile.type);

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`
        relative h-8 bg-gradient-to-r ${colorScheme.bg} 
        backdrop-blur-sm border-b ${colorScheme.border}
        transition-all duration-300 group
        ${isDragging ? 'opacity-50 z-50' : ''}
      `}
    >
      {/* Content */}
      <div className="relative flex items-center justify-between h-full px-3">
        {/* Left side - Drag handle, indicator and Title */}
        <div className="flex items-center space-x-3">
          {/* Drag Handle */}
          <div 
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-white/10 rounded transition-colors"
            title="Drag to reorder"
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
          
          {/* Maximize/Restore */}
          <button
            onClick={onMaximize}
            className="p-1 hover:bg-white/10 rounded transition-colors"
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

export const DragResizeWorkspace: React.FC<DragResizeWorkspaceProps> = ({
  tiles,
  onAddTile,
  onRemoveTile,
  renderTile,
  className = ''
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [maximizedTile, setMaximizedTile] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tileOrder, setTileOrder] = useState<string[]>([]);
  const [sizes, setSizes] = useState<number[]>([]);
  const allotmentRef = useRef<any>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize tile order
  useEffect(() => {
    if (tiles.length > 0 && tileOrder.length !== tiles.length) {
      const savedOrder = localStorage.getItem('tile-order');
      let newOrder = tiles.map(tile => tile.id);
      
      if (savedOrder) {
        try {
          const parsed = JSON.parse(savedOrder);
          if (Array.isArray(parsed)) {
            // Reorder based on saved order, add new tiles at end
            const orderedIds = parsed.filter(id => tiles.some(t => t.id === id));
            const newIds = tiles.filter(t => !parsed.includes(t.id)).map(t => t.id);
            newOrder = [...orderedIds, ...newIds];
          }
        } catch (e) {
          // Use default order
        }
      }
      
      setTileOrder(newOrder);
    }
  }, [tiles, tileOrder.length]);

  // Initialize sizes
  useEffect(() => {
    if (tiles.length > 0 && sizes.length !== tiles.length) {
      const savedSizes = localStorage.getItem('allotment-sizes');
      let newSizes = tiles.map(() => 100 / tiles.length);
      
      if (savedSizes) {
        try {
          const parsed = JSON.parse(savedSizes);
          if (Array.isArray(parsed) && parsed.length === tiles.length) {
            newSizes = parsed;
          }
        } catch (e) {
          // Use default sizes
        }
      }
      
      setSizes(newSizes);
    }
  }, [tiles.length, sizes.length]);

  // Get ordered tiles
  const orderedTiles = useMemo(() => {
    if (tileOrder.length === 0) return tiles;
    
    return tileOrder
      .map(id => tiles.find(tile => tile.id === id))
      .filter(tile => tile !== undefined) as GridTile[];
  }, [tiles, tileOrder]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = tileOrder.indexOf(active.id as string);
      const newIndex = tileOrder.indexOf(over?.id as string);

      const newOrder = arrayMove(tileOrder, oldIndex, newIndex);
      setTileOrder(newOrder);
      localStorage.setItem('tile-order', JSON.stringify(newOrder));
    }

    setActiveId(null);
  };

  const handleAddTile = (type: GridTile['type']) => {
    console.log('DragResizeWorkspace: handleAddTile called with type:', type);
    onAddTile(type);
    setShowAddMenu(false);
  };

  const toggleAddMenu = () => {
    console.log('DragResizeWorkspace: toggleAddMenu - current showAddMenu:', showAddMenu);
    setShowAddMenu(!showAddMenu);
    console.log('DragResizeWorkspace: toggleAddMenu - new showAddMenu:', !showAddMenu);
  };

  const handleMaximize = (tileId: string) => {
    if (maximizedTile === tileId) {
      setMaximizedTile(null);
    } else {
      setMaximizedTile(tileId);
    }
  };

  const handleDetach = useCallback((tileId: string) => {
    onAddTile('detach-agent', undefined, tileId);
  }, [onAddTile]);

  const handleSizeChange = (newSizes: number[]) => {
    setSizes(newSizes);
    localStorage.setItem('allotment-sizes', JSON.stringify(newSizes));
  };

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
          const emptyTerminal = orderedTiles.find(tile => tile.type === 'terminal' && !tile.agentId);
          
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
  }, [onAddTile, orderedTiles]);

  if (orderedTiles.length === 0) {
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
          <div className="relative inline-block">
            <button
              onClick={toggleAddMenu}
              className="px-4 py-2 bg-electric hover:bg-electric/80 text-midnight-900 font-medium rounded-lg transition-colors"
            >
              Add Panel
            </button>
            
            {showAddMenu && (
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-48 bg-midnight-800/95 backdrop-blur-sm 
                              border border-midnight-600 rounded-lg shadow-2xl z-50">
                <div className="p-1">
                <button
                  onClick={() => handleAddTile('terminal')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-cyan-500/20 transition-colors rounded flex items-center space-x-3"
                >
                  <div className="w-2 h-2 rounded-full bg-cyan-500" />
                  <span>Terminal</span>
                </button>
                <button
                  onClick={() => handleAddTile('chat')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-purple-500/20 transition-colors rounded flex items-center space-x-3"
                >
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>Team Chat</span>
                </button>
                <button
                  onClick={() => handleAddTile('preview')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-green-500/20 transition-colors rounded flex items-center space-x-3"
                >
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={() => handleAddTile('ide')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-orange-500/20 transition-colors rounded flex items-center space-x-3"
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
  }

  return (
    <div 
      ref={workspaceRef}
      className={`relative h-full bg-midnight-900 overflow-visible ${className}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={tileOrder} strategy={horizontalListSortingStrategy}>
          <Allotment 
            ref={allotmentRef}
            onChange={handleSizeChange}
          >
            {orderedTiles.map((tile) => (
              <Allotment.Pane key={tile.id} minSize={100}>
                <div className="h-full flex flex-col bg-midnight-800">
                  <SortableTileHeader
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
        </SortableContext>

        <DragOverlay>
          {activeId ? (
            <div className="opacity-75 bg-midnight-800 rounded shadow-lg">
              {(() => {
                const activeTile = orderedTiles.find(tile => tile.id === activeId);
                return activeTile ? (
                  <div className="p-4 text-white">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${getColorScheme(activeTile.type).indicator}`} />
                      <span className="text-sm font-medium">{activeTile.title}</span>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Floating Add Panel Button - Bottom Right Corner */}
      <div className="absolute bottom-4 right-4 z-40">
        <div className="relative">
          <button
            onClick={toggleAddMenu}
            className="w-12 h-12 bg-electric/90 hover:bg-electric text-midnight-900 font-bold 
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
                            border border-midnight-600 rounded-lg shadow-2xl z-50">
              <div className="p-1">
                <button
                  onClick={() => handleAddTile('terminal')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-cyan-500/20 transition-colors rounded flex items-center space-x-3"
                >
                  <div className="w-2 h-2 rounded-full bg-cyan-500" />
                  <span>Terminal</span>
                </button>
                <button
                  onClick={() => handleAddTile('chat')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-purple-500/20 transition-colors rounded flex items-center space-x-3"
                >
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>Team Chat</span>
                </button>
                <button
                  onClick={() => handleAddTile('preview')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-green-500/20 transition-colors rounded flex items-center space-x-3"
                >
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={() => handleAddTile('ide')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-orange-500/20 transition-colors rounded flex items-center space-x-3"
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