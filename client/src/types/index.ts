// Core domain types for CoVibe application
// Updated to match actual server API structure

export interface User {
  id: string;
  name: string; // Server uses 'name', not 'userName'
  email: string;
  teamId: string;
  createdAt?: string;
}

export interface Team {
  id: string;
  name: string; // Server uses 'name', not 'teamName'
  inviteCode: string;
  vmIp?: string;
  sshKeyPath?: string;
  repositoryUrl?: string;
  createdAt?: string;
  users?: User[];
}

export interface Agent {
  id: string;
  task: string; // Server uses 'task', not 'name'
  status: 'starting' | 'running' | 'completed' | 'failed' | 'killed';
  agentType: 'claude' | 'mock'; // Server uses 'agentType'
  type: string; // Added for compatibility with existing components
  teamId: string;
  userId: string;
  startedAt: string; // Server uses 'startedAt'
  completedAt?: string;
  vmInstance?: string;
  lastActivity?: string;
  agentName?: string; // Random generated name like "Alice Code" or "Bob Debug"
  mode?: 'terminal' | 'chat'; // Agent interface mode
  // Container information
  container?: ContainerInfo;
}

// Container information interface
export interface ContainerInfo {
  containerId: string;
  status: 'starting' | 'running' | 'stopped' | 'error' | 'creating';
  terminalPort?: number;
  previewPort?: number;
  proxyUrl?: string;
  createdAt: string;
  resources?: ContainerResources;
  environment?: Record<string, string>;
}

// Container resource information
export interface ContainerResources {
  memory: string; // e.g., '2GB', '1GB'
  cpu: string;    // e.g., '1.0', '0.5'
  memoryUsage?: number; // Current memory usage in bytes
  cpuUsage?: number;    // Current CPU usage percentage
}

export interface ChatMessage {
  id?: string;
  content?: string;
  message?: string;  // Support both content and message properties
  userId: string;
  userName: string;
  teamId: string;
  timestamp: string;
  type?: 'user' | 'system' | 'agent';
}

export interface AgentOutput {
  agentId: string;
  output: string; // Server uses 'output', not 'content'
  timestamp: Date;
  userId: string;
  userName: string;
}

export interface VMStatus {
  connected: boolean; // Server returns boolean, not string
  ip?: string;
  message?: string;
  lastCheck?: string;
}

// API Request/Response types updated to match server structure
export interface ApiResponse<T = any> {
  success?: boolean; // Server doesn't always include this
  data?: T;
  error?: string;
  message?: string;
}

// Server uses email/password login, not teamName/userName
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  teamName: string;
  userName: string;
  email: string;
  password: string;
}

// Updated to match server auth response
export interface AuthResponse {
  token: string;
  user: User;
  team: Team;
  message: string;
}

// Server uses task-based agent creation
export interface SpawnAgentRequest {
  task: string; // Required to match API service
  agentType?: 'claude' | 'mock';
  terminalLocation?: 'local' | 'remote';
  terminalIsolation?: 'none' | 'docker' | 'tmux';
  mode?: 'terminal' | 'chat';
  containerOptions?: ContainerSpawnOptions;
}

// Container spawn options
export interface ContainerSpawnOptions {
  resources?: {
    memory: string; // '2GB', '1GB', etc.
    cpu: string;    // '1.0', '0.5', etc.
  };
  environment?: Record<string, string>;
  workspaceMount?: boolean; // Whether to mount shared workspace
}

// VM Configuration types
export interface VMConfigRequest {
  ip: string;
  sshKeyPath: string;
}

// Repository configuration
export interface RepositoryConfigRequest {
  repositoryUrl: string;
}

// Join team request
export interface JoinTeamRequest {
  inviteCode: string;
  userName: string;
  email: string;
  password: string;
}

// WebSocket event types based on actual server implementation
export interface SocketEvents {
  // Client to server events
  auth: (data: { token: string }) => void;
  chat_message_send: (data: { content: string }) => void;
  typing_start: () => void;
  typing_stop: () => void;
  agent_input: (data: { agentId: string; input: string }) => void;
  refresh_preview: () => void;
  user_activity_send: (data: { activity: string }) => void;
  container_action: (data: { containerId: string; action: 'start' | 'stop' | 'restart' }) => void;
  
  // Server to client events
  auth_success: (data: { user: User; team: Team }) => void;
  auth_error: (data: { message: string; error?: string }) => void;
  user_online: (user: User) => void;
  user_offline: (data: { id: string; name: string }) => void;
  online_users: (users: User[]) => void;
  chat_message: (message: ChatMessage) => void;
  user_typing: (data: { userId: string; userName: string }) => void;
  user_stop_typing: (data: { userId: string }) => void;
  agent_started: (agent: { id: string; userId: string; userName: string; task: string; status: string; startedAt: string; container?: ContainerInfo }) => void;
  agent_output: (output: AgentOutput) => void;
  agent_completed: (data: { agentId: string; status: string; error?: string; userId: string; userName: string }) => void;
  agent_input_sent: (data: { agentId: string; input: string; userId: string; userName: string }) => void;
  preview_updated: (data: { triggeredBy: string; timestamp: Date }) => void;
  user_activity: (data: { userId: string; userName: string; activity?: string; timestamp?: string }) => void;
  error: (data: { message: string; error?: string }) => void;
  // Container-specific events
  container_status: (data: ContainerStatusEvent) => void;
  container_resource_update: (data: ContainerResourceEvent) => void;
  container_logs: (data: ContainerLogEvent) => void;
}

// Container-specific event interfaces
export interface ContainerStatusEvent {
  containerId: string;
  agentId?: string;
  status: 'starting' | 'running' | 'stopped' | 'error' | 'creating';
  timestamp: string;
  message?: string;
  error?: string;
}

export interface ContainerResourceEvent {
  containerId: string;
  agentId?: string;
  resources: {
    memoryUsage: number;
    cpuUsage: number;
    networkRx: number;
    networkTx: number;
    diskUsage: number;
  };
  timestamp: string;
}

export interface ContainerLogEvent {
  containerId: string;
  agentId?: string;
  log: string;
  timestamp: string;
  level: 'info' | 'error' | 'warn' | 'debug';
}

// Enhanced types for better type safety
export interface AgentDetails extends Agent {
  userName: string;
  agentName?: string; // Ensure it's included in detailed view
  output?: Array<{ timestamp: string; line: string }>;
  outputLines: number;
  isOwner: boolean;
}

// Error handling
export interface ApiError {
  status: number;
  message: string;
  data?: any;
}

// Component prop types
export interface ComponentProps {
  className?: string;
  children?: React.ReactNode;
}

// Form validation types
export interface ValidationError {
  field: string;
  message: string;
}

// Loading states
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
  total?: number;
}

// Common utility types
export type Status = 'idle' | 'loading' | 'success' | 'error';
export type Theme = 'light' | 'dark' | 'system';
export type Environment = 'development' | 'production' | 'test';

// Grid Tile interface for workspace management
export interface GridTile {
  id: string;
  type: 'terminal' | 'chat' | 'preview' | 'ide' | 'agentchat';
  agentId?: string | undefined; // For terminal tiles - explicit undefined for exactOptionalPropertyTypes
  title: string;
  minimized?: boolean | undefined; // Explicit undefined for exactOptionalPropertyTypes
}

// Re-export types moved to avoid circular dependencies
// Use direct imports from services instead if needed