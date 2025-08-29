import React, { useState } from 'react';

interface PreviewContainerInfo {
  containerId?: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
  port?: number;
  proxyUrl?: string;
  projectType?: string;
  memoryUsage?: number;
  cpuUsage?: number;
}

interface DeploymentMetadata {
  commitHash: string;
  commitMessage: string;
  commitAuthor: string;
  commitDate: string;
  branch: string;
  repositoryUrl: string;
  deployedAt: string;
  buildDuration?: number;
  buildStatus: 'success' | 'failed' | 'building';
  container?: PreviewContainerInfo;
}

interface DeploymentInfoProps {
  deploymentMeta?: DeploymentMetadata;
  className?: string;
}

export const DeploymentInfo: React.FC<DeploymentInfoProps> = ({ 
  deploymentMeta, 
  className = '' 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!deploymentMeta) {
    return null;
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return 'Unknown';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getRepoName = (url: string) => {
    const match = url.match(/\/([^\/]+?)(?:\.git)?$/);
    return match ? match[1] : url;
  };

  const getGitHubUrl = (repositoryUrl: string) => {
    if (repositoryUrl.includes('github.com')) {
      return repositoryUrl.replace('.git', '');
    }
    return repositoryUrl;
  };

  const getCommitUrl = (repositoryUrl: string, commitHash: string) => {
    const baseUrl = getGitHubUrl(repositoryUrl);
    return `${baseUrl}/commit/${commitHash}`;
  };

  const getBranchUrl = (repositoryUrl: string, branch: string) => {
    const baseUrl = getGitHubUrl(repositoryUrl);
    return `${baseUrl}/tree/${branch}`;
  };

  const statusColor = {
    success: 'text-green-400',
    failed: 'text-red-400',
    building: 'text-yellow-400'
  }[deploymentMeta.buildStatus];

  // Container status helpers
  const getContainerStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return '🟢';
      case 'starting': return '🟡';
      case 'stopped': return '🔴';
      case 'error': return '❌';
      default: return '⚫';
    }
  };

  const getContainerStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-green-400';
      case 'starting': return 'text-yellow-400';
      case 'stopped': return 'text-red-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)}MB`;
    return `${(mb / 1024).toFixed(1)}GB`;
  };

  return (
    <div className={`bg-gray-900 border-t border-gray-700 text-xs ${className}`}>
      {/* Compact header */}
      <div 
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-800 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <div className={`w-2 h-2 rounded-full ${
            deploymentMeta.buildStatus === 'success' ? 'bg-green-400' :
            deploymentMeta.buildStatus === 'failed' ? 'bg-red-400' :
            'bg-yellow-400 animate-pulse'
          }`} />
          <span className="text-gray-300">
            <span className="text-blue-400">{deploymentMeta.commitHash}</span>
            {' • '}
            <span className="text-gray-400">{deploymentMeta.branch}</span>
            {' • '}
            <span className="text-gray-500">{formatTime(deploymentMeta.deployedAt)}</span>
            {deploymentMeta.container && (
              <>
                {' • '}
                <span className={getContainerStatusColor(deploymentMeta.container.status)}>
                  {getContainerStatusIcon(deploymentMeta.container.status)}
                  {deploymentMeta.container.status}
                </span>
                {deploymentMeta.container.port && (
                  <>
                    {' • '}
                    <span className="text-gray-500">:{deploymentMeta.container.port}</span>
                  </>
                )}
              </>
            )}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={statusColor}>
            {deploymentMeta.buildStatus === 'building' && '⏳'}
            {deploymentMeta.buildStatus === 'success' && '✅'}
            {deploymentMeta.buildStatus === 'failed' && '❌'}
          </span>
          <svg 
            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-700 bg-gray-900/50">
          {/* Commit info */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Commit:</span>
              <a 
                href={getCommitUrl(deploymentMeta.repositoryUrl, deploymentMeta.commitHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 font-mono"
              >
                {deploymentMeta.commitHash}
              </a>
            </div>
            <div className="text-gray-300 text-xs leading-tight">
              "{deploymentMeta.commitMessage}"
            </div>
          </div>

          {/* Branch and repo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-400">Branch:</span>
              <a
                href={getBranchUrl(deploymentMeta.repositoryUrl, deploymentMeta.branch)}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-blue-400 hover:text-blue-300"
              >
                {deploymentMeta.branch}
              </a>
            </div>
            <div>
              <span className="text-gray-400">Repository:</span>
              <a
                href={getGitHubUrl(deploymentMeta.repositoryUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-blue-400 hover:text-blue-300"
              >
                {getRepoName(deploymentMeta.repositoryUrl)}
              </a>
            </div>
          </div>

          {/* Author and timing */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-400">Author:</span>
              <span className="ml-2 text-gray-300">{deploymentMeta.commitAuthor}</span>
            </div>
            <div>
              <span className="text-gray-400">Commit:</span>
              <span className="ml-2 text-gray-300">
                {formatTime(deploymentMeta.commitDate)}
              </span>
            </div>
          </div>

          {/* Build info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-400">Build:</span>
              <span className={`ml-2 ${statusColor}`}>
                {deploymentMeta.buildStatus}
                {deploymentMeta.buildDuration && ` (${formatDuration(deploymentMeta.buildDuration)})`}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Deployed:</span>
              <span className="ml-2 text-gray-300">
                {formatTime(deploymentMeta.deployedAt)}
              </span>
            </div>
          </div>

          {/* Container info */}
          {deploymentMeta.container && (
            <div className="space-y-2 pt-2 border-t border-gray-800">
              <div className="text-gray-400 text-xs font-semibold">Container Status</div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-400">Status:</span>
                  <span className={`ml-2 ${getContainerStatusColor(deploymentMeta.container.status)}`}>
                    {getContainerStatusIcon(deploymentMeta.container.status)}
                    {deploymentMeta.container.status}
                  </span>
                </div>
                {deploymentMeta.container.port && (
                  <div>
                    <span className="text-gray-400">Port:</span>
                    <span className="ml-2 text-gray-300 font-mono">
                      {deploymentMeta.container.port}
                    </span>
                  </div>
                )}
              </div>

              {deploymentMeta.container.containerId && (
                <div>
                  <span className="text-gray-400">Container ID:</span>
                  <span className="ml-2 text-gray-300 font-mono text-xs">
                    {deploymentMeta.container.containerId.slice(-12)}
                  </span>
                </div>
              )}

              {(deploymentMeta.container.memoryUsage || deploymentMeta.container.cpuUsage) && (
                <div className="grid grid-cols-2 gap-4">
                  {deploymentMeta.container.memoryUsage && (
                    <div>
                      <span className="text-gray-400">Memory:</span>
                      <span className="ml-2 text-gray-300">
                        {formatBytes(deploymentMeta.container.memoryUsage)}
                      </span>
                    </div>
                  )}
                  {deploymentMeta.container.cpuUsage !== undefined && (
                    <div>
                      <span className="text-gray-400">CPU:</span>
                      <span className="ml-2 text-gray-300">
                        {deploymentMeta.container.cpuUsage.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              )}

              {deploymentMeta.container.proxyUrl && (
                <div>
                  <span className="text-gray-400">Proxy URL:</span>
                  <a
                    href={deploymentMeta.container.proxyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-400 hover:text-blue-300 text-xs"
                  >
                    {deploymentMeta.container.proxyUrl}
                  </a>
                </div>
              )}

              {deploymentMeta.container.projectType && (
                <div>
                  <span className="text-gray-400">Project Type:</span>
                  <span className="ml-2 text-gray-300">
                    {deploymentMeta.container.projectType}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};