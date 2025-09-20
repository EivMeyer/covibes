import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useNotification } from '@/components/ui/Notification';
import { MessageList } from './MessageList';
import { OnlineUsers } from './OnlineUsers';

interface ChatInterfaceProps {
  className?: string;
  user: any;
  chatMessages: any[];
  onlineUsers: any[];
  sendChatMessage: (content: string) => void;
  isSocketConnected: () => boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  className = '',
  user,
  chatMessages: messages,
  onlineUsers,
  sendChatMessage,
  isSocketConnected,
}) => {
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [fontSize, setFontSize] = useState(12);
  const inputRef = useRef<HTMLInputElement>(null);

  const { addNotification } = useNotification();

  // Auto-focus input when component mounts
  useEffect(() => {
    if (inputRef.current && isSocketConnected()) {
      inputRef.current.focus();
    }
  }, [isSocketConnected]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageText.trim() || isSending || !isSocketConnected()) {
      return;
    }

    if (!user) {
      addNotification({
        message: 'You must be logged in to send messages',
        type: 'error',
      });
      return;
    }

    setIsSending(true);
    try {
      sendChatMessage(messageText.trim());
      setMessageText('');
      
      // Re-focus input after sending
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      addNotification({
        message: error instanceof Error ? error.message : 'Failed to send message',
        type: 'error',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as any);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);
  };

  const zoomIn = () => {
    setFontSize(prev => Math.min(prev + 2, 24));
  };

  const zoomOut = () => {
    setFontSize(prev => Math.max(prev - 2, 10));
  };

  const resetZoom = () => {
    setFontSize(14);
  };

  return (
    <div className={`flex flex-col h-full ${className} backdrop-blur-sm bg-gray-900/80 border border-gray-700/50`}>
      {/* Header with zoom controls */}
      <div className="px-3 py-2 border-b border-gray-700/60 text-sm text-gray-400 flex items-center justify-between">
        <span>Chat • {onlineUsers.length} online</span>
        <div className="flex items-center space-x-1">
          <button
            onClick={zoomOut}
            className="p-1 text-gray-400 hover:text-white transition-colors"
            title="Zoom out"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
          </button>
          <span className="text-xs text-gray-500 min-w-[1.5rem] text-center">{fontSize}px</span>
          <button
            onClick={zoomIn}
            className="p-1 text-gray-400 hover:text-white transition-colors"
            title="Zoom in"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </button>
          <button
            onClick={resetZoom}
            className="p-1 text-gray-400 hover:text-white transition-colors"
            title="Reset zoom"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-hidden relative" style={{ fontSize: `${fontSize}px` }}>
        {/* Scanline effect */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background: 'linear-gradient(to bottom, transparent 0%, rgba(0,255,65,0.08) 50%, transparent 100%)',
            height: '2px',
            animation: 'scanline 8s linear infinite'
          }}
        />
        <MessageList
          messages={messages}
          currentUserId={user?.id}
          isLoading={false}
        />
      </div>

      {/* Simple input */}
      <div className="p-3 border-t border-gray-700">
        {!isSocketConnected() && (
          <div className="mb-2 text-xs text-red-400">
            Connecting...
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={messageText}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              placeholder="Type a message..."
              disabled={!isSocketConnected() || isSending}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-l-md text-sm text-white placeholder-gray-400 focus:outline-none focus:border-[#00ff41]/50 focus:shadow-[0_0_12px_rgba(0,255,65,0.25)] transition-all duration-300"
              autoComplete="off"
              style={{ fontFamily: 'JetBrains Mono, Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace' }}
            />
            {inputRef.current === document.activeElement && (
              <div
                className="absolute top-1/2 transform -translate-y-1/2 pointer-events-none"
                style={{
                  left: `${3 + (messageText.length * 8.4)}px`,
                  animation: 'terminal-cursor 1s infinite'
                }}
              >
                <span className="text-[#00ff41] text-sm font-mono">█</span>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={!messageText.trim() || !isSocketConnected() || isSending}
            className="px-3 py-2 bg-gray-700 border border-l-0 border-gray-600 rounded-r-md text-gray-300 hover:bg-gray-600 hover:shadow-[0_0_8px_rgba(0,255,65,0.15)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
          >
            {isSending ? '•••' : '→'}
          </button>
        </form>
      </div>
    </div>
  );
};