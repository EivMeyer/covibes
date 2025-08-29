import React, { useState } from 'react';
import { AgentList } from '@/components/features/agents/AgentList';
import { TerminalTile } from '@/components/tiles/TerminalTile';

interface MobileAgentViewProps {
  agents: any[];
  agentsLoading: boolean;
  user: any;
  canSpawnAgent: boolean;
  onSpawnAgent: () => void;
  killAgent: (id: string) => Promise<void>;
  isSocketConnected: boolean;
  socket?: any;
}

export const MobileAgentView: React.FC<MobileAgentViewProps> = ({
  agents,
  agentsLoading,
  user,
  canSpawnAgent,
  onSpawnAgent,
  killAgent,
  isSocketConnected,
  socket
}) => {
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [showTerminal, setShowTerminal] = useState(false);

  const handleAgentClick = (agent: any) => {
    setSelectedAgent(agent);
    setShowTerminal(true);
  };

  return (
    <div className="flex flex-col h-full bg-midnight-900">
      {/* Header */}
      <div className="px-4 py-3 bg-midnight-800 border-b border-midnight-600 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold text-white">Agents</h2>
          {agents.length > 0 && (
            <span className="text-xs text-gray-400 bg-midnight-700 px-2 py-0.5 rounded-full">
              {agents.length}
            </span>
          )}
        </div>
        
        {/* Spawn Agent Button */}
        <button
          onClick={onSpawnAgent}
          disabled={!canSpawnAgent}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium text-sm transition-all ${
            canSpawnAgent
              ? 'bg-electric text-midnight-900 hover:bg-electric/80'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>New</span>
        </button>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <AgentList
          agents={agents}
          agentsLoading={agentsLoading}
          killAgent={killAgent}
          user={user}
          onViewOutput={handleAgentClick}
          className=""
        />
      </div>

      {/* Connection Status */}
      {!isSocketConnected && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-red-400">Disconnected - Reconnecting...</span>
          </div>
        </div>
      )}

      {/* Terminal Slide-up Panel */}
      {showTerminal && selectedAgent && (
        <div 
          className="fixed inset-0 z-50 bg-black/50" 
          onClick={() => setShowTerminal(false)}
          onTouchStart={(e) => {
            // Only close on background touch, not on terminal content
            if (e.target === e.currentTarget) {
              setShowTerminal(false);
            }
          }}
        >
          <div 
            className="absolute bottom-0 left-0 right-0 bg-midnight-800 rounded-t-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            style={{ height: '75vh' }}
          >
            {/* Terminal Header */}
            <div className="px-4 py-3 border-b border-midnight-600 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-semibold text-white">
                  {selectedAgent.agentName || `${selectedAgent.userName}'s Agent`}
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  selectedAgent.status === 'running' ? 'bg-green-500/20 text-green-400' :
                  selectedAgent.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                  selectedAgent.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {selectedAgent.status}
                </span>
              </div>
              
              <button
                onClick={() => setShowTerminal(false)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            
            {/* Terminal Content */}
            <div 
              className="h-full overflow-hidden" 
              style={{ height: 'calc(100% - 60px)' }}
              onTouchStart={(e) => {
                // Ensure terminal area receives touch focus
                e.stopPropagation();
                // Focus the container to enable text selection
                e.currentTarget.focus();
              }}
              tabIndex={0}
            >
              <TerminalTile 
                agent={selectedAgent} 
                agentId={selectedAgent.id}
                user={user}
                socket={socket}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};