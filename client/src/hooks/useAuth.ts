import { useState, useEffect, useCallback } from 'react';
import { apiService, ApiError, type AuthUser, type AuthTeam, type JoinTeamRequest } from '@/services/api';
import type { RegisterRequest } from '@/types';

interface AuthState {
  user: AuthUser | null;
  team: AuthTeam | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthHook extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  joinTeam: (joinData: JoinTeamRequest) => Promise<void>;
  refreshToken: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  getCurrentUser: () => Promise<void>;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    team: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Initialize authentication state
  const initializeAuth = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    if (!apiService.isAuthenticated()) {
      setState({
        user: null,
        team: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      return;
    }

    try {
      const userData = await apiService.getCurrentUser();
      setState({
        user: userData.user,
        team: userData.team,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      // Token might be invalid, clear it
      await apiService.logout();
      setState({
        user: null,
        team: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  }, []);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const login = async (credentials: LoginCredentials): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const authResponse = await apiService.login(credentials);
      setState({
        user: authResponse.user,
        team: authResponse.team,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      let errorMessage = 'Login failed';
      
      if (error instanceof ApiError) {
        errorMessage = error.message;
        // In dev mode, include more details
        if (import.meta.env.DEV && error.details) {
          console.log('Login error details:', error.details);
        }
      }
      
      setState({
        user: null,
        team: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });
      throw error;
    }
  };

  const register = async (userData: RegisterRequest): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const authResponse = await apiService.register(userData);
      setState({
        user: authResponse.user,
        team: authResponse.team,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : 'Registration failed';
      setState({
        user: null,
        team: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });
      throw error;
    }
  };

  const joinTeam = async (joinData: JoinTeamRequest): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const authResponse = await apiService.joinTeam(joinData);
      setState({
        user: authResponse.user,
        team: authResponse.team,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : 'Failed to join team';
      setState({
        user: null,
        team: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });
      throw error;
    }
  };

  const refreshToken = async (): Promise<void> => {
    if (!apiService.isAuthenticated()) {
      return;
    }

    try {
      await apiService.refreshToken();
      // Refresh user data after token refresh
      await getCurrentUser();
    } catch (error) {
      console.error('Failed to refresh token:', error);
      // Token refresh failed, force logout
      await logout();
      throw error;
    }
  };

  const getCurrentUser = async (): Promise<void> => {
    if (!apiService.isAuthenticated()) {
      return;
    }

    try {
      const userData = await apiService.getCurrentUser();
      setState(prev => ({
        ...prev,
        user: userData.user,
        team: userData.team,
        isAuthenticated: true,
        error: null,
      }));
    } catch (error) {
      console.error('Failed to get current user:', error);
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout error (non-critical):', error);
    } finally {
      setState({
        user: null,
        team: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  };

  const clearError = (): void => {
    setState(prev => ({ ...prev, error: null }));
  };

  return {
    ...state,
    login,
    register,
    joinTeam,
    refreshToken,
    logout,
    clearError,
    getCurrentUser,
  };
}

// Helper function to decode JWT token (client-side only, not for security)
export function decodeJWT(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT format');
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

// Helper to check if token is expired
export function isTokenExpired(token: string): boolean {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) return true;
  
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}