import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import type { GridTile } from './WorkspaceGrid';

interface SmartResizableWorkspaceProps {
  tiles: GridTile[];
  onAddTile: (type: GridTile['type'], agentId?: string) => void;
  onRemoveTile: (id: string) => void;
  renderTile: (tile: GridTile) => React.ReactNode;
  className?: string;
}

interface TileLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ULTRA-INTELLIGENT PLACEMENT ALGORITHM
const findOptimalPosition = (
  existingLayouts: TileLayout[],
  tileType: GridTile['type'],
  containerWidth: number,
  containerHeight: number
): { x: number; y: number; width: number; height: number } => {
  
  // INTELLIGENT DEFAULT SIZES based on content type
  const defaultSizes = {
    terminal: { width: 600, height: 400 },
    chat: { width: 350, height: 400 },
    preview: { width: 500, height: 400 },
    ide: { width: 600, height: 450 }
  };
  
  const size = defaultSizes[tileType] || defaultSizes.chat;
  
  // If no existing tiles, place at top-left with smart offset
  if (existingLayouts.length === 0) {
    return { x: 20, y: 20, ...size };
  }
  
  // MAGNETIC GRID POINTS (for snapping)
  const GRID_SIZE = 20;
  const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;
  
  // Check if position overlaps with existing tiles
  const hasCollision = (x: number, y: number, w: number, h: number): boolean => {
    return existingLayouts.some(layout => {
      const overlap = !(
        x + w <= layout.x || 
        x >= layout.x + layout.width ||
        y + h <= layout.y || 
        y >= layout.y + layout.height
      );
      return overlap;
    });
  };
  
  // STRATEGY 1: Find gaps using bin-packing algorithm
  const candidates: Array<{ x: number; y: number; score: number }> = [];
  
  // Scan grid points for optimal placement
  for (let y = 0; y <= containerHeight - size.height; y += GRID_SIZE) {
    for (let x = 0; x <= containerWidth - size.width; x += GRID_SIZE) {
      if (!hasCollision(x, y, size.width, size.height)) {
        let score = 1000;
        
        // Prefer top-left positions
        score -= (y * 2 + x);
        
        // Bonus for aligning with existing tiles
        const alignmentBonus = existingLayouts.reduce((bonus, layout) => {
          if (Math.abs(layout.x - x) < GRID_SIZE) bonus += 50; // Vertical alignment
          if (Math.abs(layout.y - y) < GRID_SIZE) bonus += 50; // Horizontal alignment
          if (Math.abs((layout.x + layout.width) - x) < GRID_SIZE) bonus += 100; // Right edge alignment
          if (Math.abs((layout.y + layout.height) - y) < GRID_SIZE) bonus += 100; // Bottom edge alignment
          return bonus;
        }, 0);
        
        score += alignmentBonus;
        
        // Avoid isolated positions
        const minDistance = Math.min(...existingLayouts.map(layout => {
          const dx = (x + size.width/2) - (layout.x + layout.width/2);
          const dy = (y + size.height/2) - (layout.y + layout.height/2);
          return Math.sqrt(dx * dx + dy * dy);
        }));
        
        if (minDistance < 800 && minDistance > 50) {
          score += 200; // Sweet spot distance
        }
        
        candidates.push({ x: snapToGrid(x), y: snapToGrid(y), score });
      }
    }
  }
  
  // STRATEGY 2: Cascade placement if no gaps found
  if (candidates.length === 0) {
    const cascadeOffset = existingLayouts.length * 30;
    return {
      x: snapToGrid(20 + cascadeOffset),
      y: snapToGrid(20 + cascadeOffset),
      ...size
    };
  }
  
  // Return best candidate
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  
  return { x: best.x, y: best.y, ...size };
};

