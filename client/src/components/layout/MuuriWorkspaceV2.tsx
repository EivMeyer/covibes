import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Muuri from 'muuri';
import type { GridTile } from './WorkspaceGrid';

interface MuuriWorkspaceProps {
  tiles: GridTile[];
  onAddTile: (type: GridTile['type'], agentId?: string) => void;
  onRemoveTile: (id: string) => void;
  renderTile: (tile: GridTile) => React.ReactNode;
  className?: string;
}

interface TilePortal {
  id: string;
  container: HTMLElement;
  tile: GridTile;
}

export const MuuriWorkspaceV2: React.FC<MuuriWorkspaceProps> = ({
  tiles,
  onAddTile,
  onRemoveTile,
  renderTile,
  className = '',
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const muuriRef = useRef<Muuri | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [portals, setPortals] = useState<TilePortal[]>([]);

  // ULTRA-SMART MUURI CONFIGURATION
  const initializeMuuri = useCallback(() => {
    if (!gridRef.current || muuriRef.current) return;

    muuriRef.current = new Muuri(gridRef.current, {
      // INTELLIGENT LAYOUT ALGORITHM
      layout: {
        fillGaps: true,        // Fill gaps intelligently 
        horizontal: false,     // Vertical flow preferred
        alignRight: false,     // Left alignment
        alignBottom: false,    // Top alignment
        rounding: false        // Exact positioning
      },
      
      // DRAG & DROP WITH MAGNETISM
      dragEnabled: true,
      dragSort: true,
      dragStartPredicate: {
        distance: 10,
        delay: 100,
        handle: '.tile-drag-handle'
      },
      
      // SMOOTH ANIMATIONS
      dragPlaceholder: {
        enabled: true,
        duration: 200,
        createElement: () => {
          const element = document.createElement('div');
          element.className = 'muuri-placeholder bg-electric/20 border-2 border-dashed border-electric rounded-lg';
          return element;
        }
      },
      
      // PERFORMANCE SETTINGS
      rounding: false,
      showOnInit: true,
      showDuration: 200,
      hideDuration: 200,
      
      // CSS CLASSES
      containerClass: 'muuri-container',
      itemClass: 'muuri-item',
      itemVisibleClass: 'muuri-item-shown',
      itemHiddenClass: 'muuri-item-hidden',
      itemPositioningClass: 'muuri-item-positioning',
      itemDraggingClass: 'muuri-item-dragging',
      itemReleasingClass: 'muuri-item-releasing'
    });

    // INTELLIGENT EVENTS
    muuriRef.current.on('layoutEnd', () => {
      // Save layout state for persistence
      const items = muuriRef.current?.getItems() || [];
      const layout = items.map(item => {
        const element = item.getElement();
        return {
          id: element?.dataset.tileId,
          x: item.getPosition().left,
          y: item.getPosition().top
        };
      });
      localStorage.setItem('muuri-layout', JSON.stringify(layout));
    });

  }, []);

  // Initialize Muuri on mount
  useEffect(() => {
    initializeMuuri();
    
    return () => {
      muuriRef.current?.destroy();
      muuriRef.current = null;
    };
  }, [initializeMuuri]);

  // Create tile element with intelligent sizing
  const createTileElement = useCallback((tile: GridTile): { element: HTMLElement, contentContainer: HTMLElement } => {
    const element = document.createElement('div');
    element.className = 'muuri-item';
    element.dataset.tileId = tile.id;
    element.dataset.tileType = tile.type;
    
    // INTELLIGENT SIZING based on content type
    const sizes = {
      terminal: { width: 600, height: 400, minWidth: 400, minHeight: 300 },
      chat: { width: 350, height: 300, minWidth: 280, minHeight: 200 },
      preview: { width: 450, height: 350, minWidth: 300, minHeight: 250 },
      ide: { width: 550, height: 400, minWidth: 400, minHeight: 300 }
    };
    
    const size = sizes[tile.type] || sizes.chat;
    element.style.width = `${size.width}px`;
    element.style.height = `${size.height}px`;
    element.style.minWidth = `${size.minWidth}px`;
    element.style.minHeight = `${size.minHeight}px`;
    
    // Create main container
    const inner = document.createElement('div');
    inner.className = 'muuri-item-content bg-midnight-800 rounded-lg overflow-hidden shadow-card border border-midnight-600 flex flex-col h-full w-full';
    
    // Create header container (non-draggable)
    const header = document.createElement('div');
    header.className = 'p-2 bg-midnight-700 border-b border-midnight-600 flex items-center justify-between flex-shrink-0';
    
    // Create draggable title section
    const titleSection = document.createElement('div');
    titleSection.className = 'tile-drag-handle cursor-move flex items-center space-x-2 flex-1 py-1';
    
    const titleSpan = document.createElement('span');
    titleSpan.className = 'text-sm font-medium text-white select-none';
    
    const emoji = {
      terminal: '🖥️',
      chat: '💬', 
      preview: '👁️',
      ide: '💻'
    }[tile.type] || '📄';
    
    titleSpan.textContent = `${emoji} ${tile.title}`;
    titleSection.appendChild(titleSpan);
    header.appendChild(titleSection);
    
    // Create control buttons
    const controls = document.createElement('div');
    controls.className = 'flex items-center space-x-1';
    
    // Close button
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
    controls.appendChild(closeButton);
    header.appendChild(controls);
    
    // Create React content container
    const contentContainer = document.createElement('div');
    contentContainer.className = 'tile-react-content flex-1 overflow-hidden min-h-0';
    
    inner.appendChild(header);
    inner.appendChild(contentContainer);
    element.appendChild(inner);
    
    return { element, contentContainer };
  }, [onRemoveTile]);

  // Sync tiles with Muuri and create portals
  useEffect(() => {
    if (!muuriRef.current || !gridRef.current) return;

    const grid = muuriRef.current;
    const container = gridRef.current;

    // Get current state
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

    // Create new portals for new tiles
    const newPortals: TilePortal[] = [];
    const itemsToAdd: HTMLElement[] = [];
    
    tiles.forEach(tile => {
      const existingPortal = portals.find(p => p.id === tile.id);
      
      if (existingPortal) {
        // Update existing portal
        newPortals.push({ ...existingPortal, tile });
      } else if (!currentIds.includes(tile.id)) {
        // Create new tile and portal
        const { element, contentContainer } = createTileElement(tile);
        container.appendChild(element);
        itemsToAdd.push(element);
        
        newPortals.push({
          id: tile.id,
          container: contentContainer,
          tile
        });
      }
    });

    // Add new items to grid
    if (itemsToAdd.length > 0) {
      grid.add(itemsToAdd, { layout: false });
    }

    // Update portals state
    setPortals(newPortals);

    // INTELLIGENT LAYOUT with priority sorting
    const savedLayout = localStorage.getItem('muuri-layout');
    if (savedLayout && currentItems.length === 0) {
      // Restore saved positions
      try {
        const layout = JSON.parse(savedLayout);
        grid.move(layout.map((pos: any) => pos.id));
      } catch (e) {
        // Fallback to smart auto-layout
        grid.sort((a: any, b: any) => {
          const typeA = a.getElement()?.dataset.tileType;
          const typeB = b.getElement()?.dataset.tileType;
          const priority = { chat: 0, preview: 1, terminal: 2, ide: 3 };
          return (priority[typeA as keyof typeof priority] || 9) - (priority[typeB as keyof typeof priority] || 9);
        });
      }
    }

    // Apply intelligent layout
    grid.layout();

  }, [tiles, createTileElement, portals]);

  const handleAddTile = (type: GridTile['type']) => {
    onAddTile(type);
    setShowAddMenu(false);
  };

  const smartOrganize = () => {
    if (!muuriRef.current) return;
    
    // ULTRA-SMART ORGANIZATION
    muuriRef.current.sort((a: any, b: any) => {
      const elementA = a.getElement();
      const elementB = b.getElement();
      const typeA = elementA?.dataset.tileType;
      const typeB = elementB?.dataset.tileType;
      
      // Priority: chat > preview > terminal > ide
      const priority = { chat: 0, preview: 1, terminal: 2, ide: 3 };
      const priorityA = priority[typeA as keyof typeof priority] ?? 9;
      const priorityB = priority[typeB as keyof typeof priority] ?? 9;
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // Secondary sort by size (smaller first for better packing)
      const sizeA = elementA ? elementA.offsetWidth * elementA.offsetHeight : 0;
      const sizeB = elementB ? elementB.offsetWidth * elementB.offsetHeight : 0;
      return sizeA - sizeB;
    });
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
          onClick={smartOrganize}
          className="px-3 py-1.5 bg-midnight-600 hover:bg-midnight-500 text-white text-sm rounded transition-colors"
          title="Organize tiles intelligently with priority placement"
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

      {/* React Portals for tile content */}
      {portals.map(portal => (
        createPortal(
          renderTile(portal.tile),
          portal.container,
          portal.id
        )
      ))}

      {/* Empty State */}
      {tiles.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-gray-500 text-lg">🧠 Intelligent Workspace</div>
            <div className="text-gray-600 text-sm">Click "Add Tile" for AI-powered smart placement</div>
          </div>
        </div>
      )}

      {/* Muuri Styles */}
      <style jsx>{`
        .muuri-item {
          position: absolute;
          display: block;
          margin: 8px;
          z-index: 1;
          transition: transform 0.2s ease;
        }
        
        .muuri-item.muuri-item-dragging {
          z-index: 1000;
          transform: rotate(2deg) scale(1.02);
        }
        
        .muuri-item.muuri-item-releasing {
          z-index: 2;
        }
        
        .muuri-item.muuri-item-hidden {
          z-index: 0;
          opacity: 0;
        }
        
        .muuri-placeholder {
          position: absolute;
          z-index: 2;
          pointer-events: none;
          border-radius: 8px;
        }
        
        .tile-drag-handle {
          cursor: grab;
        }
        
        .tile-drag-handle:active {
          cursor: grabbing;
        }
        
        .muuri-item-content {
          transition: box-shadow 0.2s ease;
        }
        
        .muuri-item.muuri-item-dragging .muuri-item-content {
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
};