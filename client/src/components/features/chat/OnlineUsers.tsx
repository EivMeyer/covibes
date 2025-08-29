import React from 'react';
import type { User } from '@/types';

interface OnlineUsersProps {
  users: User[];
  currentUserId?: string | undefined;
  className?: string;
  compact?: boolean;
}

export const OnlineUsers: React.FC<OnlineUsersProps> = ({
  users,
  currentUserId,
  className = '',
  compact = false,
}) => {
  const sortedUsers = React.useMemo(() => {
    // Sort users: current user first, then alphabetically
    return [...users].sort((a, b) => {
      if (a.id === currentUserId) return -1;
      if (b.id === currentUserId) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [users, currentUserId]);

  if (users.length === 0) {
    return (
      <div className={`text-center ${className}`}>
        <p className="text-sm text-gray-500">No users online</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="flex -space-x-1">
          {sortedUsers.slice(0, 5).map((user) => (
            <div
              key={user.id}
              className="w-6 h-6 rounded-full bg-blue-600 border-2 border-gray-800 flex items-center justify-center"
              title={user.id === currentUserId ? 'You' : user.name}
            >
              <span className="text-xs font-semibold text-white">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
          ))}
          {users.length > 5 && (
            <div className="w-6 h-6 rounded-full bg-gray-600 border-2 border-gray-800 flex items-center justify-center">
              <span className="text-xs font-semibold text-white">
                +{users.length - 5}
              </span>
            </div>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {users.length} online
        </span>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-300">
          Online ({users.length})
        </h4>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-gray-400">Live</span>
        </div>
      </div>

      <div className="space-y-2">
        {sortedUsers.map((user) => {
          const isCurrentUser = user.id === currentUserId;
          
          return (
            <div
              key={user.id}
              className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                isCurrentUser ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-200'
              }`}>
                {user.name.charAt(0).toUpperCase()}
              </div>

              {/* User info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className={`text-sm font-medium truncate ${
                    isCurrentUser ? 'text-blue-400' : 'text-gray-200'
                  }`}>
                    {user.name}
                    {isCurrentUser && <span className="text-xs ml-1">(you)</span>}
                  </p>
                </div>
                {user.email && (
                  <p className="text-xs text-gray-500 truncate">
                    {user.email}
                  </p>
                )}
              </div>

              {/* Status indicator */}
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full" title="Online" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Additional info for large groups */}
      {users.length > 10 && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <p className="text-xs text-gray-500 text-center">
            {users.length} team members active
          </p>
        </div>
      )}
    </div>
  );
};