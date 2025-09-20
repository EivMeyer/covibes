import React, { useRef, useState, useEffect } from 'react';
import { PreviewInspector } from '../features/preview/PreviewInspector';
import { Sparkles } from 'lucide-react';

interface LastActiveTarget {
  type: 'agent' | 'terminal' | 'chat';
  id: string;
  name: string;
  timestamp: number;
}

interface PreviewTileProps {
  url?: string | undefined; // Explicit undefined for exactOptionalPropertyTypes
  onRefresh?: (() => void) | undefined;
  onOpenIDE?: (() => void) | undefined;
  isLoading?: boolean | undefined;
  onLoad?: (() => void) | undefined;
  teamId?: string | undefined; // Team ID for inspector API calls
  lastActiveTarget?: LastActiveTarget | null;
  sendToLastActive?: (message: string) => boolean;
  agents?: any[] | undefined; // List of available agents for inspector
}

export const PreviewTile: React.FC<PreviewTileProps> = ({
  url,
  onRefresh,
  onOpenIDE,
  isLoading = false,
  onLoad,
  teamId,
  lastActiveTarget,
  sendToLastActive,
  agents,
}) => {
  const [previewError, setPreviewError] = useState(false);
  const [inspectorActive, setInspectorActive] = useState(false);
  const [showInspectorHint, setShowInspectorHint] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Check if user has seen the inspector hint before
  useEffect(() => {
    if (url && teamId) {
      const hasSeenHint = localStorage.getItem('inspector-hint-seen');
      if (!hasSeenHint) {
        setShowInspectorHint(true);
        // Auto-hide after 8 seconds
        const timer = setTimeout(() => {
          setShowInspectorHint(false);
          localStorage.setItem('inspector-hint-seen', 'true');
        }, 8000);
        return () => clearTimeout(timer);
      }
    }
  }, [url, teamId]);

  const handleInspectorClick = () => {
    setInspectorActive(!inspectorActive);
    if (showInspectorHint) {
      setShowInspectorHint(false);
      localStorage.setItem('inspector-hint-seen', 'true');
    }
  };

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
          {/* Inspector Button - Enhanced with subtle magic */}
          {url && (
            <div className="relative">
              <button
                onClick={handleInspectorClick}
                className={`relative p-1.5 rounded-lg transition-all transform hover:scale-105 ${
                  inspectorActive
                    ? 'bg-blue-500/20 text-blue-400 shadow-sm'
                    : 'bg-midnight-700/50 text-gray-400 hover:bg-midnight-600/50 hover:text-blue-400'
                }`}
                title="✨ Element Inspector - Click any element to modify it with AI"
              >
                <Sparkles className="w-5 h-5" />
              </button>

              {/* First-time user hint tooltip */}
              {showInspectorHint && (
                <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 z-50 animate-slide-in">
                  <div className="bg-midnight-800 border border-blue-500/30 text-white px-3 py-2 rounded-lg shadow-lg max-w-xs">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-blue-400" />
                      <div>
                        <div className="text-xs font-semibold mb-0.5 text-blue-400">NEW: Element Inspector</div>
                        <div className="text-xs text-gray-300">
                          Click here, then select any element to modify it
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowInspectorHint(false);
                          localStorage.setItem('inspector-hint-seen', 'true');
                        }}
                        className="text-gray-400 hover:text-white ml-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-midnight-800"></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Vertical divider after inspector */}
          {url && (
            <div className="h-4 w-px bg-gray-700" />
          )}

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

        {/* Element Inspector Overlay */}
        {teamId && (
          <PreviewInspector
            iframeRef={iframeRef}
            isActive={inspectorActive}
            onDeactivate={() => setInspectorActive(false)}
            teamId={teamId}
            lastActiveTarget={lastActiveTarget}
            sendToLastActive={sendToLastActive}
            agents={agents}
          />
        )}

        {isLoading && url && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-midnight-800 p-4 rounded-lg">
              <div className="flex items-center space-x-3">
                <svg className="animate-spin h-5 w-5 text-electric" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <p className="text-white text-sm">Updating preview...</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};