import React, { useState, useCallback, useEffect } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

export interface GridTile {
  id: string;
  type: 'terminal' | 'chat' | 'preview' | 'ide'; // NO AGENTS TYPE!
  agentId?: string | undefined; // For terminal tiles - explicit undefined for exactOptionalPropertyTypes
  title: string;
  minimized?: boolean | undefined; // Explicit undefined for exactOptionalPropertyTypes
}

interface WorkspaceGridProps {
  tiles: GridTile[];
  onAddTile: (type: GridTile['type'], agentId?: string) => void;
  onRemoveTile: (id: string) => void;
  renderTile: (tile: GridTile) => React.ReactNode;
  className?: string;
}

// ULTRA-SMART MAGNETIC PLACEMENT ALGORITHM
const getNewTilePosition = (existingLayouts: Layout[], tileId: string, type: GridTile['type']): Layout => {
  const gridCols = 48;
  const VISIBLE_ROWS = 20; // NEVER go below this without trying smaller sizes first
  const MAGNETIC_SNAP = 2; // Grid alignment tolerance
  
  // Base sizes - will be adapted if needed
  let size = type === 'terminal' 
    ? { w: 24, h: 16 } // Terminal: LARGE enough for actual work!
    : { w: 12, h: 8 };  // Others: Small default size

  const minSize = type === 'terminal' 
    ? { minW: 16, minH: 10 } // Terminal: larger minimum for usability
    : { minW: 8, minH: 6 };   // Others: small minimum

  // If no existing tiles, place at origin
  if (existingLayouts.length === 0) {
    return { i: tileId, x: 0, y: 0, ...size, ...minSize };
  }

  // Check collision with magnetic snapping
  const hasCollision = (x: number, y: number, w: number, h: number): boolean => {
    return existingLayouts.some(layout => {
      const leftA = x, rightA = x + w;
      const topA = y, bottomA = y + h;
      const leftB = layout.x, rightB = layout.x + layout.w;
      const topB = layout.y, bottomB = layout.y + layout.h;
      
      return !(rightA <= leftB || leftA >= rightB || bottomA <= topB || topA >= bottomB);
    });
  };

  // MAGNETIC GRID SNAPPING - align to existing tile edges
  const getMagneticPositions = (): Array<{x: number, y: number}> => {
    const positions = new Set<string>();
    
    // Always try origin
    positions.add('0,0');
    
    // Get all edge positions from existing tiles
    existingLayouts.forEach(layout => {
      // Right edge positions
      positions.add(`${layout.x + layout.w},${layout.y}`);
      positions.add(`${layout.x + layout.w},${layout.y + layout.h}`);
      
      // Bottom edge positions  
      positions.add(`${layout.x},${layout.y + layout.h}`);
      positions.add(`${layout.x + layout.w},${layout.y + layout.h}`);
      
      // Aligned positions (same x or y)
      positions.add(`${layout.x},0`);
      positions.add(`0,${layout.y}`);
    });
    
    return Array.from(positions).map(pos => {
      const [x, y] = pos.split(',').map(Number);
      return { x, y };
    }).filter(pos => pos.x >= 0 && pos.y >= 0);
  };

  // TRY DIFFERENT SIZES if needed (adaptive sizing)
  const sizesToTry = [
    size, // Original size
    { w: Math.max(size.w * 0.8, minSize.minW), h: Math.max(size.h * 0.8, minSize.minH) }, // 80%
    { w: Math.max(size.w * 0.6, minSize.minW), h: Math.max(size.h * 0.6, minSize.minH) }, // 60%
    { w: minSize.minW, h: minSize.minH } // Minimum size
  ];

  // PRIORITY 1: Find position in VISIBLE area with magnetic snapping
  for (const testSize of sizesToTry) {
    const magneticPositions = getMagneticPositions();
    
    // Score and sort magnetic positions
    const scoredPositions = magneticPositions
      .filter(pos => 
        pos.x + testSize.w <= gridCols && 
        pos.y + testSize.h <= VISIBLE_ROWS && // STAY IN VISIBLE AREA
        !hasCollision(pos.x, pos.y, testSize.w, testSize.h)
      )
      .map(pos => ({
        ...pos,
        size: testSize,
        score: 1000 - (pos.y * 10 + pos.x * 2) // Strong preference for top-left
      }))
      .sort((a, b) => b.score - a.score);

    if (scoredPositions.length > 0) {
      const best = scoredPositions[0];
      return { 
        i: tileId, 
        x: best.x, 
        y: best.y, 
        w: best.size.w, 
        h: best.size.h, 
        ...minSize 
      };
    }
  }

  // PRIORITY 2: Try to fit in rows above visible area if possible
  for (let y = 0; y < VISIBLE_ROWS; y++) {
    for (let x = 0; x <= gridCols - size.w; x += 2) { // Step by 2 for speed
      if (!hasCollision(x, y, size.w, size.h)) {
        return { i: tileId, x, y, ...size, ...minSize };
      }
    }
  }

  // PRIORITY 3: Compact existing tiles first (push everything up and left)
  const compactedLayouts = [...existingLayouts];
  
  // Sort by position (top-left first)
  compactedLayouts.sort((a, b) => a.y * 100 + a.x - (b.y * 100 + b.x));
  
  // Try to move each tile to a better position
  compactedLayouts.forEach((layout, i) => {
    for (let y = 0; y < layout.y; y++) {
      for (let x = 0; x <= Math.min(layout.x, gridCols - layout.w); x++) {
        const othersExceptCurrent = compactedLayouts.filter((_, idx) => idx !== i);
        if (!hasCollision(x, y, layout.w, layout.h)) {
          layout.x = x;
          layout.y = y;
          break;
        }
      }
    }
  });

  // PRIORITY 4: After compacting, try again in visible area
  for (let y = 0; y < VISIBLE_ROWS; y++) {
    for (let x = 0; x <= gridCols - size.w; x++) {
      if (!hasCollision(x, y, size.w, size.h)) {
        return { i: tileId, x, y, ...size, ...minSize };
      }
    }
  }

  // LAST RESORT: Place in next available spot (may require scrolling)
  const occupiedArea = existingLayouts.reduce((bounds, layout) => ({
    maxX: Math.max(bounds.maxX, layout.x + layout.w),
    maxY: Math.max(bounds.maxY, layout.y + layout.h)
  }), { maxX: 0, maxY: 0 });

  // Try right side first
  if (occupiedArea.maxX + size.w <= gridCols) {
    return { i: tileId, x: occupiedArea.maxX, y: 0, ...size, ...minSize };
  }
  
  // Place below (scrolling required)
  return { i: tileId, x: 0, y: occupiedArea.maxY, ...size, ...minSize };
};

