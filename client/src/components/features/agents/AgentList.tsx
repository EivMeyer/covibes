import React, { useState } from 'react';
import { useNotification } from '@/components/ui/Notification';
import type { AgentDetails, ContainerInfo } from '@/types';

interface AgentRowProps {
  agent: any;
  isOwner: boolean;
  onKill: (agent: any) => Promise<void>;
  onViewOutput?: ((agent: AgentDetails) => void) | undefined;
  killingAgent: string | null;
  formatRuntime: (timestamp: string) => string;
  getStatusIndicator: (status: string) => { color: string; pulse: boolean };
  getContainerStatusIcon: (containerInfo?: ContainerInfo) => string;
  isSelected?: boolean | undefined;
  onSelect?: (() => void) | undefined;
}

const AgentRow: React.FC<AgentRowProps> = ({
  agent,
  isOwner,
  onKill,
  onViewOutput,
  killingAgent,
  formatRuntime,
  getStatusIndicator,
  getContainerStatusIcon,
  isSelected = false,
  onSelect,
}) => {
  const isBeingKilled = killingAgent === agent.id;
  const hasTerminal = agent.hasTerminal || Math.random() > 0.5;
  const statusInfo = getStatusIndicator(agent.status);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    const dragData = {
      type: 'agent',
      agentId: agent.id,
      agentName: agent.agentName || `${agent.userName}'s Agent`,
      task: agent.task,
      status: agent.status,
    };
    e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copy';
    console.log('🎯 Agent drag started:', dragData.agentId);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      draggable={isOwner && agent.status === 'running'}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`group flex items-center h-8 px-2 rounded transition-all duration-150 ${
        isSelected 
          ? 'bg-slate-800/60' 
          : 'hover:bg-slate-800/30'
      } ${isDragging ? 'opacity-50' : ''} ${
        isOwner && agent.status === 'running' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      }`}
      title={isOwner && agent.status === 'running' ? 'Drag to connect to terminal' : ''}
      onClick={() => {
        if (onSelect) {
          onSelect();
        } else if (onViewOutput) {
          onViewOutput(agent);
        }
      }}
    >
      {/* Status dot */}
      <div className={`w-1.5 h-1.5 rounded-full mr-2 flex-shrink-0 ${statusInfo.color} ${
        statusInfo.pulse ? 'animate-pulse' : ''
      }`} />

      {/* Agent Name - compact */}
      <div className="flex-1 min-w-0 mr-2">
        <span className="text-xs text-slate-200 truncate block">
          {agent.agentName || `A-${agent.id.slice(0, 6)}`}
        </span>
        {/* Container ID - very compact */}
        {agent.container && (
          <span className="text-xs text-slate-600 truncate block font-mono">
            {agent.container.containerId.slice(-6)}
          </span>
        )}
      </div>

      {/* Container status icon */}
      <div className="mr-1.5" title={agent.container ? `Container: ${agent.container.status}` : 'No container'}>
        <span className="text-xs">
          {getContainerStatusIcon(agent.container)}
        </span>
      </div>

      {/* Status letter indicator */}
      <span className={`text-xs font-bold mr-2 ${
        agent.status === 'running' ? 'text-emerald-400' :
        agent.status === 'completed' ? 'text-blue-400' :
        agent.status === 'failed' ? 'text-red-400' :
        'text-slate-500'
      }`}>
        {agent.status[0].toUpperCase()}
      </span>

      {/* Runtime - compact */}
      <div className="text-xs text-slate-500 font-mono tabular-nums mr-2">
        {formatRuntime(agent.lastActivity || agent.createdAt)}
      </div>

      {/* Terminal indicator - enhanced for container port */}
      <div 
        className={`w-1 h-1 rounded-full mr-1.5 ${
          agent.container?.terminalPort ? 'bg-emerald-400' : 
          hasTerminal ? 'bg-emerald-400' : 
          'bg-slate-700'
        }`}
        title={agent.container?.terminalPort ? `Terminal port: ${agent.container.terminalPort}` : hasTerminal ? 'Terminal available' : 'No terminal'}
      />

      {/* Kill button - X only */}
      {isOwner && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onKill(agent);
          }}
          disabled={isBeingKilled}
          className={`opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity`}
          title="Kill"
        >
          {isBeingKilled ? (
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
          ) : (
            <span className="text-xs">×</span>
          )}
        </button>
      )}
    </div>
  );
};

