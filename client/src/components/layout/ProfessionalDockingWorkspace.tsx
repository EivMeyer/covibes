import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Layout, 
  Model, 
  TabNode, 
  DockLocation,
  Actions
} from 'flexlayout-react';
import type { 
  IJsonModel, 
  ITabSetRenderValues 
} from 'flexlayout-react';
import 'flexlayout-react/style/dark.css';
import type { GridTile } from './WorkspaceGrid';

interface ProfessionalDockingWorkspaceProps {
  tiles: GridTile[];
  onAddTile: (type: GridTile['type'], agentId?: string) => void;
  onRemoveTile: (id: string) => void;
  renderTile: (tile: GridTile) => React.ReactNode;
  className?: string;
}

// PROFESSIONAL DEFAULT LAYOUT - Empty workspace ready for drops
const createDefaultModel = (): IJsonModel => ({
  global: {
    tabEnableRename: true,
    tabEnableClose: true,
    tabEnableFloat: true,
    tabSetEnableMaximize: true,
    tabSetHeaderHeight: 32,
    tabSetTabStripHeight: 32,
    borderBarSize: 5,
    borderEnableAutoHide: false,
    splitterSize: 8,
    splitterExtra: 4
  },
  borders: [],
  layout: {
    type: 'row',
    weight: 100,
    children: [
      {
        type: 'tabset',
        weight: 100,
        selected: 0,
        children: []  // Empty tabset ready to receive drops
      }
    ]
  }
});