export const SmartResizableWorkspace: React.FC<SmartResizableWorkspaceProps> = ({
  tiles,
  onAddTile,
  onRemoveTile,
  renderTile,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [layouts, setLayouts] = useState<Record<string, TileLayout>>(() => {
    // Load saved layouts from localStorage
    const saved = localStorage.getItem('smart-workspace-layouts');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    return {};
  });
  
  // Calculate container dimensions
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 800 });
  
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  
  // Initialize layouts for new tiles
  useEffect(() => {
    const newLayouts = { ...layouts };
    let hasChanges = false;
    
    tiles.forEach(tile => {
      if (!newLayouts[tile.id]) {
        const existingLayouts = Object.values(newLayouts);
        const optimalPosition = findOptimalPosition(
          existingLayouts,
          tile.type,
          containerSize.width,
          containerSize.height
        );
        
        newLayouts[tile.id] = {
          id: tile.id,
          ...optimalPosition
        };
        hasChanges = true;
      }
    });
    
    // Remove layouts for deleted tiles
    Object.keys(newLayouts).forEach(id => {
      if (!tiles.find(t => t.id === id)) {
        delete newLayouts[id];
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      setLayouts(newLayouts);
      localStorage.setItem('smart-workspace-layouts', JSON.stringify(newLayouts));
    }
  }, [tiles, containerSize]);
  
  const handleDragStop = useCallback((tileId: string, x: number, y: number) => {
    setLayouts(prev => {
      const updated = {
        ...prev,
        [tileId]: { ...prev[tileId], x, y }
      };
      localStorage.setItem('smart-workspace-layouts', JSON.stringify(updated));
      return updated;
    });
  }, []);
  
  const handleResizeStop = useCallback((
    tileId: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    setLayouts(prev => {
      const updated = {
        ...prev,
        [tileId]: { ...prev[tileId], x, y, width, height }
      };
      localStorage.setItem('smart-workspace-layouts', JSON.stringify(updated));
      return updated;
    });
  }, []);
  
  const handleAddTile = (type: GridTile['type']) => {
    onAddTile(type);
    setShowAddMenu(false);
  };
  
  const smartOrganize = () => {
    const newLayouts: Record<string, TileLayout> = {};
    const tilesByPriority = [...tiles].sort((a, b) => {
      const priority = { chat: 0, preview: 1, terminal: 2, ide: 3 };
      return (priority[a.type] ?? 9) - (priority[b.type] ?? 9);
    });
    
    tilesByPriority.forEach(tile => {
      const existingLayouts = Object.values(newLayouts);
      const optimalPosition = findOptimalPosition(
        existingLayouts,
        tile.type,
        containerSize.width,
        containerSize.height
      );
      
      newLayouts[tile.id] = {
        id: tile.id,
        ...optimalPosition
      };
    });
    
    setLayouts(newLayouts);
    localStorage.setItem('smart-workspace-layouts', JSON.stringify(newLayouts));
  };
  
  const resetLayout = () => {
    if (confirm('Reset workspace layout? This will clear all saved positions and sizes.')) {
      localStorage.removeItem('smart-workspace-layouts');
      setLayouts({});
      // Trigger re-initialization
      window.location.reload();
    }
  };
  
  return (
    <div ref={containerRef} className={`relative w-full h-full overflow-hidden bg-midnight-900 ${className}`}>
      {/* Control Panel */}
      <div className="absolute top-2 right-2 z-50 flex items-center space-x-2">
        {/* Add Tile Menu */}
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="px-3 py-1.5 bg-electric hover:bg-electric/80 text-midnight-900 text-sm font-medium rounded transition-colors flex items-center space-x-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Tile</span>
          </button>
          
          {showAddMenu && (
            <div className="absolute top-full right-0 mt-1 w-48 bg-midnight-800 border border-midnight-600 rounded-lg shadow-xl z-50">
              <button
                onClick={() => handleAddTile('chat')}
                className="w-full px-3 py-2 text-left text-sm text-white hover:bg-midnight-700 transition-colors rounded-t-lg"
              >
                💬 Team Chat
              </button>
              <button
                onClick={() => handleAddTile('preview')}
                className="w-full px-3 py-2 text-left text-sm text-white hover:bg-midnight-700 transition-colors"
              >
                👁️ Preview
              </button>
              <button
                onClick={() => handleAddTile('ide')}
                className="w-full px-3 py-2 text-left text-sm text-white hover:bg-midnight-700 transition-colors"
              >
                💻 Code Editor
              </button>
              <button
                onClick={() => handleAddTile('terminal')}
                className="w-full px-3 py-2 text-left text-sm text-white hover:bg-midnight-700 transition-colors rounded-b-lg"
              >
                🖥️ Terminal
              </button>
            </div>
          )}
        </div>
        
        {/* Smart Organize */}
        <button
          onClick={smartOrganize}
          className="px-3 py-1.5 bg-midnight-600 hover:bg-midnight-500 text-white text-sm rounded transition-colors"
          title="Intelligently reorganize all tiles"
        >
          🧠 Smart Organize
        </button>
        
        {/* Reset Layout */}
        <button
          onClick={resetLayout}
          className="px-3 py-1.5 bg-midnight-700 hover:bg-midnight-600 text-white text-sm rounded transition-colors"
          title="Reset workspace"
        >
          ⚡ Reset
        </button>
      </div>
      
      {/* Resizable Draggable Tiles */}
      {tiles.map(tile => {
        const layout = layouts[tile.id];
        if (!layout) return null;
        
        const emoji = {
          terminal: '🖥️',
          chat: '💬',
          preview: '👁️',
          ide: '💻'
        }[tile.type] || '📄';
        
        return (
          <Rnd
            key={tile.id}
            position={{ x: layout.x, y: layout.y }}
            size={{ width: layout.width, height: layout.height }}
            onDragStop={(e, d) => handleDragStop(tile.id, d.x, d.y)}
            onResizeStop={(e, direction, ref, delta, position) => {
              handleResizeStop(
                tile.id,
                position.x,
                position.y,
                ref.offsetWidth,
                ref.offsetHeight
              );
            }}
            minWidth={200}
            minHeight={150}
            bounds="parent"
            dragGrid={[10, 10]} // Magnetic snapping
            resizeGrid={[10, 10]} // Magnetic resize
            dragHandleClassName="tile-drag-handle"
            enableResizing={{
              top: true,
              right: true,
              bottom: true,
              left: true,
              topRight: true,
              bottomRight: true,
              bottomLeft: true,
              topLeft: true
            }}
            className="group"
          >
            <div className="h-full w-full bg-midnight-800 rounded-lg overflow-hidden shadow-lg border border-midnight-600 flex flex-col group-hover:shadow-xl transition-shadow">
              {/* Tile Header */}
              <div className="p-2 bg-midnight-700 border-b border-midnight-600 flex items-center justify-between">
                <div className="tile-drag-handle cursor-move flex items-center space-x-2 flex-1 py-1">
                  <span className="text-sm font-medium text-white select-none">
                    {emoji} {tile.title}
                  </span>
                </div>
                
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => onRemoveTile(tile.id)}
                    className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Tile Content */}
              <div className="flex-1 overflow-hidden">
                {renderTile(tile)}
              </div>
              
              {/* Resize Handles Visual Indicators */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Corner resize indicators */}
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-electric opacity-0 group-hover:opacity-50 transition-opacity" />
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-electric opacity-0 group-hover:opacity-50 transition-opacity" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-electric opacity-0 group-hover:opacity-50 transition-opacity" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-electric opacity-0 group-hover:opacity-50 transition-opacity" />
                
                {/* Edge resize indicators */}
                <div className="absolute top-1/2 left-0 transform -translate-y-1/2 w-1 h-8 bg-electric opacity-0 group-hover:opacity-30 transition-opacity rounded-r" />
                <div className="absolute top-1/2 right-0 transform -translate-y-1/2 w-1 h-8 bg-electric opacity-0 group-hover:opacity-30 transition-opacity rounded-l" />
                <div className="absolute left-1/2 top-0 transform -translate-x-1/2 h-1 w-8 bg-electric opacity-0 group-hover:opacity-30 transition-opacity rounded-b" />
                <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 h-1 w-8 bg-electric opacity-0 group-hover:opacity-30 transition-opacity rounded-t" />
              </div>
            </div>
          </Rnd>
        );
      })}
      
      {/* Empty State */}
      {tiles.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-gray-500 text-lg">🧠 Intelligent Resizable Workspace</div>
            <div className="text-gray-600 text-sm">
              Click "Add Tile" to start with smart placement
              <br />
              Drag tiles to move • Drag edges to resize
            </div>
          </div>
        </div>
      )}
    </div>
  );
};