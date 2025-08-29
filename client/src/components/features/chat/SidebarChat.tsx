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

interface SidebarChatProps {
  user: User;
  chatMessages: Message[];
  sendChatMessage: (content: string) => void;
  isSocketConnected: () => boolean;
  className?: string;
}

export const SidebarChat: React.FC<SidebarChatProps> = ({
  user,
  chatMessages = [],
  sendChatMessage,
  isSocketConnected,
  className = ''
}) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    if (!isSocketConnected()) {
      console.warn('Cannot send message: not connected to server');
      return;
    }

    sendChatMessage(newMessage.trim());
    setNewMessage('');
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
    <div className={`flex flex-col h-full bg-midnight-800 ${className}`}>
      {/* Chat Messages - Super Compact */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0 text-xs">
        {chatMessages.length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            <div className="text-xs">No messages</div>
          </div>
        ) : (
          chatMessages.map((message) => {
            const isOwnMessage = message.userId === user?.id;
            const userName = isOwnMessage ? 'You' : message.user.userName.split(' ')[0]; // First name only
            return (
              <div key={message.id} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-medium truncate ${
                    isOwnMessage ? 'text-electric' : 'text-gray-300'
                  }`}>
                    {userName}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {formatTime(message.createdAt)}
                  </span>
                </div>
                <div className={`text-xs p-1.5 rounded max-w-full break-words ${
                  isOwnMessage 
                    ? 'bg-electric/20 text-white border-l-2 border-electric' 
                    : 'bg-midnight-700 text-gray-200'
                }`}>
                  {message.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input - Ultra Compact */}
      <div className="border-t border-midnight-600 p-2">
        <div className="flex space-x-1">
          <Input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isConnected ? "Message..." : "Connecting..."}
            disabled={!isConnected}
            className="flex-1 text-xs py-1 px-2 h-7"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || !isConnected}
            size="sm"
            className="px-2 h-7 min-w-0"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </Button>
        </div>
        
        {!isConnected && (
          <div className="text-xs text-amber-400 mt-1 flex items-center space-x-1">
            <div className="w-1 h-1 bg-amber-400 rounded-full animate-pulse" />
            <span className="text-xs">Reconnecting...</span>
          </div>
        )}
      </div>
    </div>
  );
};