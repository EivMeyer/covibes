import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { AgentChatTile } from './AgentChatTile';
import { TerminalTile } from './TerminalTile';

interface AgentDetails {
  id: string;
  userId: string;
  userName: string;
  agentName?: string;
  task: string;
  status: string;
  mode?: 'terminal' | 'chat';
}

interface AgentTileProps {
  agent?: AgentDetails | undefined;
  agentId?: string | undefined;
  agents?: AgentDetails[] | undefined;
  user?: { id: string; name: string; email: string } | undefined;
  socket?: any;
  onAgentSelect?: ((agentId: string) => void) | undefined;
  onDisconnect?: (() => void) | undefined;
  onSpawnAgent?: (() => void) | undefined;
  className?: string | undefined;
  setLastActiveAgent?: ((agentId: string, agentName: string) => void) | undefined;
  setLastActiveTerminal?: ((terminalId: string, terminalName: string) => void) | undefined;
}

export const AgentTile: React.FC<AgentTileProps> = ({
  agent,
  agentId,
  agents = [],
  user,
  socket,
  onAgentSelect,
  onDisconnect,
  onSpawnAgent,
  className = '',
  setLastActiveAgent,
  setLastActiveTerminal
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const currentAgentId = agentId || agent?.id;
  const currentAgent = agent || agents.find(a => a.id === currentAgentId);

  // Filter agents that are running and owned by the current user
  const availableAgents = agents.filter(a =>
    (a.status === 'running' || a.status === 'starting') &&
    a.userId === user?.id
  );

  const handleAgentSelection = (selectedAgent: AgentDetails) => {
    onAgentSelect?.(selectedAgent.id);
    setShowDropdown(false);
  };

  const handleDisconnect = () => {
    onDisconnect?.();
  };

  const handleSpawnAgent = () => {
    onSpawnAgent?.();
  };

  // If no agent is connected, show empty state
  if (!currentAgent) {
    return (
      <div className={`flex flex-col h-full bg-black text-gray-100 ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-gray-400">[agent]</span>
            <span className="text-gray-600">no agent connected</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Agent Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="px-2 py-1 text-xs font-mono bg-gray-800 hover:bg-gray-700 transition-colors"
                title="Select Agent"
              >
                <span className="text-gray-500">select</span>
              </button>

              {showDropdown && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-gray-900 border border-gray-800 z-50">
                  <div className="max-h-60 overflow-y-auto font-mono" style={{ fontSize: '12px' }}>
                    {availableAgents.length > 0 ? (
                      availableAgents.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => handleAgentSelection(a)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-baseline gap-2">
                            <span className={a.status === 'running' ? 'text-green-400' : 'text-yellow-400'}>
                              [{a.status === 'running' ? 'active' : 'starting'}]
                            </span>
                            <span className="text-gray-300">{a.agentName || a.id.substring(0, 8)}</span>
                          </div>
                          <div className="text-gray-600 truncate pl-12">{a.task}</div>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-gray-500">
                        no agents available
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Empty State Content */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-4 p-8">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
              <span className="text-2xl">🤖</span>
            </div>
            <h3 className="text-lg font-medium text-gray-300">No Agent Connected</h3>
            <p className="text-sm text-gray-500 max-w-sm">
              Spawn a new AI agent or select an existing one to start collaborating
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-sm">
            <Button
              onClick={handleSpawnAgent}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
            >
              <span className="mr-2">⚡</span>
              Spawn New Agent
            </Button>

            {availableAgents.length > 0 && (
              <div className="text-center">
                <span className="text-xs text-gray-500">
                  or select from {availableAgents.length} running agent{availableAgents.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // If agent is connected, delegate to appropriate tile component based on mode
  if (currentAgent.mode === 'terminal') {
    return (
      <TerminalTile
        agent={currentAgent}
        agentId={currentAgentId}
        agents={agents}
        user={user}
        socket={socket}
        onAgentSelect={onAgentSelect}
        onDisconnect={onDisconnect}
        className={className}
        setLastActiveAgent={setLastActiveAgent}
        setLastActiveTerminal={setLastActiveTerminal}
      />
    );
  } else {
    // Default to chat mode
    return (
      <AgentChatTile
        agent={currentAgent}
        agentId={currentAgentId}
        agents={agents}
        user={user}
        socket={socket}
        onAgentSelect={onAgentSelect}
        onDisconnect={onDisconnect}
        className={className}
        setLastActiveAgent={setLastActiveAgent}
      />
    );
  }
};