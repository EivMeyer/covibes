import React, { useState, useRef, useEffect } from 'react';
import { ConnectionDiagnostics } from '@/components/ui/ConnectionDiagnostics';

interface MobileTeamViewProps {
  team: any;
  user: any;
  chatMessages: any[];
  onlineUsers: any[];
  sendChatMessage: (message: string) => void;
  isSocketConnected: boolean;
  socket?: any;
  logout?: () => void;
}

export const MobileTeamView: React.FC<MobileTeamViewProps> = ({
  team,
  user,
  chatMessages,
  onlineUsers,
  sendChatMessage,
  isSocketConnected,
  socket,
  logout
}) => {
  const [message, setMessage] = useState('');
  const [showConnectionDiagnostics, setShowConnectionDiagnostics] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSendMessage = () => {
    if (message.trim() && isSocketConnected) {
      sendChatMessage(message.trim());
      setMessage('');
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-midnight-900">
      {/* Header - Fixed to never overflow */}
      <div className="px-2 py-2 bg-midnight-800 border-b border-midnight-600 overflow-hidden">
        {/* Top row: Team name and logout - with min-width: 0 to allow truncation */}
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-sm font-semibold text-white truncate min-w-0 flex-1">{team?.name || 'Team'}</h2>
          {/* Connection status indicator - compact */}
          <button
            onClick={() => setShowConnectionDiagnostics(true)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-midnight-700 flex-shrink-0"
            title="Connection status - tap for details"
          >
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isSocketConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
            <span className={`text-xs ${isSocketConnected ? 'text-green-400' : 'text-red-400'}`}>
              {isSocketConnected ? 'On' : 'Off'}
            </span>
          </button>
          {/* Logout button - Icon only */}
          {logout && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to logout?')) {
                  logout();
                }
              }}
              className="p-1 bg-red-500/20 text-red-400 rounded flex-shrink-0"
              title="Logout"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>
        
        {/* Bottom row: Code and user count */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="truncate">Code: {team?.inviteCode}</span>
          <span className="flex-shrink-0">{onlineUsers.length} users online</span>
        </div>
      </div>

      {/* Online Users Bar */}
      {onlineUsers.length > 0 && (
        <div className="px-4 py-2 bg-midnight-800/50 border-b border-midnight-700">
          <div className="flex items-center space-x-2 overflow-x-auto">
            {onlineUsers.map((onlineUser: any) => (
              <div
                key={onlineUser.id}
                className="flex items-center space-x-1.5 bg-midnight-700 px-2 py-1 rounded-full flex-shrink-0"
              >
                <div className="w-2 h-2 bg-green-400 rounded-full" />
                <span className="text-xs text-gray-300">
                  {onlineUser.id === user?.id ? 'You' : onlineUser.userName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {chatMessages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">No messages yet</p>
            <p className="text-gray-600 text-xs mt-1">Be the first to say hello!</p>
          </div>
        ) : (
          chatMessages.map((msg: any, index: number) => {
            const isOwnMessage = msg.userId === user?.id;
            const messageContent = msg.message || msg.content || '';
            const messageTime = msg.timestamp || msg.createdAt;

            return (
              <div
                key={msg.id || index}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] ${isOwnMessage ? 'order-2' : ''}`}>
                  {!isOwnMessage && (
                    <div className="text-xs text-gray-400 mb-1">
                      {msg.userName || 'Unknown'}
                    </div>
                  )}
                  <div className={`px-3 py-2 rounded-lg ${
                    isOwnMessage
                      ? 'bg-electric text-midnight-900'
                      : 'bg-midnight-700 text-gray-200'
                  }`}>
                    <p className="text-sm break-words">{messageContent}</p>
                  </div>
                  {messageTime && (
                    <div className="text-[10px] text-gray-500 mt-1">
                      {new Date(messageTime).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="px-4 py-3 bg-midnight-800 border-t border-midnight-600">
        <div className="flex items-center space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isSocketConnected ? "Type a message..." : "Disconnected..."}
            disabled={!isSocketConnected}
            className="flex-1 px-3 py-2 bg-midnight-700 text-white text-sm rounded-lg border border-midnight-600 focus:outline-none focus:border-electric disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSendMessage}
            disabled={!message.trim() || !isSocketConnected}
            className={`p-2 rounded-lg transition-all ${
              message.trim() && isSocketConnected
                ? 'bg-electric text-midnight-900 hover:bg-electric/80'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>

      {/* Connection Diagnostics Modal */}
      <ConnectionDiagnostics
        isOpen={showConnectionDiagnostics}
        onClose={() => setShowConnectionDiagnostics(false)}
        isConnected={isSocketConnected}
        socket={socket}
      />
    </div>
  );
};