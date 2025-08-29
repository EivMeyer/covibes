import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
// Terminal components removed
import { useAuth } from '@/hooks/useAuth';
import { useAgents } from '@/hooks/useAgents';
import { useNotification } from '@/components/ui/Notification';
import { useSocket } from '@/hooks/useSocket';
import { socketService } from '@/services/socket';
import { apiService } from '@/services/api';
import io from 'socket.io-client';
import type { AgentDetails } from '@/types';

interface AgentOutputModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: AgentDetails | null;
}

export const AgentOutputModal: React.FC<AgentOutputModalProps> = ({
  isOpen,
  onClose,
  agent,
}) => {
  const [terminalCols, setTerminalCols] = useState(80);
  const [terminalRows, setTerminalRows] = useState(24);
  const [terminalConnected, setTerminalConnected] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(true); // Terminal starts open
  const [agentSocket, setAgentSocket] = useState<any>(null); // Persistent socket for this agent
  const outputRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  // Get token directly from apiService since useAuth doesn't expose it
  const token = (apiService as any).getToken();
  const { sendInputToAgent } = useAgents();
  const { addNotification } = useNotification();
  const socketHook = useSocket(token); // Use the socket hook for connection status with token
  const [rawSocket, setRawSocket] = useState<any>(null);
  
  // Get teamId from token safely
  const teamId = (() => {
    try {
      if (!token || typeof token !== 'string') return null;
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      return JSON.parse(atob(parts[1])).teamId;
    } catch {
      return null;
    }
  })();
  
  // Create persistent socket for this agent
  useEffect(() => {
    if (!agent?.id || !token || !teamId) return;
    if (agentSocket) return; // Already have socket

    console.log('🔌 Creating persistent socket for agent:', agent.id);
    
    const socket = io();
    
    socket.on('connect', () => {
      console.log('🔌 Agent socket connected, joining team...');
      socket.emit('join-team', { teamId, token });
    });

    socket.on('team-joined', () => {
      console.log('✅ Agent socket joined team - socket ready for terminal');
      // Only set socket state after successful team join
      setAgentSocket(socket);
    });
    
    return () => {
      // Don't disconnect socket here - only when component unmounts
      // This allows closing/reopening terminal without reconnection
    };
  }, [agent?.id, token, teamId]);

  // Cleanup socket only when component unmounts or modal permanently closes
  useEffect(() => {
    if (!isOpen && agentSocket) {
      console.log('🔌 Modal closed - disconnecting agent socket');
      agentSocket.disconnect();
      setAgentSocket(null);
    }
  }, [isOpen, agentSocket]);
  
  const isOwner = agent?.userId === user?.id;
  const canInteract = isOwner && (agent?.status === 'running' || agent?.status === 'starting');
  // Show terminal if user can interact and terminal is open
  const showTerminal = canInteract && token && teamId && terminalOpen;
  
  console.log('AgentOutputModal debug:', {
    canInteract,
    socketConnected: socketHook.isConnected,
    rawSocket: !!rawSocket,
    showTerminal,
    terminalConnected,
    agentStatus: agent?.status,
    isOwner,
    hasToken: !!token,
    hasTeamId: !!teamId,
    teamId: teamId
  });

  // Listen for terminal connection events
  useEffect(() => {
    if (!rawSocket || !agent?.id) return;

    const handleTerminalConnected = (data: { agentId: string }) => {
      if (data.agentId === agent.id) {
        console.log('🖥️ Terminal connected for agent:', agent.id);
        setTerminalConnected(true);
      }
    };

    const handleTerminalError = (data: { agentId: string; error: string }) => {
      if (data.agentId === agent.id) {
        console.error('🖥️ Terminal error for agent:', agent.id, data.error);
        setTerminalConnected(false);
        addNotification({
          type: 'error',
          title: 'Terminal Connection Failed', 
          message: data.error
        });
      }
    };

    const handleTerminalDisconnected = (data: { agentId: string }) => {
      if (data.agentId === agent.id) {
        console.log('🖥️ Terminal disconnected for agent:', agent.id);
        setTerminalConnected(false);
      }
    };

    rawSocket.on('terminal_connected', handleTerminalConnected);
    rawSocket.on('terminal_error', handleTerminalError);
    rawSocket.on('terminal_disconnected', handleTerminalDisconnected);

    return () => {
      rawSocket.off('terminal_connected', handleTerminalConnected);
      rawSocket.off('terminal_error', handleTerminalError);
      rawSocket.off('terminal_disconnected', handleTerminalDisconnected);
    };
  }, [rawSocket, agent?.id, addNotification]);

  // Reset terminal connection state when agent or modal changes
  useEffect(() => {
    setTerminalConnected(false);
  }, [agent?.id, isOpen]);

  // Auto-scroll to bottom when new output arrives (for non-terminal mode)
  useEffect(() => {
    if (!showTerminal && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [agent?.output, showTerminal]);

  const handleTerminalData = (data: string) => {
    // Terminal input is handled directly by the Terminal component
    console.log('Terminal input:', data);
  };

  const handleTerminalResize = (cols: number, rows: number) => {
    setTerminalCols(cols);
    setTerminalRows(rows);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getStatusColor = (status: AgentDetails['status']) => {
    switch (status) {
      case 'running':
        return 'text-green-400';
      case 'starting':
        return 'text-yellow-400';
      case 'completed':
        return 'text-blue-400';
      case 'failed':
        return 'text-red-400';
      case 'killed':
        return 'text-gray-400';
      default:
        return 'text-gray-500';
    }
  };

  if (!agent) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl" 
      className="h-5/6"
    >
      {/* Minimal terminal-style header */}
      <div className="flex items-center justify-between px-3 py-1 bg-gray-900 border-b border-gray-700 text-xs">
        <div className="flex items-center space-x-2 text-gray-400">
          <span>{agent.userName}</span>
          <span>•</span> 
          <span className={
            agent.status === 'running' ? 'text-green-400' :
            agent.status === 'starting' ? 'text-yellow-400' : 
            agent.status === 'failed' ? 'text-red-400' :
            'text-gray-500'
          }>
            {agent.status}
          </span>
          {isOwner && <span className="text-blue-400">yours</span>}
        </div>
        
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 px-2 py-1"
        >
          ×
        </button>
      </div>

      {/* Full terminal */}
      <div className="flex-1 bg-black">
        {canInteract && showTerminal ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-lg mb-2">🚫</div>
              <div className="text-sm">Terminal Removed</div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center bg-black text-gray-400">
            {agent.status === 'starting' ? (
              <div className="text-center">
                <div className="animate-pulse">Starting...</div>
                <div className="text-xs mt-2">Terminal will open when ready</div>
              </div>
            ) : canInteract ? (
              <button 
                onClick={() => setTerminalOpen(true)}
                className="text-green-400 hover:text-green-300 font-mono text-sm"
              >
                $ open terminal
              </button>
            ) : (
              <div className="text-center">
                <div className="text-gray-500">Read-only view</div>
                <div className="text-xs mt-1">{!isOwner ? 'Not your agent' : 'Agent stopped'}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};