export const ProfessionalDockingWorkspace: React.FC<ProfessionalDockingWorkspaceProps> = ({
  tiles,
  onAddTile,
  onRemoveTile,
  renderTile,
  className = ''
}) => {
  const layoutRef = useRef<Layout>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [model, setModel] = useState<Model>(() => {
    // Load saved layout or use default
    const savedLayout = localStorage.getItem('flexlayout-model');
    if (savedLayout) {
      try {
        return Model.fromJson(JSON.parse(savedLayout));
      } catch {
        // Invalid saved layout, use default
      }
    }
    return Model.fromJson(createDefaultModel());
  });
  
  const [tileMap, setTileMap] = useState<Map<string, GridTile>>(new Map());
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  
  // Sync tiles with model
  useEffect(() => {
    const newTileMap = new Map<string, GridTile>();
    tiles.forEach(tile => {
      newTileMap.set(tile.id, tile);
    });
    setTileMap(newTileMap);
    
    // Add new tiles to model
    tiles.forEach(tile => {
      const tabExists = model.visitNodes(node => {
        if (node.getType() === 'tab') {
          const config = node.getConfig();
          if (config && config.tileId === tile.id) {
            return true; // Stop visiting
          }
        }
        return false; // Continue visiting
      });
      
      if (!tabExists) {
        // Add new tab for this tile
        const newTab = {
          type: 'tab',
          name: getTileName(tile),
          component: tile.type,
          config: { tileId: tile.id, tileType: tile.type }
        };
        
        // Find first tabset and add to it
        let added = false;
        model.visitNodes(node => {
          if (!added && node.getType() === 'tabset') {
            model.doAction(Actions.addNode(newTab, node.getId(), DockLocation.CENTER, -1));
            added = true;
          }
        });
        
        // If no tabset exists, create one
        if (!added) {
          const rootNode = model.getRoot();
          if (rootNode) {
            const newTabSet = {
              type: 'tabset',
              children: [newTab]
            };
            model.doAction(Actions.addNode(newTabSet, rootNode.getId(), DockLocation.RIGHT, -1));
          }
        }
      }
    });
    
    // Remove tabs for deleted tiles
    const nodesToDelete: string[] = [];
    model.visitNodes(node => {
      if (node.getType() === 'tab') {
        const config = node.getConfig();
        if (config && config.tileId && !tiles.find(t => t.id === config.tileId)) {
          nodesToDelete.push(node.getId());
        }
      }
    });
    
    nodesToDelete.forEach(nodeId => {
      model.doAction(Actions.deleteTab(nodeId));
    });
    
  }, [tiles, model]);
  
  const getTileName = (tile: GridTile): string => {
    const emoji = {
      terminal: '🖥️',
      chat: '💬',
      preview: '👁️',
      ide: '💻'
    }[tile.type] || '📄';
    
    return `${emoji} ${tile.title}`;
  };
  
  // Factory to create tab content
  const factory = useCallback((node: TabNode) => {
    const config = node.getConfig();
    if (!config || !config.tileId) {
      return <div className="p-4 text-gray-400">Invalid tile configuration</div>;
    }
    
    const tile = tileMap.get(config.tileId);
    if (!tile) {
      // Create a temporary tile for rendering
      const tempTile: GridTile = {
        id: config.tileId,
        type: config.tileType || 'chat',
        title: node.getName() || 'Unknown'
      };
      return (
        <div className="h-full w-full overflow-hidden">
          {renderTile(tempTile)}
        </div>
      );
    }
    
    return (
      <div className="h-full w-full overflow-hidden">
        {renderTile(tile)}
      </div>
    );
  }, [tileMap, renderTile]);
  
  // Handle model changes
  const onModelChange = useCallback(() => {
    // Save layout to localStorage
    const json = model.toJson();
    localStorage.setItem('flexlayout-model', JSON.stringify(json));
  }, [model]);
  
  // Handle tab close
  const onAction = useCallback((action: any) => {
    if (action.type === 'FlexLayout_DeleteTab') {
      const node = model.getNodeById(action.data.node);
      if (node && node.getType() === 'tab') {
        const config = node.getConfig();
        if (config && config.tileId) {
          onRemoveTile(config.tileId);
        }
      }
    }
    return action;
  }, [model, onRemoveTile]);
  
  // Custom tab rendering with close button
  const onRenderTab = useCallback((node: TabNode, renderValues: ITabSetRenderValues) => {
    const config = node.getConfig();
    
    renderValues.content = (
      <div className="flex items-center space-x-2">
        <span>{node.getName()}</span>
      </div>
    );
  }, []);
  
  const handleAddTile = (type: GridTile['type']) => {
    onAddTile(type);
    setShowAddMenu(false);
  };
  
  const resetLayout = () => {
    if (confirm('Reset workspace layout to default?')) {
      localStorage.removeItem('flexlayout-model');
      setModel(Model.fromJson(createDefaultModel()));
    }
  };
  
  const maximizeAll = () => {
    model.visitNodes(node => {
      if (node.getType() === 'tabset') {
        model.doAction(Actions.maximizeToggle(node.getId()));
      }
    });
  };
  
  // Click outside handler for add menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
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
  
  // Handle external drag over the workspace
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);
  
  // Handle external drop (from agent list)
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    
    // Get the data transferred
    const rawData = e.dataTransfer.getData('text/plain');
    
    // Only try to parse if we have data that looks like JSON
    if (rawData && rawData.startsWith('{')) {
      try {
        const data = JSON.parse(rawData);
        console.log('Drop data received:', data);
        
        if (data.type === 'agent' && data.agentId) {
          // First check if we have any tabsets in the model
          let hasTabset = false;
          model.visitNodes(node => {
            if (node.getType() === 'tabset') {
              hasTabset = true;
              return true; // Stop visiting
            }
            return false;
          });
          
          // If no tabset exists, create one first
          if (!hasTabset) {
            console.log('No tabset found, creating one...');
            const rootNode = model.getRoot();
            if (rootNode) {
              const newTabSet = {
                type: 'tabset',
                children: []
              };
              model.doAction(Actions.addNode(newTabSet, rootNode.getId(), DockLocation.CENTER, -1));
            }
          }
          
          // Now add the terminal tile
          console.log('Adding terminal tile for agent:', data.agentId);
          onAddTile('terminal', data.agentId);
        }
      } catch (error) {
        // Silently ignore parsing errors for non-agent drops
        console.debug('Drop data is not valid agent JSON:', rawData);
      }
    }
  }, [onAddTile, model]);
  
  return (
    <div className={`flex flex-col h-full w-full bg-midnight-900 ${className}`}>
      {/* Professional Control Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-midnight-800 border-b border-midnight-600">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-400 font-medium">WORKSPACE</span>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Add Tile Menu */}
          <div className="relative" ref={addMenuRef}>
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="px-2 py-1 bg-electric hover:bg-electric/80 text-midnight-900 text-xs font-medium rounded transition-colors flex items-center space-x-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Panel</span>
            </button>
            
            {showAddMenu && (
              <div className="absolute top-full right-0 mt-1 w-40 bg-midnight-800 border border-midnight-600 rounded shadow-xl z-50">
                <button
                  onClick={() => handleAddTile('terminal')}
                  className="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-midnight-700 transition-colors"
                >
                  🖥️ Terminal
                </button>
                <button
                  onClick={() => handleAddTile('chat')}
                  className="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-midnight-700 transition-colors"
                >
                  💬 Chat
                </button>
                <button
                  onClick={() => handleAddTile('preview')}
                  className="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-midnight-700 transition-colors"
                >
                  👁️ Preview
                </button>
                <button
                  onClick={() => handleAddTile('ide')}
                  className="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-midnight-700 transition-colors rounded-b"
                >
                  💻 Code Editor
                </button>
              </div>
            )}
          </div>
          
          {/* Layout Actions */}
          <button
            onClick={maximizeAll}
            className="p-1 text-gray-400 hover:text-white transition-colors"
            title="Maximize/Restore All"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
            </svg>
          </button>
          
          <button
            onClick={resetLayout}
            className="p-1 text-gray-400 hover:text-white transition-colors"
            title="Reset Layout"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* FlexLayout Container */}
      <div 
        ref={workspaceRef}
        className="flex-1 relative"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <Layout
          ref={layoutRef}
          model={model}
          factory={factory}
          onModelChange={onModelChange}
          onAction={onAction}
          onRenderTab={onRenderTab}
          realtimeResize={true}
        />
        
        {/* Empty state indicator */}
        {tiles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center space-y-4 px-8">
              <div className="text-gray-500 text-lg font-medium">
                Workspace is empty
              </div>
              <div className="text-gray-600 text-sm max-w-md">
                Drag agents from the sidebar or click "Add Panel" to get started
              </div>
              <div className="flex items-center justify-center space-x-2 text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                </svg>
                <span className="text-sm">Drag agents here</span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Custom Styles for Dark Theme */}
      <style jsx global>{`
        .flexlayout__layout {
          background: #0a0a0f !important;
        }
        
        .flexlayout__tabset {
          background: #13131a !important;
          border: 1px solid #2a2a3a !important;
        }
        
        .flexlayout__tabset-header {
          background: #1a1a24 !important;
          border-bottom: 1px solid #2a2a3a !important;
        }
        
        .flexlayout__tab {
          background: #13131a !important;
          color: #a0a0b0 !important;
          border-right: 1px solid #2a2a3a !important;
        }
        
        .flexlayout__tab--selected {
          background: #1f1f2e !important;
          color: #00ff88 !important;
        }
        
        .flexlayout__tab:hover {
          background: #1a1a24 !important;
        }
        
        .flexlayout__tab-button-close {
          color: #666 !important;
        }
        
        .flexlayout__tab-button-close:hover {
          color: #ff4444 !important;
          background: #2a2a3a !important;
        }
        
        .flexlayout__splitter {
          background: #2a2a3a !important;
        }
        
        .flexlayout__splitter:hover {
          background: #00ff88 !important;
          opacity: 0.3;
        }
        
        .flexlayout__splitter--active {
          background: #00ff88 !important;
          opacity: 0.5;
        }
        
        .flexlayout__outline_rect {
          border: 2px solid #00ff88 !important;
        }
        
        .flexlayout__edge_rect {
          background: #00ff88 !important;
          opacity: 0.2;
        }
        
        .flexlayout__tabset-sizer {
          background: #00ff88 !important;
          opacity: 0.3;
        }
        
        .flexlayout__tabset_tabbar_outer {
          background: #13131a !important;
        }
        
        .flexlayout__tabset_header {
          background: #1a1a24 !important;
        }
        
        .flexlayout__border {
          background: #13131a !important;
        }
        
        .flexlayout__drag_rect {
          background: #00ff88 !important;
          opacity: 0.1;
          border: 2px solid #00ff88 !important;
        }
      `}</style>
    </div>
  );
};