export const WorkspaceGrid: React.FC<WorkspaceGridProps> = ({
  tiles,
  onAddTile,
  onRemoveTile,
  renderTile,
  className = '',
}) => {
  const [layouts, setLayouts] = useState<any>(() => {
    // SIMPLE: All tiles start TOP-LEFT with SAME SMALL SIZE
    const defaultLayouts = {
      lg: [
        { i: 'chat-main', x: 0, y: 0, w: 12, h: 8, minW: 8, minH: 6 },
        { i: 'preview-main', x: 12, y: 0, w: 12, h: 8, minW: 8, minH: 6 }
      ],
      md: [
        { i: 'chat-main', x: 0, y: 0, w: 12, h: 8, minW: 8, minH: 6 },
        { i: 'preview-main', x: 12, y: 0, w: 12, h: 8, minW: 8, minH: 6 }
      ],
      sm: [
        { i: 'chat-main', x: 0, y: 0, w: 12, h: 8, minW: 8, minH: 6 },
        { i: 'preview-main', x: 12, y: 0, w: 12, h: 8, minW: 8, minH: 6 }
      ]
    };
    
    // Load saved layouts from localStorage
    const saved = localStorage.getItem('workspace-layouts');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Invalid saved data, use defaults
      }
    }
    
    // Return defaults if no saved or saved is old/broken
    return defaultLayouts;
  });

  const [showAddMenu, setShowAddMenu] = useState(false);

  // Update layouts when tiles change
  useEffect(() => {
    setLayouts((prevLayouts: any) => {
      const newLayouts = { ...prevLayouts };
      
      // Add layouts for new tiles
      tiles.forEach(tile => {
        ['lg', 'md', 'sm'].forEach(breakpoint => {
          const existing = newLayouts[breakpoint]?.find((l: Layout) => l.i === tile.id);
          if (!existing) {
            const newLayout = getNewTilePosition(newLayouts[breakpoint] || [], tile.id, tile.type);
            if (!newLayouts[breakpoint]) {
              newLayouts[breakpoint] = [];
            }
            newLayouts[breakpoint].push(newLayout);
          }
        });
      });

      // Remove layouts for deleted tiles
      ['lg', 'md', 'sm'].forEach(breakpoint => {
        if (newLayouts[breakpoint]) {
          newLayouts[breakpoint] = newLayouts[breakpoint].filter((l: Layout) => 
            tiles.some(tile => tile.id === l.i)
          );
        }
      });

      return newLayouts;
    });
  }, [tiles]);

  const handleLayoutChange = useCallback((layout: Layout[], layouts: any) => {
    setLayouts(layouts);
    // Save layouts to localStorage
    localStorage.setItem('workspace-layouts', JSON.stringify(layouts));
  }, []);

  const handleAddTile = (type: GridTile['type']) => {
    onAddTile(type);
    setShowAddMenu(false);
  };

  const resetLayout = () => {
    if (confirm('Reset workspace layout? This will clear your saved layout and tiles.')) {
      localStorage.removeItem('workspace-layouts');
      localStorage.removeItem('workspace-tiles');
      window.location.reload();
    }
  };

  return (
    <div className={`w-full h-full relative overflow-auto ${className}`}>
      {/* Workspace Controls */}
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
                className="w-full px-3 py-2 text-left text-sm text-white hover:bg-midnight-700 transition-colors rounded-b-lg"
              >
                💻 Code Editor
              </button>
            </div>
          )}
        </div>

        {/* Reset Layout */}
        <button
          onClick={resetLayout}
          className="px-3 py-1.5 bg-midnight-600 hover:bg-midnight-500 text-white text-sm rounded transition-colors"
          title="Reset workspace layout and tiles"
        >
          ⚡ Reset
        </button>
      </div>

      {/* Grid Layout */}
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        onLayoutChange={handleLayoutChange}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 48, md: 36, sm: 24, xs: 12, xxs: 6 }}
        rowHeight={40}
        margin={[10, 10]}
        containerPadding={[0, 0]}
        isDraggable={true}
        isResizable={true}
        autoSize={false}
        preventCollision={false}
        compactType={null}
        draggableHandle=".grid-tile-handle"
      >
        {tiles.map(tile => (
          <div key={tile.id} className="bg-midnight-800 rounded-lg overflow-hidden shadow-card border border-midnight-600 flex flex-col h-full">
            {/* Tile Header */}
            <div className="grid-tile-handle cursor-move p-2 bg-midnight-700 border-b border-midnight-600 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-white">
                  {tile.type === 'terminal' && '🖥️'}
                  {tile.type === 'chat' && '💬'}
                  {tile.type === 'preview' && '👁️'}
                  {tile.type === 'ide' && '💻'}
                  {' '}
                  {tile.title}
                </span>
              </div>
              
              <div className="flex items-center space-x-1">
                {/* Minimize/Maximize (future feature) */}
                {/* <button
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                  title="Minimize"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button> */}
                
                {/* Close Tile */}
                <button
                  onClick={() => onRemoveTile(tile.id)}
                  className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                  title="Close tile"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Tile Content */}
            <div className="flex-1 overflow-hidden min-h-0" style={{ contain: 'layout style' }}>
              {renderTile(tile)}
            </div>
          </div>
        ))}
      </ResponsiveGridLayout>

      {/* Empty State */}
      {tiles.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-gray-500 text-lg">Your workspace is empty</div>
            <div className="text-gray-600 text-sm">Click "Add Tile" to get started</div>
          </div>
        </div>
      )}
    </div>
  );
};