import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { X } from 'lucide-react';
// Simplified types to avoid import issues
interface AgentDetails {
  id: string;
  userId: string;
  userName: string;
  agentName?: string;
  task: string;
  status: string;
  mode?: 'terminal' | 'chat';
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  agentId?: string;
}

interface AgentChatTileProps {
  agent?: AgentDetails | undefined;
  agentId?: string | undefined;
  agents?: AgentDetails[] | undefined; // All available agents for dropdown
  user?: { id: string; name: string; email: string } | undefined;
  socket?: any;
  onAgentSelect?: ((agentId: string) => void) | undefined;
  onDisconnect?: (() => void) | undefined;
  className?: string | undefined;
  setLastActiveAgent?: ((agentId: string, agentName: string) => void) | undefined;
}

export const AgentChatTile: React.FC<AgentChatTileProps> = ({
  agent,
  agentId,
  agents = [],
  user,
  socket,
  onAgentSelect,
  onDisconnect,
  className = '',
  setLastActiveAgent
}) => {
  const currentUser = user;
  const currentAgentId = agentId || agent?.id;
  const [showDropdown, setShowDropdown] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [ignoreNextResponse, setIgnoreNextResponse] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [toolUseStatus, setToolUseStatus] = useState<string>('');
  // Same small size for both mobile and desktop: 12px
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const [fontSize, setFontSize] = useState(12);
  const [spinnerIndex, setSpinnerIndex] = useState(0);
  const thinkingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamingContentRef = useRef<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const spinnerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Braille spinner characters for smooth animation
  const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  const isOwner = agent?.userId === currentUser?.id;
  const canInteract = isOwner && (agent?.status === 'running' || agent?.status === 'starting');

  // Animate spinner when thinking
  useEffect(() => {
    if (isThinking && !streamingContent) {
      spinnerIntervalRef.current = setInterval(() => {
        setSpinnerIndex(prev => (prev + 1) % spinnerChars.length);
      }, 80);
    } else {
      if (spinnerIntervalRef.current) {
        clearInterval(spinnerIntervalRef.current);
        spinnerIntervalRef.current = null;
      }
      setSpinnerIndex(0);
    }

    return () => {
      if (spinnerIntervalRef.current) {
        clearInterval(spinnerIntervalRef.current);
      }
    };
  }, [isThinking, streamingContent]);

  // Filter agents that are running
  const availableAgents = agents.filter(a =>
    (a.status === 'running' || a.status === 'starting') &&
    a.userId === currentUser?.id // Only show user's own agents
  );

  // Keep ref in sync with state for streaming content
  useEffect(() => {
    streamingContentRef.current = streamingContent;
  }, [streamingContent]);

  // Handle window resize to update mobile detection
  useEffect(() => {
    const handleResize = () => {
      // No need to enforce minimum font size with viewport zoom disabled
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Initialize with welcome message when agent connects
  useEffect(() => {
    if (agent && currentAgentId && messages.length === 0) {
      setMessages([{
        id: '1',
        role: 'system',
        content: `connected to ${agent.agentName || 'agent'}`,
        timestamp: new Date().toISOString(),
        agentId: currentAgentId
      }]);

      // Set this agent as the last active target when it's opened/connected
      if (setLastActiveAgent) {
        setLastActiveAgent(agent.id, agent.agentName || agent.userName || 'Agent');
      }
    }
  }, [agent, currentAgentId]);

  // Establish connection when agent changes (chat mode doesn't need terminal)
  useEffect(() => {
    if (!socket || !currentAgentId || !canInteract) return;

    const agentInfo = agents?.find(a => a.id === currentAgentId);

    if (agentInfo?.mode === 'chat') {
      // For chat mode, request connection but expect chat_agent_ready response
      console.log('💬 AgentChat: Connecting to chat agent:', currentAgentId);
      socket.emit('terminal_connect', { agentId: currentAgentId });

      const handleChatReady = (data: any) => {
        if (data.agentId === currentAgentId) {
          console.log('💬 Chat agent ready:', currentAgentId);
          setIsLoading(false); // Ready to send messages
        }
      };

      socket.on('chat_agent_ready', handleChatReady);

      return () => {
        socket.off('chat_agent_ready', handleChatReady);
        // Chat agents don't need disconnect
      };
    } else {
      // Terminal mode agents still use terminal connection
      console.log('AgentChat: Connecting to terminal for agent:', currentAgentId);
      socket.emit('terminal_connect', { agentId: currentAgentId });

      const handleTerminalConnected = (data: any) => {
        if (data.agentId === currentAgentId) {
          console.log('AgentChat: Terminal connected for agent:', currentAgentId);
          setIsLoading(false);
        }
      };

      socket.on('terminal_connected', handleTerminalConnected);

      return () => {
        socket.off('terminal_connected', handleTerminalConnected);
        if (currentAgentId) {
          socket.emit('terminal_disconnect', { agentId: currentAgentId });
        }
      };
    }
  }, [socket, currentAgentId, canInteract, agents]);

  // Listen for agent output via socket
  useEffect(() => {
    if (!socket || !currentAgentId) return;

    const agentInfo = agents?.find(a => a.id === currentAgentId);

    const handleChatResponse = (data: any) => {
      // For chat mode agents, we get clean JSON responses
      if (data.agentId === currentAgentId && data.response) {
        // If we should ignore this response (already added from streaming), skip it
        if (ignoreNextResponse) {
          console.log('📝 Ignoring duplicate response after streaming');
          setIgnoreNextResponse(false);
          setIsLoading(false);
          return;
        }

        const responseText = data.response.trim();

        // Skip empty responses
        if (!responseText || responseText.length < 2) {
          return;
        }

        // Add the response as a message
        setMessages(prev => {
          // Check if this is a duplicate
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.role === 'assistant' && lastMsg.content === responseText) {
            return prev;
          }

          return [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: responseText,
            timestamp: new Date().toISOString(),
            agentId: currentAgentId
          }];
        });

        setIsLoading(false);
      }
    };

    const handleTerminalData = (data: any) => {
      // Fallback for terminal mode or legacy behavior
      if (data.agentId === currentAgentId && data.data && agentInfo?.mode !== 'chat') {
        const responseText = data.data.trim();

        // Skip empty responses
        if (!responseText || responseText.length < 2) {
          return;
        }

        // Add the response as a message
        setMessages(prev => {
          // Check if this is a duplicate
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.role === 'assistant' && lastMsg.content === responseText) {
            return prev;
          }

          return [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: responseText,
            timestamp: new Date().toISOString(),
            agentId: currentAgentId
          }];
        });

        setIsLoading(false);
      }
    };

    const handleChatError = (data: any) => {
      if (data.agentId === currentAgentId) {
        console.error('Chat error:', data.error);
        setIsLoading(false);
        setIsStreaming(false);
        setStreamingContent('');
        setIsThinking(false);  // Clear thinking on error
        setToolUseStatus('');  // Clear tool status on error

        // Clear timeout if exists
        if (thinkingTimeoutRef.current) {
          clearTimeout(thinkingTimeoutRef.current);
          thinkingTimeoutRef.current = null;
        }
      }
    };

    // Streaming event handlers
    const handleStreamStart = (data: any) => {
      console.log('🎬 [FRONTEND] Stream start event received:', data);
      if (data.agentId === currentAgentId) {
        console.log('🚀 [FRONTEND] Stream started for agent:', currentAgentId);
        setIsStreaming(true);
        setStreamingContent('');
        streamingContentRef.current = '';
        setIsLoading(false);
        // DON'T clear thinking here - wait for first actual content chunk
        // setIsThinking(false);  // Keep thinking until we get actual content
        setToolUseStatus('');  // Clear tool status
      }
    };

    const handleStreamChunk = (data: any) => {
      console.log('📦 [FRONTEND] Stream chunk received:', data);
      if (data.agentId === currentAgentId && data.content) {
        console.log('✍️ [FRONTEND] Adding chunk to streaming content:', data.content);

        // Clear thinking indicator only if minimum time has passed
        if (!thinkingTimeoutRef.current) {
          console.log('🎯 [THINKING] Minimum time passed, clearing thinking indicator');
          setIsThinking(false);
        } else {
          console.log('🎯 [THINKING] Minimum time not passed yet, keeping thinking indicator');
          // Set up to clear thinking when minimum time passes
          const currentTimeout = thinkingTimeoutRef.current;
          clearTimeout(currentTimeout);
          thinkingTimeoutRef.current = setTimeout(() => {
            console.log('🎯 [THINKING] Minimum time now passed, clearing thinking indicator');
            setIsThinking(false);
            thinkingTimeoutRef.current = null;
          }, 100); // Short delay to clear after minimum time
        }

        setStreamingContent(prev => {
          // Add double line break after sentences (ending with period) for better readability
          const separator = prev && prev.endsWith('.') ? '\n\n' : '';
          const newContent = prev + separator + data.content;
          console.log('📝 [FRONTEND] Total streaming content now:', newContent.substring(0, 100));
          return newContent;
        });
      }
    };

    const handleStreamComplete = (data: any) => {
      console.log('🏁 [FRONTEND] Stream complete event received:', data);
      if (data.agentId === currentAgentId) {
        // Get the final streaming content
        const finalContent = streamingContent || streamingContentRef.current;
        console.log('📄 [FRONTEND] Final streaming content:', finalContent?.substring(0, 100));

        // Convert the streaming content to a permanent message
        if (finalContent) {
          console.log('💾 [FRONTEND] Converting streaming content to permanent message');
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: finalContent,
            timestamp: new Date().toISOString(),
            agentId: currentAgentId
          }]);
        }

        // Clear streaming state
        console.log('🧹 [FRONTEND] Clearing streaming state');
        setIsStreaming(false);
        setStreamingContent('');
        streamingContentRef.current = '';
        setIsThinking(false);  // Ensure thinking is cleared
        setToolUseStatus('');  // Ensure tool status is cleared

        // Mark that we should ignore the next agent_chat_response to avoid duplicates
        setIgnoreNextResponse(true);

        // Clear timeout if it somehow still exists
        if (thinkingTimeoutRef.current) {
          clearTimeout(thinkingTimeoutRef.current);
          thinkingTimeoutRef.current = null;
        }
      }
    };

    // Tool use handler
    const handleToolUse = (data: any) => {
      if (data.agentId === currentAgentId) {
        console.log('🔧 [FRONTEND] Tool use:', data.tool);
        const toolMessages = {
          'Read': '> read file.txt',
          'Bash': '> exec command',
          'Grep': '> grep pattern',
          'Glob': '> find files',
          'Write': '> write file.txt',
          'Edit': '> edit file.txt',
          'MultiEdit': '> edit files'
        };
        setToolUseStatus(toolMessages[data.tool] || `> ${data.tool.toLowerCase()}`);
      }
    };

    // Listen for appropriate events based on agent mode
    if (agentInfo?.mode === 'chat') {
      socket.on('agent_chat_response', handleChatResponse);
      socket.on('agent_chat_stream_start', handleStreamStart);
      socket.on('agent_chat_stream_chunk', handleStreamChunk);
      socket.on('agent_chat_stream_complete', handleStreamComplete);
      socket.on('agent_tool_use', handleToolUse);
    } else {
      socket.on('terminal_data', handleTerminalData);
    }
    socket.on('agent_chat_error', handleChatError);

    return () => {
      // Clean up timeout if it exists
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current);
      }
      socket.off('agent_chat_response', handleChatResponse);
      socket.off('terminal_data', handleTerminalData);
      socket.off('agent_chat_error', handleChatError);
      socket.off('agent_chat_stream_start', handleStreamStart);
      socket.off('agent_chat_stream_chunk', handleStreamChunk);
      socket.off('agent_chat_stream_complete', handleStreamComplete);
      socket.off('agent_tool_use', handleToolUse);
    };
  }, [socket, currentAgentId, agents]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading || !canInteract || !socket || !currentAgentId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
      agentId: currentAgentId
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setIsThinking(true);  // Start thinking indicator
    setToolUseStatus('');  // Clear any previous tool status

    // Clear any existing timeout
    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current);
    }

    // Set minimum display time for thinking indicator (at least 800ms)
    const thinkingStartTime = Date.now();
    thinkingTimeoutRef.current = setTimeout(() => {
      thinkingTimeoutRef.current = null;
    }, 800);

    console.log('🎯 [THINKING] Setting isThinking to true for agent:', currentAgentId);
    console.log('🎯 [THINKING] Will show for minimum 800ms');
    console.log('🎯 [THINKING] Agent mode:', agent?.mode);
    console.log('🎯 [THINKING] isStreaming:', isStreaming);

    // Check if agent is in chat mode
    const agentInfo = agents?.find(a => a.id === currentAgentId);

    if (agentInfo?.mode === 'chat') {
      // Use chat-specific socket event for chat agents
      socket.emit('agent_chat_message', {
        agentId: currentAgentId,
        message: input.trim()
      });
    } else {
      // Fallback to terminal input for terminal mode agents
      socket.emit('terminal_input', {
        agentId: currentAgentId,
        type: 'input',
        data: input.trim() + '\r'
      });
    }

    // Also update last active target when sending a message (in case it changed)
    if (setLastActiveAgent && agent) {
      setLastActiveAgent(agent.id, agent.agentName || agent.userName || 'Agent');
    }

    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  }, [input, isLoading, canInteract, socket, currentAgentId]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAgentSelection = (selectedAgent: AgentDetails) => {
    // Clear messages when switching agents
    setMessages([{
      id: Date.now().toString(),
      role: 'system',
      content: `connected to ${selectedAgent.agentName || selectedAgent.id.substring(0, 8)}`,
      timestamp: new Date().toISOString(),
      agentId: selectedAgent.id
    }]);

    // Track this agent as the last active target when selected
    if (setLastActiveAgent) {
      setLastActiveAgent(selectedAgent.id, selectedAgent.agentName || selectedAgent.userName || 'Agent');
    }

    onAgentSelect?.(selectedAgent.id);
    setShowDropdown(false);
  };

  const handleDisconnect = () => {
    setMessages([]);
    onDisconnect?.();
  };

  return (
    <div className={`flex flex-col h-full bg-black text-gray-100 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-gray-400">[agent]</span>
          {agent ? (
            <span className="text-green-400">
              {agent.agentName || agent.id.substring(0, 8)}
            </span>
          ) : (
            <span className="text-gray-600">disconnected</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Font Size Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFontSize(Math.max(fontSize - 2, 8))}
              className="px-1 py-0.5 text-xs font-mono text-gray-400 hover:text-gray-200 transition-colors"
              title="Decrease font size"
            >
              -
            </button>
            <span className="text-xs font-mono text-gray-500 min-w-[2rem] text-center">{fontSize}px</span>
            <button
              onClick={() => setFontSize(Math.min(fontSize + 2, 24))}
              className="px-1 py-0.5 text-xs font-mono text-gray-400 hover:text-gray-200 transition-colors"
              title="Increase font size"
            >
              +
            </button>
            <button
              onClick={() => setFontSize(12)}
              className="px-1 py-0.5 text-xs font-mono text-gray-400 hover:text-gray-200 transition-colors ml-1"
              title="Reset font size"
            >
              reset
            </button>
          </div>
          {/* Agent Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="px-2 py-1 text-xs font-mono bg-gray-800 hover:bg-gray-700 transition-colors"
              title="Select Agent"
            >
              {agent ? (
                <span className="text-green-400">
                  {agent.agentName || 'active'}
                </span>
              ) : (
                <span className="text-gray-500">select</span>
              )}
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-gray-900 border border-gray-800 z-50">
                <div className="max-h-60 overflow-y-auto font-mono" style={{ fontSize: '12px' }}>
                  {availableAgents.length > 0 ? (
                    availableAgents.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => handleAgentSelection(a)}
                        className={`w-full text-left px-3 py-2 hover:bg-gray-800 transition-colors ${
                          a.id === currentAgentId ? 'bg-gray-800' : ''
                        }`}
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

          {agent && (
            <button
              onClick={handleDisconnect}
              className="px-2 py-1 text-xs font-mono text-gray-400 hover:text-gray-200 transition-colors"
              title="Disconnect"
            >
              disconnect
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 font-mono" style={{ fontSize: `${fontSize}px` }}>
        {messages.length === 0 && !agent ? (
          <div className="text-gray-600">
            <p>// no agent connected</p>
            <p>// select an agent to start</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="mb-3">
              <div className="flex items-start gap-2">
                <span className={`${
                  message.role === 'user'
                    ? 'text-green-400'
                    : message.role === 'system'
                    ? 'text-gray-600'
                    : 'text-gray-400'
                }`}>
                  {message.role === 'user' ? '>' : message.role === 'system' ? '//' : ' '}
                </span>
                <div className="flex-1">
                  <div className="whitespace-pre-wrap text-gray-100">
                    {message.content}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Thinking/Tool Use Indicator */}
        {(() => {
          const shouldShow = (isThinking || toolUseStatus) && !streamingContent;
          return shouldShow;
        })() && (
          <div className="mb-3">
            <div className="flex items-start gap-2">
              <span className="text-gray-400"> </span>
              <div className={`font-mono ${toolUseStatus ? 'text-blue-400' : 'text-green-400 animate-pulse'}`} style={{ fontSize: `${fontSize}px` }}>
                {toolUseStatus || spinnerChars[spinnerIndex]}
              </div>
            </div>
          </div>
        )}

        {/* Streaming message */}
        {isStreaming && streamingContent && (
          <div className="mb-3">
            <div className="flex items-start gap-2">
              <span className="text-gray-400"> </span>
              <div className="flex-1">
                <div className="whitespace-pre-wrap text-gray-100">
                  {streamingContent}
                  <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-1"></span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-3">
        <div className="flex gap-2">
          <span className="text-green-400 font-mono py-2" style={{ fontSize: `${fontSize}px` }}>{'>'}</span>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              agent
                ? ""
                : "// no agent connected"
            }
            className="flex-1 px-2 py-2 bg-transparent font-mono text-gray-100 placeholder-gray-600 focus:outline-none resize-none"
            style={{ fontSize: `${fontSize}px` }}
            rows={1}
            disabled={!canInteract || isLoading}
            autoCorrect={isMobile ? "on" : "off"}
            autoCapitalize={isMobile ? "sentences" : "off"}
            spellCheck={isMobile}
            autoComplete="on"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !canInteract || isLoading}
            className="px-3 py-2 font-mono text-gray-400 hover:text-green-400 disabled:text-gray-700 disabled:cursor-not-allowed transition-colors"
            style={{ fontSize: `${Math.max(fontSize - 2, 10)}px` }}
          >
            [send]
          </button>
        </div>
      </div>
    </div>
  );
};