import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { useNotification } from '@/components/ui/Notification';
import { apiService } from '@/services/api';

interface IDETileProps {
  teamId?: string;
  repositoryUrl?: string;
  branch?: 'main' | 'staging';
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onClose?: () => void;
}

interface ActivityLogEntry {
  id: string;
  type: 'file_edit' | 'file_save' | 'git_commit' | 'agent_action';
  message: string;
  timestamp: string;
  user?: string;
}

type PanelType = 'explorer' | 'activity' | 'search' | 'git';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

interface OpenFile {
  path: string;
  name: string;
  content: string;
  language?: string;
  isDirty?: boolean;
}

export const IDETile: React.FC<IDETileProps> = ({
  teamId,
  repositoryUrl,
  branch = 'main',
  isFullscreen = false,
  onToggleFullscreen,
  onClose,
}) => {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [showSidebar, setShowSidebar] = useState(true);
  const [activePanel, setActivePanel] = useState<PanelType>('explorer');
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [isResizing, setIsResizing] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const { addNotification } = useNotification();
  const editorRef = useRef<any>(null);
  const resizeRef = useRef<HTMLDivElement>(null);

  // Load file tree on mount
  useEffect(() => {
    if (teamId) {
      // Always try to load, backend will handle missing repository gracefully
      loadFileTree();
    }
    
    // Add some initial activity log entries for demo
    addActivityLog({
      type: 'agent_action',
      message: 'IDE initialized',
      timestamp: new Date().toISOString(),
    });
  }, [teamId, repositoryUrl, branch]);

  const loadFileTree = async () => {
    try {
      setLoading(true);
      // Fixed: No /api prefix needed since baseURL already includes it
      const response = await apiService.axiosInstance.get('/ide/files', {
        params: { branch }
      });
      setFiles(response.data.files || []);
    } catch (error: any) {
      console.error('Failed to load file tree:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to load file tree';
      addNotification({
        message: `Failed to load file tree: ${errorMessage}`,
        type: 'error'
      });
      // If no repository is configured, show helpful message
      if (error?.response?.status === 404 || errorMessage.includes('repository')) {
        setFiles([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadFile = async (filePath: string) => {
    try {
      // Check if file is already open
      const existingFile = openFiles.find(f => f.path === filePath);
      if (existingFile) {
        setActiveFile(filePath);
        return;
      }

      setLoading(true);
      const response = await apiService.axiosInstance.get('/ide/file', {
        params: { path: filePath, branch }
      });

      const newFile: OpenFile = {
        path: filePath,
        name: filePath.split('/').pop() || filePath,
        content: response.data.content,
        language: getLanguageFromPath(filePath)
      };

      setOpenFiles(prev => [...prev, newFile]);
      setActiveFile(filePath);
    } catch (error) {
      console.error('Failed to load file:', error);
      addNotification({
        message: 'Failed to load file',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const saveFile = async (filePath: string) => {
    try {
      const file = openFiles.find(f => f.path === filePath);
      if (!file) return;

      await apiService.axiosInstance.post('/ide/file', {
        path: filePath,
        content: file.content,
        branch
      });

      setOpenFiles(prev => prev.map(f => 
        f.path === filePath ? { ...f, isDirty: false } : f
      ));

      // Add to activity log
      addActivityLog({
        type: 'file_save',
        message: `Saved ${file.name}`,
        timestamp: new Date().toISOString(),
      });

      addNotification({
        message: 'File saved successfully',
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to save file:', error);
      addNotification({
        message: 'Failed to save file',
        type: 'error'
      });
    }
  };

  const closeFile = (filePath: string) => {
    setOpenFiles(prev => prev.filter(f => f.path !== filePath));
    if (activeFile === filePath) {
      const remainingFiles = openFiles.filter(f => f.path !== filePath);
      setActiveFile(remainingFiles.length > 0 ? remainingFiles[0].path : null);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!activeFile || value === undefined) return;

    setOpenFiles(prev => prev.map(f => 
      f.path === activeFile ? { ...f, content: value, isDirty: true } : f
    ));

    // Add to activity log (throttled to avoid spam)
    const file = openFiles.find(f => f.path === activeFile);
    if (file && !file.isDirty) {
      addActivityLog({
        type: 'file_edit',
        message: `Editing ${file.name}`,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const addActivityLog = (entry: Omit<ActivityLogEntry, 'id'>) => {
    setActivityLog(prev => [
      {
        ...entry,
        id: Date.now().toString(),
      },
      ...prev.slice(0, 99) // Keep last 100 entries
    ]);
  };

  // Handle sidebar resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    const newWidth = e.clientX;
    if (newWidth >= 200 && newWidth <= 500) {
      setSidebarWidth(newWidth);
    }
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const zoomIn = () => {
    const newSize = Math.min(fontSize + 2, 24);
    setFontSize(newSize);
    if (editorRef.current) {
      editorRef.current.updateOptions({ fontSize: newSize });
    }
  };

  const zoomOut = () => {
    const newSize = Math.max(fontSize - 2, 10);
    setFontSize(newSize);
    if (editorRef.current) {
      editorRef.current.updateOptions({ fontSize: newSize });
    }
  };

  const resetZoom = () => {
    setFontSize(14);
    if (editorRef.current) {
      editorRef.current.updateOptions({ fontSize: 14 });
    }
  };

  const getLanguageFromPath = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'md': 'markdown',
      'yml': 'yaml',
      'yaml': 'yaml',
      'xml': 'xml',
      'sh': 'shell',
      'bash': 'shell',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'swift': 'swift',
      'kt': 'kotlin',
      'r': 'r',
      'sql': 'sql',
      'dockerfile': 'dockerfile',
    };
    return languageMap[ext || ''] || 'plaintext';
  };

  const renderFileTree = (nodes: FileNode[], depth = 0): JSX.Element[] => {
    return nodes.map(node => (
      <div key={node.path}>
        <div
          className={`flex items-center px-2 py-1 hover:bg-midnight-700 cursor-pointer ${
            activeFile === node.path ? 'bg-midnight-700' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px`, fontSize: scaledSmallFontSize }}
          onClick={() => node.type === 'file' && loadFile(node.path)}
        >
          {node.type === 'directory' ? (
            <svg className="w-4 h-4 mr-2 text-electric" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
          )}
          <span className="text-gray-300 truncate">{node.name}</span>
        </div>
        {node.type === 'directory' && node.children && renderFileTree(node.children, depth + 1)}
      </div>
    ));
  };

  const renderPanelContent = () => {
    switch (activePanel) {
      case 'explorer':
        return (
          <div className="py-2">
            {loading && !files.length ? (
              <div className="px-4 py-8 text-center text-gray-500">
                Loading files...
              </div>
            ) : files.length > 0 ? (
              renderFileTree(files)
            ) : (
              <div className="px-4 py-8 text-center text-gray-500">
                <div className="space-y-2">
                  <svg className="w-8 h-8 mx-auto text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <p className="text-sm">No files found</p>
                  <p className="text-xs mt-1">
                    {!repositoryUrl 
                      ? "Configure a repository in settings to start editing"
                      : "Repository might not be cloned yet"
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      
      case 'activity':
        return (
          <div className="py-2">
            {activityLog.length > 0 ? (
              <div className="space-y-1">
                {activityLog.map(entry => (
                  <div key={entry.id} className="px-3 py-2 hover:bg-midnight-700" style={{ fontSize: scaledSmallFontSize }}>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        entry.type === 'file_save' ? 'bg-green-400' :
                        entry.type === 'file_edit' ? 'bg-yellow-400' :
                        entry.type === 'git_commit' ? 'bg-blue-400' :
                        'bg-purple-400'
                      }`} />
                      <span className="text-gray-300 flex-1">{entry.message}</span>
                    </div>
                    <div className="text-gray-500 mt-1" style={{ fontSize: scaledTinyFontSize }}>
                      {new Date(entry.timestamp).toLocaleTimeString()}
                      {entry.user && <span className="ml-1">by {entry.user}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-gray-500">
                <div className="space-y-2">
                  <svg className="w-8 h-8 mx-auto text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p style={{ fontSize: scaledSmallFontSize }}>No activity yet</p>
                  <p style={{ fontSize: scaledTinyFontSize }}>Start editing files to see activity</p>
                </div>
              </div>
            )}
          </div>
        );
      
      case 'search':
        return (
          <div className="p-3 space-y-3">
            <input
              type="text"
              placeholder="Search files..."
              className="w-full px-3 py-2 bg-midnight-700 text-white rounded border border-midnight-600 focus:border-electric focus:outline-none"
              style={{ fontSize: scaledSmallFontSize }}
            />
            <div className="text-center text-gray-500 py-8" style={{ fontSize: scaledSmallFontSize }}>
              <svg className="w-8 h-8 mx-auto text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search functionality coming soon
            </div>
          </div>
        );
      
      case 'git':
        return (
          <div className="p-3">
            <div className="text-center text-gray-500 py-8" style={{ fontSize: scaledSmallFontSize }}>
              <svg className="w-8 h-8 mx-auto text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              Git integration coming soon
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  const activeFileContent = openFiles.find(f => f.path === activeFile);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeFile) {
          saveFile(activeFile);
        }
      }
      // F11 or Ctrl/Cmd + Shift + F for fullscreen
      if (e.key === 'F11' || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F')) {
        e.preventDefault();
        onToggleFullscreen?.();
      }
      // Escape to exit fullscreen
      if (e.key === 'Escape' && isFullscreen) {
        onToggleFullscreen?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, isFullscreen, onToggleFullscreen]);

  // Cleanup Monaco Editor on unmount
  useEffect(() => {
    return () => {
      if (editorRef.current) {
        try {
          // Dispose Monaco Editor to free up resources
          editorRef.current.dispose();
          editorRef.current = null;
        } catch (error) {
          console.warn('Error disposing Monaco Editor:', error);
        }
      }
    };
  }, []);

  // Calculate scaled sizes based on zoom level
  const zoomScale = fontSize / 14; // 14px is the default
  const scaledFontSize = `${fontSize}px`;
  const scaledSmallFontSize = `${Math.round(fontSize * 0.85)}px`;
  const scaledTinyFontSize = `${Math.round(fontSize * 0.75)}px`;

  return (
    <div 
      className={`${isFullscreen ? 'fixed inset-0 z-50' : 'h-full'} bg-midnight-900 flex flex-col`}
      style={{ fontSize: scaledFontSize }}
    >
      {/* Header */}
      <div className="bg-midnight-800 border-b border-midnight-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-white font-medium" style={{ fontSize: scaledFontSize }}>Code Editor</h3>
          {branch && (
            <span className="px-2 py-1 bg-electric text-midnight-900 rounded" style={{ fontSize: scaledSmallFontSize }}>
              {branch}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
            title="Toggle file explorer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </button>
          
          <div className="flex items-center space-x-1 border-l border-midnight-600 pl-2">
            <button
              onClick={zoomOut}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="Zoom out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
            </button>
            <span className="text-gray-500 min-w-[2rem] text-center" style={{ fontSize: scaledTinyFontSize }}>{fontSize}px</span>
            <button
              onClick={zoomIn}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="Zoom in"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </button>
            <button
              onClick={resetZoom}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="Reset zoom"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen (F11)"}
            >
              {isFullscreen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              )}
            </button>
          )}
          {isFullscreen && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
              title="Close editor"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar with Tabs */}
        {showSidebar && (
          <>
            <div 
              className="bg-midnight-800 border-r border-midnight-700 overflow-hidden flex flex-col"
              style={{ width: `${sidebarWidth}px`, minWidth: '200px', maxWidth: '500px' }}
            >
              {/* Panel Tabs */}
              <div className="flex border-b border-midnight-700">
                {[
                  { key: 'explorer', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z', title: 'Explorer' },
                  { key: 'activity', icon: 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', title: 'Activity' },
                  { key: 'search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', title: 'Search' },
                  { key: 'git', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4', title: 'Git' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActivePanel(tab.key as PanelType)}
                    className={`flex-1 p-2 font-medium transition-colors ${
                      activePanel === tab.key
                        ? 'bg-midnight-900 text-white border-b-2 border-electric'
                        : 'text-gray-400 hover:text-white hover:bg-midnight-700'
                    }`}
                    title={tab.title}
                  >
                    <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                    </svg>
                  </button>
                ))}
              </div>

              {/* Panel Header */}
              <div className="px-3 py-2 border-b border-midnight-700 bg-midnight-750">
                <h4 className="font-medium text-gray-400 uppercase" style={{ fontSize: scaledTinyFontSize }}>
                  {activePanel === 'explorer' && 'Explorer'}
                  {activePanel === 'activity' && 'Activity Log'}
                  {activePanel === 'search' && 'Search'}
                  {activePanel === 'git' && 'Source Control'}
                </h4>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto">
                {renderPanelContent()}
              </div>
            </div>

            {/* Resize Handle */}
            <div
              ref={resizeRef}
              className={`w-1 bg-midnight-700 hover:bg-electric cursor-col-resize transition-colors ${
                isResizing ? 'bg-electric' : ''
              }`}
              onMouseDown={handleMouseDown}
              title="Drag to resize panel"
            />
          </>
        )}

        {/* Editor Area */}
        <div className="flex-1 flex flex-col">
          {/* Tabs */}
          {openFiles.length > 0 && (
            <div className="bg-midnight-800 border-b border-midnight-700 flex items-center overflow-x-auto">
              {openFiles.map(file => (
                <div
                  key={file.path}
                  className={`flex items-center px-3 py-2 border-r border-midnight-700 cursor-pointer min-w-0 ${
                    activeFile === file.path ? 'bg-midnight-900 text-white' : 'text-gray-400 hover:bg-midnight-700'
                  }`}
                  onClick={() => setActiveFile(file.path)}
                >
                  <span className="truncate max-w-xs" style={{ fontSize: scaledSmallFontSize }}>{file.name}</span>
                  {file.isDirty && (
                    <span className="ml-1 text-electric">•</span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeFile(file.path);
                    }}
                    className="ml-2 p-0.5 hover:bg-midnight-600 rounded"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Monaco Editor */}
          <div className="flex-1">
            {activeFileContent ? (
              <Editor
                key={activeFileContent.path} // Ensures proper remounting for different files
                theme="vs-dark"
                language={activeFileContent.language}
                value={activeFileContent.content}
                onChange={handleEditorChange}
                onMount={(editor) => {
                  editorRef.current = editor;
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: fontSize,
                  lineNumbers: 'on',
                  rulers: [80, 120],
                  wordWrap: 'off',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                      d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  <p style={{ fontSize: `${fontSize + 4}px` }}>No file open</p>
                  <p className="mt-2" style={{ fontSize: scaledSmallFontSize }}>Select a file from the explorer to start editing</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};