import React, { useState, useMemo } from 'react'
import type { AgentDetails } from '@/types'

interface AgentListMinimalProps {
  agents: any[]
  agentsLoading: boolean
  killAgent: (agentId: string) => Promise<void>
  user?: { id: string; name: string; email: string } | undefined
  onViewOutput?: ((agent: AgentDetails) => void) | undefined
  onDeleteAllAgents?: (() => Promise<void>) | undefined // Explicit undefined for exactOptionalPropertyTypes
  className?: string | undefined
}

interface AgentRowProps {
  agent: any
  isOwner: boolean
  onViewOutput: (() => void) | undefined
  showOwner?: boolean | undefined
}

const AgentRow: React.FC<AgentRowProps> = ({ 
  agent, 
  isOwner, 
  onViewOutput, 
 
  showOwner = false 
}) => {
  const [isHovered, setIsHovered] = useState(false)

  // Get status symbol
  const getStatusSymbol = () => {
    switch (agent.status) {
      case 'running':
        return <span className="text-emerald-400 animate-pulse">●</span>
      case 'starting':
        return <span className="text-amber-400 animate-pulse">◐</span>
      case 'completed':
        return <span className="text-blue-400">✓</span>
      case 'failed':
        return <span className="text-red-400">✗</span>
      default:
        return <span className="text-slate-600">○</span>
    }
  }

  // Get display name
  const getDisplayName = () => {
    if (showOwner && agent.userName) {
      return `${agent.userName} / ${agent.agentName || 'Agent'}`
    }
    return agent.agentName || agent.task?.slice(0, 30) || `Agent ${agent.id.slice(-6)}`
  }

  // Get runtime display
  const getRuntime = () => {
    if (agent.status !== 'running' || !agent.startedAt) return ''
    
    const start = new Date(agent.startedAt).getTime()
    const now = Date.now()
    const diff = now - start
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) return `${hours}h`
    if (minutes > 10) return `${minutes}m`
    return ''
  }

  const runtime = getRuntime()

  return (
    <div
      className="group flex items-center h-7 px-2 cursor-pointer hover:bg-slate-800/30 transition-colors rounded-sm"
      onClick={onViewOutput ? onViewOutput : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={agent.task}
    >
      {/* Status Symbol */}
      <div className="w-3 text-center flex-shrink-0 text-xs mr-2">
        {getStatusSymbol()}
      </div>

      {/* Agent Name */}
      <div className="flex-1 min-w-0">
        <span className={`text-xs truncate block ${
          isOwner ? 'text-slate-200' : 'text-slate-400'
        }`}>
          {getDisplayName()}
        </span>
      </div>

      {/* Runtime + Action */}
      <div className="flex items-center text-xs text-slate-500 font-mono">
        {runtime && <span className="mr-1">{runtime}</span>}
        {agent.status === 'running' && isHovered && (
          <span className="text-slate-400">→</span>
        )}
      </div>
    </div>
  )
}

export const AgentListMinimal: React.FC<AgentListMinimalProps> = ({
  agents,
  agentsLoading,
  killAgent,
  user,
  onViewOutput,
  onDeleteAllAgents,
  className = '',
}) => {
  const [deletingAllAgents, setDeletingAllAgents] = useState(false)
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
    
    // Sort by status priority (running first)
    const sortByStatus = (a: any, b: any) => {
      const statusOrder = { 
        running: 0, 
        starting: 1, 
        completed: 2, 
        failed: 3, 
        killed: 4 
      }
      return (statusOrder[a.status as keyof typeof statusOrder] || 99) - 
             (statusOrder[b.status as keyof typeof statusOrder] || 99)
    }
    
    my.sort(sortByStatus)
    team.sort(sortByStatus)
    
    return { myAgents: my, teamAgents: team }
  }, [agents, user?.id])

  const handleViewOutput = (agent: any) => {
    onViewOutput?.(agent)
  }

  const handleKillAgent = async (agentId: string) => {
    await killAgent(agentId)
  }

  const handleDeleteAllAgents = async () => {
    if (!onDeleteAllAgents || agents.length === 0) return

    const confirmMessage = `Are you sure you want to delete ALL ${agents.length} agents? This action cannot be undone.`
    if (!confirm(confirmMessage)) return

    setDeletingAllAgents(true)
    try {
      await onDeleteAllAgents()
    } catch (error) {
      console.error('Failed to delete all agents:', error)
    } finally {
      setDeletingAllAgents(false)
    }
  }

  if (agentsLoading) {
    return (
      <div className={`space-y-0.5 ${className}`}>
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center h-7 px-2">
            <div className="w-3 mr-2">
              <div className="w-2 h-2 bg-slate-700 rounded-full animate-pulse" />
            </div>
            <div className="flex-1">
              <div className="h-2.5 bg-slate-700 rounded animate-pulse w-20" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div className={`${className}`}>
        <div className="text-center py-3 text-slate-500 text-xs">
          No agents
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header with delete all button */}
      {agents.length > 0 && onDeleteAllAgents && (
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs text-slate-400 font-medium">
            {agents.length} agent{agents.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={handleDeleteAllAgents}
            disabled={deletingAllAgents}
            className="text-xs px-2 py-0.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete all agents"
          >
            {deletingAllAgents ? (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Deleting...
              </span>
            ) : (
              'Delete All'
            )}
          </button>
        </div>
      )}

      {/* Your Agents */}
      {myAgents.length > 0 && (
        <div className="space-y-0.5">
          {myAgents.map(agent => (
            <AgentRow
              key={agent.id}
              agent={agent}
              isOwner={true}
              onViewOutput={() => handleViewOutput(agent)}
            />
          ))}
        </div>
      )}

      {/* Team Section Separator */}
      {myAgents.length > 0 && teamAgents.length > 0 && (
        <div className="flex items-center gap-2 py-1">
          <span className="text-xs text-slate-600">team</span>
          <div className="flex-1 h-px bg-slate-700/40" />
        </div>
      )}

      {/* Team Agents */}
      {teamAgents.length > 0 && (
        <div className="space-y-0.5">
          {teamAgents.map(agent => (
            <AgentRow
              key={agent.id}
              agent={agent}
              isOwner={false}
              showOwner={true}
              onViewOutput={() => handleViewOutput(agent)}
            />
          ))}
        </div>
      )}
    </div>
  )
}