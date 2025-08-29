import React, { useRef, useEffect, useState, useCallback } from 'react';
import Muuri from 'muuri';
import type { GridTile } from './WorkspaceGrid';

interface MuuriWorkspaceProps {
  tiles: GridTile[];
  onAddTile: (type: GridTile['type'], agentId?: string) => void;
  onRemoveTile: (id: string) => void;
  renderTile: (tile: GridTile) => React.ReactNode;
  className?: string;
}

// ULTRA-INTELLIGENT MUURI CONFIGURATION
const MUURI_CONFIG = {
  // Layout algorithm with intelligent placement
  layout: {
    fillGaps: true,        // Fill gaps intelligently 
    horizontal: false,     // Vertical flow (top to bottom)
    alignRight: false,     // Left alignment preferred
    alignBottom: false,    // Top alignment preferred
    rounding: false        // Exact positioning
  },
  
  // Intelligent sorting for new items
  sortData: {
    priority: function(item: any) {
      const element = item.getElement();
      const type = element.dataset.tileType;
      
      // Priority order: chat > preview > terminal > ide
      const priorities = { chat: 100, preview: 90, terminal: 80, ide: 70 };
      return priorities[type as keyof typeof priorities] || 50;
    },
    
    size: function(item: any) {
      const element = item.getElement();
      return element.offsetWidth * element.offsetHeight;
    }
  },
  
  // Drag & drop configuration
  dragEnabled: true,
  dragSort: true,
  dragContainer: document.body,
  dragStartPredicate: {
    distance: 10,
    delay: 100
  },
  
  // Performance optimizations
  dragPlaceholder: {
    enabled: true,
    duration: 200,
    createElement: function() {
      const element = document.createElement('div');
      element.className = 'muuri-placeholder bg-electric/20 border-2 border-dashed border-electric rounded-lg';
      return element;
    }
  },
  
  // Responsive behavior
  rounding: false,
  showOnInit: true,
  showDuration: 200,
  hideDuration: 200,
  visibleLayout: {
    fillGaps: true
  },
  
  // Container settings
  containerClass: 'muuri-container',
  itemClass: 'muuri-item',
  itemVisibleClass: 'muuri-item-shown',
  itemHiddenClass: 'muuri-item-hidden',
  itemPositioningClass: 'muuri-item-positioning',
  itemDraggingClass: 'muuri-item-dragging',
  itemReleasingClass: 'muuri-item-releasing'
};

