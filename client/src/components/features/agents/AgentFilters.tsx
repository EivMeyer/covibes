import React from 'react'

interface AgentFiltersProps {
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

export const AgentFilters: React.FC<AgentFiltersProps> = ({
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
    <div className="space-y-3">
      {/* Search bar and actions */}
      <div className="flex items-center space-x-2">
        {/* Search input */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search agents..."
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-1.5 pr-8 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
          />
          <svg
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Multi-select toggle */}
        <button
          onClick={onMultiSelectToggle}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            multiSelectMode 
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
              : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:bg-gray-700/50'
          }`}
          title="Toggle multi-select mode (M)"
        >
          <div className="flex items-center space-x-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Select</span>
            {multiSelectMode && selectedCount > 0 && (
              <span className="bg-blue-500/30 px-1 rounded">
                {selectedCount}
              </span>
            )}
          </div>
        </button>

        {/* Batch delete (visible in multi-select mode) */}
        {multiSelectMode && selectedCount > 0 && (
          <button
            onClick={onBatchDelete}
            className="px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-all"
          >
            Delete Selected ({selectedCount})
          </button>
        )}

        {/* Delete all */}
        {totalAgents > 0 && (
          <button
            onClick={onDeleteAll}
            disabled={deletingAll}
            className="px-3 py-1.5 bg-gray-800/50 text-gray-400 border border-gray-700 rounded-lg text-xs font-medium hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all disabled:opacity-50"
          >
            {deletingAll ? (
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                <span>Deleting...</span>
              </div>
            ) : (
              `Clear All (${totalAgents})`
            )}
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1">
        {/* Status filters */}
        <div className="flex items-center space-x-1 bg-gray-800/30 rounded-lg p-0.5">
          {(['all', 'running', 'starting', 'completed', 'failed'] as const).map(status => (
            <button
              key={status}
              onClick={() => onStatusChange(status)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                statusFilter === status
                  ? status === 'running' ? 'bg-green-500/20 text-green-400' :
                    status === 'starting' ? 'bg-yellow-500/20 text-yellow-400' :
                    status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                    status === 'failed' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-700 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Owner filters */}
        <div className="flex items-center space-x-1 bg-gray-800/30 rounded-lg p-0.5">
          {(['all', 'mine', 'team'] as const).map(owner => (
            <button
              key={owner}
              onClick={() => onOwnerChange(owner)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                ownerFilter === owner
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {owner === 'all' ? 'All Agents' : owner === 'mine' ? 'My Agents' : 'Team Agents'}
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as any)}
            className="appearance-none bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-1 pr-8 text-xs text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 cursor-pointer"
          >
            <option value="activity">Sort by Activity</option>
            <option value="name">Sort by Name</option>
            <option value="runtime">Sort by Runtime</option>
            <option value="status">Sort by Status</option>
          </select>
          <svg
            className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="text-[10px] text-gray-600 flex items-center space-x-3">
        <div className="flex items-center space-x-1">
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">1-9</kbd>
          <span>Quick open</span>
        </div>
        {multiSelectMode && (
          <>
            <div className="flex items-center space-x-1">
              <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">Ctrl+A</kbd>
              <span>Select all</span>
            </div>
            <div className="flex items-center space-x-1">
              <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">Del</kbd>
              <span>Delete selected</span>
            </div>
            <div className="flex items-center space-x-1">
              <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">Esc</kbd>
              <span>Exit select</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}