import { useState } from 'react'

interface AgentCardCompactProps {
  agent: any
  isOwner: boolean
  index: number
  isPinned: boolean
  isSelected: boolean
  multiSelectMode: boolean
  metrics?: any
  onSelect: (selected: boolean) => void
  onViewOutput: () => void
  onDragAgent: () => void
  onKillAgent: () => void
}

export const AgentCardCompact: React.FC<AgentCardCompactProps> = ({
  agent,
  isOwner,
  index,
  isPinned,
  isSelected,
  multiSelectMode,
  metrics,
  onSelect,
  onViewOutput,
  onDragAgent,
  onKillAgent,
}) => {
  const [isKilling, setIsKilling] = useState(false)
  const [dragState, setDragState] = useState<'idle' | 'dragging'>('idle')

  // Calculate runtime
  const getRuntime = () => {
    if (!agent.startedAt || agent.status !== 'running') return ''
    const start = new Date(agent.startedAt).getTime()
    const now = Date.now()
    const diff = now - start
    const hours = Math.floor(diff / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    
    if (hours > 0) return `${hours}h${minutes}m`
    return `${minutes}m`
  }

  // Get status indicator
  const getStatusIndicator = () => {
    switch (agent.status) {
      case 'running':
        return <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
      case 'starting':
        return <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
      case 'completed':
        return <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
      case 'failed':
        return <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
      default:
        return <div className="w-1.5 h-1.5 bg-gray-500 rounded-full" />
    }
  }

  // Handle drag
  const handleDragStart = (e: React.DragEvent) => {
    setDragState('dragging')
    const dragData = {
      type: 'agent',
      agentId: agent.id,
      agentName: agent.agentName || `${agent.userName}'s Agent`,
      agentType: agent.agentType,
      status: agent.status,
    }
    e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';
    
    // Set global dragged agent for mouse up fallback
    ;(window as any).__draggedAgent = dragData;
    console.log('🚀 AgentCard: Set global dragged agent:', dragData.agentId);
  }

  const handleDragEnd = () => {
    setDragState('idle')
    // Clear global dragged agent
    setTimeout(() => {
      (window as any).__draggedAgent = null
      console.log('🚀 AgentCard: Cleared global dragged agent')
    }, 100)
  }

  // Handle kill agent
  const handleKill = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsKilling(true)
    try {
      await onKillAgent()
    } finally {
      setIsKilling(false)
    }
  }

  // Determine ownership color
  const getOwnershipStyle = () => {
    if (isOwner) {
      return 'border-blue-500/20 hover:border-blue-500/40 bg-blue-500/5'
    }
    return 'border-gray-700/50 hover:border-gray-600 bg-gray-800/20'
  }

  return (
    <div
      draggable={!multiSelectMode}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => !multiSelectMode && onViewOutput()}
      className={`
        group relative flex items-center px-2 py-1 rounded border transition-all cursor-pointer
        ${getOwnershipStyle()}
        ${dragState === 'dragging' ? 'opacity-50' : ''}
        ${isSelected ? 'ring-1 ring-blue-500/50' : ''}
        ${isPinned ? 'bg-blue-500/10' : ''}
        hover:bg-gray-800/30
      `}
    >
      {/* Pin indicator - subtle dot */}
      {isPinned && (
        <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-1 h-3 bg-blue-500 rounded-r" />
      )}

      {/* Multi-select checkbox */}
      {multiSelectMode && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation()
            onSelect(e.target.checked)
          }}
          className="w-3 h-3 rounded border-gray-600 bg-gray-800/50 text-blue-500 mr-2"
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Status indicator */}
      <div className="mr-1.5 flex-shrink-0">
        {getStatusIndicator()}
      </div>

      {/* Agent info - compact single line */}
      <div className="flex-1 min-w-0 flex items-center space-x-2">
        <span className={`text-xs font-medium truncate ${
          isOwner ? 'text-white' : 'text-gray-400'
        }`}>
          {agent.agentName || `Agent ${agent.id.slice(-6)}`}
        </span>
        
        {/* Owner badge for team agents */}
        {!isOwner && (
          <span className="text-[10px] text-gray-500">
            {agent.userName}
          </span>
        )}

        {/* Runtime for running agents */}
        {agent.status === 'running' && (
          <span className="text-[10px] text-gray-600 font-mono">
            {getRuntime()}
          </span>
        )}

        {/* Output count if significant */}
        {agent.outputLines > 100 && (
          <span className="text-[10px] text-gray-600">
            {agent.outputLines > 1000 ? `${(agent.outputLines/1000).toFixed(1)}k` : agent.outputLines}
          </span>
        )}
      </div>

      {/* Minimal actions - only show on hover */}
      <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Quick number indicator */}
        {index <= 9 && !multiSelectMode && (
          <span className="text-[9px] text-gray-600 px-1">
            {index}
          </span>
        )}

        {/* Terminal button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDragAgent()
          }}
          className="p-0.5 text-gray-500 hover:text-white rounded hover:bg-gray-700/50"
          title="Terminal"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>

        {/* Delete button for owners */}
        {isOwner && (
          <button
            onClick={handleKill}
            disabled={isKilling}
            className="p-0.5 text-gray-500 hover:text-red-400 rounded hover:bg-red-500/20"
            title="Delete"
          >
            {isKilling ? (
              <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Subtle activity indicator for running agents */}
      {agent.status === 'running' && metrics?.outputRate?.[metrics.outputRate.length - 1] > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-500/30 to-transparent animate-pulse" />
      )}
    </div>
  )
}