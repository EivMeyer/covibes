import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import type { ContainerInfo, ContainerResourceEvent } from '@/types';

interface ContainerMetricsProps {
  containerId: string;
  containerInfo?: ContainerInfo;
  resourceUpdates?: ContainerResourceEvent[];
  className?: string;
}

interface MetricPoint {
  timestamp: number;
  value: number;
}

interface ResourceMetrics {
  cpu: MetricPoint[];
  memory: MetricPoint[];
  network: { rx: MetricPoint[]; tx: MetricPoint[] };
  disk: MetricPoint[];
}

export const ContainerMetrics: React.FC<ContainerMetricsProps> = ({
  containerId,
  containerInfo,
  resourceUpdates = [],
  className = '',
}) => {
  const [metrics, setMetrics] = useState<ResourceMetrics>({
    cpu: [],
    memory: [],
    network: { rx: [], tx: [] },
    disk: [],
  });

  // Update metrics when new resource data comes in
  useEffect(() => {
    if (resourceUpdates.length > 0) {
      const latestUpdate = resourceUpdates[resourceUpdates.length - 1];
      if (latestUpdate.containerId === containerId) {
        const timestamp = new Date(latestUpdate.timestamp).getTime();
        const resources = latestUpdate.resources;

        setMetrics(prev => ({
          cpu: [...prev.cpu.slice(-19), { timestamp, value: resources.cpuUsage }],
          memory: [...prev.memory.slice(-19), { timestamp, value: resources.memoryUsage }],
          network: {
            rx: [...prev.network.rx.slice(-19), { timestamp, value: resources.networkRx }],
            tx: [...prev.network.tx.slice(-19), { timestamp, value: resources.networkTx }],
          },
          disk: [...prev.disk.slice(-19), { timestamp, value: resources.diskUsage }],
        }));
      }
    }
  }, [resourceUpdates, containerId]);

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Format percentage
  const formatPercent = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  // Simple text-based chart
  const renderMiniChart = (data: MetricPoint[], maxValue: number, unit: string) => {
    if (data.length === 0) return <div className="text-xs text-slate-500">No data</div>;

    const latest = data[data.length - 1];
    const bars = data.slice(-10).map((point, index) => {
      const height = Math.max(1, Math.floor((point.value / maxValue) * 20));
      return (
        <div
          key={index}
          className="w-2 bg-blue-500 opacity-70"
          style={{ height: `${height}px` }}
          title={`${point.value.toFixed(1)} ${unit}`}
        />
      );
    });

    return (
      <div className="flex items-end gap-0.5 h-5">
        {bars}
        <span className="ml-2 text-xs text-slate-400">
          {unit === '%' ? formatPercent(latest.value) : formatBytes(latest.value)}
        </span>
      </div>
    );
  };

  // Get container uptime
  const getUptime = () => {
    if (!containerInfo?.createdAt) return 'Unknown';
    
    const now = new Date().getTime();
    const start = new Date(containerInfo.createdAt).getTime();
    const diff = Math.floor((now - start) / 1000);
    
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
    return `${Math.floor(diff / 86400)}d ${Math.floor((diff % 86400) / 3600)}h`;
  };

  // Get current resource usage
  const getCurrentUsage = () => {
    if (!containerInfo?.resources) return null;
    
    return {
      memory: containerInfo.resources.memoryUsage || 0,
      cpu: containerInfo.resources.cpuUsage || 0,
      memoryLimit: containerInfo.resources.memory,
      cpuLimit: containerInfo.resources.cpu,
    };
  };

  const currentUsage = getCurrentUsage();

  return (
    <Card className={`bg-slate-800/50 border-slate-700 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">
            Container Metrics
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            {containerId.slice(-8)}
          </span>
        </div>

        {/* Current Status */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-xs text-slate-500 mb-1">Status</div>
            <div className={`text-sm font-medium ${
              containerInfo?.status === 'running' ? 'text-green-400' :
              containerInfo?.status === 'starting' ? 'text-yellow-400' :
              containerInfo?.status === 'stopped' ? 'text-red-400' :
              'text-slate-400'
            }`}>
              {containerInfo?.status || 'Unknown'}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Uptime</div>
            <div className="text-sm text-slate-300 font-mono">
              {getUptime()}
            </div>
          </div>
        </div>

        {/* Resource Usage */}
        {currentUsage && (
          <div className="space-y-3">
            {/* CPU Usage */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">CPU Usage</span>
                <span className="text-xs text-slate-400">
                  {formatPercent(currentUsage.cpu)} / {currentUsage.cpuLimit}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, currentUsage.cpu)}%` }}
                />
              </div>
              {renderMiniChart(metrics.cpu, 100, '%')}
            </div>

            {/* Memory Usage */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">Memory Usage</span>
                <span className="text-xs text-slate-400">
                  {formatBytes(currentUsage.memory)} / {currentUsage.memoryLimit}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${Math.min(100, (currentUsage.memory / (2 * 1024 * 1024 * 1024)) * 100)}%` // Assume 2GB limit for calculation
                  }}
                />
              </div>
              {renderMiniChart(metrics.memory, 2 * 1024 * 1024 * 1024, 'bytes')}
            </div>

            {/* Network Activity */}
            <div>
              <div className="text-xs text-slate-500 mb-2">Network I/O</div>
              <div className="flex justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full" />
                  <span className="text-slate-400">RX</span>
                  {renderMiniChart(metrics.network.rx, 1024 * 1024, 'bytes')}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full" />
                  <span className="text-slate-400">TX</span>
                  {renderMiniChart(metrics.network.tx, 1024 * 1024, 'bytes')}
                </div>
              </div>
            </div>

            {/* Disk Usage */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">Disk Usage</span>
              </div>
              {renderMiniChart(metrics.disk, 10 * 1024 * 1024 * 1024, 'bytes')}
            </div>
          </div>
        )}

        {/* Ports */}
        {(containerInfo?.terminalPort || containerInfo?.previewPort) && (
          <div className="mt-4 pt-3 border-t border-slate-700">
            <div className="text-xs text-slate-500 mb-2">Exposed Ports</div>
            <div className="flex gap-3 text-xs">
              {containerInfo.terminalPort && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-slate-400">Terminal: {containerInfo.terminalPort}</span>
                </div>
              )}
              {containerInfo.previewPort && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <span className="text-slate-400">Preview: {containerInfo.previewPort}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-4 pt-3 border-t border-slate-700">
          <div className="flex gap-2 text-xs">
            {containerInfo?.proxyUrl && (
              <a
                href={containerInfo.proxyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-1 bg-blue-900/30 text-blue-400 border border-blue-400/30 rounded hover:bg-blue-900/50 transition-colors"
              >
                Open Preview
              </a>
            )}
            <button className="px-2 py-1 bg-slate-700 text-slate-400 border border-slate-600 rounded hover:bg-slate-600 transition-colors">
              View Logs
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};