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
    <div className={`${className}`}>
      {sortedUsers.length === 0 ? (
        <div className="text-center text-gray-500 text-[10px] py-1">
          No users online
        </div>
      ) : (
        <div className="space-y-0.5">
          {sortedUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-midnight-700/30 transition-colors"
            >
              {/* Status dot only */}
              <div
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getStatusColor(user)}`}
              />

              {/* Name */}
              <span className={`text-xs ${user.id === currentUserId ? 'text-white' : 'text-slate-300'} truncate`}>
                {user.userName.split(' ')[0]}
              </span>

              {/* Time ago for offline users */}
              {!user.isOnline && (
                <span className="text-[10px] text-gray-600 ml-auto">
                  {getTimeAgo(user.lastSeen)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Team Stats - Super compact */}
      <div className="border-t border-midnight-700/30 mt-1.5 pt-1">
        <div className="text-[10px] text-gray-600 px-2">
          {onlineUsers.filter(u => u.isOnline).length}/{onlineUsers.length} online
        </div>
      </div>
    </div>
  );
};