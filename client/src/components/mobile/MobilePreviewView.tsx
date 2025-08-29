import React, { useRef, useState } from 'react';

interface MobilePreviewViewProps {
  previewUrl?: string | undefined;
  previewStatus: 'loading' | 'ready' | 'error';
  previewBranch?: 'main' | 'staging' | undefined; // Make optional for Dashboard compatibility
  onPreviewBranchChange?: ((branch: 'main' | 'staging') => void) | undefined; // Make optional
  refreshPreview: () => void;
  team: any;
}

export const MobilePreviewView: React.FC<MobilePreviewViewProps> = ({
  previewUrl,
  previewStatus,
  previewBranch = 'main',
  onPreviewBranchChange = () => {},
  refreshPreview,
  team
}) => {
  const [previewError, setPreviewError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleRefresh = () => {
    if (iframeRef.current) {
      setPreviewError(false);
      iframeRef.current.src = iframeRef.current.src;
    }
    refreshPreview();
  };

  React.useEffect(() => {
    setPreviewError(false);
  }, [previewUrl]);

  return (
    <div className="flex flex-col h-full bg-midnight-900">
      {/* Header */}
      <div className="px-4 py-3 bg-midnight-800 border-b border-midnight-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Branch Selector */}
            <div className="flex bg-midnight-700 rounded-lg p-0.5">
              <button
                onClick={() => onPreviewBranchChange('main')}
                className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                  previewBranch === 'main'
                    ? 'bg-electric text-midnight-900'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Main
              </button>
              <button
                onClick={() => onPreviewBranchChange('staging')}
                className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                  previewBranch === 'staging'
                    ? 'bg-electric text-midnight-900'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Staging
              </button>
            </div>
            
            {/* Status Indicator */}
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${
                previewStatus === 'ready' ? 'bg-green-400' :
                previewStatus === 'loading' ? 'bg-amber-400 animate-pulse' :
                'bg-red-400'
              }`} />
              <span className="text-xs text-gray-400">
                {previewStatus === 'ready' ? 'Ready' :
                 previewStatus === 'loading' ? 'Loading...' :
                 'Error'}
              </span>
            </div>
          </div>
          
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-midnight-700 rounded-lg transition-all"
            title="Refresh preview"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 relative bg-white">
        {previewStatus === 'loading' && (
          <div className="absolute inset-0 bg-midnight-900 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-electric mx-auto" />
              <p className="text-gray-400 text-sm">Loading preview...</p>
            </div>
          </div>
        )}
        
        {previewStatus === 'error' || previewError ? (
          <div className="absolute inset-0 bg-midnight-900 flex items-center justify-center">
            <div className="text-center space-y-4 px-6">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-gray-300 font-medium">Preview unavailable</p>
                <p className="text-gray-500 text-sm mt-1">
                  {!team?.repositoryUrl 
                    ? 'No repository configured' 
                    : 'Check your repository settings'}
                </p>
              </div>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-midnight-700 hover:bg-midnight-600 text-white text-sm rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : previewUrl ? (
          <iframe
            ref={iframeRef}
            src={previewUrl}
            className="w-full h-full border-0"
            title="Repository Preview"
            onError={() => setPreviewError(true)}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : (
          <div className="absolute inset-0 bg-midnight-900 flex items-center justify-center">
            <div className="text-center space-y-4 px-6">
              <div className="w-12 h-12 bg-midnight-700 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <div>
                <p className="text-gray-300 font-medium">No preview available</p>
                <p className="text-gray-500 text-sm mt-1">
                  Configure a repository to see the preview
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};