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
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const handleAgentClick = (agent: any) => {
    setSelectedAgent(agent);
    setShowTerminal(true);
  };

  // Handle mobile keyboard visibility and adjust terminal height
  React.useEffect(() => {
    let visualViewport: any = null;
    let resizeHandler: (() => void) | null = null;

    const updateTerminalHeight = () => {
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

    if (showTerminal) {
      // Set up listeners when terminal is shown
      if (window.visualViewport) {
        visualViewport = window.visualViewport;
        resizeHandler = updateTerminalHeight;
        visualViewport.addEventListener('resize', resizeHandler);
      } else {
        resizeHandler = updateTerminalHeight;
        window.addEventListener('resize', resizeHandler);
      }

      // Initial calculation
      updateTerminalHeight();
    } else {
      // Reset keyboard height when terminal is closed
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
  }, [showTerminal]);

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

      {/* TERMINAL AT TOP - DYNAMIC HEIGHT BASED ON KEYBOARD */}
      {showTerminal && selectedAgent && (
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
            className="absolute inset-0 bg-midnight-800 mobile-terminal-modal"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            style={{ 
              height: '100%', // Fill the 70vh container
              // Ensure terminal captures all touch/scroll events
              touchAction: 'none',
              overscrollBehavior: 'contain'
            } as React.CSSProperties}
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
            
            {/* FULL SCREEN TERMINAL CONTENT */}
            <div 
              className="h-full overflow-hidden terminal-container" 
              style={{ 
                height: 'calc(100% - 60px)',
                // Ensure terminal content is focusable and scrollable
                position: 'relative',
                zIndex: 1000,
                backgroundColor: '#1e1e1e' // Terminal background
              }}
              onTouchStart={(e) => {
                // FORCE focus on terminal content
                e.stopPropagation();
                e.preventDefault();
                
                // Focus this container immediately
                e.currentTarget.focus();
                
                // Find and focus the actual xterm terminal
                const xtermTextarea = e.currentTarget.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement;
                if (xtermTextarea) {
                  setTimeout(() => {
                    xtermTextarea.focus();
                    xtermTextarea.click();
                  }, 100);
                }
              }}
              onTouchMove={(e) => {
                // Allow scrolling within terminal only
                e.stopPropagation();
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