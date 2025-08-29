import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { AgentCardCompact } from './AgentCardCompact'
import { AgentFiltersCompact } from './AgentFiltersCompact'
import { useNotification } from '@/components/ui/Notification'
import { apiService } from '@/services/api'
import type { AgentDetails } from '@/types'

interface AgentListV2Props {
  agents: any[]
  agentsLoading: boolean
  killAgent: (agentId: string) => Promise<void>
  user?: { id: string; name: string; email: string }
  onViewOutput?: (agent: AgentDetails) => void
  onDragAgent?: (agent: AgentDetails) => void
  className?: string
  socket?: any
}

type FilterStatus = 'all' | 'running' | 'completed' | 'failed' | 'starting'
type FilterOwner = 'all' | 'mine' | 'team'
type SortBy = 'activity' | 'name' | 'runtime' | 'status'

export const AgentListV2: React.FC<AgentListV2Props> = ({
  agents,
  agentsLoading,
  killAgent,
  user,
  onViewOutput,
  onDragAgent,
  className = '',
  socket,
}) => {
  const { addNotification } = useNotification()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [ownerFilter, setOwnerFilter] = useState<FilterOwner>('all')
  const [sortBy, setSortBy] = useState<SortBy>('activity')
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set())
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [pinnedAgents] = useState<Set<string>>(new Set())
  const [deletingAll, setDeletingAll] = useState(false)
  
  // Metrics state for real-time updates
  const [agentMetrics, setAgentMetrics] = useState<Map<string, any>>(new Map())

  // Group agents by ownership
  const { myAgents, teamAgents } = useMemo(() => {
    const my: any[] = []
    const team: any[] = []
    
    agents.forEach(agent => {
      if (agent.userId === user?.id) {
        my.push(agent)
      } else {
        team.push(agent)
      }
    })
    
    return { myAgents: my, teamAgents: team }
  }, [agents, user?.id])

  // Apply filters and sorting
  const filterAndSortAgents = useCallback((agentList: any[]) => {
    let filtered = [...agentList]
    
    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(agent => 
        agent.agentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.task?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.userName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(agent => agent.status === statusFilter)
    }
    
    // Sort
    filtered.sort((a, b) => {
      // Pinned agents always first
      const aPinned = pinnedAgents.has(a.id)
      const bPinned = pinnedAgents.has(b.id)
      if (aPinned && !bPinned) return -1
      if (!aPinned && bPinned) return 1
      
      switch (sortBy) {
        case 'activity':
          return new Date(b.lastActivity || b.startedAt).getTime() - 
                 new Date(a.lastActivity || a.startedAt).getTime()
        case 'name':
          return (a.agentName || '').localeCompare(b.agentName || '')
        case 'runtime':
          return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
        case 'status':
          const statusOrder = { running: 0, starting: 1, completed: 2, failed: 3, killed: 4 }
          return (statusOrder[a.status as keyof typeof statusOrder] || 99) - 
                 (statusOrder[b.status as keyof typeof statusOrder] || 99)
        default:
          return 0
      }
    })
    
    return filtered
  }, [searchQuery, statusFilter, sortBy, pinnedAgents])

  const filteredMyAgents = useMemo(() => 
    ownerFilter === 'team' ? [] : filterAndSortAgents(myAgents),
    [myAgents, ownerFilter, filterAndSortAgents]
  )
  
  const filteredTeamAgents = useMemo(() => 
    ownerFilter === 'mine' ? [] : filterAndSortAgents(teamAgents),
    [teamAgents, ownerFilter, filterAndSortAgents]
  )

  // Toggle section collapse
  const toggleSection = (section: string) => {
    const newCollapsed = new Set(collapsedSections)
    if (newCollapsed.has(section)) {
      newCollapsed.delete(section)
    } else {
      newCollapsed.add(section)
    }
    setCollapsedSections(newCollapsed)
  }

  // Handle multi-select
  const handleSelectAgent = (agentId: string, selected: boolean) => {
    const newSelected = new Set(selectedAgents)
    if (selected) {
      newSelected.add(agentId)
    } else {
      newSelected.delete(agentId)
    }
    setSelectedAgents(newSelected)
  }

  // Handle batch operations
  const handleBatchDelete = async () => {
    if (selectedAgents.size === 0) return
    
    const confirmMessage = `Delete ${selectedAgents.size} selected agents?`
    if (!confirm(confirmMessage)) return
    
    try {
      await Promise.all(Array.from(selectedAgents).map(id => killAgent(id)))
      addNotification({
        message: `Deleted ${selectedAgents.size} agents`,
        type: 'success',
      })
      setSelectedAgents(new Set())
      setMultiSelectMode(false)
    } catch (error) {
      addNotification({
        message: 'Failed to delete some agents',
        type: 'error',
      })
    }
  }

  // Handle delete all
  const handleDeleteAll = async () => {
    if (agents.length === 0) return
    
    const confirmMessage = `Delete all ${agents.length} agents?`
    if (!confirm(confirmMessage)) return
    
    setDeletingAll(true)
    try {
      const response = await apiService.deleteAllAgents()
      addNotification({
        message: `Deleted ${response.deletedCount} agents`,
        type: 'success',
      })
    } catch (error) {
      addNotification({
        message: 'Failed to delete agents',
        type: 'error',
      })
    } finally {
      setDeletingAll(false)
    }
  }


  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl+A - Select all visible
      if (e.ctrlKey && e.key === 'a' && multiSelectMode) {
        e.preventDefault()
        const allIds = [...filteredMyAgents, ...filteredTeamAgents].map(a => a.id)
        setSelectedAgents(new Set(allIds))
      }
      
      // Delete - Delete selected
      if (e.key === 'Delete' && selectedAgents.size > 0) {
        e.preventDefault()
        handleBatchDelete()
      }
      
      // Escape - Exit multi-select
      if (e.key === 'Escape' && multiSelectMode) {
        setMultiSelectMode(false)
        setSelectedAgents(new Set())
      }
      
      // 1-9 - Quick open agent
      if (!e.ctrlKey && !e.altKey && !e.shiftKey && /^[1-9]$/.test(e.key)) {
        const index = parseInt(e.key) - 1
        const allAgents = [...filteredMyAgents, ...filteredTeamAgents]
        if (allAgents[index]) {
          onViewOutput?.(allAgents[index])
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [multiSelectMode, selectedAgents, filteredMyAgents, filteredTeamAgents])

  // Listen for metrics updates via socket
  useEffect(() => {
    if (!socket) return
    
    const handleMetricsUpdate = (data: any) => {
      setAgentMetrics(prev => {
        const newMetrics = new Map(prev)
        newMetrics.set(data.agentId, data.metrics)
        return newMetrics
      })
    }
    
    socket.on('agent_metrics', handleMetricsUpdate)
    return () => {
      socket.off('agent_metrics', handleMetricsUpdate)
    }
  }, [socket])

  if (agentsLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-10 bg-gray-700/30 rounded-lg mb-4" />
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-700/20 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col space-y-4 ${className}`}>
      {/* Header with filters and actions */}
      <div className="space-y-3">
        <AgentFiltersCompact
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          ownerFilter={ownerFilter}
          onOwnerChange={setOwnerFilter}
          sortBy={sortBy}
          onSortChange={setSortBy}
          totalAgents={agents.length}
          onMultiSelectToggle={() => {
            setMultiSelectMode(!multiSelectMode)
            setSelectedAgents(new Set())
          }}
          multiSelectMode={multiSelectMode}
          selectedCount={selectedAgents.size}
          onBatchDelete={handleBatchDelete}
          onDeleteAll={handleDeleteAll}
          deletingAll={deletingAll}
        />
      </div>

      {/* Empty state */}
      {agents.length === 0 ? (
        <div className="text-center py-6 px-3">
          <div className="w-10 h-10 bg-gray-800/30 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-gray-400 text-xs font-medium">No agents running</div>
          <div className="text-gray-500 text-[10px]">Click "New Agent" to start</div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Your Agents Section */}
          {filteredMyAgents.length > 0 && (
            <div className="space-y-0.5">
              <button
                onClick={() => toggleSection('my-agents')}
                className="flex items-center justify-between w-full px-2 py-1 hover:bg-gray-800/30 rounded transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <svg 
                    className={`w-3 h-3 text-gray-400 transition-transform ${
                      collapsedSections.has('my-agents') ? '' : 'rotate-90'
                    }`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-sm font-semibold text-blue-400">Your Agents</span>
                  <span className="text-xs text-gray-500">({filteredMyAgents.length})</span>
                </div>
              </button>
              
              {!collapsedSections.has('my-agents') && (
                <div className="space-y-0.5">
                  {filteredMyAgents.map((agent, index) => (
                    <AgentCardCompact
                      key={agent.id}
                      agent={agent}
                      isOwner={true}
                      index={index + 1}
                      isPinned={pinnedAgents.has(agent.id)}
                      isSelected={selectedAgents.has(agent.id)}
                      multiSelectMode={multiSelectMode}
                      metrics={agentMetrics.get(agent.id)}
                      onSelect={(selected) => handleSelectAgent(agent.id, selected)}
                      onViewOutput={() => onViewOutput?.(agent)}
                      onDragAgent={() => onDragAgent?.(agent)}
                      onKillAgent={() => killAgent(agent.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Team Agents Section */}
          {filteredTeamAgents.length > 0 && (
            <div className="space-y-0.5">
              <button
                onClick={() => toggleSection('team-agents')}
                className="flex items-center justify-between w-full px-2 py-1 hover:bg-gray-800/30 rounded transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <svg 
                    className={`w-3 h-3 text-gray-400 transition-transform ${
                      collapsedSections.has('team-agents') ? '' : 'rotate-90'
                    }`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-sm font-semibold text-gray-300">Team Agents</span>
                  <span className="text-xs text-gray-500">({filteredTeamAgents.length})</span>
                </div>
              </button>
              
              {!collapsedSections.has('team-agents') && (
                <div className="space-y-0.5">
                  {filteredTeamAgents.map((agent, index) => (
                    <AgentCardCompact
                      key={agent.id}
                      agent={agent}
                      isOwner={false}
                      index={filteredMyAgents.length + index + 1}
                      isPinned={pinnedAgents.has(agent.id)}
                      isSelected={selectedAgents.has(agent.id)}
                      multiSelectMode={multiSelectMode}
                      metrics={agentMetrics.get(agent.id)}
                      onSelect={(selected) => handleSelectAgent(agent.id, selected)}
                      onViewOutput={() => onViewOutput?.(agent)}
                      onDragAgent={() => onDragAgent?.(agent)}
                      onKillAgent={() => killAgent(agent.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}