export const MuuriWorkspace: React.FC<MuuriWorkspaceProps> = ({
  tiles,
  onAddTile,
  onRemoveTile,
  renderTile,
  className = '',
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const muuriRef = useRef<Muuri | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Initialize Muuri grid
  useEffect(() => {
    if (!gridRef.current) return;

    // Create Muuri instance with intelligent configuration
    muuriRef.current = new Muuri(gridRef.current, MUURI_CONFIG);

    // Add event listeners for intelligent behavior
    muuriRef.current.on('add', () => {
      // Re-sort items intelligently after adding
      muuriRef.current?.sort('priority size', { layout: 'instant' });
    });

    muuriRef.current.on('remove', () => {
      // Refresh layout after removal to fill gaps
      muuriRef.current?.refreshItems().layout();
    });

    return () => {
      muuriRef.current?.destroy();
    };
  }, []);

  // Sync tiles with Muuri grid
  useEffect(() => {
    if (!muuriRef.current || !gridRef.current) return;

    const grid = muuriRef.current;
    const container = gridRef.current;

    // Get current items
    const currentItems = grid.getItems();
    const currentIds = currentItems.map(item => item.getElement()?.dataset.tileId).filter(Boolean);
    const newIds = tiles.map(tile => tile.id);

    // Remove items that no longer exist
    const itemsToRemove = currentItems.filter(item => {
      const tileId = item.getElement()?.dataset.tileId;
      return tileId && !newIds.includes(tileId);
    });
    
    if (itemsToRemove.length > 0) {
      grid.remove(itemsToRemove, { layout: false });
    }

    // Add new items
    const itemsToAdd: HTMLElement[] = [];
    tiles.forEach(tile => {
      if (!currentIds.includes(tile.id)) {
        const element = createTileElement(tile);
        container.appendChild(element);
        itemsToAdd.push(element);
      }
    });

    if (itemsToAdd.length > 0) {
      grid.add(itemsToAdd, { layout: false });
    }

    // Intelligent layout refresh
    grid.refreshItems().layout();
  }, [tiles]);

  // Create DOM element for a tile
  const createTileElement = (tile: GridTile): HTMLElement => {
    const element = document.createElement('div');
    element.className = 'muuri-item';
    element.dataset.tileId = tile.id;
    element.dataset.tileType = tile.type;
    
    // Intelligent sizing based on tile type
    const sizes = {
      terminal: { width: 600, height: 400 },  // Large for productivity
      chat: { width: 300, height: 250 },      // Compact but usable
      preview: { width: 400, height: 300 },   // Medium for viewing
      ide: { width: 500, height: 350 }        // Large for coding
    };
    
    const size = sizes[tile.type] || sizes.chat;
    element.style.width = `${size.width}px`;
    element.style.height = `${size.height}px`;
    
    // Create inner container for the tile content
    const inner = document.createElement('div');
    inner.className = 'muuri-item-content bg-midnight-800 rounded-lg overflow-hidden shadow-card border border-midnight-600 flex flex-col h-full';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'muuri-item-header cursor-move p-2 bg-midnight-700 border-b border-midnight-600 flex items-center justify-between';
    
    const titleSection = document.createElement('div');
    titleSection.className = 'flex items-center space-x-2';
    
    const titleSpan = document.createElement('span');
    titleSpan.className = 'text-sm font-medium text-white';
    
    const emoji = {
      terminal: '🖥️',
      chat: '💬', 
      preview: '👁️',
      ide: '💻'
    }[tile.type] || '📄';
    
    titleSpan.textContent = `${emoji} ${tile.title}`;
    titleSection.appendChild(titleSpan);
    header.appendChild(titleSection);
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'p-1 text-gray-400 hover:text-red-400 transition-colors';
    closeButton.innerHTML = `
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    `;
    closeButton.onclick = (e) => {
      e.stopPropagation();
      onRemoveTile(tile.id);
    };
    header.appendChild(closeButton);
    
    // Create content area
    const content = document.createElement('div');
    content.className = 'muuri-tile-content flex-1 overflow-hidden';
    
    inner.appendChild(header);
    inner.appendChild(content);
    element.appendChild(inner);
    
    return element;
  };

  // Render React content into Muuri tiles
  useEffect(() => {
    if (!muuriRef.current) return;

    const items = muuriRef.current.getItems();
    
    items.forEach(item => {
      const element = item.getElement();
      const tileId = element?.dataset.tileId;
      const tile = tiles.find(t => t.id === tileId);
      
      if (tile && element) {
        const contentDiv = element.querySelector('.muuri-tile-content');
        if (contentDiv) {
          // Clear previous content
          contentDiv.innerHTML = '';
          
          // Create a container for React content
          const reactContainer = document.createElement('div');
          reactContainer.className = 'h-full w-full';
          contentDiv.appendChild(reactContainer);
          
          // We'll use a portal or ref callback to render React content
          // For now, add a placeholder
          reactContainer.innerHTML = `
            <div class="flex items-center justify-center h-full text-gray-400 text-sm">
              ${tile.type} content will be rendered here
            </div>
          `;
        }
      }
    });
  }, [tiles]);

  const handleAddTile = (type: GridTile['type']) => {
    onAddTile(type);
    setShowAddMenu(false);
  };

  const resetLayout = () => {
    if (confirm('Reset workspace layout? This will reorganize all tiles intelligently.')) {
      muuriRef.current?.sort('priority size').layout();
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

        {/* Smart Organize */}
        <button
          onClick={resetLayout}
          className="px-3 py-1.5 bg-midnight-600 hover:bg-midnight-500 text-white text-sm rounded transition-colors"
          title="Reorganize tiles intelligently"
        >
          🧠 Smart Organize
        </button>
      </div>

      {/* Muuri Grid Container */}
      <div 
        ref={gridRef}
        className="muuri-container p-4 min-h-full"
        style={{ position: 'relative' }}
      />

      {/* Empty State */}
      {tiles.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-gray-500 text-lg">Your workspace is empty</div>
            <div className="text-gray-600 text-sm">Click "Add Tile" to get started with intelligent placement</div>
          </div>
        </div>
      )}

      {/* Muuri Styles */}
      <style jsx>{`
        .muuri-item {
          position: absolute;
          display: block;
          margin: 5px;
          z-index: 1;
        }
        
        .muuri-item.muuri-item-dragging {
          z-index: 3;
        }
        
        .muuri-item.muuri-item-releasing {
          z-index: 2;
        }
        
        .muuri-item.muuri-item-hidden {
          z-index: 0;
        }
        
        .muuri-placeholder {
          position: absolute;
          z-index: 2;
          pointer-events: none;
        }
        
        .muuri-item-content {
          transition: transform 200ms ease;
        }
        
        .muuri-item-header {
          cursor: move;
        }
        
        .muuri-item-header:active {
          cursor: grabbing;
        }
      `}</style>
    </div>
  );
};