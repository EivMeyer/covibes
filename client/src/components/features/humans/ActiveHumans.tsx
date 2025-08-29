import React from 'react';

interface User {
  id: string;
  userName: string;
  lastSeen?: Date;
  isOnline: boolean;
}

interface ActiveHumansProps {
  onlineUsers: User[];
  currentUserId?: string;
  className?: string;
}

export const ActiveHumans: React.FC<ActiveHumansProps> = ({
  onlineUsers = [],
  currentUserId,
  className = ''
}) => {
  const getStatusColor = (user: User) => {
    if (user.isOnline) {
      return 'bg-green-400';
    }
    return 'bg-gray-500';
  };

  const getTimeAgo = (lastSeen?: Date) => {
    if (!lastSeen) return 'unknown';
    
    const now = new Date();
    const diff = now.getTime() - lastSeen.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const sortedUsers = [...onlineUsers].sort((a, b) => {
    // Current user first
    if (a.id === currentUserId) return -1;
    if (b.id === currentUserId) return 1;
    
    // Online users before offline
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    
    // Alphabetical by name
    return a.userName.localeCompare(b.userName);
  });

  return (
    <div className={`space-y-1 ${className}`}>
      {sortedUsers.length === 0 ? (
        <div className="text-center text-gray-500 text-xs py-2">
          No users online
        </div>
      ) : (
        sortedUsers.map((user) => (
          <div
            key={user.id}
            className="flex items-center space-x-2 p-1 rounded hover:bg-midnight-700 transition-colors"
          >
            {/* Status Indicator - Smaller */}
            <div className="relative flex-shrink-0">
              <div className="w-6 h-6 bg-midnight-600 rounded-full flex items-center justify-center">
                <span className="text-xs text-white uppercase">
                  {user.userName.charAt(0)}
                </span>
              </div>
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-midnight-800 ${getStatusColor(user)}`}
              />
            </div>

            {/* User Info - Compact */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-1">
                <span className="text-xs font-medium text-white truncate">
                  {user.userName.split(' ')[0]} {/* First name only */}
                </span>
                {user.id === currentUserId && (
                  <span className="text-xs bg-electric/30 text-electric px-1 rounded">
                    you
                  </span>
                )}
              </div>
              
              {!user.isOnline && (
                <div className="text-xs text-gray-500">
                  {getTimeAgo(user.lastSeen)}
                </div>
              )}
            </div>
          </div>
        ))
      )}
      
      {/* Team Stats - Compact */}
      <div className="border-t border-midnight-600 pt-1 mt-2">
        <div className="text-xs text-gray-500 px-1">
          {onlineUsers.filter(u => u.isOnline).length}/{onlineUsers.length} online
        </div>
      </div>
    </div>
  );
};