import React, { useState } from 'react';
import { AgentList } from '@/components/features/agents/AgentList';
import { AgentChatTile } from '@/components/tiles/AgentChatTile';
import { SimpleTerminal } from '@/components/features/agents/SimpleTerminal';

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
  const [showChat, setShowChat] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const handleAgentClick = (agent: any) => {
    setSelectedAgent(agent);
    setShowChat(true);
  };

  // Handle mobile keyboard visibility and adjust chat height
  React.useEffect(() => {
    let visualViewport: any = null;
    let resizeHandler: (() => void) | null = null;

    const updateChatHeight = () => {
      if (typeof window === 'undefined') return;

      // Simple keyboard detection using Visual Viewport API
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        
        // Calculate keyboard height
        const calculatedKeyboardHeight = windowHeight - viewportHeight;
        
        if (calculatedKeyboardHeight > 150) { // Keyboard threshold
          // Keyboard is open - set keyboard height
          setKeyboardHeight(calculatedKeyboardHeight);
        } else {
          // No keyboard
          setKeyboardHeight(0);
        }
      } else {
        // Fallback: assume no advanced keyboard detection
        setKeyboardHeight(0);
      }
    };

    if (showChat) {
      // Set up listeners when chat is shown
      if (window.visualViewport) {
        visualViewport = window.visualViewport;
        resizeHandler = updateChatHeight;
        visualViewport.addEventListener('resize', resizeHandler);
      } else {
        resizeHandler = updateChatHeight;
        window.addEventListener('resize', resizeHandler);
      }

      // Initial calculation
      updateChatHeight();
    } else {
      // Reset keyboard height when chat is closed
      setKeyboardHeight(0);
    }

    // Cleanup
    return () => {
      if (visualViewport && resizeHandler) {
        visualViewport.removeEventListener('resize', resizeHandler);
      } else if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
      }
    };
  }, [showChat]);

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

      {/* AGENT TERMINAL/CHAT - DYNAMIC HEIGHT BASED ON KEYBOARD */}
      {showChat && selectedAgent && (
        <div 
          className="fixed top-0 left-0 right-0 z-50 bg-midnight-800"
          style={{
            // DYNAMIC HEIGHT: Shrink when keyboard appears
            height: keyboardHeight > 0 
              ? `calc(100vh - ${keyboardHeight + 20}px)` // Leave 20px padding above keyboard
              : '70vh', // Default 70% when no keyboard
            transition: 'height 0.2s ease-in-out' // Smooth resize
          }}
        >
          <div 
            className="absolute inset-0 bg-midnight-800 mobile-chat-modal"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            style={{ 
              height: '100%', // Fill the 70vh container
              // Ensure chat captures all touch/scroll events
              touchAction: 'none',
              overscrollBehavior: 'contain'
            } as React.CSSProperties}
          >
            {/* Chat Header */}
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
                onClick={() => setShowChat(false)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            
            {/* FULL SCREEN TERMINAL OR CHAT CONTENT */}
            <div
              className="h-full overflow-hidden chat-container"
              style={{
                height: 'calc(100% - 60px)',
                // Ensure content is focusable and scrollable
                position: 'relative',
                zIndex: 1000,
                backgroundColor: '#0d0d0d' // Background
              }}
              onTouchStart={(e) => {
                // Only focus on chat input if in chat mode
                if (selectedAgent.mode === 'chat') {
                  e.stopPropagation();
                  // Find and focus the chat textarea
                  const chatTextarea = e.currentTarget.querySelector('textarea') as HTMLTextAreaElement;
                  if (chatTextarea) {
                    setTimeout(() => {
                      chatTextarea.focus();
                    }, 100);
                  }
                }
              }}
              onTouchMove={(e) => {
                // Allow scrolling within content
                e.stopPropagation();
              }}
              tabIndex={0}
            >
              {/* Render based on agent mode */}
              {selectedAgent.mode === 'chat' ? (
                <AgentChatTile
                  agent={selectedAgent}
                  agentId={selectedAgent.id}
                  agents={agents}
                  user={user}
                  socket={socket}
                />
              ) : (
                <SimpleTerminal
                  agentId={selectedAgent.id}
                  isVisible={true}
                  socket={socket}
                  className="h-full"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};