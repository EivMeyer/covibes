import axios, { type AxiosInstance, type AxiosError } from 'axios';
import type {
  RegisterRequest,
  Agent,
  Team,
  User,
} from '@/types';

// Local type definitions to avoid unused import errors
// Commented out as unused but may be needed later
// type ApiResponse<T = any> = {
//   success?: boolean;
//   data?: T;
//   error?: string;
//   message?: string;
// };

// type LoginRequest = {
//   email: string;
//   password: string;
// };

// type AuthResponse = {
//   token: string;
//   user: User;
//   team: Team;
//   message: string;
// };

// Enhanced API types based on actual server implementation
export interface JoinTeamRequest {
  inviteCode: string;
  userName: string;
  email: string;
  password: string;
}

export interface SpawnAgentRequest {
  task: string;
  agentType?: 'mock' | 'claude';
}

export interface VMConfigRequest {
  ip: string;
  sshKeyPath: string;
}

export interface RepositoryConfigRequest {
  repositoryUrl: string;
}

export interface AuthUser extends User {
  hasVMConfig: boolean;
}

export interface AuthTeam extends Team {
  inviteCode: string;
  repositoryUrl?: string;
}

export interface EnhancedAuthResponse {
  token: string;
  user: AuthUser;
  team: AuthTeam;
  message: string;
}

export interface AgentDetails extends Agent {
  userName: string;
  output?: Array<{ timestamp: string; line: string }>;
  outputLines: number;
  isOwner: boolean;
}

// API Error handling
export class ApiError extends Error {
  public status: number;
  public data?: any;
  public response?: any;
  public details?: string;
  
  constructor(status: number, message: string, data?: any, response?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.response = response;
    
    // In dev mode, add detailed debugging info
    if (import.meta.env.DEV) {
      this.details = JSON.stringify({
        status,
        message,
        data,
        timestamp: new Date().toISOString(),
      }, null, 2);
    }
  }

  static fromAxiosError(error: AxiosError): ApiError {
    const status = error.response?.status || 500;
    const data = error.response?.data as any;
    const message = data?.message || data?.error || error.message || 'Unknown error';
    
    // Log full error in dev mode
    if (import.meta.env.DEV) {
      console.error('API Error Details:', {
        status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        method: error.config?.method,
        data,
        headers: error.response?.headers,
      });
    }
    
    return new ApiError(status, message, data, error.response);
  }
}

class ApiService {
  private api: AxiosInstance;

  private authTokenKey = 'colabvibe_auth_token';

