import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Send, Bot, User, ChevronDown, X, Zap } from 'lucide-react';
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
}

export const AgentChatTile: React.FC<AgentChatTileProps> = ({
  agent,
  agentId,
  agents = [],
  user,
  socket,
  onAgentSelect,
  onDisconnect,
  className = ''
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
  const thinkingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamingContentRef = useRef<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isOwner = agent?.userId === currentUser?.id;
  const canInteract = isOwner && (agent?.status === 'running' || agent?.status === 'starting');

  // Filter agents that are running
  const availableAgents = agents.filter(a =>
    (a.status === 'running' || a.status === 'starting') &&
    a.userId === currentUser?.id // Only show user's own agents
  );

  // Keep ref in sync with state for streaming content
  useEffect(() => {
    streamingContentRef.current = streamingContent;
  }, [streamingContent]);

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
        content: `Connected to ${agent.agentName || 'Agent'}. You can now chat with the agent about planning, implementation, or debugging.`,
        timestamp: new Date().toISOString(),
        agentId: currentAgentId
      }]);
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
          const newContent = prev + data.content;
          console.log('📝 [FRONTEND] Total streaming content now:', newContent.substring(0, 100));
          return newContent;
        });
      }
    };

    const handleStreamComplete = (data: any) => {
      console.log('🏁 [FRONTEND] Stream complete event received:', data);
      if (data.agentId === currentAgentId) {
        const currentContent = streamingContentRef.current;
        console.log('📄 [FRONTEND] Current streaming content from ref:', currentContent);

        // Convert the accumulated streaming content into a permanent message
        if (currentContent) {
          console.log('💾 [FRONTEND] Converting streaming content to permanent message');
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: currentContent,
            timestamp: new Date().toISOString(),
            agentId: currentAgentId
          }]);

          // Mark that we should ignore the next agent_chat_response to avoid duplicates
          setIgnoreNextResponse(true);
          console.log('✅ [FRONTEND] Converted streaming content to message:', currentContent.substring(0, 50));
        } else {
          console.warn('⚠️ [FRONTEND] No streaming content to convert!');
        }

        // Clear streaming state
        console.log('🧹 [FRONTEND] Clearing streaming state');
        setIsStreaming(false);
        setStreamingContent('');
        streamingContentRef.current = '';
        setIsThinking(false);  // Ensure thinking is cleared
        setToolUseStatus('');  // Ensure tool status is cleared

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
          'Read': 'Reading file...',
          'Bash': 'Running command...',
          'Grep': 'Searching codebase...',
          'Glob': 'Finding files...',
          'Write': 'Writing file...',
          'Edit': 'Editing file...',
          'MultiEdit': 'Making multiple edits...'
        };
        setToolUseStatus(toolMessages[data.tool] || `Using ${data.tool}...`);
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
      content: `Connected to ${selectedAgent.agentName || 'Agent'}. You can now chat with the agent.`,
      timestamp: new Date().toISOString(),
      agentId: selectedAgent.id
    }]);

    onAgentSelect?.(selectedAgent.id);
    setShowDropdown(false);
  };

  const handleDisconnect = () => {
    setMessages([]);
    onDisconnect?.();
  };

  return (
    <div className={`flex flex-col h-full bg-gray-950 text-gray-100 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-900 to-purple-900 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-400" />
          <span className="font-semibold">Agent Chat</span>
          {agent ? (
            <span className="text-xs text-gray-300">
              {agent.agentName || `Agent ${agent.id.substring(0, 8)}`}
            </span>
          ) : (
            <span className="text-xs text-gray-400">No agent connected</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Agent Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded flex items-center gap-1 transition-colors"
              title="Select Agent"
            >
              {agent ? (
                <>
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  {agent.agentName || 'Agent'}
                </>
              ) : (
                'Select Agent'
              )}
              <ChevronDown className="w-3 h-3" />
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50">
                <div className="p-2 border-b border-gray-700">
                  <span className="text-xs text-gray-400">Available Agents</span>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {availableAgents.length > 0 ? (
                    availableAgents.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => handleAgentSelection(a)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-800 flex items-center gap-2 transition-colors ${
                          a.id === currentAgentId ? 'bg-gray-800' : ''
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${
                          a.status === 'running' ? 'bg-green-500' : 'bg-yellow-500'
                        }`} />
                        <div className="flex-1">
                          <div className="font-medium">{a.agentName || `Agent ${a.id.substring(0, 8)}`}</div>
                          <div className="text-xs text-gray-400 truncate">{a.task}</div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      No running agents available
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {agent && (
            <button
              onClick={handleDisconnect}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
              title="Disconnect"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !agent ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Bot className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-center">Select an agent from the dropdown to start chatting</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : message.role === 'system'
                    ? 'bg-gray-800 text-gray-300 italic'
                    : 'bg-gray-900 text-gray-100 border border-gray-800'
                }`}
              >
                <div className="flex items-center gap-2 mb-1 text-xs text-gray-400">
                  {message.role === 'user' ? (
                    <>
                      <User className="w-3 h-3" />
                      You
                    </>
                  ) : message.role === 'assistant' ? (
                    <>
                      <Bot className="w-3 h-3" />
                      {agent?.agentName || 'Agent'}
                    </>
                  ) : (
                    <>
                      <Zap className="w-3 h-3" />
                      System
                    </>
                  )}
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {message.content}
                </div>
                <div className="mt-1 text-xs opacity-70">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Thinking/Tool Use Indicator */}
        {(() => {
          console.log('🎨 [THINKING-RENDER] isThinking:', isThinking, 'toolUseStatus:', toolUseStatus, 'isStreaming:', isStreaming, 'streamingContent:', streamingContent);
          const shouldShow = (isThinking || toolUseStatus) && !streamingContent; // Show until we have content
          console.log('🎨 [THINKING-RENDER] Should show thinking:', shouldShow);
          return shouldShow;
        })() && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-900 text-gray-100 border border-gray-800">
              <div className="flex items-center gap-2 mb-1 text-xs text-gray-400">
                <Bot className="w-3 h-3" />
                {agent?.agentName || 'Agent'}
              </div>
              <div className="text-sm leading-relaxed flex items-center gap-2">
                {/* Spinner */}
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                <span className="text-gray-400">
                  {toolUseStatus || 'Thinking...'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Streaming message */}
        {(() => {
          console.log('🎨 [FRONTEND-RENDER] Checking streaming bubble - isStreaming:', isStreaming, 'streamingContent:', streamingContent?.substring(0, 50));
          return isStreaming && streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-900 text-gray-100 border border-gray-800">
                <div className="flex items-center gap-2 mb-1 text-xs text-gray-400">
                  <Bot className="w-3 h-3" />
                  {agent?.agentName || 'Agent'}
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {streamingContent}
                  <span className="inline-block w-2 h-4 ml-1 bg-blue-400 animate-pulse" />
                </div>
              </div>
            </div>
          );
        })()}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-3">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              agent
                ? "Ask the agent about planning, implementation, or debugging..."
                : "Select an agent to start chatting..."
            }
            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
            rows={1}
            disabled={!canInteract || isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || !canInteract || isLoading}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="mt-1 text-xs text-gray-600 flex justify-between">
          <span>Shift+Enter for new line</span>
          {agent && <span className="text-green-500">Connected to {agent.agentName}</span>}
        </div>
      </div>
    </div>
  );
};