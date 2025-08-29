import { useEffect, useRef, useCallback, useState } from 'react';
import { apiService } from '@/services/api';
import { useSocket } from './useSocket';

interface WorkspaceData {
  tiles: any[];
  layouts: any;
  sidebarWidth: number;
}

interface WorkspaceUpdateEvent {
  tiles?: any[];
  layouts?: any;
  sidebarWidth?: number;
  updatedBy: string;
  timestamp: string;
}

interface DragEvent {
  tileId: string;
  position?: { x: number; y: number };
  draggedBy: string;
  timestamp: string;
}

interface DragMoveEvent {
  tileId: string;
  position: { x: number; y: number };
  draggedBy: string;
  timestamp: string;
}

interface DragStopEvent {
  tileId: string;
  finalPosition?: { x: number; y: number; w: number; h: number };
  draggedBy: string;
  timestamp: string;
}

interface TileAddEvent {
  type: string;
  title: string;
  position?: { x: number; y: number; w: number; h: number };
  addedBy: string;
  timestamp: string;
}

interface TileRemoveEvent {
  tileId: string;
  removedBy: string;
  timestamp: string;
}

export const useTeamWorkspaceSync = (token: string | null) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDrags, setActiveDrags] = useState<Map<string, { draggedBy: string; position?: { x: number; y: number } }>>(new Map());
  
  const { socket, connected } = useSocket(token);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>('');
  const pendingChangesRef = useRef<Partial<WorkspaceData>>({});
  const currentWorkspaceRef = useRef<WorkspaceData>({ tiles: [], layouts: {}, sidebarWidth: 256 });

  // Event handlers for workspace updates
  const [onWorkspaceUpdated, setOnWorkspaceUpdated] = useState<((data: WorkspaceUpdateEvent) => void) | null>(null);
  const [onDragStarted, setOnDragStarted] = useState<((data: DragEvent) => void) | null>(null);
  const [onDragMoved, setOnDragMoved] = useState<((data: DragMoveEvent) => void) | null>(null);
  const [onDragStopped, setOnDragStopped] = useState<((data: DragStopEvent) => void) | null>(null);
  const [onTileAdded, setOnTileAdded] = useState<((data: TileAddEvent) => void) | null>(null);
  const [onTileRemoved, setOnTileRemoved] = useState<((data: TileRemoveEvent) => void) | null>(null);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleWorkspaceUpdated = (data: WorkspaceUpdateEvent) => {
      onWorkspaceUpdated?.(data);
    };

    const handleDragStarted = (data: DragEvent) => {
      setActiveDrags(prev => new Map(prev.set(data.tileId, { draggedBy: data.draggedBy, position: data.position })));
      onDragStarted?.(data);
    };

    const handleDragMoved = (data: DragMoveEvent) => {
      setActiveDrags(prev => {
        const newMap = new Map(prev);
        const current = newMap.get(data.tileId);
        if (current && current.draggedBy === data.draggedBy) {
          newMap.set(data.tileId, { ...current, position: data.position });
        }
        return newMap;
      });
      onDragMoved?.(data);
    };

    const handleDragStopped = (data: DragStopEvent) => {
      setActiveDrags(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.tileId);
        return newMap;
      });
      onDragStopped?.(data);
    };

    const handleTileAdded = (data: TileAddEvent) => {
      onTileAdded?.(data);
    };

    const handleTileRemoved = (data: TileRemoveEvent) => {
      onTileRemoved?.(data);
    };

    // Register event listeners
    socket.on('workspace-updated', handleWorkspaceUpdated);
    socket.on('workspace-drag-started', handleDragStarted);
    socket.on('workspace-drag-moved', handleDragMoved);
    socket.on('workspace-drag-stopped', handleDragStopped);
    socket.on('workspace-tile-added', handleTileAdded);
    socket.on('workspace-tile-removed', handleTileRemoved);

    // Cleanup
    return () => {
      socket.off('workspace-updated', handleWorkspaceUpdated);
      socket.off('workspace-drag-started', handleDragStarted);
      socket.off('workspace-drag-moved', handleDragMoved);
      socket.off('workspace-drag-stopped', handleDragStopped);
      socket.off('workspace-tile-added', handleTileAdded);
      socket.off('workspace-tile-removed', handleTileRemoved);
    };
  }, [socket, onWorkspaceUpdated, onDragStarted, onDragMoved, onDragStopped, onTileAdded, onTileRemoved]);

  // Load workspace from server
  const loadWorkspace = useCallback(async (retryCount = 0): Promise<WorkspaceData | null> => {
    if (!token) {
      setLoading(false);
      return null;
    }

    try {
      const workspace = await apiService.getWorkspace();
      
      // Update current workspace reference
      currentWorkspaceRef.current = {
        tiles: workspace.tiles || [],
        layouts: workspace.layouts || {},
        sidebarWidth: workspace.sidebarWidth || 256
      };
      
      setError(null);
      return workspace;
    } catch (err: any) {
      console.error(`Failed to load team workspace (attempt ${retryCount + 1}):`, err);
      
      // Check if it's an auth error (don't retry)
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Authentication failed - please log in again');
        setLoading(false);
        return null;
      }
      
      // Retry on network errors
      if (retryCount < 2 && (err.code === 'ECONNABORTED' || err.response?.status >= 500)) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return loadWorkspace(retryCount + 1);
      }
      
      setError('Failed to load team workspace configuration');
      // Return default values on error
      return {
        tiles: [],
        layouts: {},
        sidebarWidth: 256
      };
    } finally {
      if (retryCount === 0) { // Only set loading false on the initial call
        setLoading(false);
      }
    }
  }, [token]);

  // Save workspace to server with real-time sync
  const saveWorkspace = useCallback((data: Partial<WorkspaceData>) => {
    if (!token) {
      console.warn('❌ No token available for workspace save');
      return;
    }
    
    if (!socket || !connected) {
      console.warn('❌ Socket not connected, skipping real-time sync');
      // Still save to database even if socket is not connected
    }

    // Accumulate pending changes
    Object.assign(pendingChangesRef.current, data);

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce saves to avoid too many API calls and socket events
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        // Get all accumulated changes
        const accumulatedData = { ...pendingChangesRef.current };
        
        // Clear pending changes since we're about to save them
        pendingChangesRef.current = {};
        
        // Update current workspace reference with accumulated data
        if (accumulatedData.tiles) {
          currentWorkspaceRef.current.tiles = accumulatedData.tiles;
        }
        if (accumulatedData.layouts) {
          currentWorkspaceRef.current.layouts = accumulatedData.layouts;
        }
        if (accumulatedData.sidebarWidth !== undefined) {
          currentWorkspaceRef.current.sidebarWidth = accumulatedData.sidebarWidth;
        }
        
        // Merge the accumulated data with current workspace state
        const mergedData = {
          ...currentWorkspaceRef.current,
          ...accumulatedData
        };
        
        const dataStr = JSON.stringify(mergedData);
        // Skip if data hasn't changed
        if (dataStr === lastSavedRef.current) {
          return;
        }

        // Update database via HTTP API using apiService
        const response = await apiService.updateWorkspace(mergedData);

        if (response) {
          lastSavedRef.current = dataStr;
          setError(null);

          // Broadcast update to team members via WebSocket (if connected)
          if (socket && connected) {
            socket.emit('workspace-update', mergedData);
          }
        }
      } catch (err: any) {
        console.error('❌ Failed to save workspace:', err);
        
        if (err.response?.status === 401 || err.response?.status === 403) {
          setError('Authentication failed - please log in again');
        } else {
          setError('Failed to save workspace configuration');
        }
      }
    }, 500); // 500ms debounce for better responsiveness
  }, [token, socket, connected]);

  // Emit drag events
  const emitDragStart = useCallback((tileId: string, position?: { x: number; y: number }) => {
    if (socket && connected) {
      socket.emit('workspace-drag-start', { tileId, position });
    }
  }, [socket, connected]);

  const emitDragMove = useCallback((tileId: string, position: { x: number; y: number }) => {
    if (socket && connected) {
      socket.emit('workspace-drag-move', { tileId, position });
    }
  }, [socket, connected]);

  const emitDragStop = useCallback((tileId: string, finalPosition?: { x: number; y: number; w: number; h: number }) => {
    if (socket && connected) {
      socket.emit('workspace-drag-stop', { tileId, finalPosition });
    }
  }, [socket, connected]);

  // Emit tile events
  const emitTileAdd = useCallback((type: string, title: string, position?: { x: number; y: number; w: number; h: number }) => {
    if (socket && connected) {
      socket.emit('workspace-tile-add', { type, title, position });
    }
  }, [socket, connected]);

  const emitTileRemove = useCallback((tileId: string) => {
    if (socket && connected) {
      socket.emit('workspace-tile-remove', { tileId });
    }
  }, [socket, connected]);

  // Clear workspace
  const clearWorkspace = useCallback(async () => {
    if (!token) return;

    try {
      await apiService.clearWorkspace();
      setError(null);
    } catch (err) {
      console.error('Failed to clear team workspace:', err);
      setError('Failed to clear team workspace configuration');
    }
  }, [token]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Register event handlers
  const registerEventHandlers = useCallback((handlers: {
    onWorkspaceUpdated?: (data: WorkspaceUpdateEvent) => void;
    onDragStarted?: (data: DragEvent) => void;
    onDragMoved?: (data: DragMoveEvent) => void;
    onDragStopped?: (data: DragStopEvent) => void;
    onTileAdded?: (data: TileAddEvent) => void;
    onTileRemoved?: (data: TileRemoveEvent) => void;
  }) => {
    setOnWorkspaceUpdated(() => handlers.onWorkspaceUpdated || null);
    setOnDragStarted(() => handlers.onDragStarted || null);
    setOnDragMoved(() => handlers.onDragMoved || null);
    setOnDragStopped(() => handlers.onDragStopped || null);
    setOnTileAdded(() => handlers.onTileAdded || null);
    setOnTileRemoved(() => handlers.onTileRemoved || null);
  }, []);

  return {
    loadWorkspace,
    saveWorkspace,
    clearWorkspace,
    registerEventHandlers,
    emitDragStart,
    emitDragMove,
    emitDragStop,
    emitTileAdd,
    emitTileRemove,
    activeDrags,
    loading,
    error,
    connected
  };
};