import React, { useState, useCallback, useEffect, useRef } from 'react'
import GridLayout, {
  Layout,
  Responsive,
  WidthProvider,
} from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import type { GridTile } from '@/types'

const ResponsiveGridLayout = WidthProvider(Responsive)

interface DynamicDashboardProps {
  tiles: GridTile[]
  onAddTile: (type: GridTile['type']) => void
  onRemoveTile: (id: string) => void
  renderTile: (tile: GridTile) => React.ReactNode
  activeDrags?: Map<string, { draggedBy: string; position?: { x: number; y: number } }>
  onDragStart?: (tileId: string, position?: { x: number; y: number }) => void
  onDragMove?: (tileId: string, position: { x: number; y: number }) => void
  onDragStop?: (tileId: string, finalPosition?: { x: number; y: number; w: number; h: number }) => void
  onTileAdd?: (type: string, title: string, position?: { x: number; y: number; w: number; h: number }) => void
  onTileRemove?: (tileId: string) => void
}

interface DashboardLayout extends Layout {
  i: string
}

export const DynamicDashboard: React.FC<DynamicDashboardProps> = ({
  tiles,
  onAddTile,
  onRemoveTile,
  renderTile,
  activeDrags = new Map(),
  onDragStart,
  onDragMove,
  onDragStop,
  onTileAdd,
  onTileRemove,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolling, setIsScrolling] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [showScrollIndicator, setShowScrollIndicator] = useState(false)
  const dashboardRef = useRef<HTMLDivElement>(null)
  const scrollIndicatorRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [layouts, setLayouts] = useState<{ lg: DashboardLayout[] }>(() => {
    // Try to load saved layout from localStorage
    const savedLayouts = localStorage.getItem('dashboard-layouts')
    if (savedLayouts) {
      try {
        const parsed = JSON.parse(savedLayouts)
        return parsed
      } catch (e) {
        console.error('🔍 [DYNAMIC DASHBOARD] Failed to parse saved layouts:', e)
      }
    }
    return { lg: [] }
  })

  // Track which tiles we've seen to avoid regenerating layouts
  const [seenTiles, setSeenTiles] = useState<Set<string>>(new Set())

  // Listen for workspace layout updates from team members
  useEffect(() => {
    const handleWorkspaceLayoutsUpdated = (event: CustomEvent) => {
      setLayouts(event.detail || { lg: [] });
    };

    window.addEventListener('workspace-layouts-updated', handleWorkspaceLayoutsUpdated as EventListener);
    
    return () => {
      window.removeEventListener('workspace-layouts-updated', handleWorkspaceLayoutsUpdated as EventListener);
    };
  }, []);

  // Only add layouts for genuinely new tiles - FIXED: Split into separate effects to prevent infinite loops
  useEffect(() => {
    const newTiles = tiles.filter(tile => !seenTiles.has(tile.id))

    if (newTiles.length > 0) {
      const newLayouts: DashboardLayout[] = newTiles.map((tile, index) => {
        const defaultLayouts: Record<GridTile['type'], Partial<DashboardLayout>> = {
          agent: { w: 5, h: 10, minW: 3, minH: 6 },
          terminal: { w: 6, h: 12, minW: 3, minH: 6 },
          chat: { w: 4, h: 10, minW: 3, minH: 4 },
          preview: { w: 6, h: 8, minW: 3, minH: 4 },
          ide: { w: 8, h: 10, minW: 4, minH: 5 },
          agentchat: { w: 5, h: 10, minW: 3, minH: 6 },
        }

        const tileDefaults = defaultLayouts[tile.type] || {
          w: 4,
          h: 6,
          minW: 2,
          minH: 3,
        }

        return {
          i: tile.id,
          x: (index % 3) * 4,
          y: Math.floor(index / 3) * 6,
          ...tileDefaults,
        }
      })

      setLayouts(prev => ({
        ...prev,
        lg: [...(prev.lg || []), ...newLayouts],
      }))

      // Mark these tiles as seen
      setSeenTiles(prev => new Set([...prev, ...newTiles.map(t => t.id)]))
    }
  }, [tiles, seenTiles])

  // Separate effect for cleanup to prevent circular dependencies
  useEffect(() => {
    const currentTileIds = new Set(tiles.map(t => t.id))
    const currentLayouts = layouts.lg || []
    const layoutsToKeep = currentLayouts.filter(layout => currentTileIds.has(layout.i))

    // Only update layouts if there are actually layouts to remove
    if (layoutsToKeep.length !== currentLayouts.length) {
      setLayouts(prev => ({
        ...prev,
        lg: layoutsToKeep,
      }))
    }

    // Remove from seen tiles if they no longer exist
    const currentSeenTiles = [...seenTiles]
    const seenTilesToKeep = currentSeenTiles.filter(id => currentTileIds.has(id))

    // Only update seenTiles if there are actually tiles to remove
    if (seenTilesToKeep.length !== currentSeenTiles.length) {
      setSeenTiles(new Set(seenTilesToKeep))
    }
  }, [tiles.length, layouts.lg]) // Use tiles.length to avoid infinite loops

  // Save layout changes to localStorage and trigger parent save
  const handleLayoutChange = (currentLayout: Layout[], allLayouts: any) => {
    
    // Save to localStorage for immediate use
    localStorage.setItem('dashboard-layouts', JSON.stringify(allLayouts))
    
    // Also trigger parent save to database if available
    if ((window as any).saveWorkspaceLayouts) {
      (window as any).saveWorkspaceLayouts(allLayouts);
    } else {
      console.warn('🎯 saveWorkspaceLayouts not available on window');
    }
  }

  // Collaborative drag event handlers
  const handleDragStart = (layout: Layout[], oldItem: Layout, newItem: Layout, placeholder: Layout, e: MouseEvent, element: HTMLElement) => {
    onDragStart?.(newItem.i, { x: newItem.x, y: newItem.y });
  }

  const handleDrag = (layout: Layout[], oldItem: Layout, newItem: Layout, placeholder: Layout, e: MouseEvent, element: HTMLElement) => {
    onDragMove?.(newItem.i, { x: newItem.x, y: newItem.y });
  }

  const handleDragStop = (layout: Layout[], oldItem: Layout, newItem: Layout, placeholder: Layout, e: MouseEvent, element: HTMLElement) => {
    onDragStop?.(newItem.i, { x: newItem.x, y: newItem.y, w: newItem.w, h: newItem.h });
  }

  // Collaborative tile management wrapper functions
  const handleAddTileWithCollab = (type: GridTile['type']) => {
    // Get the tile title for the type
    const tileNames: Record<GridTile['type'], string> = {
      agent: 'Agent',
      terminal: 'Agent Terminal',
      chat: 'Team Chat',
      preview: 'Preview',
      ide: 'Code Editor',
      agentchat: 'Agent Chat'
    };
    
    const title = tileNames[type] || 'Unknown';
    
    // Emit collaborative event
    onTileAdd?.(type, title);
    
    // Call original handler
    onAddTile(type);
  }

  const handleRemoveTileWithCollab = useCallback((tileId: string) => {
    // Emit collaborative event
    onTileRemove?.(tileId);

    // Call original handler
    onRemoveTile(tileId);
  }, [onTileRemove, onRemoveTile]);

  const menuItems = [
    {
      type: 'agent' as GridTile['type'],
      label: 'Agent',
      icon: '⚡',
      description: 'AI assistant for terminal & chat',
      color: 'from-blue-500 to-purple-600',
    },
    {
      type: 'chat' as GridTile['type'],
      label: 'Chat',
      icon: '💬',
      description: 'Team collaboration',
      color: 'from-purple-500 to-purple-600',
    },
    {
      type: 'preview' as GridTile['type'],
      label: 'Preview',
      icon: '🌐',
      description: 'Live preview window',
      color: 'from-green-500 to-green-600',
    },
    {
      type: 'ide' as GridTile['type'],
      label: 'IDE',
      icon: '📝',
      description: 'Code editor',
      color: 'from-blue-500 to-blue-600',
    },
  ]

  const handleAddTile = (type: GridTile['type']) => {
    handleAddTileWithCollab(type)
    setIsMenuOpen(false)
  }

  // Custom styles for the grid
  const gridStyles = `
    /* Grid Layout */
    .react-grid-layout {
      position: relative;
      min-height: 100%;
    }
    
    /* Custom Scrollbar for Dashboard Container */
    .dashboard-container {
      scrollbar-width: thin;
      scrollbar-color: rgba(59, 130, 246, 0.8) rgba(30, 41, 59, 0.3);
    }
    
    .dashboard-container::-webkit-scrollbar {
      width: 12px;
    }
    
    .dashboard-container::-webkit-scrollbar-track {
      background: linear-gradient(180deg, rgba(30, 41, 59, 0.2) 0%, rgba(51, 65, 85, 0.3) 100%);
      border-radius: 8px;
      margin: 8px 0;
      border: 1px solid rgba(51, 65, 85, 0.2);
    }
    
    .dashboard-container::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, rgba(59, 130, 246, 0.9) 0%, rgba(29, 78, 216, 0.8) 50%, rgba(99, 102, 241, 0.9) 100%);
      border-radius: 8px;
      border: 1px solid rgba(59, 130, 246, 0.3);
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
      transition: all 0.3s ease;
    }
    
    .dashboard-container::-webkit-scrollbar-thumb:hover {
      background: linear-gradient(180deg, rgba(59, 130, 246, 1) 0%, rgba(29, 78, 216, 0.9) 50%, rgba(99, 102, 241, 1) 100%);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
      transform: scaleX(1.1);
    }
    
    .dashboard-container::-webkit-scrollbar-thumb:active {
      background: linear-gradient(180deg, rgba(147, 197, 253, 1) 0%, rgba(59, 130, 246, 1) 50%, rgba(79, 70, 229, 1) 100%);
      box-shadow: 0 6px 16px rgba(59, 130, 246, 0.6);
    }
    
    .dashboard-container::-webkit-scrollbar-corner {
      background: rgba(30, 41, 59, 0.2);
    }
    
    /* Scrollbar glow effect when scrolling */
    .dashboard-container.scrolling::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, rgba(59, 130, 246, 1) 0%, rgba(29, 78, 216, 1) 50%, rgba(99, 102, 241, 1) 100%);
      box-shadow: 0 0 20px rgba(59, 130, 246, 0.8), 0 0 40px rgba(59, 130, 246, 0.4);
      animation: scrollbarPulse 1.5s ease-in-out;
    }
    
    @keyframes scrollbarPulse {
      0% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.8), 0 0 40px rgba(59, 130, 246, 0.4); }
      50% { box-shadow: 0 0 30px rgba(59, 130, 246, 1), 0 0 60px rgba(59, 130, 246, 0.6); }
      100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.8), 0 0 40px rgba(59, 130, 246, 0.4); }
    }
    
    /* Scroll Position Indicator */
    .scroll-indicator {
      position: fixed;
      top: 50%;
      right: 4px;
      transform: translateY(-50%);
      width: 4px;
      height: 60px;
      background: rgba(59, 130, 246, 0.2);
      border-radius: 2px;
      z-index: 1000;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    
    .scroll-indicator.visible {
      opacity: 1;
    }
    
    .scroll-indicator::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: var(--scroll-progress, 0%);
      background: linear-gradient(180deg, rgba(59, 130, 246, 1) 0%, rgba(99, 102, 241, 1) 100%);
      border-radius: 2px;
      box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
      transition: height 0.1s ease-out;
    }
    
    /* Grid Items */
    .react-grid-item {
      transition: all 200ms ease;
      transition-property: left, top, width, height;
      border-radius: 0.75rem;
      overflow: hidden;
      background: rgb(30 41 59);
      border: 1px solid rgb(51 65 85);
    }
    
    .react-grid-item.cssTransforms {
      transition-property: transform, width, height;
    }
    
    .react-grid-item.resizing {
      transition: none;
      z-index: 100;
      border-color: rgb(59 130 246);
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
    }
    
    .react-grid-item.react-draggable-dragging {
      transition: none;
      z-index: 100;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      border-color: rgb(59 130 246);
      opacity: 0.9;
    }
    
    .react-grid-item > .react-resizable-handle {
      position: absolute;
      width: 20px;
      height: 20px;
    }
    
    .react-grid-item > .react-resizable-handle::after {
      content: "";
      position: absolute;
      right: 3px;
      bottom: 3px;
      width: 8px;
      height: 8px;
      border-right: 2px solid rgba(255, 255, 255, 0.3);
      border-bottom: 2px solid rgba(255, 255, 255, 0.3);
      transition: all 0.2s ease;
    }
    
    .react-grid-item:hover > .react-resizable-handle::after {
      border-color: rgba(59, 130, 246, 0.8);
      width: 10px;
      height: 10px;
    }
    
    .react-grid-placeholder {
      background: linear-gradient(135deg, rgb(59 130 246 / 0.2) 0%, rgb(147 51 234 / 0.2) 100%);
      border-radius: 0.75rem;
      border: 2px dashed rgb(59 130 246 / 0.5);
      transition-duration: 100ms;
      z-index: 2;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      -o-user-select: none;
      user-select: none;
    }
  `

  // Handle scroll events for fancy scrollbar effects
  useEffect(() => {
    const dashboardElement = dashboardRef.current
    if (!dashboardElement) return

    const handleScroll = () => {
      setIsScrolling(true)
      
      // Calculate scroll progress
      const { scrollTop, scrollHeight, clientHeight } = dashboardElement
      const maxScroll = scrollHeight - clientHeight
      const progress = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0
      
      setScrollProgress(progress)
      
      // Show indicator when there's content to scroll and we're scrolling
      setShowScrollIndicator(maxScroll > 10)
      
      // Update scroll progress CSS custom property
      if (scrollIndicatorRef.current) {
        scrollIndicatorRef.current.style.setProperty('--scroll-progress', `${progress}%`)
      }
      
      // Clear any existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      
      // Set timeout to remove scrolling class after scrolling stops
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false)
        setShowScrollIndicator(false)
      }, 2000) // Remove glow effect 2 seconds after scrolling stops
    }

    dashboardElement.addEventListener('scroll', handleScroll)
    
    return () => {
      dashboardElement.removeEventListener('scroll', handleScroll)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])


  useEffect(() => {
    // Add custom styles to document
    const styleElement = document.createElement('style')
    styleElement.innerHTML = gridStyles
    document.head.appendChild(styleElement)

    return () => {
      document.head.removeChild(styleElement)
    }
  }, [])

  // Safety check for tiles data integrity
  if (!tiles || !Array.isArray(tiles)) {
    console.error('🚨 [DYNAMIC DASHBOARD] Invalid tiles data:', tiles)
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center space-y-4">
          <div className="text-red-400 text-xl">⚠️ Data Error</div>
          <div className="text-white">Invalid workspace data. Please refresh the page.</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }

  // Empty state
  if (tiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">
              Welcome to Your Dashboard
            </h2>
            <p className="text-gray-400">
              Start building your workspace by adding components
            </p>
          </div>
          <button
            onClick={() => setIsMenuOpen(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105"
          >
            Add Your First Component
          </button>
        </div>

        {/* Always show the Floating Add Button */}
        <AddButton
          isMenuOpen={isMenuOpen}
          setIsMenuOpen={setIsMenuOpen}
          menuItems={menuItems}
          handleAddTile={handleAddTile}
          tiles={tiles}
          onRemoveTile={onRemoveTile}
        />
      </div>
    )
  }

  return (
    <div 
      ref={dashboardRef}
      className={`min-h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 dashboard-container ${isScrolling ? 'scrolling' : ''}`}
      style={{ paddingBottom: '200px' }}
    >
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        onLayoutChange={handleLayoutChange}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragStop={handleDragStop}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={30}
        isDraggable={true}
        isResizable={true}
        draggableHandle=".drag-handle"
        compactType={null}
        preventCollision={true}
        margin={[4, 4]}
        isDroppable={false}
      >
        {tiles?.filter(tile => tile && typeof tile === 'object' && tile.id && !Array.isArray(tile)).map((tile) => {
          // Find the layout for this tile from the current breakpoint (lg)
          const layoutItem = layouts.lg?.find((l) => l.i === tile.id)

          // Check if this tile is being dragged by a team member
          const activeDrag = activeDrags.get(tile.id)
          const isBeingDragged = !!activeDrag
          
          return (
            <div 
              key={tile.id} 
              data-grid={layoutItem}
              className={isBeingDragged ? 'collaborative-drag-active' : ''}
            >
              <div 
                className={`h-full flex flex-col ${isBeingDragged ? 'ring-2 ring-blue-500 ring-opacity-75' : ''}`}
                data-testid={`${tile.type}-tile`}
              >
                {/* Tile Header */}
                <div
                  className={`px-4 py-2 flex items-center justify-between border-b border-slate-700 flex-shrink-0 ${
                    isBeingDragged ? 'bg-blue-900 border-blue-600' : 'bg-slate-800'
                  }`}
                  style={{ minHeight: '44px', zIndex: 100 }}
                >
                  <div className="drag-handle flex items-center gap-2 cursor-move flex-1 py-1">
                    <span className="text-sm font-medium text-white">
                      {tile.title}
                    </span>
                    <span className="text-xs text-gray-400">({tile.type})</span>
                    {isBeingDragged && (
                      <span className="text-xs text-blue-300 bg-blue-800 px-2 py-1 rounded-full animate-pulse">
                        Being moved by teammate
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="text-gray-400 hover:text-gray-200 transition-colors p-1 hover:bg-slate-700/50 rounded"
                      title="Drag to move"
                      tabIndex={-1}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h16M4 12h16M4 18h16"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleRemoveTileWithCollab(tile.id)
                      }}
                      className="text-red-400 hover:text-red-200 hover:bg-red-500/20 transition-all duration-200 p-1.5 rounded-md border border-transparent hover:border-red-400/30"
                      title={`Close ${tile.title}`}
                      type="button"
                      style={{ zIndex: 1000 }}
                      data-testid="close-tile-button"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Tile Content */}
                <div className="flex-1 overflow-hidden">{renderTile(tile)}</div>
              </div>
            </div>
          )
        })}
      </ResponsiveGridLayout>

      {/* Floating Add Button */}
      <AddButton
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        menuItems={menuItems}
        handleAddTile={handleAddTile}
        tiles={tiles}
        onRemoveTile={onRemoveTile}
      />
      
      {/* Scroll Progress Indicator */}
      <div 
        ref={scrollIndicatorRef}
        className={`scroll-indicator ${showScrollIndicator ? 'visible' : ''}`}
        style={{ '--scroll-progress': `${scrollProgress}%` } as React.CSSProperties}
      />
    </div>
  )
}

