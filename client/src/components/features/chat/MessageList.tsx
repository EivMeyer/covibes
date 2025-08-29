import React, { useEffect, useRef } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { ChatMessage } from '@/types';

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId?: string | undefined;
  isLoading?: boolean;
  className?: string;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUserId,
  isLoading = false,
  className = '',
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) { // 24 hours
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}h ago`;
    } else {
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const formatMessageContent = (content: string | undefined) => {
    // Handle undefined content gracefully
    if (!content) return '';
    
    // Simple link detection and formatting
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline">$1</a>');
  };

  const getMessageTypeIcon = (type?: ChatMessage['type']) => {
    switch (type) {
      case 'system':
        return (
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'agent':
        return (
          <span className="text-sm">🤖</span>
        );
      default:
        return null;
    }
  };

  const getUserColor = (userName: string) => {
    // Generate consistent colors for users based on their name
    const colors = [
      'bg-gradient-to-br from-blue-500 to-blue-600',
      'bg-gradient-to-br from-green-500 to-green-600',
      'bg-gradient-to-br from-purple-500 to-purple-600',
      'bg-gradient-to-br from-red-500 to-red-600',
      'bg-gradient-to-br from-yellow-500 to-yellow-600',
      'bg-gradient-to-br from-pink-500 to-pink-600',
      'bg-gradient-to-br from-indigo-500 to-indigo-600',
      'bg-gradient-to-br from-teal-500 to-teal-600',
    ];
    let hash = 0;
    for (let i = 0; i < userName.length; i++) {
      hash = userName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getMessageStyles = (message: ChatMessage, isOwn: boolean) => {
    if (message.type === 'system') {
      return {
        container: 'justify-center',
        bubble: 'bg-gray-800/50 text-gray-400 text-xs px-3 py-2 rounded-full border border-gray-700',
        timestamp: 'text-gray-600 text-xs mt-1',
      };
    }

    if (message.type === 'agent') {
      return {
        container: 'justify-start',
        bubble: 'bg-gradient-to-br from-violet-600 to-purple-700 text-white max-w-lg shadow-lg border border-violet-500/30',
        timestamp: 'text-gray-400 text-xs mt-1',
      };
    }

    if (isOwn) {
      return {
        container: 'justify-end',
        bubble: 'bg-gradient-to-br from-blue-600 to-blue-700 text-white max-w-lg ml-auto shadow-lg',
        timestamp: 'text-gray-400 text-xs mt-1 text-right',
      };
    }

    return {
      container: 'justify-start',
      bubble: 'bg-gray-800 text-gray-100 max-w-lg shadow-lg border border-gray-700',
      timestamp: 'text-gray-400 text-xs mt-1',
    };
  };

  if (isLoading && messages.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center space-y-4">
          <LoadingSpinner size="md" />
          <p className="text-gray-400">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center p-8">
          <div className="text-gray-500 text-sm">No messages yet</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`overflow-y-auto p-4 ${className}`}
      style={{ scrollBehavior: 'smooth' }}
    >
      {messages.map((message, index) => {
        const isOwn = message.userId === currentUserId;
        const styles = getMessageStyles(message, isOwn);
        
        // Show date separator for messages on different days
        const showDateSeparator = index === 0 || 
          new Date(message.timestamp).toDateString() !== new Date(messages[index - 1].timestamp).toDateString();

        return (
          <React.Fragment key={message.id || `${message.userId}-${message.timestamp}`}>
            {showDateSeparator && (
              <div className="flex justify-center my-6">
                <div className="text-gray-400 text-xs px-4 py-2 bg-gray-800/50 rounded-full border border-gray-700">
                  {new Date(message.timestamp).toLocaleDateString(undefined, { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
            )}

            <div className={`flex ${styles.container} group mb-4`}>
              {/* Avatar for non-own messages */}
              {!isOwn && message.type !== 'system' && (
                <div className="flex-shrink-0 mr-3 mt-1">
                  {message.type === 'agent' ? (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-md">
                      <span className="text-sm">🤖</span>
                    </div>
                  ) : (
                    <div className={`w-8 h-8 rounded-full ${getUserColor(message.userName)} flex items-center justify-center shadow-md`}>
                      <span className="text-white text-xs font-bold">
                        {message.userName?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col max-w-lg">
                {/* Message header with name and timestamp */}
                {message.type !== 'system' && !isOwn && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-300">
                      {message.type === 'agent' ? '🤖 AI Assistant' : message.userName}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(message.timestamp)}
                    </span>
                  </div>
                )}
                
                {/* Message bubble */}
                <div className={`${styles.bubble} px-4 py-3 rounded-2xl text-sm break-words relative`}>
                  {/* Own message header */}
                  {isOwn && message.type !== 'system' && (
                    <div className="flex items-center justify-end gap-2 mb-1">
                      <span className="text-xs text-gray-300 opacity-75">
                        {formatTimestamp(message.timestamp)}
                      </span>
                      <span className="text-sm font-medium text-white/90">You</span>
                    </div>
                  )}
                  
                  {/* Message content */}
                  <div 
                    className={message.type === 'system' ? 'text-center' : ''}
                    dangerouslySetInnerHTML={{ 
                      __html: formatMessageContent(message.content || message.message) 
                    }}
                  />
                  
                  {/* System message timestamp */}
                  {message.type === 'system' && (
                    <div className="text-xs text-gray-500 mt-1 text-center">
                      {formatTimestamp(message.timestamp)}
                    </div>
                  )}
                </div>
              </div>

              {/* Avatar for own messages */}
              {isOwn && message.type !== 'system' && (
                <div className="flex-shrink-0 ml-3 mt-1">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-md">
                    <span className="text-white text-xs font-bold">
                      {message.userName?.charAt(0)?.toUpperCase() || 'Y'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}
      
      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  );
};