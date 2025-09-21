import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface Message {
  id: string;
  content: string;
  userId: string;
  userName: string;
  createdAt: string;
}

interface User {
  id: string;
  userName: string;
}

interface ChatTileProps {
  user: User;
  chatMessages: Message[];
  sendChatMessage: (content: string) => void;
  isSocketConnected: () => boolean;
  setLastActiveChat?: (() => void) | undefined;
}

export const ChatTile: React.FC<ChatTileProps> = ({
  user,
  chatMessages = [],
  sendChatMessage,
  isSocketConnected,
  setLastActiveChat,
}) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom ONLY for new messages AFTER user has been active
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [previousMessageCount, setPreviousMessageCount] = useState(0);

  // Only set chat as active when user actually sends a message, not when mounting

  useEffect(() => {
    // Only auto-scroll if:
    // 1. User has sent at least one message (interacted)
    // 2. We have NEW messages (not initial load)
    // 3. User is near the bottom already
    if (hasUserInteracted && chatMessages.length > previousMessageCount && previousMessageCount > 0) {
      const container = messagesEndRef.current?.parentElement;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        if (isNearBottom) {
          // Scroll the container itself, not the page
          container.scrollTop = container.scrollHeight;
        }
      }
    }
    setPreviousMessageCount(chatMessages.length);
  }, [chatMessages.length, hasUserInteracted]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    if (!isSocketConnected()) {
      console.warn('Cannot send message: not connected to server');
      return;
    }

    sendChatMessage(newMessage.trim());
    // Track chat as the last active target for inspector auto-injection
    if (setLastActiveChat) {
      setLastActiveChat();
    }
    setNewMessage('');
    setHasUserInteracted(true); // User has now interacted
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      // Fallback to current time if invalid
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const isConnected = isSocketConnected();

  return (
    <div className="flex flex-col h-full bg-gray-900/80 backdrop-blur-sm border border-gray-700/50">
      {/* Chat Status Bar - Modern Terminal */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-gray-900/90 to-black/80 border-b border-[#00ff41]/20 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-[#00ff41] text-xs font-mono">TEAM://CHAT</span>
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-[#00ff41] shadow-[0_0_8px_rgba(0,255,65,0.6)]' : 'bg-amber-400 animate-pulse'
            }`} />
          </div>
          <span className="text-xs text-gray-500 font-mono">
            [{chatMessages.length} msgs]
          </span>
        </div>
        <div className="text-[10px] text-gray-600 font-mono">
          v2.0.1
        </div>
      </div>

      {/* Chat Messages - Modern Terminal Style */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 bg-black/40 relative">
        {/* Subtle scanline effect */}
        <div
          className="absolute inset-0 pointer-events-none z-10 opacity-30"
          style={{
            background: 'linear-gradient(to bottom, transparent 0%, rgba(0,255,65,0.03) 50%, transparent 100%)',
            height: '4px',
            animation: 'scanline 12s linear infinite'
          }}
        />
        {chatMessages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <div className="text-sm font-mono opacity-60">{'> No messages yet_'}</div>
          </div>
        ) : (
          chatMessages.map((message, index) => {
            const isOwnMessage = message.userId === user?.id;
            const userName = isOwnMessage ? 'You' : message.userName.split(' ')[0];
            const isFirstFromUser = index === 0 || chatMessages[index - 1].userId !== message.userId;

            return (
              <div
                key={message.id}
                className={`animate-fadeIn ${isFirstFromUser ? 'mt-3' : 'mt-1'}`}
                style={{animationDelay: `${index * 0.02}s`}}
              >
                <div className={`
                  flex gap-3 group
                  ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}
                `}>
                  {/* Avatar/Icon */}
                  <div className={`
                    flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold
                    ${isFirstFromUser ? 'visible' : 'invisible'}
                    ${isOwnMessage
                      ? 'bg-gradient-to-br from-[#00ff41]/20 to-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/30'
                      : 'bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 text-cyan-400 border border-cyan-500/30'
                    }
                  `}>
                    {userName[0].toUpperCase()}
                  </div>

                  {/* Message Content */}
                  <div className={`
                    flex-1 max-w-[75%]
                    ${isOwnMessage ? 'items-end' : 'items-start'}
                  `}>
                    {/* Username and Time - Only show if first message from user */}
                    {isFirstFromUser && (
                      <div className={`
                        flex items-baseline gap-2 mb-1 px-1
                        ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}
                      `}>
                        <span className={`
                          text-xs font-semibold
                          ${isOwnMessage ? 'text-[#00ff41]' : 'text-cyan-400'}
                        `}>
                          {userName}
                        </span>
                        <span className="text-[10px] text-gray-600 font-mono">
                          {formatTime(message.createdAt)}
                        </span>
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div className={`
                      inline-block px-3 py-2 rounded-lg
                      ${isOwnMessage
                        ? 'bg-[#00ff41]/10 border-l-2 border-[#00ff41]/50 text-gray-100'
                        : 'bg-gray-800/50 border-l-2 border-cyan-500/50 text-gray-200'
                      }
                      hover:bg-opacity-80 transition-all duration-200
                    `}>
                      <p className="text-sm leading-relaxed break-words">
                        {message.content}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input - Modern Terminal */}
      <div className="border-t border-[#00ff41]/20 p-3 bg-gradient-to-b from-gray-900/80 to-black/90 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-[#00ff41] text-sm font-mono">{'>'}</span>
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isConnected ? "Type your message..." : "Connecting..."}
              disabled={!isConnected}
              className="w-full bg-black/50 text-white text-sm px-3 py-2 pr-8 border border-gray-700/50 rounded-md focus:outline-none focus:border-[#00ff41]/60 focus:shadow-[0_0_15px_rgba(0,255,65,0.2)] transition-all duration-300 font-mono placeholder-gray-600"
            />
            {inputRef.current === document.activeElement && !newMessage && (
              <div
                className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none"
                style={{
                  animation: 'terminal-cursor 1s infinite'
                }}
              >
                <span className="text-[#00ff41] opacity-50">█</span>
              </div>
            )}
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || !isConnected}
            className="px-4 py-2 bg-gradient-to-r from-[#00ff41]/20 to-[#00ff41]/10 border border-[#00ff41]/40 text-[#00ff41] text-sm font-mono rounded-md disabled:opacity-30 hover:from-[#00ff41]/30 hover:to-[#00ff41]/20 hover:shadow-[0_0_15px_rgba(0,255,65,0.3)] transition-all duration-300 flex items-center gap-1"
          >
            <span>Send</span>
            <span className="text-xs">↵</span>
          </button>
        </div>
      </div>
    </div>
  );
};