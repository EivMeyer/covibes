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
  const [terminalHeight, setTerminalHeight] = useState('75vh');
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

      // Try Visual Viewport API first (modern browsers)
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        
        // Calculate keyboard height
        const calculatedKeyboardHeight = windowHeight - viewportHeight;
        
        if (calculatedKeyboardHeight > 150) { // Keyboard threshold
          // Keyboard is open - move modal up and resize
          setKeyboardHeight(calculatedKeyboardHeight);
          // Use available viewport height minus header and some padding
          const availableHeight = viewportHeight - 80; // 80px for header + padding
          setTerminalHeight(`${Math.max(availableHeight, 300)}px`);
        } else {
          // No keyboard, position at bottom normally
          setKeyboardHeight(0);
          setTerminalHeight('75vh');
        }
      } else {
        // Fallback: listen for window resize events
        const currentHeight = window.innerHeight;
        const initialHeight = window.screen.height;
        
        if (currentHeight < initialHeight * 0.75) {
          const estimatedKeyboardHeight = initialHeight - currentHeight;
          setKeyboardHeight(estimatedKeyboardHeight);
          setTerminalHeight(`${Math.max(currentHeight - 80, 300)}px`);
        } else {
          setKeyboardHeight(0);
          setTerminalHeight('75vh');
        }
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
      // Reset height and position when terminal is closed
      setTerminalHeight('75vh');
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

      {/* Full-Screen Terminal */}
      {showTerminal && selectedAgent && (
        <div 
          className={`fixed inset-0 z-50 ${keyboardHeight > 0 ? 'bg-midnight-800' : 'bg-black/50'}`}
          onClick={keyboardHeight > 0 ? undefined : () => setShowTerminal(false)}
          onTouchStart={keyboardHeight > 0 ? undefined : (e) => {
            // Only close on background touch when keyboard is closed
            if (e.target === e.currentTarget) {
              setShowTerminal(false);
            }
          }}
          style={{
            // When keyboard is open, make it full screen from top
            // When keyboard is closed, show as bottom sheet
            ...(keyboardHeight > 0 ? {
              paddingTop: '0px',
              paddingBottom: `${keyboardHeight}px`
            } : {})
          }}
        >
          <div 
            className={`absolute left-0 right-0 bg-midnight-800 shadow-2xl mobile-terminal-modal ${
              keyboardHeight > 0 
                ? 'top-0 rounded-none keyboard-open' // Full screen from top when keyboard open
                : 'bottom-0 rounded-t-2xl' // Bottom sheet when keyboard closed
            }`}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            style={{ 
              height: keyboardHeight > 0 ? `calc(100vh - ${keyboardHeight}px)` : terminalHeight,
              '--terminal-height': terminalHeight,
              '--keyboard-height': `${keyboardHeight}px`,
              transition: 'all 0.2s ease-in-out',
              // Ensure terminal captures all touch/scroll events
              touchAction: 'none',
              overscrollBehavior: 'contain'
            } as React.CSSProperties & { [key: string]: any }}
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
              style={{ 
                height: 'calc(100% - 60px)',
                // Add safe area insets for notched devices
                paddingBottom: keyboardHeight > 0 ? '0px' : 'max(env(safe-area-inset-bottom), 0px)',
                // Ensure terminal content is focusable and scrollable
                position: 'relative',
                zIndex: 1000
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