import React from 'react';
import type { ComponentProps } from '@/types';
import { ResizableLayout } from '@/components/ui/ResizableLayout';
import { DeploymentInfo } from '@/components/features/preview/DeploymentInfo';

interface MainContentProps extends ComponentProps {
  sidebar?: React.ReactNode;
  preview?: React.ReactNode;
  showPreview?: boolean;
}

export const MainContent: React.FC<MainContentProps> = ({
  children,
  sidebar,
  preview,
  showPreview = true,
  className = '',
  ...props
}) => {
  // Use ResizableLayout on desktop (xl and above), fallback to simple layout on smaller screens
  return (
    <div className={`flex-1 flex overflow-hidden ${className}`} {...props}>
      {/* Desktop resizable layout */}
      <div className="hidden xl:flex xl:w-full xl:h-full xl:overflow-hidden">
        <ResizableLayout
          sidebar={sidebar}
          main={children}
          preview={preview}
          showPreview={showPreview}
          className="w-full h-full"
        />
      </div>

      {/* Mobile/tablet simple layout */}
      <div className="flex-1 flex overflow-hidden xl:hidden">
        {/* Sidebar - Hidden on mobile, drawer on tablet, fixed on desktop */}
        {sidebar && (
          <div className="hidden md:flex md:flex-shrink-0">
            {sidebar}
          </div>
        )}

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {children}
        </div>

        {/* Preview panel - Hidden on mobile/tablet */}
        {showPreview && preview && (
          <div className="w-1/3 flex-shrink-0 border-l border-midnight-600 hidden lg:flex">
            {preview}
          </div>
        )}
      </div>
    </div>
  );
};

// Chat/Workshop area component
interface WorkshopProps extends ComponentProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const Workshop: React.FC<WorkshopProps> = ({
  title = "Team Collaboration",
  subtitle,
  action,
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`bg-midnight-800 flex flex-col h-full shadow-inner ${className}`} {...props}>
      {/* Header */}
      {(title || subtitle || action) && (
        <div className="px-3 py-2 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              {title && (
                <h2 className="text-sm font-medium text-gray-400">{title}</h2>
              )}
            </div>
            {action && (
              <div className="flex-shrink-0 ml-4">
                {action}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
};

// Preview panel component
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
}

interface PreviewPanelProps extends ComponentProps {
  url?: string | undefined;
  lastUpdate?: string;
  onRefresh?: () => void;
  isLoading?: boolean;
  branch?: 'main' | 'staging';
  onBranchChange?: (branch: 'main' | 'staging') => void;
  deploymentMeta?: DeploymentMetadata;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  url,
  lastUpdate,
  onRefresh,
  isLoading = false,
  branch = 'main',
  onBranchChange,
  deploymentMeta,
  className = '',
  ...props
}) => {
  const [previewError, setPreviewError] = React.useState(false);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const handleRefresh = () => {
    if (iframeRef.current) {
      setPreviewError(false);
      iframeRef.current.src = iframeRef.current.src; // Reload iframe
    }
    onRefresh?.();
  };

  const handleIframeError = () => {
    setPreviewError(true);
  };

  React.useEffect(() => {
    // Reset error state when URL changes
    setPreviewError(false);
  }, [url]);

  return (
    <div className={`bg-midnight-700 flex flex-col h-full w-full shadow-inner ${className}`} {...props}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-400">Preview</span>
            {/* Branch selector tabs */}
            {onBranchChange && (
              <div className="flex gap-1">
                <button
                  onClick={() => onBranchChange('main')}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                    branch === 'main' 
                      ? 'bg-gray-600 text-white' 
                      : 'text-gray-500 hover:text-gray-400'
                  }`}
                >
                  main
                </button>
                <button
                  onClick={() => onBranchChange('staging')}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                    branch === 'staging' 
                      ? 'bg-gray-600 text-white' 
                      : 'text-gray-500 hover:text-gray-400'
                  }`}
                >
                  staging
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {lastUpdate && (
              <span className="text-xs text-gray-500">{lastUpdate}</span>
            )}
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-1 text-gray-400 hover:text-gray-300 transition-colors"
              title="Refresh preview"
            >
              <svg 
                className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Deployment metadata */}
      {deploymentMeta && (
        <DeploymentInfo deploymentMeta={deploymentMeta} />
      )}

      {/* Preview content */}
      <div className="flex-1 relative overflow-hidden">
        {previewError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-midnight-900">
            <div className="text-center space-y-6 p-4 sm:p-8 max-w-sm mx-auto">
              <svg className="w-12 h-12 sm:w-16 sm:h-16 text-coral mx-auto animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 20.5a7.962 7.962 0 01-5.291-2.209M3 3l18 18" />
              </svg>
              <div className="space-y-3">
                <p className="text-coral font-semibold text-base sm:text-lg">Preview not available</p>
                <p className="text-xs sm:text-sm text-gray-400">
                  The preview could not be loaded. This may be due to no content being available yet or a network error.
                </p>
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2 sm:px-6 sm:py-3 bg-midnight-600 hover:bg-midnight-500 text-white text-sm font-medium rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        ) : !url ? (
          <div className="absolute inset-0 flex items-center justify-center bg-midnight-900">
            <div className="text-center space-y-6 p-4 sm:p-8 max-w-sm mx-auto">
              <svg className="w-12 h-12 sm:w-16 sm:h-16 text-electric mx-auto float" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <div className="space-y-3">
                <p className="text-electric font-semibold text-base sm:text-lg">Ready for Preview</p>
                <p className="text-xs sm:text-sm text-gray-400">
                  Spawn an agent to start working on your project and see live updates here.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={url}
            onError={handleIframeError}
            className="w-full h-full bg-white"
            title="Live Preview"
            sandbox="allow-scripts allow-forms allow-modals"
          />
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center">
            <div className="glass p-6 rounded-lg shadow-card-hover">
              <div className="flex items-center space-x-4">
                <svg className="animate-spin h-6 w-6 text-electric" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <p className="text-electric font-medium">Updating preview...</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};