interface AgentListProps {
  agents: any[]; // Accept agents as props from Dashboard
  agentsLoading: boolean; // Accept loading state as props
  killAgent: (agentId: string) => Promise<void>; // Accept kill function as props
  user?: { id: string; name: string; email: string }; // Add user prop
  onViewOutput?: ((agent: AgentDetails) => void) | undefined;
  selectedAgentId?: string | null; // For keyboard selection
  onSelectAgent?: (agentId: string | null) => void; // For keyboard selection
  className?: string;
  onDeleteAllAgents?: () => Promise<void>; // Function to delete all agents
}

export const AgentList: React.FC<AgentListProps> = ({
  agents,
  agentsLoading,
  killAgent,
  user,
  onViewOutput,
  selectedAgentId,
  onSelectAgent,
  className = '',
  onDeleteAllAgents,
}) => {
  const { addNotification } = useNotification();
  const [killingAgent, setKillingAgent] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [deletingAllAgents, setDeletingAllAgents] = useState(false);

  const handleKillAgent = async (agent: any) => {
    const agentName = agent.agentName || `${agent.userName}'s Agent`;
    const confirmMessage = `Are you sure you want to delete "${agentName}"? This action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setKillingAgent(agent.id);
    try {
      await killAgent(agent.id);
      addNotification({
        message: `Agent "${agentName}" has been deleted.`,
        type: 'success',
      });
    } catch (error) {
      console.error('Failed to delete agent:', error);
      addNotification({
        message: error instanceof Error ? error.message : 'Failed to delete agent',
        type: 'error',
      });
    } finally {
      setKillingAgent(null);
    }
  };

  const handleDeleteAllAgents = async () => {
    if (agents.length === 0) {
      return;
    }

    const confirmMessage = `Are you sure you want to delete ALL ${agents.length} agents? This action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setDeletingAllAgents(true);
    try {
      if (onDeleteAllAgents) {
        await onDeleteAllAgents();
        addNotification({
          message: `All ${agents.length} agents have been deleted.`,
          type: 'success',
        });
      }
    } catch (error) {
      console.error('Failed to delete all agents:', error);
      addNotification({
        message: error instanceof Error ? error.message : 'Failed to delete all agents',
        type: 'error',
      });
    } finally {
      setDeletingAllAgents(false);
    }
  };

  const formatRuntime = (timestamp: string) => {
    const now = new Date().getTime();
    const start = new Date(timestamp).getTime();
    const diff = Math.floor((now - start) / 1000);
    
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const getStatusIndicator = (status: string): { color: string; pulse: boolean } => {
    switch (status) {
      case 'running': 
        return { color: 'bg-emerald-500', pulse: true };
      case 'starting': 
        return { color: 'bg-amber-500', pulse: true };
      case 'completed': 
        return { color: 'bg-blue-500', pulse: false };
      case 'failed': 
        return { color: 'bg-red-500', pulse: false };
      case 'killed': 
        return { color: 'bg-slate-600', pulse: false };
      default: 
        return { color: 'bg-slate-600', pulse: false };
    }
  };

  const getContainerStatusIcon = (containerInfo?: ContainerInfo): string => {
    if (!containerInfo) return '⚫'; // No container
    
    switch (containerInfo.status) {
      case 'running': 
        return '🟢';
      case 'starting': 
      case 'creating':
        return '🟡';
      case 'stopped': 
        return '🔴';
      case 'error': 
        return '❌';
      default: 
        return '⚪';
    }
  };


  if (agentsLoading) {
    return (
      <div className={`space-y-0.5 ${className}`}>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-8 px-2 flex items-center bg-slate-800/20 rounded">
            <div className="w-1.5 h-1.5 bg-slate-700 rounded-full mr-2 animate-pulse" />
            <div className="h-2.5 bg-slate-700 rounded w-20 animate-pulse" />
            <div className="flex-1" />
            <div className="h-2.5 bg-slate-700 rounded w-8 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className={`${className}`}>
        <div className="rounded bg-slate-800/20 border border-slate-700/30 p-4 text-center">
          <p className="text-xs text-slate-500">No agents running</p>
        </div>
      </div>
    );
  }

  // Separate agents by ownership
  const userAgents = agents.filter(agent => agent.userId === user?.id);
  const teamAgents = agents.filter(agent => agent.userId !== user?.id);

  return (
    <div className={`${className}`}>
      {/* Compact header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <h3 className="text-xs font-semibold text-slate-300">Agents</h3>
          <span className="text-xs text-slate-500">{agents.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Delete All Agents Button */}
          {agents.length > 0 && onDeleteAllAgents && (
            <button
              onClick={handleDeleteAllAgents}
              disabled={deletingAllAgents}
              className="p-0.5 text-slate-600 hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Delete All Agents"
            >
              {deletingAllAgents ? (
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          )}
          {/* Filter Button */}
          {agents.length > 5 && (
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="p-0.5 text-slate-600 hover:text-slate-400 transition-colors"
              title="Filter"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Compact filter */}
      {showAdvancedFilters && (
        <div className="mb-1.5 flex gap-1">
          {['running', 'completed', 'failed'].map(status => (
            <button
              key={status}
              className="px-1.5 py-0.5 text-xs bg-slate-800/30 text-slate-400 rounded hover:bg-slate-700/40 hover:text-slate-300 transition-all"
            >
              {status[0].toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* Compact agent list */}
      <div className="rounded bg-slate-800/20 border border-slate-700/40">
        <div className="p-1">
          {/* Your Agents */}
          {userAgents.length > 0 && (
            <>
              {userAgents.length > 0 && teamAgents.length > 0 && (
                <div className="px-1 py-0.5">
                  <span className="text-xs text-slate-600">yours</span>
                </div>
              )}
              <div className="space-y-0.5">
                {userAgents.map(agent => (
                  <AgentRow 
                    key={agent.id} 
                    agent={agent} 
                    isOwner={true}
                    onKill={handleKillAgent}
                    onViewOutput={onViewOutput}
                    killingAgent={killingAgent}
                    formatRuntime={formatRuntime}
                    getStatusIndicator={getStatusIndicator}
                    getContainerStatusIcon={getContainerStatusIcon}
                    isSelected={selectedAgentId === agent.id}
                    onSelect={onSelectAgent ? () => onSelectAgent(agent.id) : undefined}
                  />
                ))}
              </div>
            </>
          )}

          {/* Team Agents */}
          {teamAgents.length > 0 && (
            <>
              {userAgents.length > 0 && <div className="h-1" />}
              {userAgents.length > 0 && teamAgents.length > 0 && (
                <div className="px-1 py-0.5">
                  <span className="text-xs text-slate-600">team</span>
                </div>
              )}
              <div className="space-y-0.5">
                {teamAgents.map(agent => (
                  <AgentRow 
                    key={agent.id} 
                    agent={agent} 
                    isOwner={false}
                    onKill={handleKillAgent}
                    onViewOutput={onViewOutput}
                    killingAgent={killingAgent}
                    formatRuntime={formatRuntime}
                    getStatusIndicator={getStatusIndicator}
                    getContainerStatusIcon={getContainerStatusIcon}
                    isSelected={selectedAgentId === agent.id}
                    onSelect={onSelectAgent ? () => onSelectAgent(agent.id) : undefined}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};