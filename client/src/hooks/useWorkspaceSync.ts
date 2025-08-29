import { useEffect, useRef, useCallback, useState } from 'react';
import axios from 'axios';

interface WorkspaceData {
  tiles: any[];
  layouts: any;
  sidebarWidth: number;
}

// Use environment variable for backend URL with proper API path
const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_BASE_URL = `${backendUrl}/api`;

export const useWorkspaceSync = (token: string | null) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>('');

  // Load workspace from server
  const loadWorkspace = useCallback(async (): Promise<WorkspaceData | null> => {
    if (!token) {
      setLoading(false);
      return null;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/workspace/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const workspace = response.data;
      console.log('Loaded workspace from server:', workspace);
      setError(null);
      return workspace;
    } catch (err) {
      console.error('Failed to load workspace:', err);
      setError('Failed to load workspace configuration');
      // Return default values on error
      return {
        tiles: [],
        layouts: {},
        sidebarWidth: 256
      };
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Save workspace to server (debounced)
  const saveWorkspace = useCallback((data: Partial<WorkspaceData>) => {
    if (!token) return;

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce saves to avoid too many API calls
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const dataStr = JSON.stringify(data);
        // Skip if data hasn't changed
        if (dataStr === lastSavedRef.current) {
          return;
        }

        const response = await axios.put(
          `${API_BASE_URL}/workspace/config`,
          data,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        if (response.status === 200) {
          lastSavedRef.current = dataStr;
          console.log('Workspace saved to server');
          setError(null);
        }
      } catch (err) {
        console.error('Failed to save workspace:', err);
        setError('Failed to save workspace configuration');
      }
    }, 1000); // 1 second debounce
  }, [token]);

  // Clear workspace
  const clearWorkspace = useCallback(async () => {
    if (!token) return;

    try {
      await axios.delete(`${API_BASE_URL}/workspace/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Workspace cleared');
      setError(null);
    } catch (err) {
      console.error('Failed to clear workspace:', err);
      setError('Failed to clear workspace configuration');
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

  return {
    loadWorkspace,
    saveWorkspace,
    clearWorkspace,
    loading,
    error
  };
};