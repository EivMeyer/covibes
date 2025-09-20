import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface Message {
  id: string;
  content: string;
  userId: string;
  user: {
    userName: string;
  };
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
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isConnected = isSocketConnected();

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Chat Status Bar - Similar to Terminal */}
      <div className="flex items-center justify-between px-2 py-1 bg-midnight-900 border-b border-midnight-700">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-400' : 'bg-amber-400 animate-pulse'
          }`} />
          <span className="text-xs text-gray-400">
            Team Chat • {chatMessages.length} messages
          </span>
        </div>
      </div>

      {/* Chat Messages - Compact like terminal */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0 bg-black">
        {chatMessages.length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            <div className="text-xs">No messages yet</div>
          </div>
        ) : (
          chatMessages.map((message) => {
            const isOwnMessage = message.userId === user?.id;
            const userName = isOwnMessage ? 'You' : message.user.userName.split(' ')[0];
            return (
              <div key={message.id} className="text-xs font-mono">
                <span className={`${
                  isOwnMessage ? 'text-electric' : 'text-gray-400'
                }`}>
                  [{formatTime(message.createdAt)}] {userName}:
                </span>
                <span className="text-gray-200 ml-1">
                  {message.content}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input - Compact */}
      <div className="border-t border-midnight-700 p-2 bg-midnight-900">
        <div className="flex space-x-1">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isConnected ? "Message..." : "Connecting..."}
            disabled={!isConnected}
            className="flex-1 bg-black text-white text-xs px-2 py-1 border border-midnight-600 rounded focus:outline-none focus:border-electric"
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || !isConnected}
            className="px-3 py-1 bg-electric text-midnight-900 text-xs font-medium rounded disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};