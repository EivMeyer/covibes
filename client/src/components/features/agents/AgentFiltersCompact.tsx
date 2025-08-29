import React from 'react'

interface AgentFiltersCompactProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  statusFilter: 'all' | 'running' | 'completed' | 'failed' | 'starting'
  onStatusChange: (status: 'all' | 'running' | 'completed' | 'failed' | 'starting') => void
  ownerFilter: 'all' | 'mine' | 'team'
  onOwnerChange: (owner: 'all' | 'mine' | 'team') => void
  sortBy: 'activity' | 'name' | 'runtime' | 'status'
  onSortChange: (sort: 'activity' | 'name' | 'runtime' | 'status') => void
  totalAgents: number
  onMultiSelectToggle: () => void
  multiSelectMode: boolean
  selectedCount: number
  onBatchDelete: () => void
  onDeleteAll: () => void
  deletingAll: boolean
}

export const AgentFiltersCompact: React.FC<AgentFiltersCompactProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  ownerFilter,
  onOwnerChange,
  sortBy,
  onSortChange,
  totalAgents,
  onMultiSelectToggle,
  multiSelectMode,
  selectedCount,
  onBatchDelete,
  onDeleteAll,
  deletingAll,
}) => {
  return (
    <div className="space-y-1">
      {/* Compact search and action bar */}
      <div className="flex items-center space-x-1">
        {/* Search - more compact */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search..."
            className="w-full bg-gray-800/30 border border-gray-700/50 rounded px-2 py-0.5 pr-6 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/30"
          />
          <svg
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Multi-select toggle - smaller */}
        <button
          onClick={onMultiSelectToggle}
          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
            multiSelectMode 
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
              : 'bg-gray-800/30 text-gray-500 border border-gray-700/50 hover:text-gray-400'
          }`}
          title="Multi-select (M)"
        >
          {multiSelectMode && selectedCount > 0 ? `${selectedCount} selected` : 'Select'}
        </button>

        {/* Batch delete - only show when needed */}
        {multiSelectMode && selectedCount > 0 && (
          <button
            onClick={onBatchDelete}
            className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-[10px] font-medium hover:bg-red-500/20"
          >
            Delete
          </button>
        )}

        {/* Clear all - minimal */}
        {totalAgents > 0 && !multiSelectMode && (
          <button
            onClick={onDeleteAll}
            disabled={deletingAll}
            className="px-2 py-0.5 text-[10px] text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
            title={`Clear all ${totalAgents} agents`}
          >
            {deletingAll ? '...' : 'Clear'}
          </button>
        )}
      </div>

      {/* Minimal filter bar */}
      <div className="flex items-center space-x-1 text-[10px]">
        {/* Status filter - ultra compact */}
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value as any)}
          className="appearance-none bg-gray-800/20 border border-gray-700/30 rounded px-1.5 py-0.5 pr-4 text-gray-400 focus:outline-none cursor-pointer"
        >
          <option value="all">All</option>
          <option value="running">Running</option>
          <option value="starting">Starting</option>
          <option value="completed">Done</option>
          <option value="failed">Failed</option>
        </select>

        {/* Owner filter - ultra compact */}
        <select
          value={ownerFilter}
          onChange={(e) => onOwnerChange(e.target.value as any)}
          className="appearance-none bg-gray-800/20 border border-gray-700/30 rounded px-1.5 py-0.5 pr-4 text-gray-400 focus:outline-none cursor-pointer"
        >
          <option value="all">Everyone</option>
          <option value="mine">Mine</option>
          <option value="team">Team</option>
        </select>

        {/* Sort - ultra compact */}
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as any)}
          className="appearance-none bg-gray-800/20 border border-gray-700/30 rounded px-1.5 py-0.5 pr-4 text-gray-400 focus:outline-none cursor-pointer"
        >
          <option value="activity">Activity</option>
          <option value="name">Name</option>
          <option value="runtime">Runtime</option>
          <option value="status">Status</option>
        </select>

        <div className="flex-1" />
        
        {/* Shortcut hints - very minimal */}
        <span className="text-gray-600">
          {multiSelectMode ? 'Ctrl+A • Del • Esc' : '1-9 quick open'}
        </span>
      </div>
    </div>
  )
}