// Enhanced Add Button Component with Reset and Stylish Design
const AddButton: React.FC<{
  isMenuOpen: boolean
  setIsMenuOpen: (open: boolean) => void
  menuItems: any[]
  handleAddTile: (type: GridTile['type']) => void
  tiles: GridTile[]
  onRemoveTile: (id: string) => void
}> = ({
  isMenuOpen,
  setIsMenuOpen,
  menuItems,
  handleAddTile,
  tiles,
  onRemoveTile,
}) => {
  const menuRef = React.useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [setIsMenuOpen])

  // Close menu on escape key
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [setIsMenuOpen])

  const enhancedMenuItems = menuItems.map((item) => ({
    ...item,
    color: `text-${item.type === 'terminal' ? 'cyan' : item.type === 'chat' ? 'purple' : item.type === 'preview' ? 'green' : 'blue'}-400 bg-${item.type === 'terminal' ? 'cyan' : item.type === 'chat' ? 'purple' : item.type === 'preview' ? 'green' : 'blue'}-600/10 hover:bg-${item.type === 'terminal' ? 'cyan' : item.type === 'chat' ? 'purple' : item.type === 'preview' ? 'green' : 'blue'}-600/20 border-${item.type === 'terminal' ? 'cyan' : item.type === 'chat' ? 'purple' : item.type === 'preview' ? 'green' : 'blue'}-600/30`,
  }))

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
      ref={menuRef}
    >
      {/* Reset Button */}
      {tiles.length > 0 && (
        <button
          onClick={() => {
            // Clear all tiles
            tiles.forEach((tile) => {
              // Just call the prop function directly
              onRemoveTile(tile.id);
            })
          }}
          className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group hover:scale-110"
          title="Clear workspace"
        >
          <svg
            className="w-5 h-5 transition-transform duration-300 group-hover:rotate-12"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      )}

      {/* Dropdown Menu */}
      {isMenuOpen && (
        <div className="absolute bottom-16 right-0 mb-2 min-w-[300px] bg-midnight-800/95 backdrop-blur-xl border border-midnight-600/50 rounded-2xl shadow-2xl p-3 animate-in slide-in-from-bottom-2 duration-200">
          <div className="p-2 text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-midnight-600/30 mb-2">
            ✨ Add Component
          </div>
          <div className="space-y-2">
            {enhancedMenuItems.map((item) => (
              <button
                key={item.type}
                onClick={() => handleAddTile(item.type)}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border transition-all duration-300 group hover:scale-[1.02] ${item.color}`}
                data-testid={`add-${item.type}-panel`}
              >
                <div className="flex-shrink-0 text-xl group-hover:scale-110 transition-transform duration-300">
                  {item.icon}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-white group-hover:text-white/90 transition-colors">
                    {item.label}
                  </div>
                  <div className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
                    {item.description}
                  </div>
                </div>
                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-0 translate-x-2">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-midnight-600/30">
            <button
              onClick={() => {
                localStorage.removeItem('dashboard-layouts')
                window.location.reload()
              }}
              className="w-full text-xs text-gray-400 hover:text-red-400 transition-colors py-2 hover:bg-red-500/10 rounded-lg"
            >
              Reset Layout to Default
            </button>
          </div>
        </div>
      )}

      {/* Stylish + Button with enhanced effects */}
      <div className="relative">
        {/* Animated ring effect */}
        <div
          className={`absolute inset-0 rounded-full bg-gradient-to-r from-electric via-blue-500 to-electric opacity-75 ${isMenuOpen ? 'animate-pulse' : ''}`}
          style={{
            filter: 'blur(8px)',
            animation: isMenuOpen ? 'none' : 'spin 6s linear infinite',
          }}
        />

        {/* Glowing ring */}
        <div className="absolute -inset-1 bg-gradient-to-r from-electric to-blue-500 rounded-full opacity-40 blur-sm animate-pulse" />

        {/* Main button */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`relative w-16 h-16 bg-gradient-to-r from-electric via-blue-500 to-electric text-white rounded-full shadow-2xl transition-all duration-500 flex items-center justify-center group overflow-hidden ${
            isMenuOpen
              ? 'rotate-45 scale-110 shadow-electric/50'
              : 'hover:scale-115 hover:shadow-electric/30'
          }`}
          data-testid="add-panel-button"
          style={{
            background: isMenuOpen
              ? 'linear-gradient(135deg, #3b82f6, #1d4ed8, #3b82f6)'
              : 'linear-gradient(135deg, #3b82f6, #1d4ed8, #6366f1)',
            boxShadow: isMenuOpen
              ? '0 0 40px rgba(59, 130, 246, 0.6), 0 0 80px rgba(59, 130, 246, 0.3)'
              : '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

          <svg
            className={`w-7 h-7 transition-all duration-500 z-10 ${isMenuOpen ? 'scale-90' : 'group-hover:scale-110'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      </div>

      {/* Enhanced background blur when menu is open */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] -z-10 transition-all duration-300" />
      )}
    </div>
  )
}
