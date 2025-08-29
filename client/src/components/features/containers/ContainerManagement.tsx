import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useNotification } from '@/components/ui/Notification';
import type { ContainerInfo, ContainerStatusEvent, ContainerResourceEvent } from '@/types';

interface ContainerManagementProps {
  teamId: string;
  containers: ContainerInfo[];
  onContainerAction: (action: string, containerId: string) => void;
  onRefresh?: () => void;
}

interface ContainerWithAgent extends ContainerInfo {
  agentId?: string;
  agentName?: string;
  agentTask?: string;
  type: 'agent' | 'preview';
}

export const ContainerManagement: React.FC<ContainerManagementProps> = ({
  teamId,
  containers,
  onContainerAction,
  onRefresh,
}) => {
  const { addNotification } = useNotification();
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Helper function for container status icons
  const getContainerStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return '🟢';
      case 'starting': 
      case 'creating': return '🟡';
      case 'stopped': return '🔴';
      case 'error': return '❌';
      default: return '⚫';
    }
  };

  // Helper function for container status colors
  const getContainerStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-green-400 bg-green-900/20';
      case 'starting': 
      case 'creating': return 'text-yellow-400 bg-yellow-900/20';
      case 'stopped': return 'text-red-400 bg-red-900/20';
      case 'error': return 'text-red-400 bg-red-900/20';
      default: return 'text-gray-400 bg-gray-900/20';
    }
  };

  // Handle container actions
  const handleContainerAction = async (action: string, containerId: string) => {
    setActionLoading(containerId);
    try {
      await onContainerAction(action, containerId);
      addNotification({
        message: `Container ${action} initiated successfully`,
        type: 'success',
      });
    } catch (error) {
      console.error(`Failed to ${action} container:`, error);
      addNotification({
        message: error instanceof Error ? error.message : `Failed to ${action} container`,
        type: 'error',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Format container uptime
  const formatUptime = (createdAt: string) => {
    const now = new Date().getTime();
    const start = new Date(createdAt).getTime();
    const diff = Math.floor((now - start) / 1000);
    
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  // Format memory usage
  const formatMemory = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)}MB`;
    return `${(mb / 1024).toFixed(1)}GB`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-200">Container Management</h2>
          <span className="text-sm text-slate-500 bg-slate-800 px-2 py-1 rounded">
            {containers.length} containers
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={onRefresh}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Container List */}
      {containers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-slate-500">No containers running</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {containers.map((container) => (
            <Card key={container.containerId} className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  {/* Container Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getContainerStatusColor(container.status)}`}>
                        {getContainerStatusIcon(container.status)}
                        {container.status}
                      </span>
                      <span className="text-sm font-mono text-slate-300">
                        {container.containerId.slice(-12)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatUptime(container.createdAt)} uptime
                      </span>
                    </div>

                    {/* Ports and Proxy */}
                    <div className="flex items-center gap-4 text-xs text-slate-400 mb-2">
                      {container.terminalPort && (
                        <span>Terminal: {container.terminalPort}</span>
                      )}
                      {container.previewPort && (
                        <span>Preview: {container.previewPort}</span>
                      )}
                      {container.proxyUrl && (
                        <a 
                          href={container.proxyUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300"
                        >
                          View Live →
                        </a>
                      )}
                    </div>

                    {/* Resource Usage */}
                    {container.resources && (
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Memory: {container.resources.memory}</span>
                        <span>CPU: {container.resources.cpu}</span>
                        {container.resources.memoryUsage && (
                          <span>Used: {formatMemory(container.resources.memoryUsage)}</span>
                        )}
                        {container.resources.cpuUsage !== undefined && (
                          <span>CPU: {container.resources.cpuUsage.toFixed(1)}%</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {container.status === 'running' && (
                      <>
                        <Button
                          onClick={() => handleContainerAction('restart', container.containerId)}
                          disabled={actionLoading === container.containerId}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                        >
                          Restart
                        </Button>
                        <Button
                          onClick={() => handleContainerAction('stop', container.containerId)}
                          disabled={actionLoading === container.containerId}
                          variant="outline"
                          size="sm"
                          className="text-xs text-red-400 border-red-400/50 hover:bg-red-900/20"
                        >
                          Stop
                        </Button>
                      </>
                    )}
                    {container.status === 'stopped' && (
                      <Button
                        onClick={() => handleContainerAction('start', container.containerId)}
                        disabled={actionLoading === container.containerId}
                        variant="outline"
                        size="sm"
                        className="text-xs text-green-400 border-green-400/50 hover:bg-green-900/20"
                      >
                        Start
                      </Button>
                    )}
                    
                    {/* Logs button */}
                    <Button
                      onClick={() => setShowLogs(showLogs === container.containerId ? null : container.containerId)}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      Logs
                    </Button>

                    {actionLoading === container.containerId && (
                      <div className="w-4 h-4 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />
                    )}
                  </div>
                </div>

                {/* Container Logs */}
                {showLogs === container.containerId && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <div className="bg-black/50 rounded p-3 max-h-32 overflow-y-auto">
                      <div className="text-xs font-mono text-slate-300">
                        {/* Placeholder for logs - would be populated via WebSocket */}
                        <div className="text-slate-500">Container logs would appear here...</div>
                        <div className="text-slate-400">[2024-01-01 12:00:00] Container started</div>
                        <div className="text-slate-400">[2024-01-01 12:00:01] Service ready on port {container.terminalPort}</div>
                        {container.previewPort && (
                          <div className="text-slate-400">[2024-01-01 12:00:02] Preview server running on port {container.previewPort}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      <Card className="bg-slate-800/30 border-slate-700">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Container Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-green-400">
                {containers.filter(c => c.status === 'running').length}
              </div>
              <div className="text-xs text-slate-500">Running</div>
            </div>
            <div>
              <div className="text-lg font-bold text-yellow-400">
                {containers.filter(c => ['starting', 'creating'].includes(c.status)).length}
              </div>
              <div className="text-xs text-slate-500">Starting</div>
            </div>
            <div>
              <div className="text-lg font-bold text-red-400">
                {containers.filter(c => c.status === 'stopped').length}
              </div>
              <div className="text-xs text-slate-500">Stopped</div>
            </div>
            <div>
              <div className="text-lg font-bold text-red-400">
                {containers.filter(c => c.status === 'error').length}
              </div>
              <div className="text-xs text-slate-500">Errors</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};