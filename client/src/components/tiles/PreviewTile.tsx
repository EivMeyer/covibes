import React, { useRef, useState } from 'react';

interface PreviewTileProps {
  url?: string | undefined; // Explicit undefined for exactOptionalPropertyTypes
  onRefresh?: (() => void) | undefined;
  onRestart?: (() => Promise<void>) | undefined;
  onOpenIDE?: (() => void) | undefined;
  isLoading?: boolean | undefined;
  isRestarting?: boolean | undefined;
  onLoad?: (() => void) | undefined;
}

export const PreviewTile: React.FC<PreviewTileProps> = ({
  url,
  onRefresh,
  onRestart,
  onOpenIDE,
  isLoading = false,
  isRestarting = false,
  onLoad,
}) => {
  const [previewError, setPreviewError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleRefresh = () => {
    if (iframeRef.current && url) {
      setPreviewError(false);
      // Use location.reload() on the iframe's content window for safer refresh
      try {
        iframeRef.current.contentWindow?.location.reload();
      } catch (e) {
        // If cross-origin prevents reload, set a new src with cache buster
        const newUrl = new URL(url);
        newUrl.searchParams.set('refresh', Date.now().toString());
        iframeRef.current.src = newUrl.toString();
      }
    }
    onRefresh?.();
  };

  const handleRestart = () => {
    onRestart?.();
  };

  const handleIframeError = () => {
    setPreviewError(true);
  };

  const handleOpenNewTab = () => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  React.useEffect(() => {
    // Reset error state when URL changes
    setPreviewError(false);
  }, [url]);

  return (
    <div className="h-full bg-midnight-900 flex flex-col">
      {/* Preview Header */}
      <div className="px-3 py-2 border-b border-midnight-700 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-electric">Live Preview</span>
          {url && (
            <span className="text-xs text-gray-500 truncate max-w-xs">
              {url}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Open in New Tab Button */}
          {url && (
            <button
              onClick={handleOpenNewTab}
              className="p-1 text-gray-400 hover:text-electric transition-colors"
              title="Open in new tab"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          )}
          
          {/* Open IDE Button */}
          {onOpenIDE && (
            <button
              onClick={onOpenIDE}
              className="p-1 text-gray-400 hover:text-electric transition-colors"
              title="Open Code Editor"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </button>
          )}
          
          {/* Restart Button */}
          {onRestart && (
            <button
              onClick={handleRestart}
              disabled={isRestarting || !url}
              className="p-1 text-gray-400 hover:text-coral transition-colors disabled:opacity-50"
              title="Restart preview container"
            >
              <svg 
                className={`w-4 h-4 ${isRestarting ? 'animate-spin' : ''}`} 
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
                <circle cx="12" cy="12" r="1" fill="currentColor" />
              </svg>
            </button>
          )}
          
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isLoading || !url}
            className="p-1 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh preview"
          >
          <svg 
            className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} 
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

      {/* Preview Content */}
      <div className="flex-1 relative">
        {previewError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-midnight-900">
            <div className="text-center space-y-4 p-6">
              <svg className="w-12 h-12 text-coral mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="space-y-2">
                <p className="text-white font-medium">Preview not available</p>
                <p className="text-xs text-gray-400">
                  The preview could not be loaded. Check if the server is running.
                </p>
                <button
                  onClick={handleRefresh}
                  className="px-3 py-1.5 bg-midnight-700 hover:bg-midnight-600 text-white text-sm rounded transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        ) : !url ? (
          <div className="absolute inset-0 flex items-center justify-center bg-midnight-900">
            <div className="text-center space-y-4 p-6">
              <svg className="w-12 h-12 text-electric mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <div className="space-y-3">
                <p className="text-white font-medium text-lg">Preview Demo</p>
                <p className="text-sm text-gray-300">
                  No preview URL configured yet
                </p>
                <div className="bg-midnight-800 rounded-lg p-4 text-left max-w-xs mx-auto">
                  <p className="text-xs text-gray-400 mb-2">To enable preview:</p>
                  <ol className="text-xs text-gray-300 space-y-1">
                    <li>1. Configure repository URL in settings</li>
                    <li>2. Spawn an agent to work on code</li>
                    <li>3. Preview will show live updates</li>
                  </ol>
                </div>
                <div className="pt-4">
                  <p className="text-xs text-gray-500">
                    For now, this is a demo preview panel
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            // Use the proxy URL which has WebSocket support for HMR
            src={url}
            onError={handleIframeError}
            onLoad={onLoad}
            className="w-full h-full bg-white"
            title="Live Preview"
            // Remove sandbox for local development to allow full functionality
            // sandbox="allow-scripts allow-forms allow-modals allow-same-origin"
          />
        )}

        {(isLoading || isRestarting) && url && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-midnight-800 p-4 rounded-lg">
              <div className="flex items-center space-x-3">
                <svg className="animate-spin h-5 w-5 text-electric" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <p className="text-white text-sm">{isRestarting ? 'Restarting container...' : 'Updating preview...'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};