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

  // Determine agent mode - default to terminal for backward compatibility
  const agentMode = agent.mode || 'terminal'
  const isTerminalMode = agentMode === 'terminal'
  const isChatMode = agentMode === 'chat'

  // Get status indicator
  const getStatusIndicator = () => {
    const baseClasses = "w-1.5 h-1.5 rounded-full flex-shrink-0"
    switch (agent.status) {
      case 'running':
        return <div className={`${baseClasses} ${isTerminalMode ? 'bg-emerald-400' : 'bg-blue-400'} animate-pulse shadow-lg shadow-emerald-400/60`} />
      case 'starting':
        return <div className={`${baseClasses} ${isTerminalMode ? 'bg-yellow-400' : 'bg-purple-400'} animate-pulse shadow-sm shadow-yellow-400/50`} />
      case 'completed':
        return <div className={`${baseClasses} bg-emerald-500`} />
      case 'failed':
        return <div className={`${baseClasses} bg-red-400`} />
      default:
        return <div className={`${baseClasses} bg-slate-500`} />
    }
  }

  // Get mode icon
  const getModeIcon = () => {
    if (isChatMode) return '💬'
    return '›'
  }

  // Get display name
  const getDisplayName = () => {
    if (showOwner && agent.userName) {
      const firstName = agent.userName.split(' ')[0]
      return `${firstName}/${agent.agentName || 'Agent'}`
    }
    return agent.agentName || `Agent ${agent.id.slice(-6)}`
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
    if (minutes > 0) return `${minutes}m`
    return ''
  }

  // Get task display (truncated)
  const getTaskDisplay = () => {
    const task = agent.task || ''
    if (task.length > 30) {
      return task.substring(0, 30) + '...'
    }
    return task
  }

  const runtime = getRuntime()

  return (
    <div
      className={`group flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition-all ${
        agent.status === 'running'
          ? 'bg-emerald-900/40 hover:bg-emerald-800/50 ring-1 ring-emerald-500/20'
          : agent.status === 'completed'
            ? 'bg-blue-900/30 hover:bg-blue-800/40'
            : agent.status === 'failed'
              ? 'bg-red-900/30 hover:bg-red-800/40'
              : 'bg-slate-800/30 hover:bg-slate-700/40'
      }`}
      onClick={onViewOutput ? onViewOutput : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={agent.task || 'No task specified'}
    >
      {/* Status dot */}
      {getStatusIndicator()}

      {/* Mode icon */}
      <span className={`text-[10px] w-3 ${
        agent.status === 'running' ? 'text-emerald-400 opacity-80' : 'opacity-60'
      }`}>{getModeIcon()}</span>

      {/* Name */}
      <span className={`text-xs truncate flex-shrink-0 max-w-[80px] ${
        agent.status === 'running'
          ? (isOwner ? 'text-emerald-100 font-semibold' : 'text-emerald-200 font-medium')
          : agent.status === 'completed'
            ? 'text-blue-200 font-medium'
            : agent.status === 'failed'
              ? 'text-red-200 font-medium'
              : 'text-slate-200'
      }`}>
        {getDisplayName()}
      </span>

      {/* Task - takes remaining space */}
      <span className={`text-[11px] truncate flex-1 min-w-0 ${
        agent.status === 'running' ? 'text-slate-300' : 'text-slate-400'
      }`}>
        {getTaskDisplay()}
      </span>

      {/* Runtime */}
      {runtime && (
        <span className={`text-[10px] flex-shrink-0 ${
          agent.status === 'running' ? 'text-emerald-300 font-semibold' : 'text-slate-400'
        }`}>
          {runtime}
        </span>
      )}

      {/* Hover arrow */}
      <span className={`text-[10px] opacity-0 group-hover:opacity-100 transition-opacity ${
        agent.status === 'running' ? 'text-emerald-400' : 'text-slate-500'
      }`}>
        →
      </span>
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
    console.log('🎯 [DEBUG] AgentListMinimal - clicking agent:', { id: agent.id, mode: agent.mode, agentData: agent });
    onViewOutput?.(agent)
  }

  const handleKillAgent = async (agentId: string) => {
    await killAgent(agentId)
  }

  const handleDeleteAllAgents = async () => {
    if (!onDeleteAllAgents || agents.length === 0) return

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
    <div className={`${className}`}>
      {/* Header with delete all button */}
      {agents.length > 0 && onDeleteAllAgents && (
        <div className="flex items-center justify-between px-2 py-1 mb-1">
          <span className="text-[10px] text-slate-500 font-medium uppercase">
            {agents.length} agent{agents.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={handleDeleteAllAgents}
            disabled={deletingAllAgents}
            className="text-[10px] px-1.5 py-0.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete all agents"
          >
            {deletingAllAgents ? (
              <span className="flex items-center gap-1">
                <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                <span>...</span>
              </span>
            ) : (
              'Clear'
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
        <div className="flex items-center gap-1 px-2 py-1 mt-2">
          <span className="text-[9px] text-slate-600 font-medium uppercase">Team</span>
          <div className="flex-1 h-px bg-slate-700/30" />
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