  constructor() {
    this.api = axios.create({
      baseURL: '/api',
      timeout: 30000, // Increased timeout for agent operations
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - add auth token and logging
    this.api.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        
        return config;
      },
      (error) => {
        console.error('API Request Error:', error);
        return Promise.reject(ApiError.fromAxiosError(error));
      }
    );

    // Response interceptor - handle errors and logging
    this.api.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        const apiError = ApiError.fromAxiosError(error);
        
        // Handle authentication errors
        if (apiError.status === 401) {
          this.clearToken();
          // Don't redirect - let React handle auth state changes
          // The useAuth hook will detect the cleared token and show login page
          console.log('Authentication failed - token cleared');
        }
        
        // Log API errors
        console.error(`API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
          status: apiError.status,
          message: apiError.message,
          data: apiError.data,
        });
        
        return Promise.reject(apiError);
      }
    );
  }

  // Token management methods
  private getToken(): string | null {
    return localStorage.getItem(this.authTokenKey);
  }

  // Public getter for axios instance (for components that need direct access)
  get axiosInstance(): AxiosInstance {
    return this.api;
  }

  private setToken(token: string): void {
    localStorage.setItem(this.authTokenKey, token);
  }

  private clearToken(): void {
    localStorage.removeItem(this.authTokenKey);
  }

  // Auth endpoints - Updated to match server API structure
  async login(credentials: { email: string; password: string }): Promise<EnhancedAuthResponse> {
    try {
      const response = await this.api.post<EnhancedAuthResponse>('/auth/login', credentials);
      this.setToken(response.data.token);
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  async register(userData: RegisterRequest): Promise<EnhancedAuthResponse> {
    try {
      const response = await this.api.post<EnhancedAuthResponse>('/auth/register', userData);
      this.setToken(response.data.token);
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  async joinTeam(joinData: JoinTeamRequest): Promise<EnhancedAuthResponse> {
    try {
      const response = await this.api.post<EnhancedAuthResponse>('/auth/join', joinData);
      this.setToken(response.data.token);
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  async completeGitHubSignup(data: {
    action: 'create_team' | 'join_team';
    teamName?: string;
    inviteCode?: string;
  }): Promise<EnhancedAuthResponse> {
    try {
      const response = await this.api.post<EnhancedAuthResponse>('/auth/github/complete', data);
      this.setToken(response.data.token);
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  // GitHub Repository endpoints
  async getGitHubRepositories(params?: { 
    type?: string; 
    sort?: string; 
    per_page?: number; 
    page?: number 
  }): Promise<any> {
    try {
      const response = await this.api.get('/github/repositories', { params });
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  async searchGitHubRepositories(query: string, params?: { 
    per_page?: number; 
    page?: number 
  }): Promise<any> {
    try {
      const response = await this.api.get('/github/search', { 
        params: { q: query, ...params } 
      });
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  async getGitHubRepository(owner: string, repo: string): Promise<any> {
    try {
      const response = await this.api.get(`/github/repository/${owner}/${repo}`);
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  async setTeamRepository(repositoryUrl: string): Promise<any> {
    try {
      const response = await this.api.post('/github/set-team-repository', { repositoryUrl });
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  async checkGitHubStatus(): Promise<{ 
    connected: boolean; 
    githubUsername?: string; 
    avatarUrl?: string 
  }> {
    try {
      const response = await this.api.get('/github/status');
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  async getCurrentUser(): Promise<{ user: AuthUser; team: AuthTeam }> {
    try {
      const response = await this.api.get<{ user: AuthUser; team: AuthTeam }>('/auth/me');
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  async refreshToken(): Promise<{ token: string; message: string }> {
    try {
      const response = await this.api.post<{ token: string; message: string }>('/auth/refresh');
      this.setToken(response.data.token);
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  async logout(): Promise<void> {
    this.clearToken();
    // In a real app, you might want to call a logout endpoint
    // await this.api.post('/auth/logout');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // Team endpoints - Updated to match server structure
  async configureRepository(data: RepositoryConfigRequest): Promise<{ message: string; team: AuthTeam }> {
    try {
      const response = await this.api.post<{ message: string; team: AuthTeam }>('/team/configure-repository', data);
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  // Agent endpoints - Updated to match server structure
  async getAgents(): Promise<{ agents: AgentDetails[] }> {
    try {
      const response = await this.api.get<{ agents: AgentDetails[] }>('/agents');
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  async getAgentDetails(agentId: string): Promise<{ agent: AgentDetails }> {
    try {
      const response = await this.api.get<{ agent: AgentDetails }>(`/agents/${agentId}`);
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  async spawnAgent(agentData: SpawnAgentRequest): Promise<{ message: string; agent: AgentDetails }> {
    try {
      const response = await this.api.post<{ message: string; agent: AgentDetails }>('/agents/spawn', agentData);
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  async killAgent(agentId: string): Promise<{ message: string; agentId: string }> {
    try {
      const response = await this.api.delete<{ message: string; agentId: string }>(`/agents/${agentId}`);
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  async deleteAllAgents(): Promise<{ message: string; deletedCount: number }> {
    try {
      const response = await this.api.delete<{ message: string; deletedCount: number }>('/agents');
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  // Workspace endpoints
  async getWorkspace(): Promise<any> {
    try {
      const response = await this.api.get('/workspace/config');
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  async updateWorkspace(data: any): Promise<any> {
    try {
      const response = await this.api.put('/workspace/config', data);
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  async clearWorkspace(): Promise<any> {
    try {
      const response = await this.api.delete('/workspace/config');
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  async sendInputToAgent(agentId: string, input: string): Promise<{ message: string }> {
    try {
      const response = await this.api.post<{ message: string }>(`/agents/${agentId}/input`, { input });
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  async sendSignalToAgent(agentId: string, signal: string): Promise<{ message: string }> {
    try {
      const response = await this.api.post<{ message: string }>(`/agents/${agentId}/signal`, { signal });
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  // VM endpoints - Updated to match server structure
  async configureVM(vmData: VMConfigRequest): Promise<{ message: string }> {
    try {
      const response = await this.api.post<{ message: string }>('/vm/configure', vmData);
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  async testVMConnection(vmData: VMConfigRequest): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.api.post<{ success: boolean; message: string }>('/vm/test', vmData);
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  async getVMStatus(): Promise<{ connected: boolean; ip?: string; message?: string }> {
    try {
      const response = await this.api.get<{ connected: boolean; ip?: string; message?: string }>('/vm/status');
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }

  // Health check endpoint
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      const response = await this.api.get<{ status: string; timestamp: string }>('/health');
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : ApiError.fromAxiosError(error as AxiosError);
    }
  }
}

export const apiService = new ApiService();