import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useNotification } from '@/components/ui/Notification';
import { useVMPing } from '@/hooks/useVMPing';

interface HeaderProps {
  user?: any;
  team?: any;
  logout?: () => void;
  isSocketConnected?: () => boolean;
  onConfigureVM?: () => void;
  onConfigureRepo?: () => void;
  showVMConfig?: boolean;
  showRepoConfig?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  team,
  logout,
  isSocketConnected,
  onConfigureVM,
  onConfigureRepo,
  showVMConfig = true,
  showRepoConfig = true,
}) => {
  const isConnected = isSocketConnected ? isSocketConnected() : false;
  const { addNotification } = useNotification();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // VM ping status - disabled for now due to 403 errors
  const pingStatus = { status: 'online', ping: 45 };

  const handleLogout = async () => {
    if (!logout) {
      console.error('Logout function not provided');
      return;
    }

    if (!confirm('Are you sure you want to logout?')) {
      return;
    }

    setIsLoggingOut(true);
    try {
      await logout();
      addNotification({
        message: 'Logged out successfully',
        type: 'success',
      });
    } catch (error) {
      console.error('Logout error:', error);
      addNotification({
        message: 'Logout failed',
        type: 'error',
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const copyInviteCode = async () => {
    if (!team?.inviteCode) return;
    
    try {
      await navigator.clipboard.writeText(team.inviteCode);
      addNotification({
        message: 'Invite code copied to clipboard!',
        type: 'success',
      });
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = team.inviteCode;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        addNotification({
          message: 'Invite code copied to clipboard!',
          type: 'success',
        });
      } catch (fallbackError) {
        addNotification({
          message: 'Could not copy invite code',
          type: 'error',
        });
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <header className="bg-midnight-800 border-b border-midnight-600 px-4 py-3 shadow-card">
      <div className="flex justify-between items-center">
        {/* Left side - Brand and team info */}
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-xl font-bold text-white">CoVibe</h1>
            {team && (
              <p className="text-sm text-gray-400">
                {team.name}
              </p>
            )}
          </div>
          
          {team?.inviteCode && (
            <button
              onClick={copyInviteCode}
              className="group flex items-center space-x-2 px-3 py-1 bg-midnight-700 hover:bg-midnight-600 rounded-lg transition-all duration-200 hover:scale-105"
              title="Click to copy invite code"
            >
              <span className="text-xs text-gray-400 group-hover:text-gray-300">Code:</span>
              <span className="text-sm font-mono text-electric group-hover:text-electric/80">
                {team.inviteCode}
              </span>
              <svg className="w-4 h-4 text-gray-500 group-hover:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          )}

          {/* Connection status */}
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-coral'}`} />
            <span className={`text-xs ${isConnected ? 'text-success' : 'text-coral'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Right side - Status, Actions and user info */}
        <div className="flex items-center space-x-4">
          {/* Repository Status */}
          {showRepoConfig && (
            <div className="hidden lg:flex items-center space-x-2 px-3 py-2 bg-midnight-700 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${team?.repositoryUrl ? 'bg-success animate-pulse' : 'bg-midnight-500'}`} />
              <div className="text-sm">
                <span className="text-gray-400 mr-2">Repo:</span>
                <span className={team?.repositoryUrl ? 'text-success' : 'text-gray-400'}>
                  {team?.repositoryUrl ? 
                    (() => {
                      try {
                        const match = team.repositoryUrl.match(/github\.com\/([^\/]+\/[^\/]+)/) || 
                                     team.repositoryUrl.match(/gitlab\.com\/([^\/]+\/[^\/]+)/);
                        return match ? match[1].replace('.git', '') : 'Connected';
                      } catch {
                        return 'Connected';
                      }
                    })() : 'Not configured'
                  }
                </span>
              </div>
              <Button
                size="xs"
                variant={team?.repositoryUrl ? 'secondary' : 'success'}
                onClick={onConfigureRepo}
                className="ml-2"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={team?.repositoryUrl ? "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" : "M12 6v6m0 0v6m0-6h6m-6 0H6"} />
                </svg>
              </Button>
            </div>
          )}

          {/* VM Status with Ping */}
          {showVMConfig && (
            <div className="hidden lg:flex items-center space-x-2 px-3 py-2 bg-midnight-700 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${
                pingStatus.status === 'online' ? 'bg-green-500' :
                pingStatus.status === 'checking' ? 'bg-yellow-500 animate-pulse' :
                pingStatus.status === 'offline' ? 'bg-red-500' :
                'bg-gray-500'
              }`} />
              <div className="text-sm">
                <span className="text-gray-400 mr-2">VM:</span>
                <span className={
                  pingStatus.status === 'online' ? 'text-green-400' :
                  pingStatus.status === 'checking' ? 'text-yellow-400' :
                  'text-gray-400'
                }>
                  {pingStatus.status === 'online' && pingStatus.ping ? `${pingStatus.ping}ms` :
                   pingStatus.status === 'checking' ? 'checking...' :
                   pingStatus.status === 'offline' ? 'offline' :
                   'error'}
                </span>
              </div>
              <Button
                size="xs"
                variant="secondary"
                onClick={onConfigureVM}
                className="ml-2"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                </svg>
              </Button>
            </div>
          )}

          {/* Simple buttons for smaller screens */}
          <div className="lg:hidden flex items-center space-x-2">
            {showRepoConfig && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onConfigureRepo}
                className="hidden sm:inline-flex"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Repo
              </Button>
            )}

            {showVMConfig && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onConfigureVM}
                className="hidden sm:inline-flex"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                VM
              </Button>
            )}
          </div>

          {/* User info and logout */}
          <div className="flex items-center space-x-3 pl-3 border-l border-gray-600">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-white">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-gray-400">
                {user?.email}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {/* Mobile menu button */}
              <div className="sm:hidden relative">
                <details className="relative">
                  <summary className="list-none cursor-pointer">
                    <Button size="sm" variant="secondary">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </Button>
                  </summary>
                  <div className="absolute right-0 mt-2 w-48 glass rounded-lg shadow-card-hover z-10">
                    <div className="p-3 border-b border-midnight-600">
                      <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                      <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                    </div>
                    <div className="p-2 space-y-1">
                      {showRepoConfig && (
                        <button
                          onClick={onConfigureRepo}
                          className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-midnight-700 rounded-lg transition-colors duration-200"
                        >
                          Configure Repository
                        </button>
                      )}
                      {showVMConfig && (
                        <button
                          onClick={onConfigureVM}
                          className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-midnight-700 rounded-lg transition-colors duration-200"
                        >
                          Configure VM
                        </button>
                      )}
                    </div>
                  </div>
                </details>
              </div>

              <Button
                size="sm"
                variant="danger"
                onClick={handleLogout}
                loading={isLoggingOut}
                disabled={isLoggingOut}
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};